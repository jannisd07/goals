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
/** A one-time nudge planned for today needs at least this much notice. */
export const MIN_ONCE_LEAD_MINUTES = 10;
/**
 * Calendar days before the same one-time advice may fire again. Without this a
 * one-time nudge rescheduled on every app start would behave like a daily one.
 */
export const ONCE_COOLDOWN_DAYS: Record<string, number> = {
  weekly_target: 1,
  overdue: 3,
  dormant: 7,
  best_time: 14,
  trend: 21,
};
const DEFAULT_ONCE_COOLDOWN_DAYS = 7;
const DELIVERY_LOG_RETENTION_MS = 60 * 86_400_000;

export type NudgeTiming = "weekly" | "once";

export interface CoachNudge {
  kind: string;
  goalId: string;
  /** 0 = Sunday … 6 = Saturday, or null when the nudge is not day-specific. */
  weekday: number | null;
  hour: number | null;
  /** "weekly" repeats on `weekday`; "once" fires a single time. */
  timing: NudgeTiming;
  /** After this instant the advice is outdated and must not fire. */
  expiresAt: string | null;
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
  /** 0 = Sunday … 6 = Saturday, or null for a one-time nudge. */
  weekday: number | null;
  hour: number;
  minute: number;
}

/** When each one-time nudge was last planned to fire (epoch ms), by `onceNudgeKey`. */
export type NudgeDeliveryLog = Record<string, number>;

export type PlannedNudgeTrigger =
  | { type: "weekly"; weekday: number; hour: number; minute: number }
  | { type: "date"; date: Date };

export interface PlannedCoachNotification {
  key: string;
  nudge: CoachNudge;
  trigger: PlannedNudgeTrigger;
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

    const rawWeekday = isFiniteInt(entry.weekday) ? Math.round(entry.weekday) : null;
    const rawHour = isFiniteInt(entry.hour) ? Math.round(entry.hour) : null;
    const weekday = rawWeekday !== null && rawWeekday >= 0 && rawWeekday <= 6 ? rawWeekday : null;
    // Entries cached before `timing` existed repeated weekly exactly when they
    // had a weekday. A weekly nudge without a day cannot repeat, so it fires once.
    const timing: NudgeTiming =
      entry.timing === "once" || weekday === null
        ? "once"
        : entry.timing === "weekly" || entry.timing === undefined
          ? "weekly"
          : "once";
    const expiresAt =
      typeof entry.expiresAt === "string" && Number.isFinite(Date.parse(entry.expiresAt))
        ? entry.expiresAt
        : null;

    nudges.push({
      kind: typeof entry.kind === "string" ? entry.kind : "unknown",
      goalId: typeof entry.goalId === "string" ? entry.goalId : "",
      weekday,
      hour: rawHour !== null && rawHour >= 0 && rawHour <= 23 ? rawHour : null,
      timing,
      expiresAt,
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

/**
 * Nudges worth scheduling, capped so it never nags. The server already orders
 * them by importance (a missed weekly target before a nice-to-know trend), and
 * confidence values of different kinds are not comparable, so order is kept.
 */
export function selectNudges(nudges: CoachNudge[]): CoachNudge[] {
  return nudges
    .filter((n) => n.confidence >= MIN_NUDGE_CONFIDENCE)
    .slice(0, MAX_SCHEDULED_NUDGES);
}

export function onceNudgeKey(nudge: Pick<CoachNudge, "kind" | "goalId">): string {
  return `${nudge.kind}:${nudge.goalId}`;
}

function localDayIndex(date: Date): number {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
}

/** Next moment a one-time nudge may fire: today if there is still time, else tomorrow. */
export function nextOnceFireDate(nudge: CoachNudge, now: Date): Date {
  const { hour, minute } = nudgeSchedule(nudge);
  const fire = new Date(now.getTime());
  fire.setHours(hour, minute, 0, 0);
  if (fire.getTime() < now.getTime() + MIN_ONCE_LEAD_MINUTES * 60_000) {
    fire.setDate(fire.getDate() + 1);
  }
  return fire;
}

/**
 * Turns nudges into concrete triggers. Habit reminders repeat weekly; all other
 * advice fires once and then respects a cooldown, so the same sentence is not
 * repeated every time the app starts. Returns the updated delivery log.
 */
export function planCoachNotifications(
  nudges: CoachNudge[],
  now: Date,
  log: NudgeDeliveryLog,
): { planned: PlannedCoachNotification[]; log: NudgeDeliveryLog } {
  const nowMs = now.getTime();
  const nextLog: NudgeDeliveryLog = {};
  for (const [key, at] of Object.entries(log)) {
    if (Number.isFinite(at) && nowMs - at < DELIVERY_LOG_RETENTION_MS) nextLog[key] = at;
  }

  const planned: PlannedCoachNotification[] = [];
  for (const nudge of selectNudges(nudges)) {
    if (nudge.timing === "weekly" && nudge.weekday !== null) {
      const when = nudgeSchedule(nudge);
      planned.push({
        key: `weekly:${nudge.kind}:${nudge.goalId}:${nudge.weekday}`,
        nudge,
        trigger: { type: "weekly", weekday: nudge.weekday, hour: when.hour, minute: when.minute },
      });
      continue;
    }

    const key = onceNudgeKey(nudge);
    const last = nextLog[key];
    let fire: Date;
    if (last !== undefined && last > nowMs) {
      // Already planned for later: keep that moment, only the copy is refreshed.
      fire = new Date(last);
    } else {
      const cooldownDays = ONCE_COOLDOWN_DAYS[nudge.kind] ?? DEFAULT_ONCE_COOLDOWN_DAYS;
      if (last !== undefined && localDayIndex(now) - localDayIndex(new Date(last)) < cooldownDays) {
        continue;
      }
      fire = nextOnceFireDate(nudge, now);
    }

    const expires = nudge.expiresAt ? Date.parse(nudge.expiresAt) : Number.NaN;
    if (Number.isFinite(expires) && fire.getTime() >= expires) continue;

    nextLog[key] = fire.getTime();
    planned.push({ key, nudge, trigger: { type: "date", date: fire } });
  }

  return { planned, log: nextLog };
}
