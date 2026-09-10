/**
 * Personal coach: finds long-term patterns in a user's own history and returns
 * ready-to-schedule notification copy.
 *
 * How API calls are kept low, in order of effect:
 *  1. Patterns are computed deterministically. No pattern, no model call.
 *  2. Counters that change daily (weekly progress, days since the last session)
 *     are never sent to the model; they always use deterministic wording.
 *  3. Copy for the remaining patterns is cached against a fingerprint of their
 *     numbers and reused for `CACHE_TTL_DAYS` while those stay the same.
 *  4. One request writes every nudge for the user at once.
 *  5. A hard per-user daily budget caps the worst case.
 *  6. Any failure falls back to deterministic wording instead of retrying.
 *
 * The client schedules the returned nudges as local notifications, so no push
 * infrastructure and no server-side cron are involved.
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import {
  detectCoachPatterns,
  patternFingerprint,
  selectNotificationPatterns,
  timeZoneClock,
  type CoachGoal,
  type CoachSession,
} from "../_shared/coachPatterns.ts";
import {
  DEFAULT_GROQ_MODEL,
  fallbackNudges,
  hasWritablePatterns,
  reuseCachedNudges,
  writeNudges,
  type CoachNudge,
} from "../_shared/coachWriter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Cached wording stays valid this long while the patterns are unchanged. */
const CACHE_TTL_DAYS = 14;
/** Model calls one user may cause per UTC day, however often the app opens. */
const DAILY_MODEL_CALL_LIMIT = 1;
/** Upper bound on history read per user. Years of use stay well below this. */
const MAX_SESSIONS = 2000;

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

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  try {
    let utcOffsetMinutes = 0;
    let timeZone: string | null = null;
    try {
      const body = await req.json();
      if (body !== null && (typeof body !== "object" || Array.isArray(body))) {
        return jsonResponse({ error: "Invalid request body." }, 400);
      }
      const input = (body ?? {}) as { utc_offset_minutes?: unknown; time_zone?: unknown };
      utcOffsetMinutes = parseOffset(input.utc_offset_minutes);
      timeZone = parseTimeZone(input.time_zone);
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
    const user = userData?.user;
    if (userError || !user) {
      return jsonResponse({ error: "Invalid session." }, 401);
    }

    const admin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });

    // --- 1. Read the full history, not just recent weeks ---------------------
    const [{ data: goalRows, error: goalError }, { data: sessionRows, error: sessionError }] =
      await Promise.all([
        admin
          .from("goals")
          .select("id, name, type, is_active, target_sessions_per_week, target_hours_per_week")
          .eq("user_id", user.id),
        admin
          .from("sessions")
          .select("start_time, end_time, duration_seconds, rating, goal_id, trigger")
          .eq("user_id", user.id)
          .not("end_time", "is", null)
          .order("start_time", { ascending: false })
          .limit(MAX_SESSIONS),
      ]);

    if (goalError || sessionError) {
      console.error("coach-nudges load failed:", goalError ?? sessionError);
      return jsonResponse({ error: "Could not load your history." }, 500);
    }

    const goals = (goalRows ?? []) as CoachGoal[];
    const sessions = (sessionRows ?? []) as CoachSession[];

    // --- 2. Detect patterns. This is the gate for every model call ------------
    const patterns = selectNotificationPatterns(
      detectCoachPatterns(sessions, goals, { clock: timeZoneClock(timeZone, utcOffsetMinutes) }),
    );
    if (patterns.length === 0) {
      return jsonResponse({
        status: "insufficient_data",
        nudges: [],
        source: "none",
        sessions_analyzed: sessions.length,
      });
    }

    const fingerprint = patternFingerprint(patterns);
    const writable = hasWritablePatterns(patterns);

    // --- 3. Reuse cached wording while the stable advice is unchanged ---------
    if (writable) {
      const { data: cached } = await admin
        .from("coach_nudge_cache")
        .select("fingerprint, nudges, model_written, generated_at")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cached) {
        const row = cached as {
          fingerprint: string;
          nudges: CoachNudge[];
          model_written: boolean;
          generated_at: string;
        };
        const ageMs = Date.now() - Date.parse(row.generated_at);
        const fresh = Number.isFinite(ageMs) && ageMs < CACHE_TTL_DAYS * 86_400_000;
        // Fallback copy is worth upgrading later; model-written copy is not.
        if (row.fingerprint === fingerprint && fresh && row.model_written && Array.isArray(row.nudges)) {
          return jsonResponse({
            status: "ready",
            // Volatile nudges are rebuilt from today's numbers on every call.
            nudges: reuseCachedNudges(patterns, row.nudges),
            source: "cache",
            generated_at: row.generated_at,
            sessions_analyzed: sessions.length,
          });
        }
      }
    }

    // --- 4. Budget check, then exactly one request for the whole set ---------
    const apiKey = Deno.env.get("GROQ_API_KEY") ?? null;
    const model = Deno.env.get("GROQ_MODEL") ?? DEFAULT_GROQ_MODEL;

    let nudges: CoachNudge[];
    let usedModel = false;
    let source = "fallback";

    if (!apiKey || !writable) {
      nudges = fallbackNudges(patterns);
    } else {
      const { data: quota, error: quotaError } = await admin.rpc(
        "consume_coach_nudge_quota",
        { p_user_id: user.id, p_limit: DAILY_MODEL_CALL_LIMIT },
      );
      const allowed = !quotaError && Array.isArray(quota) && quota[0]?.allowed === true;
      if (!allowed) {
        nudges = fallbackNudges(patterns);
        source = "budget_reached";
      } else {
        const result = await writeNudges(patterns, apiKey, model);
        nudges = result.nudges;
        usedModel = result.usedModel;
        source = result.usedModel ? "model" : "fallback";
        if (result.error) {
          console.warn("coach-nudges model call failed:", result.error);
        }
      }
    }

    const generatedAt = new Date().toISOString();
    if (writable) {
      const { error: cacheError } = await admin.from("coach_nudge_cache").upsert(
        {
          user_id: user.id,
          fingerprint,
          nudges,
          model_written: usedModel,
          generated_at: generatedAt,
          updated_at: generatedAt,
        },
        { onConflict: "user_id" },
      );
      if (cacheError) {
        // A failed cache write only costs a future call; the answer is still good.
        console.warn("coach-nudges cache write failed:", cacheError);
      }
    }

    return jsonResponse({
      status: "ready",
      nudges,
      source,
      generated_at: generatedAt,
      sessions_analyzed: sessions.length,
    });
  } catch (error) {
    console.error("coach-nudges failed:", error);
    return jsonResponse({ error: "Could not build your coaching tips." }, 500);
  }
});
