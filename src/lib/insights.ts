import type { Session } from "../types";

/** Shorter sessions are usually accidental taps or abandoned starts. */
const MIN_INSIGHT_SESSION_SECONDS = 5 * 60;

/**
 * Local heuristic insight — one calm sentence derived from the user's own data.
 * Presented without any "AI" framing (per product decision). Only shown when
 * the `analyze-sessions` pattern insight cannot be loaded.
 */
export function computeLocalInsight(
  sessions: Session[],
  physical = false,
): string | null {
  const completed = sessions.filter(
    (s) => s.end_time && s.duration_seconds >= MIN_INSIGHT_SESSION_SECONDS,
  );
  if (completed.length < 4) return null;

  const bucketSeconds = { morning: 0, afternoon: 0, evening: 0 };
  const weekdaySeconds = new Array(7).fill(0) as number[];
  let ratedSum = 0;
  let ratedCount = 0;
  let eveningRated = 0;
  let eveningRatedCount = 0;

  for (const s of completed) {
    const start = new Date(s.start_time);
    const hour = start.getHours();
    const bucket = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
    const contribution = physical ? 1 : s.duration_seconds;
    bucketSeconds[bucket] += contribution;
    weekdaySeconds[(start.getDay() + 6) % 7] += contribution;
    if (s.rating != null) {
      ratedSum += s.rating;
      ratedCount += 1;
      if (bucket === "evening") {
        eveningRated += s.rating;
        eveningRatedCount += 1;
      }
    }
  }

  const total = bucketSeconds.morning + bucketSeconds.afternoon + bucketSeconds.evening;
  if (total === 0) return null;

  const bucketLabel: Record<string, string> = {
    morning: "in the morning",
    afternoon: "in the afternoon",
    evening: "in the evening",
  };
  const [topBucket, topSeconds] = (Object.entries(bucketSeconds) as [string, number][])
    .sort((a, b) => b[1] - a[1])[0];
  const share = Math.round((topSeconds / total) * 100);

  if (eveningRatedCount >= 3 && ratedCount >= 5) {
    const eveningAvg = eveningRated / eveningRatedCount;
    const overallAvg = ratedSum / ratedCount;
    if (eveningAvg - overallAvg >= 0.5) {
      return "Your evening sessions feel best — plan the hard work after dinner.";
    }
  }

  if (share >= 55) {
    return physical
      ? `Most of your visits happen ${bucketLabel[topBucket]} — ${share}% of this month's check-ins.`
      : `Most of your focus happens ${bucketLabel[topBucket]} — ${share}% of your hours. Protect that window.`;
  }

  const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const bestDay = weekdaySeconds.indexOf(Math.max(...weekdaySeconds));
  if (weekdaySeconds[bestDay] > 0) {
    return physical
      ? `${dayNames[bestDay]} is your most consistent check-in day.`
      : `${dayNames[bestDay]} is your strongest focus day this month.`;
  }

  return null;
}
