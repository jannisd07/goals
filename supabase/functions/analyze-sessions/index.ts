/**
 * Stats insight: one or two calm sentences about the selected goal, computed by
 * the same deterministic pattern engine as the coach notifications.
 *
 * No model is involved and nothing is cached here, so a session logged a minute
 * ago already counts; the client keeps the answer for a few minutes.
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import {
  buildStatsInsight,
  detectCoachPatterns,
  timeZoneClock,
  type CoachGoal,
  type CoachSession,
} from "../_shared/coachPatterns.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Upper bound on history read per user. Years of use stay well below this. */
const MAX_SESSIONS = 2000;

/** Abuse ceiling, not a product limit: normal refreshes stay far below this. */
const REQUESTS_PER_MINUTE = 10;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function parseOffset(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  // Real offsets span UTC-12:00 to UTC+14:00.
  return Math.max(-720, Math.min(840, Math.round(n)));
}

function parseTimeZone(value: unknown): string | null {
  return typeof value === "string" && value.length <= 64 && /^[A-Za-z0-9_+\-/]+$/.test(value)
    ? value
    : null;
}

function parseGoalId(value: unknown): string | null {
  return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value) ? value : null;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  try {
    let goalId: string | null = null;
    let timeZone: string | null = null;
    let utcOffsetMinutes = 0;
    try {
      const body = await req.json();
      if (
        body !== null &&
        (typeof body !== "object" ||
          Array.isArray(body) ||
          ("force" in body && typeof (body as { force?: unknown }).force !== "boolean"))
      ) {
        return jsonResponse({ error: "Invalid request body." }, 400);
      }
      const input = (body ?? {}) as {
        goal_id?: unknown;
        time_zone?: unknown;
        utc_offset_minutes?: unknown;
      };
      goalId = parseGoalId(input.goal_id);
      timeZone = parseTimeZone(input.time_zone);
      utcOffsetMinutes = parseOffset(input.utc_offset_minutes);
    } catch {
      return jsonResponse({ error: "A JSON request body is required." }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      return jsonResponse({ error: "Server not configured." }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Missing authorization header." }, 401);
    }

    // The Authorization header only reaches PostgREST. `getUser()` without an
    // argument reads the client's own (empty) session, so the JWT must be passed
    // explicitly or every caller is rejected as unauthenticated.
    const accessToken = authHeader.replace(/^Bearer\s+/i, "").trim();
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser(accessToken);
    if (userError || !userData.user) {
      return jsonResponse({ error: "Unauthorized." }, 401);
    }

    const userId = userData.user.id;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });

    // Every call reads up to MAX_SESSIONS rows and clusters them, so a valid
    // token must not be able to loop it. The client refetches at most every few
    // minutes; this ceiling is far above normal use and only catches abuse.
    const { data: quota, error: quotaError } = await supabase.rpc(
      "consume_insight_rate_slot",
      { p_user_id: userId, p_limit: REQUESTS_PER_MINUTE, p_window_seconds: 60 },
    );
    if (quotaError) {
      console.error("Insight rate limit check failed:", quotaError.message);
      return jsonResponse({ error: "Unable to generate insights at this time." }, 503);
    }
    const quotaRow = Array.isArray(quota) ? quota[0] : quota;
    if (quotaRow?.allowed !== true) {
      return jsonResponse(
        { error: "Too many insight requests. Please try again shortly." },
        429,
      );
    }

    const [goalsResult, sessionsResult] = await Promise.all([
      supabase
        .from("goals")
        .select("id, name, type, is_active, target_sessions_per_week, target_hours_per_week")
        .eq("user_id", userId),
      supabase
        .from("sessions")
        .select("start_time, end_time, duration_seconds, rating, goal_id, trigger")
        .eq("user_id", userId)
        .not("end_time", "is", null)
        .order("start_time", { ascending: false })
        .limit(MAX_SESSIONS),
    ]);
    if (goalsResult.error) throw goalsResult.error;
    if (sessionsResult.error) throw sessionsResult.error;

    const goals = (goalsResult.data ?? []) as CoachGoal[];
    const sessions = (sessionsResult.data ?? []) as CoachSession[];
    const patterns = detectCoachPatterns(sessions, goals, {
      clock: timeZoneClock(timeZone, utcOffsetMinutes),
    });
    const result = buildStatsInsight(sessions, goals, patterns, goalId);

    return jsonResponse({
      insight: result.insight,
      status: result.status,
      goal_id: result.goalId,
      generated_at: new Date().toISOString(),
      refreshes_remaining: null,
    });
  } catch (err) {
    console.error("Analysis error:", err);
    return jsonResponse({ error: "Unable to generate insights at this time." }, 500);
  }
});
