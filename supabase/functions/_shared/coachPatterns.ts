/**
 * Long-term pattern detection for the personal coach and the Stats insight.
 *
 * Everything in this file is deterministic and runs without a model. The AI is
 * only ever asked to phrase a pattern that was already found and verified here,
 * which is what keeps the number of API calls low: no pattern, no call.
 *
 * Shared by the `coach-nudges` and `analyze-sessions` Edge Functions and the
 * domain test suite, so it stays import-free.
 *
 * Guards against the ways naive habit statistics mislead:
 *  - sessions under five minutes (taps, abandoned starts) are ignored;
 *  - weekday and hour come from the user's time zone per session, so daylight
 *    saving does not split one habit into two different hours;
 *  - habits cluster start times within a window instead of exact clock hours;
 *  - quality comparisons pull small groups towards the other sessions, so three
 *    lucky sessions do not become "your best day";
 *  - ratings and minutes are never mixed in one comparison;
 *  - inactive goals get no advice.
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
  /** Missing means active, so callers that do not load the flag keep working. */
  is_active?: boolean | null;
  target_sessions_per_week?: number | null;
  target_hours_per_week?: number | null;
}

export type PatternKind =
  | "weekly_target"
  | "overdue"
  | "dormant"
  | "usual_time"
  | "best_time"
  | "trend";

export type NudgeTiming = "weekly" | "once";

export interface CoachPattern {
  kind: PatternKind;
  goalId: string;
  goalName: string;
  goalType: string;
  /** 0 = Sunday … 6 = Saturday, in the user's local time. Null when not tied to a day. */
  weekday: number | null;
  /** Local hour the sessions usually start. Null when not tied to a time. */
  hour: number | null;
  /** "weekly" repeats on `weekday` (habit reminders); "once" fires a single time. */
  timing: NudgeTiming;
  /** After this instant the advice is outdated, for example once the week ends. */
  expiresAt: string | null;
  /** Strength within its kind, 0–1. Not comparable across kinds. */
  confidence: number;
  sampleSize: number;
  /** Numbers change daily (progress, days since): never cached as model copy. */
  volatile: boolean;
  /** Compact, already-computed numbers handed to the model. Never raw sessions. */
  facts: Record<string, string | number>;
  /** Used verbatim when the model is unavailable, so the feature never depends on it. */
  fallbackTitle: string;
  fallbackBody: string;
  /** One calm sentence for the Stats card. */
  statsText: string;
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

/** Shorter sessions are accidental taps or abandoned starts and are ignored. */
export const MIN_SESSION_MINUTES = 5;
/** Real sessions a goal needs before any habit, quality or trend pattern. */
export const MIN_SESSIONS_FOR_PATTERNS = 4;
/** Distinct dates on one weekday (and time window) before it counts as a habit. */
export const MIN_HABIT_OCCURRENCES = 3;
/** Start times this many minutes apart still count as "the same time". */
export const HABIT_WINDOW_MINUTES = 75;
/** A habit must have happened this recently to still be one. */
export const HABIT_RECENCY_DAYS = 42;
/** Share of that weekday's dates with a session, below which it is coincidence. */
export const MIN_HABIT_CONSISTENCY = 0.3;
/** Groups compared for quality need this many sessions on each side. */
export const MIN_GROUP_SESSIONS = 3;
/**
 * Pseudo-sessions at the other sessions' average added to a group before it is
 * compared, so three lucky sessions do not beat a long, stable baseline.
 */
export const SHRINKAGE_SESSIONS = 3;
/** Notifications handed to one user at most. Keeps a single AI call small. */
export const MAX_PATTERNS = 4;

/** Rating points a group must stay ahead by after shrinkage. */
const MIN_RATING_ADVANTAGE = 0.4;
/** Relative length advantage a group must keep after shrinkage. */
const MIN_LENGTH_ADVANTAGE = 0.2;
/** And in absolute minutes, so 6 against 5 minutes is not "longer". */
const MIN_LENGTH_ADVANTAGE_MINUTES = 10;
/** Days a quality comparison must span, so one busy week is not a pattern. */
const MIN_PATTERN_SPAN_DAYS = 21;
const DORMANT_AFTER_DAYS = 14;
const DORMANT_UNTIL_DAYS = 120;
const DAY_MS = 86_400_000;

const PARTS_OF_DAY = [
  { from: 0, to: 5 * 60, phrase: "late at night", adjective: "late-night" },
  { from: 5 * 60, to: 12 * 60, phrase: "in the morning", adjective: "morning" },
  { from: 12 * 60, to: 17 * 60, phrase: "in the afternoon", adjective: "afternoon" },
  { from: 17 * 60, to: 24 * 60, phrase: "in the evening", adjective: "evening" },
];

// ---------------------------------------------------------------------------
// Local time
// ---------------------------------------------------------------------------

/** A moment on the user's wall clock. */
export interface LocalTime {
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number;
  hour: number;
  minuteOfDay: number;
  /** Local calendar day as days since 1970-01-01, for gaps and week boundaries. */
  dayNumber: number;
}

export type LocalClock = (epochMs: number) => LocalTime;

function localTime(year: number, month: number, day: number, hour: number, minute: number): LocalTime {
  const dayNumber = Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
  // 1970-01-01 was a Thursday.
  const weekday = (((dayNumber + 4) % 7) + 7) % 7;
  return { weekday, hour, minuteOfDay: hour * 60 + minute, dayNumber };
}

/** Wall clock with one fixed UTC offset. Ignores daylight saving for older sessions. */
export function fixedOffsetClock(utcOffsetMinutes: number): LocalClock {
  return (epochMs) => {
    const shifted = new Date(epochMs + utcOffsetMinutes * 60_000);
    return localTime(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth() + 1,
      shifted.getUTCDate(),
      shifted.getUTCHours(),
      shifted.getUTCMinutes(),
    );
  };
}

/**
 * Wall clock for an IANA time zone, so a session from last winter keeps the hour
 * it really had. Falls back to the fixed offset when the zone is unknown.
 */
export function timeZoneClock(
  timeZone: string | null | undefined,
  fallbackOffsetMinutes = 0,
): LocalClock {
  if (!timeZone) return fixedOffsetClock(fallbackOffsetMinutes);
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      hour12: false,
      // hour12:false alone leaves midnight as hour 24 on some engines, and the
      // printed day may or may not be shifted with it. hourCycle "h23" pins
      // midnight to hour 0 so hour and date always describe the same day.
      hourCycle: "h23",
    });
  } catch {
    return fixedOffsetClock(fallbackOffsetMinutes);
  }
  return (epochMs) => {
    const parts: Record<string, number> = {};
    for (const part of formatter.formatToParts(new Date(epochMs))) {
      if (part.type !== "literal") parts[part.type] = Number(part.value);
    }
    // Some engines print midnight as hour 24 in 24-hour mode.
    return localTime(parts.year, parts.month, parts.day, (parts.hour ?? 0) % 24, parts.minute ?? 0);
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface Timed extends LocalTime {
  startedAt: number;
  minutes: number;
  rating: number | null;
}

interface GoalContext {
  goal: CoachGoal;
  /** Every finished session of the goal, including very short ones. */
  own: CoachSession[];
  /** Real sessions only, oldest first, on the user's wall clock. */
  items: Timed[];
  clock: LocalClock;
  today: LocalTime;
  now: Date;
  nouns: { one: string; many: string };
}

interface Habit {
  weekday: number;
  pattern: CoachPattern;
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

function formatHours(hours: number): string {
  return hours < 1 ? formatMinutes(hours * 60) : `${round(hours)}h`;
}

function hashText(text: string): string {
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

function distinctDays(items: Timed[]): number {
  return new Set(items.map((i) => i.dayNumber)).size;
}

function usualHour(items: Timed[]): number | null {
  if (items.length === 0) return null;
  // Rounding up would wrap a 23:30-23:59 habit to hour 0 and tell somebody who
  // always trains late at night to go "around 12am" — the wrong hour and the
  // wrong day. Truncating keeps the stated hour inside the block they train in.
  return Math.floor(median(items.map((i) => i.minuteOfDay)) / 60) % 24;
}

function isActiveGoal(goal: CoachGoal): boolean {
  return goal.is_active !== false;
}

export function isMeaningfulSession(session: CoachSession): boolean {
  return (
    Boolean(session.end_time) &&
    Number.isFinite(Date.parse(session.start_time)) &&
    Number.isFinite(session.duration_seconds) &&
    session.duration_seconds >= MIN_SESSION_MINUTES * 60
  );
}

function toTimed(session: CoachSession, clock: LocalClock): Timed {
  const startedAt = Date.parse(session.start_time);
  return {
    ...clock(startedAt),
    startedAt,
    minutes: session.duration_seconds / 60,
    rating: typeof session.rating === "number" && session.rating > 0 ? session.rating : null,
  };
}

function nounsFor(goal: CoachGoal): { one: string; many: string } {
  return goal.type === "physical"
    ? { one: "visit", many: "visits" }
    : { one: "session", many: "sessions" };
}

function weeklyTarget(goal: CoachGoal): { unit: "sessions" | "hours"; value: number } | null {
  const sessions = Number(goal.target_sessions_per_week) || 0;
  const hours = Number(goal.target_hours_per_week) || 0;
  if (goal.type !== "physical" && hours > 0) return { unit: "hours", value: hours };
  if (sessions > 0) return { unit: "sessions", value: sessions };
  return null;
}

/**
 * Days since the goal was last used at all. Very short sessions never form a
 * pattern, but they do show the goal is not dormant, and the app lists them.
 */
function daysSinceLast(context: GoalContext): number | null {
  if (context.own.length === 0) return null;
  const lastDay = Math.max(
    ...context.own.map((s) => context.clock(Date.parse(s.start_time)).dayNumber),
  );
  return context.today.dayNumber - lastDay;
}

function pattern(
  context: GoalContext,
  fields: Omit<CoachPattern, "goalId" | "goalName" | "goalType">,
): CoachPattern {
  return {
    goalId: context.goal.id,
    goalName: context.goal.name,
    goalType: context.goal.type,
    ...fields,
  };
}

// ---------------------------------------------------------------------------
// Patterns
// ---------------------------------------------------------------------------

/** The weekday (and, when clustered, the time) the user reliably shows up. */
function findHabit(context: GoalContext): Habit | null {
  const { goal, items, today } = context;
  if (items.length < MIN_SESSIONS_FOR_PATTERNS) return null;

  let best: {
    weekday: number;
    members: Timed[];
    timed: boolean;
    occurrences: number;
    weeks: number;
    rank: number;
  } | null = null;

  for (let weekday = 0; weekday < 7; weekday += 1) {
    const onDay = items.filter((i) => i.weekday === weekday);
    if (distinctDays(onDay) < MIN_HABIT_OCCURRENCES) continue;

    // The densest group of start times on this weekday.
    let cluster: Timed[] = [];
    for (const anchor of onDay) {
      const around = onDay.filter(
        (i) => Math.abs(i.minuteOfDay - anchor.minuteOfDay) <= HABIT_WINDOW_MINUTES,
      );
      if (distinctDays(around) > distinctDays(cluster)) cluster = around;
    }
    const timed = distinctDays(cluster) >= MIN_HABIT_OCCURRENCES;
    const members = timed ? cluster : onDay;
    const days = members.map((i) => i.dayNumber);
    const firstDay = Math.min(...days);
    const lastDay = Math.max(...days);
    if (today.dayNumber - lastDay > HABIT_RECENCY_DAYS) continue;

    // How many of this weekday's dates have passed since the habit began. Today
    // only counts once the session happened.
    let weeks = Math.floor((today.dayNumber - firstDay) / 7) + 1;
    if (today.weekday === weekday && lastDay !== today.dayNumber) weeks -= 1;
    weeks = Math.max(1, weeks);
    const occurrences = distinctDays(members);
    const consistency = Math.min(1, occurrences / weeks);
    if (consistency < MIN_HABIT_CONSISTENCY) continue;

    const rank = consistency + (timed ? 0.1 : 0);
    if (!best || rank > best.rank) {
      best = { weekday, members, timed, occurrences, weeks, rank };
    }
  }
  if (!best) return null;

  const dayName = WEEKDAY_NAMES[best.weekday];
  const hour = usualHour(best.members) ?? 0;
  const time = formatHour(hour);
  const tail = `${best.occurrences} of the last ${best.weeks} ${dayName}s`;
  return {
    weekday: best.weekday,
    pattern: pattern(context, {
      kind: "usual_time",
      weekday: best.weekday,
      hour,
      timing: "weekly",
      expiresAt: null,
      confidence: round(Math.min(1, best.occurrences / best.weeks), 2),
      sampleSize: best.members.length,
      volatile: false,
      facts: {
        goal: goal.name,
        weekday: dayName,
        time: best.timed ? time : "varies",
        occurrences: best.occurrences,
        of_last_weekdays: best.weeks,
      },
      fallbackTitle: best.timed ? `${goal.name} around ${time} today?` : `${dayName} is your ${goal.name} day`,
      fallbackBody: best.timed
        ? `${goal.name} on ${tail} around ${time}. Keeping the slot makes it stick.`
        : `${goal.name} on ${tail}. Today fits that rhythm.`,
      statsText: best.timed
        ? `${dayName}s around ${time} are your usual ${goal.name} slot: ${best.occurrences} of the last ${best.weeks} weeks.`
        : `${dayName} is your most regular ${goal.name} day: ${best.occurrences} of the last ${best.weeks} weeks.`,
    }),
  };
}

/** The week's target is getting tight but still reachable. */
function weeklyTargetPattern(context: GoalContext, habit: Habit | null): CoachPattern | null {
  const { goal, own, items, clock, today, now, nouns } = context;
  const target = weeklyTarget(goal);
  if (!target) return null;

  const daysIntoWeek = (today.weekday + 6) % 7; // Monday = 0, like the Home screen
  const weekStart = today.dayNumber - daysIntoWeek;
  const daysLeft = 7 - daysIntoWeek; // including today
  const dayWord = daysLeft === 1 ? "day" : "days";
  // Counted exactly like the Home screen: every finished session this week.
  const thisWeek = own.filter((s) => clock(Date.parse(s.start_time)).dayNumber >= weekStart);
  const expiresAt = new Date(
    now.getTime() + daysLeft * DAY_MS - today.minuteOfDay * 60_000 - (now.getTime() % 60_000),
  ).toISOString();

  let hint = "";
  if (habit && (habit.weekday + 6) % 7 >= daysIntoWeek) {
    hint = habit.weekday === today.weekday
      ? " Today is one of your usual days."
      : ` ${WEEKDAY_NAMES[habit.weekday]} is usually a good day for it.`;
  }

  if (target.unit === "sessions") {
    const done = thisWeek.length;
    const needed = target.value - done;
    // Early in the week there is nothing to remind of yet, and an unreachable
    // target would only discourage.
    if (needed < 1 || needed > daysLeft || daysLeft > needed + 2) return null;
    return pattern(context, {
      kind: "weekly_target",
      weekday: null,
      hour: usualHour(items),
      timing: "once",
      expiresAt,
      confidence: round(Math.min(1, 0.5 + needed / (2 * daysLeft)), 2),
      sampleSize: done,
      volatile: true,
      facts: { goal: goal.name, done, target: target.value, days_left: daysLeft },
      fallbackTitle: `${needed} more ${needed === 1 ? nouns.one : nouns.many} for ${goal.name}`,
      fallbackBody: `${done} of ${target.value} this week, ${daysLeft} ${dayWord} left.${hint}`,
      statsText: `${done} of ${target.value} ${nouns.many} this week: ${needed} more in ${daysLeft} ${dayWord} reaches your target.`,
    });
  }

  const doneHours = thisWeek.reduce((sum, s) => sum + Math.max(0, s.duration_seconds) / 3600, 0);
  const neededHours = target.value - doneHours;
  if (neededHours < 0.5 || daysLeft > 4 || neededHours / daysLeft > 4) return null;
  const perDay = formatMinutes((neededHours * 60) / daysLeft);
  // "0 min of 10h" reads like an error; say plainly that nothing is logged yet.
  const progress = doneHours * 60 < 1
    ? `No ${goal.name} time logged yet this week`
    : `${formatHours(doneHours)} of ${target.value}h this week`;
  return pattern(context, {
    kind: "weekly_target",
    weekday: null,
    hour: usualHour(items),
    timing: "once",
    expiresAt,
    confidence: round(Math.min(1, 0.5 + neededHours / (8 * daysLeft)), 2),
    sampleSize: thisWeek.length,
    volatile: true,
    facts: {
      goal: goal.name,
      done_hours: round(doneHours),
      target_hours: target.value,
      days_left: daysLeft,
    },
    fallbackTitle: `${formatHours(neededHours)} left for ${goal.name}`,
    fallbackBody: `${progress}, ${daysLeft} ${dayWord} left: about ${perDay} a day.${hint}`,
    statsText: `${progress}: about ${perDay} a day for the next ${daysLeft} ${dayWord} reaches your ${target.value}h target.`,
  });
}

/** Two quiet weeks after a real start. */
function dormantPattern(context: GoalContext): CoachPattern | null {
  const { goal, items, nouns } = context;
  const since = daysSinceLast(context);
  if (since === null || items.length < 3) return null;
  if (since < DORMANT_AFTER_DAYS || since > DORMANT_UNTIL_DAYS) return null;
  return pattern(context, {
    kind: "dormant",
    weekday: null,
    hour: usualHour(items),
    timing: "once",
    expiresAt: null,
    confidence: 0.5,
    sampleSize: items.length,
    volatile: true,
    facts: { goal: goal.name, days_since_last: since, total: items.length },
    fallbackTitle: `${goal.name} has been quiet`,
    fallbackBody: `${since} days since your last ${nouns.one}, after ${items.length} ${nouns.many} before that. A short one restarts it.`,
    statsText: `${since} days since your last ${goal.name} ${nouns.one}. A short one restarts the habit.`,
  });
}

/** An established rhythm has lapsed. Only for goals without a weekly target. */
function overduePattern(context: GoalContext): CoachPattern | null {
  const { goal, items, nouns } = context;
  const since = daysSinceLast(context);
  if (since === null || items.length < 6) return null;
  const days = [...new Set(items.map((i) => i.dayNumber))].sort((a, b) => a - b);
  const gaps = days.slice(1).map((day, index) => day - days[index]);
  if (gaps.length < 5) return null;
  const typical = Math.round(median(gaps));
  if (typical < 1 || typical > 10) return null;
  const dueAfter = Math.max(Math.ceil(typical * 1.5), typical + 1);
  if (since < dueAfter || since >= DORMANT_AFTER_DAYS) return null;
  const every = typical === 1 ? "every day" : `every ${typical} days`;
  return pattern(context, {
    kind: "overdue",
    weekday: null,
    hour: usualHour(items),
    timing: "once",
    expiresAt: null,
    confidence: round(Math.min(1, since / (typical * 3)), 2),
    sampleSize: items.length,
    volatile: true,
    facts: { goal: goal.name, usual_gap_days: typical, days_since_last: since },
    fallbackTitle: `Time for ${goal.name}?`,
    fallbackBody: `Your rhythm is about ${every}; the last ${nouns.one} was ${since} days ago.`,
    statsText: `Your ${goal.name} rhythm is about ${every}; the last ${nouns.one} was ${since} days ago.`,
  });
}

/** A weekday or time of day that is clearly better than the rest. */
function bestTimePattern(context: GoalContext): CoachPattern | null {
  const { goal, items, nouns } = context;
  const rated = items.filter((i) => i.rating !== null);
  const usesRating = rated.length >= 6;
  // Visit length says little about how a visit went: without ratings there is
  // no quality signal for physical goals.
  if (!usesRating && (goal.type === "physical" || items.length < 6)) return null;
  const pool = usesRating ? rated : items;
  if (pool[pool.length - 1].dayNumber - pool[0].dayNumber < MIN_PATTERN_SPAN_DAYS) return null;
  const valueOf = (item: Timed) => (usesRating ? (item.rating as number) : item.minutes);
  // Ratings are bounded, so their mean is fair; lengths use the median because
  // a single forgotten timer can run for hours.
  const center = usesRating ? mean : median;

  interface Group {
    members: Timed[];
    weekday: number | null;
    part: (typeof PARTS_OF_DAY)[number] | null;
  }
  const groups: Group[] = [
    ...PARTS_OF_DAY.map((part) => ({
      part,
      weekday: null,
      members: pool.filter((i) => i.minuteOfDay >= part.from && i.minuteOfDay < part.to),
    })),
    ...WEEKDAY_NAMES.map((_name, weekday) => ({
      part: null,
      weekday,
      members: pool.filter((i) => i.weekday === weekday),
    })),
  ];

  let best: { group: Group; groupMean: number; otherMean: number; others: number; strength: number } | null = null;
  for (const group of groups) {
    const memberSet = new Set(group.members);
    const others = pool.filter((i) => !memberSet.has(i));
    if (distinctDays(group.members) < MIN_GROUP_SESSIONS || distinctDays(others) < MIN_GROUP_SESSIONS) {
      continue;
    }
    const groupMean = center(group.members.map(valueOf));
    const otherMean = center(others.map(valueOf));
    const n = group.members.length;
    const shrunk = (n * groupMean + SHRINKAGE_SESSIONS * otherMean) / (n + SHRINKAGE_SESSIONS);
    let strength: number;
    if (usesRating) {
      strength = (shrunk - otherMean) / MIN_RATING_ADVANTAGE;
    } else {
      if (otherMean <= 0 || groupMean - otherMean < MIN_LENGTH_ADVANTAGE_MINUTES) continue;
      strength = (shrunk - otherMean) / otherMean / MIN_LENGTH_ADVANTAGE;
    }
    if (strength < 1) continue;
    if (!best || strength > best.strength) {
      best = { group, groupMean, otherMean, others: others.length, strength };
    }
  }
  if (!best) return null;

  const { group } = best;
  const groupValue = usesRating ? `${round(best.groupMean)}/5` : formatMinutes(best.groupMean);
  const otherValue = usesRating ? `${round(best.otherMean)}/5` : formatMinutes(best.otherMean);
  const confidence = round(Math.min(1, 0.3 + 0.15 * (best.strength - 1)), 2);
  const measure = usesRating ? "average rating" : "typical length";

  if (group.weekday !== null) {
    const day = WEEKDAY_NAMES[group.weekday];
    return pattern(context, {
      kind: "best_time",
      weekday: group.weekday,
      hour: usualHour(group.members),
      timing: "weekly",
      expiresAt: null,
      confidence,
      sampleSize: group.members.length,
      volatile: false,
      facts: {
        goal: goal.name,
        group: `${day}s`,
        compared_with: "other days",
        measure,
        group_value: groupValue,
        other_value: otherValue,
        group_sessions: group.members.length,
        other_sessions: best.others,
      },
      fallbackTitle: usesRating ? `${day}s suit your ${goal.name}` : `${goal.name} runs longest on ${day}s`,
      fallbackBody: usesRating
        ? `Your ${day} ${goal.name} ${nouns.many} average ${groupValue} against ${otherValue} on other days.`
        : `Your ${day} ${goal.name} ${nouns.many} typically run ${groupValue} against ${otherValue} on other days.`,
      statsText: usesRating
        ? `Your ${goal.name} ${nouns.many} rate highest on ${day}s: ${groupValue} against ${otherValue} on other days.`
        : `Your longest ${goal.name} ${nouns.many} happen on ${day}s: typically ${groupValue} against ${otherValue} on other days.`,
    });
  }

  const part = group.part ?? PARTS_OF_DAY[0];
  return pattern(context, {
    kind: "best_time",
    weekday: null,
    hour: usualHour(group.members),
    timing: "once",
    expiresAt: null,
    confidence,
    sampleSize: group.members.length,
    volatile: false,
    facts: {
      goal: goal.name,
      group: part.adjective,
      compared_with: "other times of day",
      measure,
      group_value: groupValue,
      other_value: otherValue,
      group_sessions: group.members.length,
      other_sessions: best.others,
    },
    fallbackTitle: usesRating ? `${goal.name} goes best ${part.phrase}` : `${goal.name} runs longest ${part.phrase}`,
    fallbackBody: usesRating
      ? `Your ${part.adjective} ${goal.name} ${nouns.many} average ${groupValue} against ${otherValue} at other times.`
      : `Your ${part.adjective} ${goal.name} ${nouns.many} typically run ${groupValue} against ${otherValue} at other times.`,
    statsText: usesRating
      ? `Your best-rated ${goal.name} ${nouns.many} happen ${part.phrase}: ${groupValue} against ${otherValue} at other times.`
      : `Your longest ${goal.name} ${nouns.many} happen ${part.phrase}: typically ${groupValue} against ${otherValue} at other times.`,
  });
}

/** The last four weeks against the eight before. Only improvements are reported. */
function trendPattern(context: GoalContext): CoachPattern | null {
  const { goal, items, today, nouns } = context;
  const recentFrom = today.dayNumber - 27;
  const previousFrom = today.dayNumber - 83;
  const recent = items.filter((i) => i.dayNumber >= recentFrom);
  const previous = items.filter((i) => i.dayNumber >= previousFrom && i.dayNumber < recentFrom);
  const firstDay = items[0]?.dayNumber ?? today.dayNumber;
  const previousWeeks = (recentFrom - Math.max(previousFrom, firstDay)) / 7;

  const make = (measure: string, earlier: string, latest: string, title: string, sentence: string) =>
    pattern(context, {
      kind: "trend",
      weekday: null,
      hour: null,
      timing: "once",
      expiresAt: null,
      confidence: 0.4,
      sampleSize: recent.length + previous.length,
      volatile: false,
      facts: {
        goal: goal.name,
        measure,
        earlier,
        recent: latest,
        window: "the last 4 weeks against the 8 weeks before",
      },
      fallbackTitle: title,
      fallbackBody: sentence,
      statsText: sentence,
    });

  if (previousWeeks >= 3 && recent.length >= 3 && previous.length >= 2) {
    const recentRate = recent.length / 4;
    const previousRate = previous.length / previousWeeks;
    if (recentRate >= 1 && recentRate >= previousRate * 1.5 && recentRate - previousRate >= 0.5) {
      const latest = `${round(recentRate)}× a week`;
      const earlier = `${round(previousRate)}× a week`;
      return make(
        "frequency",
        earlier,
        latest,
        `${goal.name} is happening more often`,
        `${goal.name} is happening more often: ${latest} over the last 4 weeks, up from ${earlier} before.`,
      );
    }
  }

  const recentRated = recent.filter((i) => i.rating !== null);
  const previousRated = previous.filter((i) => i.rating !== null);
  if (recentRated.length >= 3 && previousRated.length >= 3) {
    const latest = mean(recentRated.map((i) => i.rating as number));
    const earlier = mean(previousRated.map((i) => i.rating as number));
    if (latest - earlier >= 0.5) {
      return make(
        "average rating",
        `${round(earlier)}/5`,
        `${round(latest)}/5`,
        `${goal.name} feels better lately`,
        `Your ${goal.name} ratings average ${round(latest)}/5 over the last 4 weeks, up from ${round(earlier)}/5 before.`,
      );
    }
  }

  if (goal.type !== "physical" && recent.length >= 4 && previous.length >= 4) {
    const latest = median(recent.map((i) => i.minutes));
    const earlier = median(previous.map((i) => i.minutes));
    if (earlier > 0 && latest - earlier >= MIN_LENGTH_ADVANTAGE_MINUTES && (latest - earlier) / earlier >= 0.25) {
      return make(
        "typical length",
        formatMinutes(earlier),
        formatMinutes(latest),
        `Your ${goal.name} ${nouns.many} are getting longer`,
        `Your ${goal.name} ${nouns.many} run ${formatMinutes(latest)} over the last 4 weeks, up from ${formatMinutes(earlier)} before.`,
      );
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Public entry points
// ---------------------------------------------------------------------------

/** Time-sensitive advice first, then habits, then nice-to-know. */
const NOTIFY_PRIORITY: Record<PatternKind, number> = {
  weekly_target: 0,
  overdue: 1,
  dormant: 2,
  usual_time: 3,
  best_time: 4,
  trend: 5,
};

function byNotificationPriority(a: CoachPattern, b: CoachPattern): number {
  return NOTIFY_PRIORITY[a.kind] - NOTIFY_PRIORITY[b.kind] || b.confidence - a.confidence;
}

export interface DetectOptions {
  /** Maps timestamps onto the user's wall clock, see `timeZoneClock`. */
  clock: LocalClock;
  /** Injected for tests. */
  now?: Date;
}

/**
 * Finds every pattern worth telling the user about, most important first.
 *
 * @param sessions Complete history, not just the recent weeks.
 */
export function detectCoachPatterns(
  sessions: CoachSession[],
  goals: CoachGoal[],
  options: DetectOptions,
): CoachPattern[] {
  const { clock } = options;
  const now = options.now ?? new Date();
  const nowMs = now.getTime();
  const today = clock(nowMs);
  const patterns: CoachPattern[] = [];

  for (const goal of goals) {
    if (!isActiveGoal(goal)) continue;
    const own = sessions.filter(
      (s) => s.goal_id === goal.id && Boolean(s.end_time) && Date.parse(s.start_time) <= nowMs,
    );
    const items = own
      .filter(isMeaningfulSession)
      .map((s) => toTimed(s, clock))
      .sort((a, b) => a.startedAt - b.startedAt);
    const context: GoalContext = { goal, own, items, clock, today, now, nouns: nounsFor(goal) };
    const habit = findHabit(context);

    // One time-sensitive observation per goal: a lapse replaces the weekly
    // count, and a goal with a weekly target is measured against that target.
    const current =
      dormantPattern(context) ??
      weeklyTargetPattern(context, habit) ??
      (weeklyTarget(goal) ? null : overduePattern(context));
    if (current) patterns.push(current);

    if (items.length >= MIN_SESSIONS_FOR_PATTERNS) {
      if (habit) patterns.push(habit.pattern);
      const best = bestTimePattern(context);
      if (best) patterns.push(best);
      const trend = trendPattern(context);
      if (trend) patterns.push(trend);
    }
  }

  return patterns.sort(byNotificationPriority);
}

/** Notification set: per goal at most one time-sensitive and one habit nudge. */
export function selectNotificationPatterns(patterns: CoachPattern[]): CoachPattern[] {
  const taken = new Set<string>();
  const selected: CoachPattern[] = [];
  for (const candidate of [...patterns].sort(byNotificationPriority)) {
    const slot = `${candidate.goalId}:${candidate.volatile ? "current" : "habit"}`;
    if (taken.has(slot)) continue;
    taken.add(slot);
    selected.push(candidate);
    if (selected.length >= MAX_PATTERNS) break;
  }
  return selected;
}

export interface StatsInsight {
  status: "ready" | "insufficient_data";
  insight: string;
  goalId: string | null;
}

const STATS_HABIT_ORDER: PatternKind[] = ["best_time", "usual_time", "trend"];
const STATS_CURRENT_ORDER: PatternKind[] = ["dormant", "overdue", "weekly_target"];

/**
 * One or two sentences for the Stats card about one goal: the strongest habit
 * or quality pattern, then where the goal stands right now.
 */
export function buildStatsInsight(
  sessions: CoachSession[],
  goals: CoachGoal[],
  patterns: CoachPattern[],
  goalId: string | null,
): StatsInsight {
  const active = goals.filter(isActiveGoal);
  const realCount = (id: string) =>
    sessions.filter((s) => s.goal_id === id && isMeaningfulSession(s)).length;
  const goal =
    (goalId ? active.find((g) => g.id === goalId) : undefined) ??
    [...active].sort((a, b) => realCount(b.id) - realCount(a.id))[0];
  if (!goal) {
    return {
      status: "insufficient_data",
      insight: "Add a goal and its patterns will show up here.",
      goalId: null,
    };
  }

  const own = patterns.filter((p) => p.goalId === goal.id);
  const first = (order: PatternKind[]) =>
    order
      .map((kind) => own.find((p) => p.kind === kind))
      .find((p): p is CoachPattern => p !== undefined);
  const sentences = [first(STATS_HABIT_ORDER), first(STATS_CURRENT_ORDER)]
    .filter((p): p is CoachPattern => p !== undefined)
    .map((p) => p.statsText);
  if (sentences.length > 0) {
    return { status: "ready", insight: sentences.join(" "), goalId: goal.id };
  }

  const count = realCount(goal.id);
  const { many } = nounsFor(goal);
  if (count < MIN_SESSIONS_FOR_PATTERNS) {
    return {
      status: "insufficient_data",
      insight: `Patterns for ${goal.name} show up after ${MIN_SESSIONS_FOR_PATTERNS} ${many} of at least ${MIN_SESSION_MINUTES} minutes. ${count} so far.`,
      goalId: goal.id,
    };
  }
  return {
    status: "ready",
    insight: `No clear day or time for ${goal.name} yet: ${count} ${many} so far. A rhythm shows after a few weeks of logging.`,
    goalId: goal.id,
  };
}

/**
 * Fingerprint of the advice whose copy may be cached. Volatile patterns are
 * left out because they are always worded fresh; facts are included because
 * cached copy quotes them, so changed numbers never reuse old wording.
 */
export function patternFingerprint(patterns: CoachPattern[]): string {
  const parts = patterns
    .filter((p) => !p.volatile)
    .map((p) =>
      [p.kind, p.goalId, p.weekday ?? "-", p.hour ?? "-", hashText(JSON.stringify(p.facts))].join(":"),
    );
  return parts.join("|") || "empty";
}
