import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

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

serve(async (req: Request) => {
  try {
    const { user_id } = await req.json();
    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id required" }), { status: 400 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

    const [sessionsResult, goalsResult] = await Promise.all([
      supabase
        .from("sessions")
        .select("start_time, end_time, duration_seconds, rating, goal_id, trigger")
        .eq("user_id", user_id)
        .gte("start_time", fourWeeksAgo.toISOString())
        .not("end_time", "is", null)
        .order("start_time", { ascending: false }),
      supabase
        .from("goals")
        .select("id, name, type")
        .eq("user_id", user_id)
        .eq("is_active", true),
    ]);

    const sessions = (sessionsResult.data ?? []) as SessionRow[];
    const goals = (goalsResult.data ?? []) as GoalRow[];

    if (sessions.length < 5) {
      return new Response(
        JSON.stringify({ insight: "Complete more sessions to unlock personalized insights." }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    const goalMap = new Map(goals.map((g) => [g.id, g]));
    const insights: string[] = [];

    // Analyze rating by time of day
    const ratedSessions = sessions.filter((s) => s.rating !== null && s.rating > 0);
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
    const physicalSessions = sessions.filter((s) => s.trigger === "geofence");
    const focusSessions = sessions.filter((s) => s.trigger === "manual_pomodoro");

    if (physicalSessions.length >= 3 && focusSessions.length >= 3) {
      const physicalAvgRating = physicalSessions
        .filter((s) => s.rating !== null)
        .reduce((sum, s) => sum + (s.rating ?? 0), 0) /
        Math.max(1, physicalSessions.filter((s) => s.rating !== null).length);

      const focusAvgRating = focusSessions
        .filter((s) => s.rating !== null)
        .reduce((sum, s) => sum + (s.rating ?? 0), 0) /
        Math.max(1, focusSessions.filter((s) => s.rating !== null).length);

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

    const insightText = insights.length > 0
      ? insights.slice(0, 3).join(" ")
      : "Keep logging sessions — insights will appear as patterns emerge.";

    return new Response(
      JSON.stringify({ insight: insightText }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Analysis error:", err);
    return new Response(
      JSON.stringify({ insight: "Unable to generate insights at this time." }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
});
