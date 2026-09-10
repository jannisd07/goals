import {
  advancePomodoro,
  computeAdaptiveBreakMinutes,
  computeFlowtimeBreakMinutes,
  sessionMinutesToRatio,
  sessionRatioToMinutes,
} from "../src/lib/pomodoro";
import { computeStreak } from "../src/lib/streaks";
import { detectStudySpot } from "../src/lib/studySpots";
import { buildConstellation } from "../src/lib/constellation";
import { planOnboardingGoals } from "../src/lib/onboardingPlan";
import { classifyGeofenceSession } from "../src/lib/geofenceSessions";
import {
  buildStatsInsight,
  detectCoachPatterns,
  fixedOffsetClock,
  patternFingerprint,
  selectNotificationPatterns,
  timeZoneClock,
  type CoachGoal,
  type CoachSession,
} from "../supabase/functions/_shared/coachPatterns";
import {
  buildWriterPayload,
  fallbackNudges,
  isFaithfulCopy,
  mergeWriterResponse,
  reuseCachedNudges,
  MAX_TITLE_CHARS,
} from "../supabase/functions/_shared/coachWriter";
import {
  nudgeSchedule,
  parseCoachNudges,
  planCoachNotifications,
  selectNudges,
  type CoachNudge,
} from "../src/lib/coachSchedule";
import { normalizeMinVisitMinutes } from "../src/types";
import {
  buildSupabasePlaceSearchEndpoint,
  buildPlaceSearchUrl,
  isTrustedSupabasePlaceSearchEndpoint,
  PUBLIC_NOMINATIM_SEARCH_ENDPOINT,
  resolvePlaceSearchEndpoint,
  usesPublicNominatim,
} from "../src/lib/placeSearchProvider";
import {
  buildNominatimUrl,
  buildPlaceSearchCacheInput,
  parsePlaceSearchRequest,
  sanitizeNominatimResults,
} from "../supabase/functions/_shared/placeSearch";
import { computeDisposableTime } from "../src/lib/time";
import {
  formatInsightUpdatedAt,
  parseServerInsight,
} from "../src/lib/serverInsights";
import {
  circularSliderValueFromPoint,
  clampSliderRatio,
  sliderRatioFromPageX,
  sliderThumbLeft,
} from "../src/lib/sliders";
import type { Goal, PomodoroState, Session } from "../src/types";

let assertionCount = 0;

function assert(condition: unknown, message: string): asserts condition {
  assertionCount += 1;
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

function approximately(actual: number, expected: number, epsilon = 1e-8): boolean {
  return Math.abs(actual - expected) <= epsilon;
}

function throws(fn: () => unknown): boolean {
  try {
    fn();
    return false;
  } catch {
    return true;
  }
}

function basePomodoro(overrides: Partial<PomodoroState> = {}): PomodoroState {
  return {
    is_running: true,
    is_break: false,
    is_long_break: false,
    current_cycle: 1,
    total_cycles: 0,
    elapsed_seconds: 0,
    duration_seconds: 25 * 60,
    break_duration_seconds: 5 * 60,
    mode: "interval",
    flow_stretch_seconds: 0,
    focused_seconds: 0,
    last_tick_at_ms: 0,
    ...overrides,
  };
}

function session(
  id: string,
  goalId: string,
  start: string,
  durationSeconds: number,
  rating: number | null = null,
): Session {
  return {
    id,
    user_id: "user",
    goal_id: goalId,
    start_time: start,
    end_time: new Date(new Date(start).getTime() + durationSeconds * 1000).toISOString(),
    duration_seconds: durationSeconds,
    trigger: "manual_pomodoro",
    rating,
    pomodoro_cycles: 1,
    ambient_sound: null,
    notes: null,
    growth_stage: 0,
    created_at: start,
  };
}

assert(clampSliderRatio(-0.2) === 0, "slider ratios clamp at the lower edge");
assert(clampSliderRatio(1.2) === 1, "slider ratios clamp at the upper edge");
assert(
  sliderRatioFromPageX(150, 100, 200) === 0.25,
  "slider page coordinates map against the full track",
);
assert(
  sliderRatioFromPageX(50, 100, 200) === 0 &&
    sliderRatioFromPageX(350, 100, 200) === 1,
  "slider input remains clamped while dragging beyond either edge",
);
assert(
  sliderThumbLeft(0, 200, 24) === 0 &&
    sliderThumbLeft(1, 200, 24) === 176,
  "slider thumb stays fully inside the track",
);
assert(
  circularSliderValueFromPoint(100, 0, 200, 5, 125, 5) === 5,
  "circular slider starts at twelve o'clock",
);
assert(
  circularSliderValueFromPoint(200, 100, 200, 5, 125, 5) === 35 &&
    circularSliderValueFromPoint(100, 200, 200, 5, 125, 5) === 65,
  "circular slider increases clockwise in stepped values",
);
assert(
  circularSliderValueFromPoint(100, 100, 200, 5, 125, 5) === null,
  "circular slider ignores touches in the timer center",
);
assert(
  resolvePlaceSearchEndpoint("  https://places.example/search  ") ===
    "https://places.example/search",
  "place search accepts a configured proxy endpoint",
);
assert(
  resolvePlaceSearchEndpoint("  ") === PUBLIC_NOMINATIM_SEARCH_ENDPOINT,
  "blank place search configuration preserves the development fallback",
);
const projectUrl = "https://project-ref.supabase.co";
const projectSearchEndpoint =
  "https://project-ref.supabase.co/functions/v1/place-search";
assert(
  buildSupabasePlaceSearchEndpoint(projectUrl) === projectSearchEndpoint &&
    resolvePlaceSearchEndpoint("supabase", projectUrl) === projectSearchEndpoint,
  "the Supabase provider derives its authenticated place-search function",
);
assert(
  resolvePlaceSearchEndpoint(undefined, projectUrl) ===
    PUBLIC_NOMINATIM_SEARCH_ENDPOINT,
  "an undeployed proxy cannot silently break the development fallback",
);
assert(
  isTrustedSupabasePlaceSearchEndpoint(projectSearchEndpoint, projectUrl) &&
    !isTrustedSupabasePlaceSearchEndpoint(
      "https://attacker.example/functions/v1/place-search",
      projectUrl,
    ),
  "place-search JWTs are only sent to the configured Supabase origin",
);
assert(
  buildPlaceSearchUrl("https://places.example/search?source=goals", "q=Berlin") ===
    "https://places.example/search?source=goals&q=Berlin",
  "place search preserves proxy query parameters",
);
assert(
  usesPublicNominatim(PUBLIC_NOMINATIM_SEARCH_ENDPOINT) &&
    !usesPublicNominatim("https://places.example/search"),
  "direct Nominatim throttling is not applied to a configured proxy",
);
const parsedPlaceRequest = parsePlaceSearchRequest(
  new URL(
    "https://project-ref.supabase.co/functions/v1/place-search?q=Ulm&countrycodes=DE&limit=4&accept-language=de-DE",
  ),
);
assert(
  parsedPlaceRequest.ok &&
    parsedPlaceRequest.value.countryCode === "de" &&
    parsedPlaceRequest.value.limit === 4,
  "place-search proxy accepts a bounded local request",
);
assert(
  !parsePlaceSearchRequest(
    new URL("https://example.test/place-search?q=x&limit=99"),
  ).ok,
  "place-search proxy rejects short queries and oversized limits",
);
if (!parsedPlaceRequest.ok) {
  throw new Error("Expected a valid place-search request");
}
assert(
  buildNominatimUrl(parsedPlaceRequest.value).searchParams.get("countrycodes") ===
    "de",
  "place-search proxy forwards the explicit local-country boundary",
);
assert(
  buildPlaceSearchCacheInput(parsedPlaceRequest.value) ===
    buildPlaceSearchCacheInput({
      ...parsedPlaceRequest.value,
      query: "ulm",
      language: "DE-de",
    }),
  "place-search cache keys normalize query and language casing",
);
const safeUpstreamResults = sanitizeNominatimResults(
  [
    {
      display_name: "Ulm, Baden-Württemberg, Deutschland",
      name: "Ulm",
      lat: "48.3974",
      lon: "9.9934",
      address: { country_code: "DE" },
      ignored_private_field: "not forwarded",
    },
    {
      display_name: "Invalid",
      lat: "999",
      lon: "9",
    },
  ],
  8,
);
assert(
  safeUpstreamResults?.length === 1 &&
    safeUpstreamResults[0].address?.country_code === "de" &&
    !("ignored_private_field" in safeUpstreamResults[0]),
  "place-search proxy bounds coordinates and strips unneeded upstream fields",
);

// Pomodoro: one full block + break + one minute crosses two boundaries while
// counting only productive seconds.
const crossed = advancePomodoro(basePomodoro(), 25 * 60 + 5 * 60 + 60, 5);
assert(crossed.completedFocusBlocks === 1, "one focus block completes");
assert(crossed.completedBreaks === 1, "one break completes");
assert(crossed.pomodoro.total_cycles === 1, "cycle total increments once");
assert(crossed.pomodoro.current_cycle === 2, "the next cycle starts");
assert(crossed.pomodoro.elapsed_seconds === 60, "remaining time enters next focus block");
assert(crossed.pomodoro.focused_seconds === 26 * 60, "break time is excluded");
assert(crossed.focusedSecondsAdded === 26 * 60, "added focus time is exact");

const paused = advancePomodoro(basePomodoro({ is_running: false }), 3600);
assert(paused.pomodoro.focused_seconds === 0, "paused wall time is ignored");
assert(paused.pomodoro.elapsed_seconds === 0, "paused phase does not move");

const flow = advancePomodoro(
  basePomodoro({ mode: "flowtime", duration_seconds: 0 }),
  601,
);
assert(flow.pomodoro.focused_seconds === 601, "flowtime counts upward");
assert(flow.pomodoro.flow_stretch_seconds === 601, "flow stretch is persisted");
const openFlowBreak = advancePomodoro(
  basePomodoro({
    mode: "flowtime",
    is_break: true,
    elapsed_seconds: 25,
    focused_seconds: 10 * 60,
  }),
  60 * 60,
);
assert(openFlowBreak.pomodoro.is_break, "flowtime break stays open until resumed");
assert(
  openFlowBreak.pomodoro.elapsed_seconds === 60 * 60 + 25,
  "flowtime break behaves as a count-up stopwatch",
);
assert(
  openFlowBreak.pomodoro.focused_seconds === 10 * 60,
  "flowtime recovery never adds focused time",
);
assert(openFlowBreak.completedBreaks === 0, "flowtime break never auto-completes");
const interruptedInterval = advancePomodoro(
  basePomodoro({
    is_break: true,
    elapsed_seconds: 4 * 60 + 59,
    break_duration_seconds: 5 * 60,
    interrupted_focus_elapsed_seconds: 8 * 60,
    focused_seconds: 8 * 60,
  }),
  1,
);
assert(
  !interruptedInterval.pomodoro.is_break &&
    interruptedInterval.pomodoro.elapsed_seconds === 8 * 60,
  "a manually started interval break resumes the interrupted focus block",
);
assert(
  interruptedInterval.pomodoro.current_cycle === 1 &&
    interruptedInterval.pomodoro.interrupted_focus_elapsed_seconds === undefined,
  "manual interval recovery neither advances the cycle nor leaves stale resume state",
);
assert(computeFlowtimeBreakMinutes(10 * 60) === 2, "flow break has two-minute floor");
assert(computeFlowtimeBreakMinutes(200 * 60) === 30, "flow break has thirty-minute ceiling");
assert(
  computeAdaptiveBreakMinutes(25, 5).shortBreakMinutes === 5,
  "25-minute interval preserves five-minute base break",
);
for (const minutes of [5, 15, 25, 45, 60]) {
  assert(
    Math.abs(sessionRatioToMinutes(sessionMinutesToRatio(minutes)) - minutes) <= 1,
    `session slider round-trips ${minutes} minutes`,
  );
}

// Streak uses local calendar days and ignores open sessions.
const now = new Date(2026, 6, 28, 12);
const streak = computeStreak(
  [
    { start_time: new Date(2026, 6, 26, 18).toISOString(), end_time: "done" },
    { start_time: new Date(2026, 6, 27, 18).toISOString(), end_time: "done" },
    { start_time: new Date(2026, 6, 28, 8).toISOString(), end_time: "done" },
    { start_time: new Date(2026, 6, 25, 8).toISOString(), end_time: null },
  ],
  now,
);
assert(streak.current === 3, "current streak joins consecutive completed days");
assert(streak.longest === 3, "longest streak is calculated");
assert(!streak.atRiskToday, "today's completion removes streak risk");

const atRisk = computeStreak(
  [{ start_time: new Date(2026, 6, 27, 18).toISOString(), end_time: "done" }],
  now,
);
assert(atRisk.current === 1 && atRisk.atRiskToday, "yesterday-only streak is at risk");

// Study spots require three nearby points and are suppressed near a configured
// Auto Check-In.
const focusGoal = { id: "focus", name: "Reading" } as Pick<Goal, "id" | "name">;
const locationRows = [
  { start_latitude: 48.3984, start_longitude: 9.9916 },
  { start_latitude: 48.3985, start_longitude: 9.9917 },
  { start_latitude: 48.3983, start_longitude: 9.9915 },
];
const spot = detectStudySpot(locationRows, focusGoal);
assert(spot?.sessionCount === 3, "three nearby focus starts form a study spot");
assert(
  detectStudySpot(locationRows.slice(0, 2), focusGoal) === null,
  "two starts do not form a study spot",
);
assert(
  detectStudySpot(locationRows, focusGoal, [
    { latitude: 48.3984, longitude: 9.9916 },
  ]) === null,
  "Auto Check-In overlap suppresses the learned spot",
);

// Grove layout is deterministic and builds one MST edge fewer than stars in
// each goal cluster.
const constellationSessions = [
  session("s1", "g1", "2026-07-20T10:00:00.000Z", 900, 3),
  session("s2", "g1", "2026-07-21T10:00:00.000Z", 1800, 4),
  session("s3", "g1", "2026-07-22T10:00:00.000Z", 2700, 5),
  session("s4", "g2", "2026-07-23T10:00:00.000Z", 1200),
  session("s5", "g2", "2026-07-24T10:00:00.000Z", 2400),
];
const firstConstellation = buildConstellation(constellationSessions);
const secondConstellation = buildConstellation(constellationSessions);
assert(
  JSON.stringify(firstConstellation) === JSON.stringify(secondConstellation),
  "constellation layout is deterministic",
);
assert(firstConstellation.stars.length === 5, "every completed session becomes one star");
assert(firstConstellation.lines.length === 3, "MST creates n-1 edges per goal cluster");

assert(
  approximately(
    computeDisposableTime({
      sleep_hours_per_night: 8,
      work_hours_per_day: 8,
      work_days_per_week: 5,
      daily_overhead_hours: 2,
    }),
    58,
  ),
  "weekly disposable budget is correct",
);
assert(
  computeDisposableTime({
    sleep_hours_per_night: 24,
    work_hours_per_day: 24,
    work_days_per_week: 7,
    daily_overhead_hours: 24,
  }) === 0,
  "weekly budget never becomes negative",
);

const firstOnboardingPlan = planOnboardingGoals([], true);
assert(firstOnboardingPlan.createFocusGoal, "first onboarding creates a focus goal");
assert(firstOnboardingPlan.createPhysicalGoal, "configured Auto Check-In creates a physical goal");

const existingOnboardingGoals = [
  { id: "focus-new", type: "focus" as const, updated_at: "2", created_at: "2" },
  { id: "focus-old", type: "focus" as const, updated_at: "1", created_at: "1" },
  { id: "physical-new", type: "physical" as const, updated_at: "2", created_at: "2" },
  { id: "physical-old", type: "physical" as const, updated_at: "1", created_at: "1" },
];
const retryPlan = planOnboardingGoals(existingOnboardingGoals, true);
assert(retryPlan.focusGoalId === "focus-new", "retry updates the newest focus goal");
assert(retryPlan.physicalGoalId === "physical-new", "retry updates the newest physical goal");
assert(
  retryPlan.deactivateGoalIds.join(",") === "focus-old,physical-old",
  "retry deactivates older duplicate goals",
);
assert(!retryPlan.createFocusGoal && !retryPlan.createPhysicalGoal, "retry creates no duplicates");

const skippedCheckinPlan = planOnboardingGoals(existingOnboardingGoals, false);
assert(skippedCheckinPlan.physicalGoalId === null, "skipping Auto Check-In selects no physical goal");
assert(
  skippedCheckinPlan.deactivateGoalIds.includes("physical-new") &&
    skippedCheckinPlan.deactivateGoalIds.includes("physical-old"),
  "skipping Auto Check-In deactivates every active physical goal",
);

assert(
  classifyGeofenceSession(9 * 60 * 1000) === "discard_short",
  "a nine-minute visit is discarded",
);
assert(
  classifyGeofenceSession(10 * 60 * 1000) === "complete",
  "a ten-minute visit is completed",
);
assert(
  classifyGeofenceSession(18 * 60 * 60 * 1000) === "discard_stale",
  "an eighteen-hour orphan is discarded consistently",
);

// Per-goal minimum stay: walking past a gym must not become a session.
assert(
  classifyGeofenceSession(25 * 60 * 1000, 30) === "discard_short",
  "a 25-minute visit is discarded when the goal requires 30 minutes",
);
assert(
  classifyGeofenceSession(31 * 60 * 1000, 30) === "complete",
  "a 31-minute visit completes when the goal requires 30 minutes",
);
assert(
  classifyGeofenceSession(6 * 60 * 1000, 5) === "complete",
  "a short threshold lets a six-minute visit count",
);
assert(
  classifyGeofenceSession(18 * 60 * 60 * 1000, 5) === "discard_stale",
  "the stale-visit guard still wins over a low minimum stay",
);
assert(
  classifyGeofenceSession(11 * 60 * 1000) === "complete" &&
    classifyGeofenceSession(11 * 60 * 1000, Number.NaN) === "complete",
  "an absent or invalid threshold falls back to the ten-minute default",
);
assert(
  normalizeMinVisitMinutes(0) === 1 &&
    normalizeMinVisitMinutes(9999) === 240 &&
    normalizeMinVisitMinutes(20.4) === 20 &&
    normalizeMinVisitMinutes("nope") === 10,
  "minimum stay values are clamped onto the supported range",
);

const parsedInsight = parseServerInsight({
  insight: "  Morning sessions are strongest.  ",
  status: "ready",
  generated_at: "2026-07-30T08:15:00.000Z",
  refreshes_remaining: 2,
});
assert(parsedInsight.insight === "Morning sessions are strongest.", "insight text is trimmed");
assert(parsedInsight.refreshes_remaining === 2, "valid refresh allowance is preserved");
assert(
  throws(() =>
    parseServerInsight({
      insight: "Invalid status",
      status: "unknown",
      generated_at: "2026-07-30T08:15:00.000Z",
      refreshes_remaining: 2,
    }),
  ),
  "unknown insight status is rejected",
);
assert(
  throws(() =>
    parseServerInsight({
      insight: "Invalid allowance",
      status: "ready",
      generated_at: "2026-07-30T08:15:00.000Z",
      refreshes_remaining: 4,
    }),
  ),
  "refresh allowance outside the server limit is rejected",
);
assert(
  formatInsightUpdatedAt(
    "2026-07-30T08:15:00.000Z",
    new Date("2026-07-30T12:00:00.000Z"),
  ).startsWith("Updated today at "),
  "same-day insight timestamps use the compact label",
);
assert(
  formatInsightUpdatedAt(
    "2026-07-29T08:15:00.000Z",
    new Date("2026-07-30T12:00:00.000Z"),
  ).startsWith("Updated "),
  "older insight timestamps use a date label",
);


// ---------------------------------------------------------------------------
// Personal coach: long-term pattern detection
// ---------------------------------------------------------------------------

const DAY = 86_400_000;
const UTC_CLOCK = fixedOffsetClock(0);
// 2026-09-10 is a Thursday; its week (Monday start, like Home) began 2026-09-07.
const COACH_NOW = new Date(Date.UTC(2026, 8, 10, 18, 0, 0));
const atNow = { clock: UTC_CLOCK, now: COACH_NOW };

const GYM: CoachGoal = {
  id: "gym",
  name: "Gym",
  type: "physical",
  is_active: true,
  target_sessions_per_week: 0,
  target_hours_per_week: 0,
};
const GYM_TARGET: CoachGoal = { ...GYM, target_sessions_per_week: 4 };
const STUDY: CoachGoal = {
  id: "study",
  name: "Studying",
  type: "focus",
  is_active: true,
  target_sessions_per_week: 0,
  target_hours_per_week: 0,
};

/** A session `daysAgo` days before 2026-09-10 (UTC) at hour:minute. */
function coachSession(
  daysAgo: number,
  hour: number,
  rating: number | null,
  minutes = 60,
  goalId = "gym",
  minute = 0,
): CoachSession {
  const start = new Date(Date.UTC(2026, 8, 10, hour, minute, 0) - daysAgo * DAY);
  return {
    start_time: start.toISOString(),
    end_time: new Date(start.getTime() + minutes * 60_000).toISOString(),
    duration_seconds: Math.round(minutes * 60),
    rating,
    goal_id: goalId,
    trigger: goalId === "gym" ? "geofence" : "manual_pomodoro",
  };
}

// A real habit: four of the last five Mondays around 5pm, never at the same
// minute. Exact weekday+hour buckets used to split this across two hours.
const mondayHabit: CoachSession[] = [
  coachSession(3, 17, null, 60, "gym", 10),
  coachSession(10, 16, null, 60, "gym", 50),
  coachSession(17, 17, null, 60, "gym", 5),
  coachSession(31, 17, null, 60, "gym", 20),
  coachSession(5, 11, null, 45),
  coachSession(19, 11, null, 45),
];
const habitPatterns = detectCoachPatterns(mondayHabit, [GYM], atNow);
const usualTime = habitPatterns.find((p) => p.kind === "usual_time");
assert(usualTime?.weekday === 1, "a Monday habit is detected");
assert(usualTime?.hour === 17, "start times within the habit window cluster around 5pm");
assert(usualTime?.timing === "weekly", "a habit reminder repeats weekly");
assert(
  String(usualTime?.fallbackBody).includes("4 of the last 5 Mondays"),
  "the habit says on how many of the recent weekdays it happened",
);
assert(
  detectCoachPatterns(mondayHabit, [{ ...GYM, is_active: false }], atNow).length === 0,
  "inactive goals get no advice",
);

// Taps and abandoned starts are not sessions: eight Tuesday taps under a
// minute used to produce "Tuesdays are your best".
const tapsAndSessions: CoachSession[] = [];
for (let week = 0; week < 8; week += 1) {
  tapsAndSessions.push(coachSession(2 + week * 7, 18, null, 0.3, "study"));
}
tapsAndSessions.push(
  coachSession(1, 9, null, 50, "study"),
  coachSession(4, 9, null, 40, "study"),
  coachSession(6, 20, null, 35, "study"),
);
const tapPatterns = detectCoachPatterns(tapsAndSessions, [STUDY], atNow);
assert(tapPatterns.length === 0, "sessions under five minutes never create a pattern");
const tapInsight = buildStatsInsight(tapsAndSessions, [STUDY], tapPatterns, "study");
assert(tapInsight.status === "insufficient_data", "too few real sessions keep the Stats card honest");
assert(tapInsight.insight.includes("3 so far"), "the Stats card counts only real sessions");

// Three sessions slightly above a stable average are luck, not a pattern.
const ratedStudy: CoachSession[] = [
  ...[6, 13, 20].map((d) => coachSession(d, 10, 5, 50, "study")), // Fridays
  coachSession(3, 10, 4, 50, "study"),
  coachSession(10, 10, 4, 50, "study"),
  coachSession(17, 10, 5, 50, "study"), // Mondays
  coachSession(1, 10, 4, 50, "study"),
  coachSession(8, 10, 5, 50, "study"),
  coachSession(15, 10, 4, 50, "study"), // Wednesdays
  coachSession(2, 10, 4, 50, "study"),
  coachSession(9, 10, 4, 50, "study"),
  coachSession(16, 10, 5, 50, "study"), // Tuesdays
  coachSession(28, 10, 4, 50, "study"), // a Thursday, so the history spans four weeks
];
assert(
  !detectCoachPatterns(ratedStudy, [STUDY], atNow).some((p) => p.kind === "best_time"),
  "three sessions slightly above a stable average are not called a pattern",
);
// One busy week with a few very long sessions (forgotten timers or full work
// days) is not a long-term pattern, however large the difference looks.
const burstWeek: CoachSession[] = [
  coachSession(42, 17, null, 58, "study"),
  coachSession(42, 19, null, 97, "study"),
  coachSession(41, 16, null, 220, "study"),
  coachSession(40, 13, null, 492, "study"),
  coachSession(39, 11, null, 591, "study"),
  coachSession(38, 12, null, 436, "study"),
];
assert(
  !detectCoachPatterns(burstWeek, [STUDY], atNow).some((p) => p.kind === "best_time"),
  "one busy week is not reported as the best time of day",
);
const strongStudy: CoachSession[] = [
  ...[6, 13, 20, 27, 34].map((d) => coachSession(d, 10, 5, 50, "study")),
  ...[3, 10, 17, 1, 8, 15].map((d) => coachSession(d, 10, 3, 50, "study")),
];
const bestTime = detectCoachPatterns(strongStudy, [STUDY], atNow).find((p) => p.kind === "best_time");
assert(bestTime?.weekday === 5, "a clearly better weekday is found");
assert(
  bestTime?.facts.group_value === "5/5" && bestTime?.facts.other_value === "3/5",
  "a comparison uses ratings on both sides, never ratings against minutes",
);

// Local time per session: daylight saving must not move a 5pm habit.
const berlin = timeZoneClock("Europe/Berlin");
assert(
  berlin(Date.parse("2026-01-12T16:00:00Z")).hour === 17 &&
    berlin(Date.parse("2026-07-13T15:00:00Z")).hour === 17,
  "a 5pm session stays at 5pm in winter and summer",
);
assert(
  berlin(Date.parse("2026-03-29T22:30:00Z")).weekday === 1,
  "a late UTC session already falls on the next local weekday",
);
assert(
  timeZoneClock("Not/AZone", 120)(Date.parse("2026-01-12T16:00:00Z")).hour === 18,
  "an unknown time zone falls back to the device offset",
);

// Weekly target: Thursday, two of four visits done.
const thisWeek = [coachSession(3, 17, null, 60), coachSession(2, 18, null, 60)];
const targetPattern = detectCoachPatterns(thisWeek, [GYM_TARGET], atNow)
  .find((p) => p.kind === "weekly_target");
assert(
  targetPattern?.facts.done === 2 && targetPattern?.facts.days_left === 4,
  "Thursday with 2 of 4 visits leaves 2 to go in 4 days",
);
assert(
  targetPattern?.volatile === true && targetPattern?.timing === "once",
  "weekly progress is time-sensitive and fires once",
);
assert(
  targetPattern?.expiresAt === "2026-09-14T00:00:00.000Z",
  "weekly target advice expires when the week ends",
);
assert(
  !detectCoachPatterns(
    [...thisWeek, coachSession(1, 17, null, 60), coachSession(0, 7, null, 60)],
    [GYM_TARGET],
    atNow,
  ).some((p) => p.kind === "weekly_target"),
  "a met target produces no reminder",
);
assert(
  !detectCoachPatterns([], [GYM_TARGET], {
    clock: UTC_CLOCK,
    now: new Date(Date.UTC(2026, 8, 7, 9, 0, 0)),
  }).some((p) => p.kind === "weekly_target"),
  "Monday morning with the whole week ahead is not nagged",
);
assert(
  detectCoachPatterns([...thisWeek, coachSession(1, 17, null, 1)], [GYM_TARGET], {
    clock: UTC_CLOCK,
    now: new Date(Date.UTC(2026, 8, 12, 18, 0, 0)),
  }).find((p) => p.kind === "weekly_target")?.facts.done === 3,
  "every finished session counts toward the week, exactly like on Home",
);
const STUDY_HOURS: CoachGoal = { ...STUDY, target_hours_per_week: 10 };
const hoursPattern = detectCoachPatterns([coachSession(2, 9, null, 120, "study")], [STUDY_HOURS], atNow)
  .find((p) => p.kind === "weekly_target");
assert(
  hoursPattern?.fallbackTitle === "8h left for Studying" &&
    String(hoursPattern?.fallbackBody).includes("2h of 10h this week"),
  "an hours target counts this week's hours",
);
assert(
  String(
    detectCoachPatterns([], [STUDY_HOURS], atNow).find((p) => p.kind === "weekly_target")?.statsText,
  ).startsWith("No Studying time logged yet this week"),
  "an empty week is described plainly, not as 0 min",
);
assert(
  !detectCoachPatterns([], [STUDY_HOURS], {
    clock: UTC_CLOCK,
    now: new Date(Date.UTC(2026, 8, 13, 9, 0, 0)),
  }).some((p) => p.kind === "weekly_target"),
  "an hours target that would need more than four hours a day is not pushed",
);

// Lapses.
const lapsedPatterns = detectCoachPatterns(
  [24, 22, 20].map((d) => coachSession(d, 17, null, 60)),
  [GYM_TARGET],
  atNow,
);
assert(
  lapsedPatterns.some((p) => p.kind === "dormant" && p.facts.days_since_last === 20),
  "twenty quiet days become a restart nudge",
);
assert(
  !lapsedPatterns.some((p) => p.kind === "weekly_target"),
  "a restart nudge replaces the weekly count instead of adding to it",
);
assert(
  !detectCoachPatterns(
    [...[24, 22, 20].map((d) => coachSession(d, 17, null, 60)), coachSession(2, 17, null, 0.5)],
    [GYM],
    atNow,
  ).some((p) => p.kind === "dormant"),
  "a short session two days ago means the goal is not dormant",
);
const rhythm: CoachSession[] = [];
for (let i = 0; i < 12; i += 1) {
  rhythm.push(coachSession(9 + i * 3, 17, 4, 60, "study"));
}
const rhythmPatterns = detectCoachPatterns(rhythm, [STUDY], atNow);
assert(
  rhythmPatterns.some((p) => p.kind === "overdue"),
  "a three-day rhythm that is nine days idle is reported as overdue",
);
assert(rhythmPatterns[0].kind === "overdue", "time-sensitive advice outranks habits and trends");

// Selection, Stats text and fingerprint.
const busy = detectCoachPatterns(mondayHabit, [GYM_TARGET], atNow);
const selectedBusy = selectNotificationPatterns(busy);
assert(
  selectedBusy[0]?.kind === "weekly_target" && selectedBusy[1]?.kind === "usual_time",
  "a goal gets one current and one habit nudge, the current one first",
);
const gymInsight = buildStatsInsight(mondayHabit, [GYM_TARGET], busy, "gym");
assert(
  gymInsight.status === "ready" && gymInsight.insight.includes("Mondays around 5pm"),
  "the Stats card leads with the detected habit",
);
assert(gymInsight.insight.includes("1 of 4 visits this week"), "the Stats card adds this week's progress");
const emptyInsight = buildStatsInsight([], [STUDY], [], "study");
assert(
  emptyInsight.status === "insufficient_data" && emptyInsight.insight.includes("0 so far"),
  "a goal without sessions says what unlocks its patterns",
);
assert(
  buildStatsInsight(mondayHabit, [GYM_TARGET, STUDY], busy, null).goalId === "gym",
  "without a selected goal the busiest goal is described",
);
assert(
  patternFingerprint(habitPatterns) ===
    patternFingerprint(detectCoachPatterns(mondayHabit, [GYM], atNow)),
  "identical history yields an identical fingerprint, so the cache holds",
);
assert(
  patternFingerprint(habitPatterns) !==
    patternFingerprint(detectCoachPatterns(mondayHabit.filter((_, i) => i !== 3), [GYM], atNow)),
  "changed numbers change the fingerprint, so cached copy never quotes old counts",
);
assert(
  patternFingerprint(busy.filter((p) => p.volatile)) === "empty",
  "time-sensitive advice never enters the cache fingerprint",
);

// The prompt carries computed numbers only, and only for stable advice.
const payload = buildWriterPayload(selectedBusy);
assert(!payload.includes("start_time"), "the prompt contains no raw session fields");
assert(
  payload.includes("Monday") && !payload.includes("weekly_target"),
  "weekly counters never reach the model",
);

// ---------------------------------------------------------------------------
// Personal coach: model output handling
// ---------------------------------------------------------------------------

const goodCompletion = JSON.stringify({
  nudges: [{ id: "n0", title: "Gym around 5pm today?", body: "You went on 4 of the last 5 Mondays around 5pm. Keep the slot." }],
});
const merged = mergeWriterResponse(habitPatterns, goodCompletion);
assert(merged[0].written === true, "faithful model copy is used");
assert(merged[0].title === "Gym around 5pm today?", "model copy is preserved verbatim");
assert(merged.length === habitPatterns.length, "every pattern still yields exactly one nudge");
assert(
  mergeWriterResponse(
    habitPatterns,
    JSON.stringify({ nudges: [{ id: "n0", title: "Gym around 5pm today?", body: "You went on 9 of the last 10 Mondays around 5pm." }] }),
  )[0].written === false,
  "copy with a number the pattern does not contain is rejected",
);
assert(
  mergeWriterResponse(
    habitPatterns,
    JSON.stringify({ nudges: [{ id: "n0", title: "Mondays keep getting better", body: "Your Monday visits are up from 4 to 5 recently." }] }),
  )[0].written === false,
  "a comparison may not be described as a change over time",
);
assert(
  isFaithfulCopy(
    {
      kind: "trend", goalId: "g", weekday: null, hour: null, timing: "once", expiresAt: null,
      confidence: 0.4, volatile: false, facts: { earlier: "1× a week", recent: "3× a week" },
      fallbackTitle: "t", fallbackBody: "b",
    },
    "Gym is happening more often",
    "Up from 1× a week to 3× a week recently.",
  ),
  "a real trend may say that it went up",
);
assert(
  mergeWriterResponse(
    selectedBusy,
    JSON.stringify({ nudges: [{ id: "n0", title: "Only 2 left, go today", body: "You have 2 visits left this week, go today." }] }),
  )[0].written === false,
  "weekly counters always use the deterministic wording",
);
const reused = reuseCachedNudges(selectedBusy, merged);
assert(
  reused[1].title === "Gym around 5pm today?" && reused[1].written,
  "cached copy is reused for unchanged stable advice",
);
assert(
  reused[0].written === false && reused[0].body.includes("1 of 4"),
  "time-sensitive advice is worded fresh even on a cache hit",
);
assert(
  mergeWriterResponse(habitPatterns, "not json").every((n) => !n.written),
  "unparseable model output falls back instead of failing",
);
assert(
  mergeWriterResponse(habitPatterns, JSON.stringify({ nudges: "nope" })).every((n) => !n.written),
  "a malformed nudges field falls back",
);
assert(
  mergeWriterResponse(
    habitPatterns,
    JSON.stringify({ nudges: [{ id: "n0", title: "Hi", body: "short" }] }),
  )[0].written === false,
  "copy that is too short to be useful is rejected",
);
const overlong = mergeWriterResponse(
  habitPatterns,
  JSON.stringify({ nudges: [{ id: "n0", title: "x".repeat(200), body: "y".repeat(400) }] }),
);
assert(
  overlong[0].title.length <= MAX_TITLE_CHARS,
  "overlong model titles are trimmed to the notification limit",
);
assert(
  fallbackNudges([...busy, ...detectCoachPatterns(strongStudy, [STUDY], atNow)])
    .every((n) => n.title.length > 0 && n.body.length > 0),
  "every pattern has usable wording without any model at all",
);

// ---------------------------------------------------------------------------
// Personal coach: scheduling
// ---------------------------------------------------------------------------

function nudge(overrides: Partial<CoachNudge> = {}): CoachNudge {
  return {
    kind: "best_time", goalId: "gym", weekday: null, hour: null, timing: "once",
    expiresAt: null, title: "t", body: "b", confidence: 0.5, written: true,
    ...overrides,
  };
}

assert(
  JSON.stringify(nudgeSchedule(nudge({ weekday: 2, hour: 14, timing: "weekly" }))) ===
    JSON.stringify({ weekday: 2, hour: 12, minute: 30 }),
  "a 14:00 slot is announced 90 minutes ahead, at 12:30",
);
assert(
  nudgeSchedule(nudge({ weekday: 1, hour: 6, timing: "weekly" })).hour === 8,
  "an early-morning slot never fires during the night",
);
assert(nudgeSchedule(nudge()).hour === 10, "a nudge without a time of day becomes a mid-morning reminder");
assert(
  selectNudges([nudge({ confidence: 0.9 }), nudge({ confidence: 0.05 })]).length === 1,
  "low-confidence nudges are never scheduled",
);
assert(
  selectNudges(Array.from({ length: 6 }, (_, i) => nudge({ kind: `k${i}` }))).length === 3,
  "at most three nudges are scheduled so the app never nags",
);
assert(
  selectNudges([
    nudge({ kind: "weekly_target", confidence: 0.6 }),
    nudge({ kind: "usual_time", confidence: 0.9 }),
  ])[0].kind === "weekly_target",
  "the server's priority order is kept",
);

const targetNudge = nudge({ kind: "weekly_target", hour: 17 });
const thursdayMorning = new Date(2026, 8, 10, 9, 0, 0);
const firstPlan = planCoachNotifications([targetNudge], thursdayMorning, {});
const firstTrigger = firstPlan.planned[0]?.trigger;
const firstFire = firstTrigger?.type === "date" ? firstTrigger.date : null;
assert(
  firstFire !== null &&
    firstFire.getDate() === 10 &&
    firstFire.getHours() === 15 &&
    firstFire.getMinutes() === 30,
  "a one-time nudge fires today, 90 minutes before the usual start",
);
assert(
  planCoachNotifications([targetNudge], new Date(2026, 8, 10, 19, 0, 0), firstPlan.log)
    .planned.length === 0,
  "the same one-time advice does not fire twice on one day",
);
assert(
  planCoachNotifications([targetNudge], new Date(2026, 8, 11, 9, 0, 0), firstPlan.log)
    .planned.length === 1,
  "a weekly target reminder may return the next day",
);
const keptTrigger = planCoachNotifications(
  [targetNudge],
  new Date(2026, 8, 10, 12, 0, 0),
  firstPlan.log,
).planned[0]?.trigger;
assert(
  keptTrigger?.type === "date" && keptTrigger.date.getTime() === firstFire?.getTime(),
  "a nudge planned for later keeps its moment when the app reopens",
);
assert(
  planCoachNotifications(
    [nudge({ kind: "weekly_target", hour: 17, expiresAt: new Date(2026, 8, 10, 12, 0, 0).toISOString() })],
    thursdayMorning,
    {},
  ).planned.length === 0,
  "advice that expires before it would fire is dropped",
);
assert(
  planCoachNotifications([nudge()], thursdayMorning, {
    "best_time:gym": new Date(2026, 8, 5, 10, 0, 0).getTime(),
  }).planned.length === 0,
  "a quality insight waits two weeks before it repeats",
);
const weeklyPlan = planCoachNotifications(
  [nudge({ kind: "usual_time", weekday: 1, hour: 17, timing: "weekly" })],
  thursdayMorning,
  {},
);
const weeklyTrigger = weeklyPlan.planned[0]?.trigger;
assert(
  weeklyTrigger?.type === "weekly" &&
    weeklyTrigger.weekday === 1 &&
    weeklyTrigger.hour === 15 &&
    weeklyTrigger.minute === 30,
  "a habit reminder repeats every Monday at 15:30",
);
assert(Object.keys(weeklyPlan.log).length === 0, "weekly reminders need no delivery log");

const parsedNudges = parseCoachNudges({
  status: "ready",
  nudges: [
    { kind: "best_slot", goalId: "gym", weekday: 2, hour: 14, title: "Good", body: "A believable body.", confidence: 0.4, written: true },
    { kind: "broken", goalId: "gym", weekday: 99, hour: 14, title: "x", body: "" },
    { kind: "cadence_due", goalId: "gym", weekday: null, hour: 9, title: "Overdue", body: "Cached before timing existed.", confidence: 0.5 },
    { kind: "usual_time", goalId: "gym", weekday: null, hour: 9, timing: "weekly", title: "Weekly", body: "A weekly nudge without a day.", confidence: 0.5 },
  ],
  source: "model",
  generated_at: "2026-09-01T10:00:00.000Z",
  sessions_analyzed: 42,
});
assert(parsedNudges.nudges.length === 3, "unusable server entries are dropped");
assert(parsedNudges.nudges[0].timing === "weekly", "older cached nudges with a weekday keep repeating weekly");
assert(parsedNudges.nudges[1].timing === "once", "older cached nudges without a weekday fire once, not daily");
assert(parsedNudges.nudges[2].timing === "once", "a weekly nudge without a day cannot repeat and fires once");
assert(parsedNudges.sessionsAnalyzed === 42, "the analyzed count is carried through");
assert(
  parseCoachNudges(null).status === "insufficient_data",
  "a missing payload is treated as no advice, not as an error",
);

console.log(`Domain smoke tests passed: ${assertionCount} assertions.`);
