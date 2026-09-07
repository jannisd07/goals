/**
 * Pure scheduling rules for coach nudges: what a nudge is, when it fires and
 * which ones are worth sending. No Expo imports, so the domain test suite can
 * cover this directly; `coachNudges.ts` adds the notification side on top.
 */

/** Never wake anyone before this hour, whatever the pattern says. */
export const EARLIEST_NUDGE_HOUR = 8;
/** Nor after this one. */
export const LATEST_NUDGE_HOUR = 21;
/** How far ahead of the usual start time the reminder lands. */
export const NUDGE_LEAD_MINUTES = 90;
/** Hour used for nudges that are not tied to a time of day. */
export const UNTIMED_NUDGE_HOUR = 10;
/** Weak patterns are not worth a notification. */
export const MIN_NUDGE_CONFIDENCE = 0.12;
export const MAX_SCHEDULED_NUDGES = 3;

export interface CoachNudge {
  kind: string;
  goalId: string;
  /** 0 = Sunday … 6 = Saturday, or null when the nudge is not day-specific. */
  weekday: number | null;
  hour: number | null;
  title: string;
  body: string;
  confidence: number;
  written: boolean;
}

export interface CoachNudgeResponse {
  status: "ready" | "insufficient_data";
  nudges: CoachNudge[];
  source: string;
  generatedAt: string | null;
  sessionsAnalyzed: number;
}

export interface NudgeSchedule {
  /** 0 = Sunday … 6 = Saturday. Null means "repeat daily is wrong, use once". */
  weekday: number | null;
  hour: number;
  minute: number;
}

function isFiniteInt(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Parses the Edge Function payload defensively; bad entries are dropped. */
export function parseCoachNudges(value: unknown): CoachNudgeResponse {
  const root = (value ?? {}) as Record<string, unknown>;
  const rawList = Array.isArray(root.nudges) ? root.nudges : [];
  const nudges: CoachNudge[] = [];

  for (const raw of rawList) {
    if (raw === null || typeof raw !== "object") continue;
    const entry = raw as Record<string, unknown>;
    const title = typeof entry.title === "string" ? entry.title.trim() : "";
    const body = typeof entry.body === "string" ? entry.body.trim() : "";
    if (title.length < 3 || body.length < 10) continue;

    const weekday = isFiniteInt(entry.weekday) ? Math.round(entry.weekday) : null;
    const hour = isFiniteInt(entry.hour) ? Math.round(entry.hour) : null;
    nudges.push({
      kind: typeof entry.kind === "string" ? entry.kind : "unknown",
      goalId: typeof entry.goalId === "string" ? entry.goalId : "",
      weekday: weekday !== null && weekday >= 0 && weekday <= 6 ? weekday : null,
      hour: hour !== null && hour >= 0 && hour <= 23 ? hour : null,
      title,
      body,
      confidence: isFiniteInt(entry.confidence)
        ? Math.max(0, Math.min(1, entry.confidence))
        : 0,
      written: entry.written === true,
    });
  }

  return {
    status: root.status === "ready" ? "ready" : "insufficient_data",
    nudges,
    source: typeof root.source === "string" ? root.source : "unknown",
    generatedAt: typeof root.generated_at === "string" ? root.generated_at : null,
    sessionsAnalyzed: isFiniteInt(root.sessions_analyzed) ? root.sessions_analyzed : 0,
  };
}

/**
 * When a nudge should fire: shortly before the user's usual start time, and
 * never at night. A nudge without an hour becomes a mid-morning reminder.
 */
export function nudgeSchedule(nudge: CoachNudge): NudgeSchedule {
  if (nudge.hour === null) {
    return { weekday: nudge.weekday, hour: UNTIMED_NUDGE_HOUR, minute: 0 };
  }
  const target = nudge.hour * 60 - NUDGE_LEAD_MINUTES;
  let hour = Math.floor(target / 60);
  let minute = ((target % 60) + 60) % 60;

  if (hour < EARLIEST_NUDGE_HOUR) {
    hour = EARLIEST_NUDGE_HOUR;
    minute = 0;
  } else if (hour > LATEST_NUDGE_HOUR) {
    hour = LATEST_NUDGE_HOUR;
    minute = 0;
  }
  return { weekday: nudge.weekday, hour, minute };
}

/** Nudges worth scheduling, strongest first, capped so it never nags. */
export function selectNudges(nudges: CoachNudge[]): CoachNudge[] {
  return [...nudges]
    .filter((n) => n.confidence >= MIN_NUDGE_CONFIDENCE)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, MAX_SCHEDULED_NUDGES);
}

