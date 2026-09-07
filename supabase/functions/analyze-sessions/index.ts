import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface SessionRow {
  start_time: string;
  end_time: string | null;
  duration_seconds: number;
  rating: number | null;
  goal_id: string;
  trigger: string;
}

interface GoalRow {
  id: string;
  name: string;
  type: string;
}

interface InsightCacheRow {
  insight: string;
  status: "ready" | "insufficient_data";
  generated_at: string;
}

const INSIGHT_CACHE_MS = 24 * 60 * 60 * 1000;
const MANUAL_REFRESH_LIMIT = 3;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  try {
    let force = false;
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
      force = (body as { force?: boolean } | null)?.force === true;
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
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { data: cachedInsight, error: cacheReadError } = await supabase
      .from("insight_cache")
      .select("insight, status, generated_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (cacheReadError) throw cacheReadError;

    const cached = cachedInsight as InsightCacheRow | null;
    const cachedAt = cached ? Date.parse(cached.generated_at) : Number.NaN;
    if (
      !force &&
      cached &&
      Number.isFinite(cachedAt) &&
      Date.now() - cachedAt < INSIGHT_CACHE_MS
    ) {
      return jsonResponse({
        ...cached,
        refreshes_remaining: null,
        cached: true,
      });
    }

    let refreshesRemaining: number | null = null;
    if (force) {
      const { data: quotaRows, error: quotaError } = await supabase.rpc(
        "consume_insight_refresh_quota",
        {
          p_user_id: userId,
          p_limit: MANUAL_REFRESH_LIMIT,
        },
      );
      if (quotaError) throw quotaError;

      const quota = (
        quotaRows as Array<{ allowed: boolean; remaining: number }> | null
      )?.[0];
      if (!quota?.allowed) {
        return jsonResponse(
          {
            error: "Daily refresh limit reached.",
            code: "INSIGHT_REFRESH_LIMIT",
            refreshes_remaining: 0,
          },
          429,
        );
      }
      refreshesRemaining = quota.remaining;
    }

    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

    const [sessionsResult, goalsResult] = await Promise.all([
      supabase
        .from("sessions")
        .select("start_time, end_time, duration_seconds, rating, goal_id, trigger")
        .eq("user_id", userId)
        .gte("start_time", fourWeeksAgo.toISOString())
        .not("end_time", "is", null)
        .order("start_time", { ascending: false }),
      supabase
        .from("goals")
        .select("id, name, type")
        .eq("user_id", userId)
        .eq("is_active", true),
    ]);

    const sessions = (sessionsResult.data ?? []) as SessionRow[];
    const goals = (goalsResult.data ?? []) as GoalRow[];
    if (sessionsResult.error) throw sessionsResult.error;
    if (goalsResult.error) throw goalsResult.error;

    const ratedSessions = sessions.filter((s) => s.rating !== null && s.rating > 0);
    if (ratedSessions.length < 5) {
      const generatedAt = new Date().toISOString();
      const insight =
        "Complete a few more rated sessions to unlock personal patterns.";
      const { error: cacheWriteError } = await supabase
        .from("insight_cache")
        .upsert(
          {
            user_id: userId,
            insight,
            status: "insufficient_data",
            generated_at: generatedAt,
            updated_at: generatedAt,
          },
          { onConflict: "user_id" },
        );
      if (cacheWriteError) throw cacheWriteError;

      return jsonResponse({
        insight,
        status: "insufficient_data",
        generated_at: generatedAt,
        refreshes_remaining: refreshesRemaining,
      });
    }

    const goalMap = new Map(goals.map((g) => [g.id, g]));
    const insights: string[] = [];

    // Analyze rating by time of day
    if (ratedSessions.length >= 5) {
      const hourBuckets: Record<string, { total: number; count: number }> = {
        morning: { total: 0, count: 0 },
        afternoon: { total: 0, count: 0 },
        evening: { total: 0, count: 0 },
      };

      for (const s of ratedSessions) {
        const hour = new Date(s.start_time).getHours();
        const bucket = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
        hourBuckets[bucket].total += s.rating!;
        hourBuckets[bucket].count += 1;
      }

      let bestPeriod = "";
      let bestAvg = 0;
      for (const [period, data] of Object.entries(hourBuckets)) {
        if (data.count >= 2) {
          const avg = data.total / data.count;
          if (avg > bestAvg) {
            bestAvg = avg;
            bestPeriod = period;
          }
        }
      }

      if (bestPeriod && bestAvg >= 3.5) {
        insights.push(
          `Your highest-rated sessions tend to happen in the ${bestPeriod} (avg ${bestAvg.toFixed(1)}/5).`
        );
      }
    }

    // Analyze consistency by day of week
    const dayCount: Record<number, number> = {};
    for (const s of sessions) {
      const day = new Date(s.start_time).getDay();
      dayCount[day] = (dayCount[day] ?? 0) + 1;
    }

    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const sortedDays = Object.entries(dayCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 2);

    if (sortedDays.length >= 2) {
      const topDays = sortedDays.map(([d]) => dayNames[parseInt(d)]);
      insights.push(
        `You've been most consistent on ${topDays[0]} and ${topDays[1]} — consider protecting those time blocks.`
      );
    }

    // Analyze physical vs focus pattern
    const physicalSessions = sessions.filter(
      (s) => s.trigger === "geofence" || s.trigger === "manual_checkin",
    );
    const focusSessions = sessions.filter((s) => s.trigger === "manual_pomodoro");
    const ratedPhysicalSessions = physicalSessions.filter((s) => s.rating !== null);
    const ratedFocusSessions = focusSessions.filter((s) => s.rating !== null);

    // Never interpret "no ratings" as a zero-star average. Each side needs a
    // minimally useful rated sample before a comparison is shown.
    if (ratedPhysicalSessions.length >= 2 && ratedFocusSessions.length >= 2) {
      const physicalAvgRating =
        ratedPhysicalSessions.reduce((sum, s) => sum + (s.rating ?? 0), 0) /
        ratedPhysicalSessions.length;

      const focusAvgRating =
        ratedFocusSessions.reduce((sum, s) => sum + (s.rating ?? 0), 0) /
        ratedFocusSessions.length;

      if (Math.abs(physicalAvgRating - focusAvgRating) >= 0.5) {
        const better = physicalAvgRating > focusAvgRating ? "physical" : "focus";
        insights.push(
          `Your ${better} sessions are rated ${Math.abs(physicalAvgRating - focusAvgRating).toFixed(1)} points higher on average than your ${better === "physical" ? "focus" : "physical"} sessions.`
        );
      }
    }

    // Analyze session after rest
    for (const s of ratedSessions) {
      const sessionTime = new Date(s.start_time).getTime();
      const precedingSessions = sessions.filter((ps) => {
        const psEnd = ps.end_time ? new Date(ps.end_time).getTime() : 0;
        const gap = sessionTime - psEnd;
        return gap > 0 && gap < 3 * 60 * 60 * 1000;
      });

      if (precedingSessions.length > 0) {
        const goal = goalMap.get(s.goal_id);
        const preceding = goalMap.get(precedingSessions[0].goal_id);
        if (goal && preceding && goal.id !== preceding.id) {
          const similarSessions = ratedSessions.filter(
            (rs) =>
              rs.goal_id === s.goal_id &&
              rs.rating !== null &&
              sessions.some((ps) => {
                const psEnd = ps.end_time ? new Date(ps.end_time).getTime() : 0;
                const rsStart = new Date(rs.start_time).getTime();
                return ps.goal_id === preceding.id && rsStart - psEnd > 0 && rsStart - psEnd < 3 * 60 * 60 * 1000;
              })
          );

          if (similarSessions.length >= 3) {
            const avgAfter = similarSessions.reduce((sum, rs) => sum + (rs.rating ?? 0), 0) / similarSessions.length;
            if (avgAfter >= 4) {
              insights.push(
                `${goal.name} sessions after ${preceding.name} are rated ${avgAfter.toFixed(1)}/5 on average.`
              );
              break;
            }
          }
        }
      }
    }

    if (insights.length === 1) {
      insights.push("Keep rating sessions so the pattern becomes more reliable.");
    }
    const insightText = insights.length > 0
      ? insights.slice(0, 3).join(" ")
      : "Your recent sessions do not show one dominant pattern yet. Keep logging and rating them as you go.";
    const generatedAt = new Date().toISOString();
    const { error: cacheWriteError } = await supabase
      .from("insight_cache")
      .upsert(
        {
          user_id: userId,
          insight: insightText,
          status: "ready",
          generated_at: generatedAt,
          updated_at: generatedAt,
        },
        { onConflict: "user_id" },
      );
    if (cacheWriteError) throw cacheWriteError;

    return jsonResponse({
      insight: insightText,
      status: "ready",
      generated_at: generatedAt,
      refreshes_remaining: refreshesRemaining,
    });
  } catch (err) {
    console.error("Analysis error:", err);
    return jsonResponse({ error: "Unable to generate insights at this time." }, 500);
  }
});
