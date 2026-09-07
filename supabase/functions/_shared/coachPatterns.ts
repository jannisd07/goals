/**
 * Long-term pattern detection for the personal coach.
 *
 * Everything in this file is deterministic and runs without a model. The AI is
 * only ever asked to phrase a pattern that was already found and verified here,
 * which is what keeps the number of API calls low: no pattern, no call.
 *
 * Shared by the `coach-nudges` Edge Function and the domain test suite.
 */

export interface CoachSession {
  start_time: string;
  end_time: string | null;
  duration_seconds: number;
  rating: number | null;
  goal_id: string;
  trigger: string;
}

export interface CoachGoal {
  id: string;
  name: string;
  type: string;
}

export type PatternKind =
  | "best_slot"
  | "best_weekday"
  | "cadence_due"
  | "dormant"
  | "duration_trend"
  | "rating_trend";

export interface CoachPattern {
  kind: PatternKind;
  goalId: string;
  goalName: string;
  goalType: string;
  /** 0 = Sunday … 6 = Saturday, in the user's local time. Null when not tied to a day. */
  weekday: number | null;
  /** Local hour the sessions usually start. Null when not tied to a time. */
  hour: number | null;
  /** How much better this slot is than the goal's own average, 0–1. */
  confidence: number;
  sampleSize: number;
  /** Compact, already-computed numbers handed to the model. Never raw sessions. */
  facts: Record<string, string | number>;
  /** Used verbatim when the model is unavailable, so the feature never depends on it. */
  fallbackTitle: string;
  fallbackBody: string;
}

export const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/** A pattern needs this many sessions in total before it is trusted at all. */
export const MIN_SESSIONS_FOR_PATTERNS = 8;
/** A single weekday/hour slot needs this many sessions of its own. */
export const MIN_SESSIONS_PER_SLOT = 3;
/** Trends compare two halves and need a longer history than slot patterns. */
export const MIN_SESSIONS_FOR_TREND = 12;
export const MIN_TREND_SPAN_DAYS = 42;
/** Most nudges we ever hand to one user. Keeps a single AI call small. */
export const MAX_PATTERNS = 4;

interface Timed {
  session: CoachSession;
  startedAt: number;
  weekday: number;
  hour: number;
  minutes: number;
  rating: number | null;
}

function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function formatHour(hour: number): string {
  const period = hour < 12 ? "am" : "pm";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}${period}`;
}

function formatMinutes(minutes: number): string {
  const rounded = Math.round(minutes);
  if (rounded < 60) return `${rounded} min`;
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/**
 * Converts a UTC timestamp into the user's local wall clock.
 * `utcOffsetMinutes` comes from the device, because the server has no timezone.
 */
function toLocal(session: CoachSession, utcOffsetMinutes: number): Timed | null {
  const startedAt = Date.parse(session.start_time);
  if (!Number.isFinite(startedAt)) return null;
  if (!session.end_time) return null;
  const durationMinutes = session.duration_seconds / 60;
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return null;
  const local = new Date(startedAt + utcOffsetMinutes * 60_000);
  return {
    session,
    startedAt,
    weekday: local.getUTCDay(),
    hour: local.getUTCHours(),
    minutes: durationMinutes,
    rating: typeof session.rating === "number" ? session.rating : null,
  };
}

/**
 * Score of a group of sessions. Ratings are the honest signal when the user
 * supplies them; otherwise session length stands in for "this went well".
 */
function score(items: Timed[]): { value: number; usesRating: boolean } {
  const rated = items.filter((i) => i.rating !== null);
  if (rated.length >= Math.max(2, Math.ceil(items.length * 0.5))) {
    return { value: mean(rated.map((i) => i.rating as number)), usesRating: true };
  }
  return { value: mean(items.map((i) => i.minutes)), usesRating: false };
}

/** Relative advantage of a group over the goal's own baseline, clamped to 0–1. */
function advantage(groupValue: number, baseline: number): number {
  if (baseline <= 0) return 0;
  return Math.max(0, Math.min(1, (groupValue - baseline) / baseline));
}

function goalNoun(goal: CoachGoal): string {
  return goal.type === "physical" ? "visits" : "sessions";
}

/**
 * Finds every pattern worth telling the user about, strongest first.
 *
 * @param sessions Complete history, not just the recent weeks.
 * @param utcOffsetMinutes The device's offset, so weekday and hour are local.
 * @param now Injected for tests.
 */
export function detectCoachPatterns(
  sessions: CoachSession[],
  goals: CoachGoal[],
  utcOffsetMinutes: number,
  now: Date = new Date(),
): CoachPattern[] {
  const goalById = new Map(goals.map((g) => [g.id, g]));
  const patterns: CoachPattern[] = [];
  const nowMs = now.getTime();

  for (const goal of goals) {
    const items = sessions
      .filter((s) => s.goal_id === goal.id)
      .map((s) => toLocal(s, utcOffsetMinutes))
      .filter((i): i is Timed => i !== null)
      .sort((a, b) => a.startedAt - b.startedAt);

    if (items.length < MIN_SESSIONS_FOR_PATTERNS) continue;

    const baseline = score(items);
    const noun = goalNoun(goal);
    const spanDays = (items[items.length - 1].startedAt - items[0].startedAt) / 86_400_000;

    // --- Weekday + hour slot -------------------------------------------------
    const slots = new Map<string, Timed[]>();
    for (const item of items) {
      const key = `${item.weekday}-${item.hour}`;
      const bucket = slots.get(key);
      if (bucket) bucket.push(item);
      else slots.set(key, [item]);
    }
    let bestSlot: { items: Timed[]; value: number; weekday: number; hour: number } | null = null;
    for (const [key, bucket] of slots) {
      if (bucket.length < MIN_SESSIONS_PER_SLOT) continue;
      const value = score(bucket).value;
      if (!bestSlot || value > bestSlot.value) {
        const [weekday, hour] = key.split("-").map(Number);
        bestSlot = { items: bucket, value, weekday, hour };
      }
    }
    if (bestSlot) {
      const conf = advantage(bestSlot.value, baseline.value);
      if (conf >= 0.12) {
        const dayName = WEEKDAY_NAMES[bestSlot.weekday];
        const timeLabel = formatHour(bestSlot.hour);
        patterns.push({
          kind: "best_slot",
          goalId: goal.id,
          goalName: goal.name,
          goalType: goal.type,
          weekday: bestSlot.weekday,
          hour: bestSlot.hour,
          confidence: conf,
          sampleSize: bestSlot.items.length,
          facts: {
            goal: goal.name,
            weekday: dayName,
            time: timeLabel,
            measure: baseline.usesRating ? "average rating" : "average length",
            slot_value: baseline.usesRating
              ? `${round(bestSlot.value)}/5`
              : formatMinutes(bestSlot.value),
            usual_value: baseline.usesRating
              ? `${round(baseline.value)}/5`
              : formatMinutes(baseline.value),
            sessions_in_slot: bestSlot.items.length,
            history_days: Math.round(spanDays),
          },
          fallbackTitle: `${dayName} ${timeLabel} works for you`,
          fallbackBody: baseline.usesRating
            ? `Your ${dayName} ${timeLabel} ${noun} average ${round(bestSlot.value)}/5 versus ${round(baseline.value)}/5 otherwise. Worth trying today.`
            : `Your ${dayName} ${timeLabel} ${noun} run ${formatMinutes(bestSlot.value)} versus ${formatMinutes(baseline.value)} otherwise. Worth trying today.`,
        });
      }
    }

    // --- Weekday alone -------------------------------------------------------
    const byWeekday = new Map<number, Timed[]>();
    for (const item of items) {
      const bucket = byWeekday.get(item.weekday);
      if (bucket) bucket.push(item);
      else byWeekday.set(item.weekday, [item]);
    }
    let bestDay: { items: Timed[]; value: number; weekday: number } | null = null;
    for (const [weekday, bucket] of byWeekday) {
      if (bucket.length < MIN_SESSIONS_PER_SLOT) continue;
      const value = score(bucket).value;
      if (!bestDay || value > bestDay.value) bestDay = { items: bucket, value, weekday };
    }
    if (bestDay) {
      const conf = advantage(bestDay.value, baseline.value);
      // Only worth saying when the finer slot pattern did not already say it.
      const alreadyCovered = patterns.some(
        (p) => p.kind === "best_slot" && p.goalId === goal.id && p.weekday === bestDay?.weekday,
      );
      if (conf >= 0.15 && !alreadyCovered) {
        const dayName = WEEKDAY_NAMES[bestDay.weekday];
        const usualHour = Math.round(median(bestDay.items.map((i) => i.hour)));
        patterns.push({
          kind: "best_weekday",
          goalId: goal.id,
          goalName: goal.name,
          goalType: goal.type,
          weekday: bestDay.weekday,
          hour: usualHour,
          confidence: conf,
          sampleSize: bestDay.items.length,
          facts: {
            goal: goal.name,
            weekday: dayName,
            measure: baseline.usesRating ? "average rating" : "average length",
            day_value: baseline.usesRating
              ? `${round(bestDay.value)}/5`
              : formatMinutes(bestDay.value),
            usual_value: baseline.usesRating
              ? `${round(baseline.value)}/5`
              : formatMinutes(baseline.value),
            sessions_on_day: bestDay.items.length,
            history_days: Math.round(spanDays),
          },
          fallbackTitle: `${dayName} is your strongest day`,
          fallbackBody: baseline.usesRating
            ? `Across ${bestDay.items.length} ${dayName} ${noun} you average ${round(bestDay.value)}/5, above your usual ${round(baseline.value)}/5.`
            : `Across ${bestDay.items.length} ${dayName} ${noun} you average ${formatMinutes(bestDay.value)}, above your usual ${formatMinutes(baseline.value)}.`,
        });
      }
    }

    // --- Cadence: the rhythm is established and today is due -----------------
    const gaps: number[] = [];
    for (let i = 1; i < items.length; i += 1) {
      const gapDays = (items[i].startedAt - items[i - 1].startedAt) / 86_400_000;
      if (gapDays > 0.2) gaps.push(gapDays);
    }
    const daysSinceLast = (nowMs - items[items.length - 1].startedAt) / 86_400_000;
    if (gaps.length >= 5) {
      const typical = median(gaps);
      if (typical >= 0.8 && typical <= 14) {
        if (daysSinceLast >= typical * 1.6 && daysSinceLast <= 21) {
          patterns.push({
            kind: "cadence_due",
            goalId: goal.id,
            goalName: goal.name,
            goalType: goal.type,
            weekday: null,
            hour: Math.round(median(items.map((i) => i.hour))),
            confidence: Math.min(1, daysSinceLast / (typical * 3)),
            sampleSize: items.length,
            facts: {
              goal: goal.name,
              usual_gap_days: round(typical),
              days_since_last: round(daysSinceLast),
              total_sessions: items.length,
            },
            fallbackTitle: `${goal.name} is overdue`,
            fallbackBody: `You normally go every ${round(typical)} days. It has been ${Math.round(daysSinceLast)}.`,
          });
        } else if (daysSinceLast > 21 && daysSinceLast <= 120) {
          patterns.push({
            kind: "dormant",
            goalId: goal.id,
            goalName: goal.name,
            goalType: goal.type,
            weekday: null,
            hour: Math.round(median(items.map((i) => i.hour))),
            confidence: 0.5,
            sampleSize: items.length,
            facts: {
              goal: goal.name,
              days_since_last: Math.round(daysSinceLast),
              total_sessions: items.length,
              best_streak_note: `${items.length} ${noun} logged in total`,
            },
            fallbackTitle: `${goal.name} has been quiet`,
            fallbackBody: `${Math.round(daysSinceLast)} days since your last visit, after ${items.length} ${noun}. One short one restarts it.`,
          });
        }
      }
    }

    // --- Long-term trends: first half versus second half ---------------------
    if (items.length >= MIN_SESSIONS_FOR_TREND && spanDays >= MIN_TREND_SPAN_DAYS) {
      const half = Math.floor(items.length / 2);
      const older = items.slice(0, half);
      const newer = items.slice(half);

      const olderMinutes = mean(older.map((i) => i.minutes));
      const newerMinutes = mean(newer.map((i) => i.minutes));
      if (olderMinutes > 0) {
        const change = (newerMinutes - olderMinutes) / olderMinutes;
        // Only improvements become notifications. A decline is discouraging on a
        // lock screen and offers nothing to act on; it belongs in Stats instead.
        if (change >= 0.2) {
          const up = true;
          patterns.push({
            kind: "duration_trend",
            goalId: goal.id,
            goalName: goal.name,
            goalType: goal.type,
            weekday: null,
            hour: null,
            confidence: Math.min(1, Math.abs(change)),
            sampleSize: items.length,
            facts: {
              goal: goal.name,
              direction: up ? "longer" : "shorter",
              change_percent: Math.round(Math.abs(change) * 100),
              earlier_average: formatMinutes(olderMinutes),
              recent_average: formatMinutes(newerMinutes),
              history_days: Math.round(spanDays),
            },
            fallbackTitle: up
              ? `Your ${goal.name} ${noun} are getting longer`
              : `Your ${goal.name} ${noun} are getting shorter`,
            fallbackBody: `${formatMinutes(olderMinutes)} on average early on, ${formatMinutes(newerMinutes)} recently, over ${Math.round(spanDays)} days.`,
          });
        }
      }

      const olderRated = older.filter((i) => i.rating !== null);
      const newerRated = newer.filter((i) => i.rating !== null);
      if (olderRated.length >= 4 && newerRated.length >= 4) {
        const olderRating = mean(olderRated.map((i) => i.rating as number));
        const newerRating = mean(newerRated.map((i) => i.rating as number));
        const delta = newerRating - olderRating;
        if (delta >= 0.5) {
          const up = true;
          patterns.push({
            kind: "rating_trend",
            goalId: goal.id,
            goalName: goal.name,
            goalType: goal.type,
            weekday: null,
            hour: null,
            confidence: Math.min(1, Math.abs(delta) / 2),
            sampleSize: olderRated.length + newerRated.length,
            facts: {
              goal: goal.name,
              direction: up ? "better" : "worse",
              earlier_rating: `${round(olderRating)}/5`,
              recent_rating: `${round(newerRating)}/5`,
              history_days: Math.round(spanDays),
            },
            fallbackTitle: up
              ? `${goal.name} is feeling better lately`
              : `${goal.name} has been feeling harder`,
            fallbackBody: `Your ratings moved from ${round(olderRating)}/5 to ${round(newerRating)}/5 over ${Math.round(spanDays)} days.`,
          });
        }
      }
    }
  }

  // Overdue and dormant goals matter more than a nice-to-know trend.
  const priority: Record<PatternKind, number> = {
    cadence_due: 0,
    best_slot: 1,
    dormant: 2,
    best_weekday: 3,
    rating_trend: 4,
    duration_trend: 5,
  };
  patterns.sort((a, b) => {
    const byKind = priority[a.kind] - priority[b.kind];
    if (byKind !== 0) return byKind;
    return b.confidence - a.confidence;
  });

  // One nudge per goal and kind is plenty; more reads as nagging.
  const seen = new Set<string>();
  const unique: CoachPattern[] = [];
  for (const pattern of patterns) {
    const key = `${pattern.goalId}-${pattern.kind}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(pattern);
    if (unique.length >= MAX_PATTERNS) break;
  }
  void goalById;
  return unique;
}

/**
 * Stable fingerprint of the current advice. While this does not change, the
 * cached wording stays valid and no model call is made.
 */
export function patternFingerprint(patterns: CoachPattern[]): string {
  const parts = patterns.map((p) =>
    [
      p.kind,
      p.goalId,
      p.weekday ?? "-",
      p.hour ?? "-",
      // Bucket the confidence so tiny numeric drift does not force a new call.
      Math.round(p.confidence * 5),
      Math.round(p.sampleSize / 5),
    ].join(":"),
  );
  return parts.join("|") || "empty";
}
