import {
  advancePomodoro,
  computeAdaptiveBreakMinutes,
  computeFlowtimeBreakMinutes,
  sessionMinutesToRatio,
  sessionRatioToMinutes,
  catchUpAfterGap,
  isStaleSession,
  MAX_CATCH_UP_SECONDS,
  MAX_PLAUSIBLE_FOCUS_SECONDS,
  SESSION_ABANDONED_AFTER_SECONDS,
} from "../src/lib/pomodoro";
import { computeStreak } from "../src/lib/streaks";
import { detectStudySpot } from "../src/lib/studySpots";
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
import {
  asGrowCategory,
  categoryRoom,
  computeGrowSize,
  MAX_GROW_SESSION_SECONDS,
  MIN_GROW_SESSION_SECONDS,
  sessionEarnsReward,
  defaultGrowOption,
  describeGrowLevel,
  describeGrowOption,
  describeGrowSize,
  GROW_CATEGORIES,
  GROW_OBJECTS,
  GROW_STEPS_BY_TIER,
  categoryCount,
  growCopies,
  growOptions,
  isGrowCategory,
  type GrowCategory,
  liveGrowth,
  tierForRatio,
  type GrowOption,
  type GrowSizeTier,
} from "../src/lib/growRewards";
import {
  categoryLimit,
  ISLAND_CATEGORY_LIMITS,
  ISLAND_STAGE_LEVELS,
  ISLAND_STAGE_METRES,
  islandGrowth,
  islandStageFor,
  TOTAL_GROWTH_LEVELS,
  standingObjects,
  waterPieces,
} from "../src/lib/islandScene";
import { PIECE_SPRITES } from "../src/components/grow/waterPieceSprites";
import { EMPTY_ISLAND, islandIsEmpty, mergeIslands } from "../src/lib/islandMerge";
import {
  earnedMilestones,
  MILESTONE_OBJECT_KEYS,
  missingMilestones,
  nextMilestone,
} from "../src/lib/milestones";
import { SPECIAL_SPRITES } from "../src/components/grow/specialSprites";
import { LAND_OBJECTS as LAND_FOR_MILESTONES } from "../src/lib/islandLand";
import {
  AUTO_APPLY_AFTER_HOURS,
  autoGrowPick,
  islandCanTakeAReward,
  MAX_WAITING_REWARDS,
  overdueGrows,
} from "../src/lib/growDelivery";
import { LAND_OBJECTS } from "../src/lib/islandLand";
import {
  groundCells,
  objectCells,
  resolveSpots,
  seedForUser,
  stageZones,
} from "../src/lib/islandPlacement";
import { cellAt, cellCentre, zoneAt } from "../src/lib/islandZones";
import {
  baseKeyOf,
  countOf,
  instanceId,
  nextInstanceId,
} from "../src/lib/islandInstances";
import {
  FLOW_TARGET_STEPS,
  FLOW_TARGET_SWEEP,
  flowTargetAt,
  flowTargetIndex,
  flowTargetTurn,
  formatFlowTarget,
  snapFlowTarget,
} from "../src/lib/flowTarget";
import { normalizeMinVisitMinutes } from "../src/types";
import {
  REWARD_MILESTONES,
  formatMilestoneHours,
  formatRewardHours,
  rewardProgress,
  totalTrackedHours,
} from "../src/lib/rewards";
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
import { computeDisposableTime, formatTimer } from "../src/lib/time";
import { BEACH_SPRITES } from "../src/components/grow/beachSprites";
import { describeSetupSaveError } from "../src/lib/setupSaveError";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { islandSprite, spriteReach } from "../src/components/island/islandSprites";
import { BUILDING_SPRITES } from "../src/components/grow/buildingSprites";
import { PLANT_SPRITES } from "../src/components/grow/plantSprites";
import { WATER_SPRITES } from "../src/components/grow/waterSprites";
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
import { consistentEndTime } from "../src/lib/sessionTimes";
import type { Goal, PomodoroState } from "../src/types";

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

const repeatedSetupPlan = planOnboardingGoals(existingOnboardingGoals, false, {
  preserveExistingPhysicalGoal: true,
});
assert(
  repeatedSetupPlan.focusGoalId === "focus-new",
  "a repeated setup writes the new weekly target into the existing focus goal",
);
assert(
  !repeatedSetupPlan.deactivateGoalIds.includes("physical-new"),
  "a repeated setup that skips Auto Check-In keeps the account's check-in goal",
);
assert(
  repeatedSetupPlan.deactivateGoalIds.includes("physical-old"),
  "a repeated setup still retires older duplicate check-in goals",
);
assert(
  !repeatedSetupPlan.createPhysicalGoal && repeatedSetupPlan.physicalGoalId === null,
  "a repeated setup without Auto Check-In neither creates nor rewrites a check-in goal",
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

assert(REWARD_MILESTONES.length === 10, "the rewards roadmap has ten milestones");
assert(
  REWARD_MILESTONES.every((m, i) => i === 0 || m.hours > REWARD_MILESTONES[i - 1].hours),
  "reward milestones are strictly ascending in hours",
);
const rewardsAtStart = rewardProgress(0);
assert(
  rewardsAtStart.unlocked.length === 0 && rewardsAtStart.next?.hours === 5,
  "a new account starts before the first reward",
);
const rewardsAt100 = rewardProgress(100);
assert(
  rewardsAt100.unlocked.length === 5 && rewardsAt100.next?.hours === 200,
  "100 hours unlock the lighthouse and point at the next reward",
);
assert(rewardProgress(150).progressToNext === 0.5, "reward progress is measured from the previous milestone");
const rewardsDone = rewardProgress(5000);
assert(rewardsDone.next === null && rewardsDone.unlocked.length === 10, "past the last milestone every reward is unlocked");
assert(
  totalTrackedHours([
    { duration_seconds: 5400, end_time: "2026-09-10T10:00:00Z" },
    { duration_seconds: 1800, end_time: null },
    { duration_seconds: -5, end_time: "2026-09-10T11:00:00Z" },
  ]) === 1.5,
  "only finished sessions with a positive duration count toward rewards",
);
assert(
  formatRewardHours(4.26) === "4.2 h" && formatRewardHours(1234.9) === "1,234 h" && formatMilestoneHours(1000) === "1,000 h",
  "reward hours are shown compactly",
);

// ---------------------------------------------------------------------------
// Island growth: what grows and how big
// ---------------------------------------------------------------------------

const HOUR = 3600;
const pilatesHistory = Array.from({ length: 10 }, () => HOUR);
const studyHistory = Array.from({ length: 10 }, () => 3 * HOUR);
assert(computeGrowSize(2 * HOUR, []).label === "Medium", "without history every object is medium");
assert(
  computeGrowSize(2 * HOUR, pilatesHistory).label === "Huge",
  "two hours after a usual hour grows a huge object",
);
assert(
  computeGrowSize(2 * HOUR, studyHistory).label === "Small",
  "two hours after a usual three hours grows a small object",
);
assert(
  computeGrowSize(HOUR, pilatesHistory).label === "Medium" &&
    computeGrowSize(HOUR, pilatesHistory).score === 0.5,
  "a session of the usual length is medium, in the middle of the scale",
);
assert(
  computeGrowSize(2 * HOUR, [HOUR, HOUR]).label === "Medium",
  "with two earlier sessions the size still leans towards medium",
);
assert(
  computeGrowSize(2 * HOUR, [HOUR, HOUR, HOUR, HOUR]).label === "Large",
  "with four earlier sessions the comparison counts halfway",
);
assert(
  computeGrowSize(2 * HOUR, [...Array.from({ length: 12 }, () => 20), ...pilatesHistory])
    .usualSeconds === HOUR,
  "taps under five minutes never shape the usual length",
);
assert(
  tierForRatio(0.39) === 1 && tierForRatio(0.4) === 2 && tierForRatio(0.75) === 3 &&
    tierForRatio(1.35) === 4 && tierForRatio(1.99) === 4 && tierForRatio(2) === 5,
  "size tiers switch exactly at 0.4×, 0.75×, 1.35× and 2×",
);
assert(
  describeGrowSize(computeGrowSize(2 * HOUR, pilatesHistory), 2 * HOUR) === "2h · 2× your usual",
  "the reveal names the multiple of the usual length",
);
assert(
  describeGrowSize(computeGrowSize(45 * 60, []), 45 * 60).includes("first sessions grow medium"),
  "without history the reveal explains why the object is medium",
);
assert(
  liveGrowth(5 * 60, pilatesHistory, 25 * 60).visualScale <
    liveGrowth(90 * 60, pilatesHistory, 25 * 60).visualScale,
  "the object keeps growing while the session runs",
);
assert(
  liveGrowth(25 * 60, [], 25 * 60).visualScale === liveGrowth(40 * 60, [], 25 * 60).visualScale &&
    liveGrowth(5 * 60, [], 25 * 60).visualScale < liveGrowth(25 * 60, [], 25 * 60).visualScale,
  "without history it grows to medium over the planned length, then holds",
);
assert(
  !isGrowCategory("special") && asGrowCategory("special") === null && asGrowCategory("beach") === "beach",
  "sessions never grow special objects; those only come from the rewards roadmap",
);
const growKeys = GROW_CATEGORIES.flatMap((category) =>
  GROW_OBJECTS[category.key].map((object) => object.key),
);
const roadmapKeys: string[] = REWARD_MILESTONES.map((milestone) => milestone.object);
assert(
  GROW_OBJECTS.plant.length === 8 &&
    GROW_OBJECTS.beach.length === 8 &&
    GROW_OBJECTS.water.length === 7 &&
    GROW_OBJECTS.building.length === 10 &&
    new Set(growKeys).size === growKeys.length &&
    growKeys.every((key) => !roadmapKeys.includes(key)) &&
    GROW_CATEGORIES.every((category) =>
      GROW_OBJECTS[category.key].every((object) => object.maxLevel >= 2),
    ),
  "session objects follow catalog v1 with unique keys and no roadmap objects",
);
const growSteps = ([1, 2, 3, 4, 5] as GrowSizeTier[]).map((tier) => GROW_STEPS_BY_TIER[tier]);
assert(
  growSteps.every((steps, index) => index === 0 || steps >= growSteps[index - 1]) &&
    GROW_STEPS_BY_TIER[3] === 2,
  "a longer session never grows less, and a usual session grows two steps",
);
const findGrowOption = (options: GrowOption[], key: string): GrowOption => {
  const option = options.find((candidate) => candidate.object.key === key);
  if (!option) throw new Error(`missing grow option ${key}`);
  return option;
};
const newPlants = growOptions("plant", 3, {});
assert(
  newPlants.length === GROW_OBJECTS.plant.length &&
    newPlants.every((option) => option.action === "add" && option.fromLevel === 0),
  "on an empty island every object of the category can be added",
);
assert(
  growOptions("plant", 1, {})[0].toLevel === 1 &&
    growOptions("plant", 3, {})[0].toLevel === 2 &&
    growOptions("plant", 5, {})[0].toLevel === 4,
  "the session size sets the level a new object starts at",
);
const grownIsland = { leafy_tree: { level: 2 }, bush: { level: 10 }, grass_tufts: { level: 9 } };
const largePlants = growOptions("plant", 4, grownIsland);
assert(
  findGrowOption(largePlants, "leafy_tree").action === "grow" &&
    findGrowOption(largePlants, "leafy_tree").fromLevel === 2 &&
    findGrowOption(largePlants, "leafy_tree").toLevel === 5,
  "an object already on the island grows by the session's steps instead of appearing twice",
);
assert(
  findGrowOption(largePlants, "grass_tufts").toLevel === 10 &&
    !findGrowOption(largePlants, "bush").maxed &&
    findGrowOption(largePlants, "bush").another &&
    findGrowOption(largePlants, "bush").instanceId === "bush#2",
  "growth stops at the maximum, and a finished bush offers a second one instead",
);
{
  // Copies: the catalog allows several of a plant, and only when every one of
  // them is standing and finished is there nothing left to do (§15.10).
  const oneTree = { world_tree: { level: 10 } };
  assert(
    findGrowOption(growOptions("plant", 4, oneTree), "world_tree").maxed,
    "a one-off stays maxed — there is no second world tree",
  );
  const trees: Record<string, { level: number }> = {};
  const leafy = GROW_OBJECTS.plant.find((object) => object.key === "leafy_tree")!;
  for (let index = 1; index <= leafy.maxCount; index += 1) {
    trees[index === 1 ? "leafy_tree" : `leafy_tree#${index}`] = { level: leafy.maxLevel };
  }
  assert(
    countOf(trees, "leafy_tree") === leafy.maxCount &&
      findGrowOption(growOptions("plant", 4, trees), "leafy_tree").maxed &&
      nextInstanceId(trees, "leafy_tree", leafy.maxCount) === null,
    "once every allowed copy is fully grown the object really is finished",
  );
  const half = { leafy_tree: { level: leafy.maxLevel }, "leafy_tree#2": { level: 3 } };
  assert(
    findGrowOption(growOptions("plant", 1, half), "leafy_tree").instanceId === "leafy_tree#2" &&
      findGrowOption(growOptions("plant", 1, half), "leafy_tree").action === "grow",
    "the reward goes to the copy that is still growing, not to a new one",
  );
  assert(
    baseKeyOf("leafy_tree#4") === "leafy_tree" &&
      baseKeyOf("leafy_tree") === "leafy_tree" &&
      instanceId("bush", 1) === "bush" &&
      instanceId("bush", 3) === "bush#3",
    "an id says which copy, a key says what it looks like",
  );
  assert(
    countOf({ leafy_tree: { level: 4 }, "leafy_tree#3": { level: 1 } }, "leafy_tree") === 2 &&
      nextInstanceId({ leafy_tree: { level: 4 } }, "leafy_tree", 6) === "leafy_tree#2",
    "copies are counted by what stands there, and the next one fills the first gap",
  );
}
{
  // Finished now means every allowed copy is standing and grown, not just one.
  const allLeafy: Record<string, { level: number }> = {};
  const leafy = GROW_OBJECTS.plant.find((object) => object.key === "leafy_tree")!;
  for (let index = 1; index <= leafy.maxCount; index += 1) {
    allLeafy[index === 1 ? "leafy_tree" : `leafy_tree#${index}`] = { level: leafy.maxLevel };
  }
  assert(
    defaultGrowOption(growOptions("plant", 3, { leafy_tree: { level: 10 } }))?.object.key ===
      "leafy_tree" &&
      defaultGrowOption(growOptions("plant", 3, allLeafy))?.object.key === "bush",
    "one finished tree still offers a second; only a finished set is skipped when preselecting",
  );
}
const plantRoom = categoryRoom("plant", grownIsland);
assert(
  // Six to add: the five plants not there yet, plus a second bush now that the
  // first one is finished. Two still growing: the tree and the grass.
  plantRoom.add === 6 && plantRoom.grow === 2 && plantRoom.locked === 0,
  "category cards count what can be added — a further copy included — and what can grow",
);
// Truly full now means every allowed copy of every plant, grown out.
const fullPlants: Record<string, { level: number }> = {};
for (const object of GROW_OBJECTS.plant) {
  for (let index = 1; index <= object.maxCount; index += 1) {
    fullPlants[index === 1 ? object.key : `${object.key}#${index}`] = { level: object.maxLevel };
  }
}
assert(
  defaultGrowOption(growOptions("plant", 5, fullPlants)) === null &&
    categoryRoom("plant", fullPlants).add + categoryRoom("plant", fullPlants).grow === 0,
  "a fully grown category offers nothing",
);
assert(
  describeGrowOption(findGrowOption(growOptions("water", 3, {}), "dolphins")) === "New, ×5" &&
    describeGrowOption(findGrowOption(largePlants, "leafy_tree")) === "Stage 2 → 5" &&
    describeGrowOption(findGrowOption(growOptions("building", 2, { house: { level: 1 } }), "house")) ===
      "Size 1 → 2" &&
    describeGrowOption(findGrowOption(largePlants, "bush")) === "Another one, stage 3" &&
    describeGrowOption(findGrowOption(growOptions("plant", 3, fullPlants), "bush")) ===
      "Fully grown",
  "each option says whether the reward adds, grows, multiplies or starts a further copy",
);
assert(
  describeGrowLevel(GROW_OBJECTS.plant[0], 2) === "Stage 2 of 10" &&
    describeGrowLevel(findGrowOption(growOptions("water", 3, {}), "dolphins").object, 4) === "9 of 27",
  "the added screen names the level the object reached",
);

// --- the island itself: its size and what stands in the water ---------------
assert(
  ISLAND_STAGE_LEVELS.every(
    (levels, index) => index === 0 || levels > ISLAND_STAGE_LEVELS[index - 1],
  ) && ISLAND_STAGE_LEVELS[ISLAND_STAGE_LEVELS.length - 1] < TOTAL_GROWTH_LEVELS,
  "every island size needs more than the one before it, and the largest is reachable",
);
assert(
  islandStageFor({}) === 1 &&
    islandStageFor({ house: { level: 10 }, library: { level: 12 }, boat: { level: 5 } }) === 2,
  "the island grows with everything that stands on it",
);
assert(waterPieces(1, {}).length === 0, "an empty island has nothing in the water");
const fleetIsland = {
  dock: { level: 4 },
  boat: { level: 12 },
  dolphins: { level: 5 },
  gulls: { level: 3 },
};
const drawnWater = waterPieces(5, fleetIsland);
const countSprites = (pieces: { sprite: string }[], prefix: string) =>
  pieces.filter((piece) => piece.sprite.startsWith(prefix)).length;
assert(
  countSprites(drawnWater, "dock") === 1 &&
    countSprites(drawnWater, "boat_") === 3 &&
    countSprites(drawnWater, "dolphin") === 12 &&
    countSprites(drawnWater, "gull") === 3,
  "past the last hull the fleet grows, and a dolphin level is a whole school",
);
assert(
  drawnWater.slice(-3).every((piece) => piece.sprite.startsWith("gull")),
  "gulls fly above everything else, so they are drawn last",
);
const fullWater: Record<string, { level: number }> = {};
for (const object of GROW_OBJECTS.water) fullWater[object.key] = { level: object.maxLevel };
// A small island shows a smaller fleet: there is less sea around it, and the
// pieces are the same size on every stage. The fleet only ever grows with the
// island, the largest island shows all of it, and nothing is drawn that has no
// picture.
let drawnBefore = 0;
for (const stage of [1, 2, 3, 4, 5] as const) {
  const pieces = waterPieces(stage, fullWater);
  assert(
    pieces.every((piece) => PIECE_SPRITES[piece.sprite] !== undefined),
    `stage ${stage} draws only pieces that have a picture`,
  );
  assert(
    pieces.length >= drawnBefore && pieces.length <= 72,
    `stage ${stage} never shows less of the fleet than the island before it`,
  );
  drawnBefore = pieces.length;
}
assert(drawnBefore === 72, "the largest island shows the whole fleet, all 72 pieces");
// What you own is never invisible: one of everything shows one of everything.
const oneOfEach: Record<string, { level: number }> = {};
for (const object of GROW_OBJECTS.water) oneOfEach[object.key] = { level: 1 };
for (const stage of [1, 2, 3, 4, 5] as const) {
  const kinds = new Set(
    waterPieces(stage, oneOfEach).map((piece) => piece.sprite.replace(/[_0-9].*$/, "")),
  );
  assert(
    kinds.size === GROW_OBJECTS.water.length,
    `island ${stage} shows every kind of water object the player owns`,
  );
}

// --- a failure has to name its own reason ------------------------------------
{
  // "Check your connection" for a permission error cost a real user days: he
  // checked his connection, reinstalled, and checked again, while the app was
  // being refused by the database. A wrong reason is worse than no reason.
  const denied = describeSetupSaveError({ code: "42501", message: "permission denied" });
  assert(!denied.canRetry, "a refusal does not offer a button that repeats it");
  assert(
    !denied.message.includes("connection"),
    "a refusal is never explained as a connection problem",
  );
  const missing = describeSetupSaveError(new Error("Your account profile is missing."));
  assert(
    !missing.canRetry && missing.message.includes("Sign out"),
    "a missing profile says what actually helps",
  );
  const offline = describeSetupSaveError({ message: "Network request failed" });
  assert(
    offline.canRetry && offline.message.includes("connection"),
    "a real connection problem still says so, and still offers another try",
  );
  assert(describeSetupSaveError(null).canRetry, "an unknown failure is worth one more try");
}

// --- a reward nobody came back for is still placed ---------------------------
{
  // `growDelivery.ts` was fully written, documented and covered by these tests —
  // and nothing in the app ever called it. The reveal screen promised a blocked
  // reward would "land by itself", Home held a celebration for it, and neither
  // could ever happen. Logic without a caller is not a feature, so the wiring
  // is part of what these tests protect.
  // From the repo root: the suite is run through npm, and the compiled tests
  // sit in a build directory whose depth is not this test's business.
  const repo = process.cwd();
  const appSource = readFileSync(join(repo, "App.tsx"), "utf8");
  const hookSource = readFileSync(join(repo, "src", "hooks", "useGrowDelivery.ts"), "utf8");
  assert(
    appSource.includes("useGrowDelivery()"),
    "the app mounts the hook that places waiting rewards",
  );
  assert(
    hookSource.includes("overdueGrows") && hookSource.includes("autoGrowPick"),
    "that hook is the one that uses the delivery rules",
  );
  assert(
    hookSource.includes("applyGrowReward") && hookSource.includes("removePendingGrow"),
    "a reward it places is both put on the island and taken off the waiting list",
  );
  // A reward the player has open in front of them is theirs to decide. Without
  // this the reveal screen answers its own question and says "Already on your
  // island" while somebody is still choosing.
  const revealSource = readFileSync(
    join(repo, "src", "screens", "GrowRevealScreen.tsx"),
    "utf8",
  );
  assert(
    hookSource.includes("revealIsOpenFor"),
    "the delivery leaves alone the reward whose reveal is open",
  );
  assert(
    revealSource.includes("markRevealOpen") && revealSource.includes("markRevealClosed"),
    "the reveal screen says while it is open, and says when it closes",
  );

  // Placing several overdue rewards in a row must respect the island's room:
  // each one is decided against the island the one before it left behind.
  let island: Record<string, { level: number }> = {};
  const limitFor = (category: GrowCategory) =>
    categoryLimit(islandStageFor(island), category);
  let placed = 0;
  for (let round = 0; round < 40; round += 1) {
    const pick = autoGrowPick({ category: "plant", objectKey: null }, 3, island, limitFor);
    if (!pick) break;
    island = { ...island, [pick.instanceId]: { level: pick.toLevel } };
    placed += 1;
    assert(
      categoryCount("plant", island) <= limitFor("plant"),
      "placing rewards one after another never overfills a category",
    );
  }
  assert(placed > 0, "an empty island can take a reward");
  // A full island hands back nothing rather than inventing a place, so the
  // reward keeps waiting instead of being thrown away.
  const stuffed: Record<string, { level: number }> = {};
  for (const category of GROW_CATEGORIES) {
    for (const object of GROW_OBJECTS[category.key]) {
      for (let copy = 1; copy <= growCopies(object); copy += 1) {
        stuffed[copy === 1 ? object.key : `${object.key}#${copy}`] = { level: object.maxLevel };
      }
    }
  }
  assert(
    autoGrowPick({ category: "plant", objectKey: null }, 3, stuffed, () => 99) === null,
    "a finished island takes no more rewards, and says so instead of guessing",
  );
}

// --- taking hold of an object goes by its picture ----------------------------
{
  // A house is drawn tall and upwards from the cell it stands on, so asking
  // which ground cell a touch landed in meant grabbing a house by its doorstep.
  // A touch anywhere on the drawing has to count.
  const house = islandSprite("house_5");
  assert(house !== null && house.h > 10, "the house has a picture to be grabbed by");
  if (house) {
    const middle = -Math.round(house.h * 0.45);
    assert(
      spriteReach("house_5", 0, 0, 0, middle) === 0,
      "a touch in the middle of the house is a touch on the house",
    );
    assert(
      (spriteReach("house_5", 0, 0, 0, -house.h - 40) ?? 0) > 20,
      "well above the roof is not the house any more",
    );
    assert(spriteReach("no_such_sprite_9", 0, 0, 0, 0) === null, "an unknown picture is no target");
  }
  // Every land object a player can own has to be reachable this way, or it
  // cannot be moved at all.
  for (const category of GROW_CATEGORIES) {
    for (const object of GROW_OBJECTS[category.key]) {
      const name = `${object.key}_${object.maxLevel}`;
      const sprite = islandSprite(name);
      if (!sprite) continue; // water objects have no land picture
      assert(
        sprite.rows.some((row) => row.split("").some((char) => char !== ".")),
        `${name}: a picture with something in it`,
      );
    }
  }
}

// --- copies and pieces are not the same thing --------------------------------
{
  // `maxCount` means copies for a tree and pieces for a group. Reading it as
  // copies everywhere would put ten patches of eight shells on the beach and
  // hand out levels for a second set of buoys the water never draws.
  for (const category of GROW_CATEGORIES) {
    for (const object of GROW_OBJECTS[category.key]) {
      assert(
        growCopies(object) === (object.growth === "multiply" ? 1 : Math.max(1, object.maxCount)),
        `${object.key}: a group is one object, anything else has its copies`,
      );
    }
  }
  const maxedGroup: Record<string, { level: number }> = {};
  for (const object of GROW_OBJECTS.water) maxedGroup[object.key] = { level: object.maxLevel };
  for (const option of growOptions("water", 3, maxedGroup)) {
    assert(
      option.maxed && option.instanceId === option.object.key,
      `${option.object.key}: a finished group is finished, it never starts a second one`,
    );
  }
  // A tree is the other case: once one is grown the next one starts.
  const oneTree = { leafy_tree: { level: 10 } };
  const treeOption = growOptions("plant", 3, oneTree).find((o) => o.object.key === "leafy_tree");
  assert(
    treeOption !== undefined && !treeOption.maxed && treeOption.instanceId === "leafy_tree#2",
    "a grown tree makes room for the next one, not for nothing",
  );
}

// --- how far to the next island size ----------------------------------------
{
  const empty = islandGrowth({});
  assert(
    empty.stage === 1 && empty.levels === 0 && empty.nextAt === 25 && empty.toNext === 25,
    "a fresh island is size 1 and says how far the next one is",
  );
  const almost = islandGrowth({ leafy_tree: { level: 10 }, bush: { level: 10 }, house: { level: 4 } });
  assert(
    almost.levels === 24 && almost.stage === 1 && almost.toNext === 1 && almost.ratio > 0.9,
    "one level short of growing, and the ratio says so",
  );
  const grown = islandGrowth({ leafy_tree: { level: 10 }, bush: { level: 10 }, house: { level: 5 } });
  assert(
    grown.stage === 2 && grown.toNext === 45 && grown.ratio < 0.1,
    "reaching the mark grows the island and the count starts again from there",
  );
  const finished: Record<string, { level: number }> = {};
  for (const category of GROW_CATEGORIES) {
    for (const object of GROW_OBJECTS[category.key]) finished[object.key] = { level: object.maxLevel };
  }
  const full = islandGrowth(finished);
  assert(
    full.stage === 5 && full.nextAt === null && full.toNext === null && full.ratio === 1,
    "the largest island has nothing left to reach and never shows a countdown",
  );
  // The last island size arrives long before the catalog is finished, so there
  // has to be something left to read after it. Without this the app said "fully
  // grown" with hundreds of levels still to collect.
  assert(
    full.toFinish > 0 && full.completion > 0 && full.completion < 1 && !full.complete,
    "the largest island is not the end: the collection still has a distance to go",
  );
  const everything: Record<string, { level: number }> = {};
  for (const category of GROW_CATEGORIES) {
    for (const object of GROW_OBJECTS[category.key]) {
      for (let copy = 1; copy <= growCopies(object); copy += 1) {
        everything[copy === 1 ? object.key : `${object.key}#${copy}`] = { level: object.maxLevel };
      }
    }
  }
  const done = islandGrowth(everything);
  assert(
    done.complete && done.toFinish === 0 && done.levels === done.total && done.completion === 1,
    "growing every copy of everything finishes the island exactly",
  );
  assert(
    islandGrowth({}).total === done.total && done.total > ISLAND_STAGE_LEVELS[4],
    "the catalog total is fixed and larger than the levels the last island needs",
  );
  assert(
    ISLAND_STAGE_METRES.length === ISLAND_STAGE_LEVELS.length &&
      ISLAND_STAGE_METRES.every((m, i) => i === 0 || m > ISLAND_STAGE_METRES[i - 1]),
    "every island size has a width to name, and they only get bigger",
  );
}

// --- the Flowtime target scale ----------------------------------------------
assert(
  FLOW_TARGET_STEPS[0] === 5 &&
    FLOW_TARGET_STEPS[FLOW_TARGET_STEPS.length - 1] === 960 &&
    FLOW_TARGET_STEPS.every((value, index) => index === 0 || value > FLOW_TARGET_STEPS[index - 1]),
  "the target scale runs from 5 minutes to 16 hours and only ever climbs",
);
assert(
  FLOW_TARGET_STEPS.every((value) => value % 5 === 0) &&
    FLOW_TARGET_STEPS.filter((value) => value <= 60).length === 12,
  "every step is a round number, and a third of the turn covers the first hour",
);
assert(
  FLOW_TARGET_STEPS.every((value) => snapFlowTarget(value) === value) &&
    snapFlowTarget(23) === 25 &&
    snapFlowTarget(1) === 5 &&
    snapFlowTarget(99999) === 960,
  "anything in between takes the nearer step, and the ends hold",
);
assert(
  FLOW_TARGET_STEPS.every((value, index) => flowTargetAt(index) === value) &&
    FLOW_TARGET_STEPS.every((value, index) => flowTargetIndex(value) === index),
  "a target and its place on the dial always find each other again",
);
assert(
  flowTargetTurn(5) === 0 &&
    flowTargetTurn(960) === 1 &&
    FLOW_TARGET_SWEEP === 1 &&
    flowTargetTurn(60) > 0.2 &&
    flowTargetTurn(60) < 0.35,
  "16 h is one whole turn, and the first hour still sits inside the first third",
);
// No step may be coarser than an hour. The scale once jumped from twelve hours
// to fourteen, so a target a person would say out loud could not be set at all.
assert(
  FLOW_TARGET_STEPS.every((value, index) => index === 0 || value - FLOW_TARGET_STEPS[index - 1] <= 60),
  "the dial never skips more than an hour at a time",
);
assert(
  [13, 14, 15, 16].every((hours) => FLOW_TARGET_STEPS.includes(hours * 60)),
  "every whole hour near the top of the scale can actually be chosen",
);
assert(
  formatFlowTarget(45) === "45 min" &&
    formatFlowTarget(90) === "1 h 30" &&
    formatFlowTarget(120) === "2 h" &&
    formatFlowTarget(960) === "16 h",
  "the target reads as minutes below an hour and as hours above it",
);

// --- where a new object goes ------------------------------------------------
/** The largest picture an object ever has, so the test uses its biggest foot. */
function maxLevelOf(key: string): number {
  for (const category of GROW_CATEGORIES) {
    const found = GROW_OBJECTS[category.key].find((object) => object.key === key);
    if (found) return found.maxLevel;
  }
  return 1;
}

// Full-grown, so the test covers the biggest foot every object can have.
const allLand = Object.keys(LAND_OBJECTS).map((key) => ({ key, level: maxLevelOf(key) }));
const bigIsland = stageZones(5);
const spots = resolveSpots(5, allLand, {}, 42);
assert(
  Object.keys(spots).length === allLand.length,
  "on the biggest island every object finds a place",
);
assert(
  allLand.every((object) =>
    groundCells(object.key, object.level, spots[object.key]).every(
      (cell) =>
        zoneAt(bigIsland, cell.i, cell.j) ===
        (LAND_OBJECTS[object.key].zone === "grass" ? "G" : "B"),
    ),
  ),
  "every object stands on the right ground with its whole foot, not just its middle",
);
const usedCells = new Set<string>();
let clashes = 0;
for (const object of allLand) {
  for (const cell of objectCells(object.key, object.level, spots[object.key])) {
    const name = `${cell.i},${cell.j}`;
    if (usedCells.has(name)) clashes += 1;
    usedCells.add(name);
  }
}
assert(clashes === 0, "two objects never claim the same ground");
assert(
  JSON.stringify(resolveSpots(5, allLand, {}, 42)) === JSON.stringify(spots),
  "the same island always looks the same",
);
assert(
  JSON.stringify(resolveSpots(5, allLand, {}, 43)) !== JSON.stringify(spots),
  "another player gets another layout",
);
const twoThings = [
  { key: "leafy_tree", level: 1 },
  { key: "house", level: 1 },
];
const firstTwo = resolveSpots(3, twoThings, {}, 42);
const withMore = resolveSpots(
  3,
  [...twoThings, { key: "windmill", level: 1 }, { key: "cafe", level: 1 }],
  firstTwo,
  42,
);
assert(
  twoThings.every(
    ({ key }) => withMore[key].i === firstTwo[key].i && withMore[key].j === firstTwo[key].j,
  ),
  "what already stands does not move when something new is added",
);
assert(
  seedForUser("a") !== seedForUser("b") && seedForUser("a") === seedForUser("a"),
  "the layout seed follows the account",
);

// --- how much fits on each island size --------------------------------------
const islandStages = [1, 2, 3, 4, 5] as const;
assert(
  GROW_CATEGORIES.every((category) =>
    islandStages.every(
      (stage) =>
        categoryLimit(stage, category.key) <= GROW_OBJECTS[category.key].length &&
        (stage === 1 ||
          categoryLimit(stage, category.key) >= categoryLimit((stage - 1) as 1, category.key)),
    ),
  ),
  "a bigger island never holds less, and never more than the catalog has",
);
assert(
  categoryLimit(1, "beach") < GROW_OBJECTS.beach.length &&
    categoryLimit(5, "beach") === GROW_OBJECTS.beach.length &&
    categoryLimit(5, "water") === GROW_OBJECTS.water.length,
  "the smallest island cannot hold every beach object, the biggest holds everything",
);
// Whether the placement can physically pack these numbers is not asserted here:
// it depends on object sizes and the placement rules, which live elsewhere and
// change on their own schedule. `python3 island/pixel/preview_islands.py limits`
// measures it and prints the table to put into ISLAND_CATEGORY_LIMITS; run it
// after changing object sizes, the island shape or the placement.
assert(
  islandStages.every((stage) =>
    GROW_CATEGORIES.every((category) => {
      const inCatalog = GROW_OBJECTS[category.key].filter(
        (object) => category.key === "water" || LAND_OBJECTS[object.key],
      ).length;
      return categoryLimit(stage, category.key) <= inCatalog;
    }),
  ),
  "no island promises room for an object the catalog does not have",
);
// The placing screen turns a touch back into a cell with `cellAt`. If that ever
// stops being the exact inverse of `cellCentre`, the ghost object sits somewhere
// other than the finger and nobody would see why.
{
  const zones = stageZones(4);
  let roundTrips = 0;
  for (let i = -12; i <= 12; i += 3) {
    for (let j = -12; j <= 12; j += 3) {
      const centre = cellCentre(zones, i, j);
      const back = cellAt(zones, centre.x, centre.y + 2);
      if (back.i === i && back.j === j) roundTrips += 1;
    }
  }
  assert(roundTrips === 81, "a touch on a cell's middle finds that cell again");
}

const fullBeach: Record<string, { level: number }> = {};
for (const object of GROW_OBJECTS.beach.slice(0, ISLAND_CATEGORY_LIMITS.beach[0])) {
  fullBeach[object.key] = { level: 2 };
}
const beachOptions = growOptions("beach", 3, fullBeach, categoryLimit(1, "beach"));
assert(
  beachOptions.filter((option) => option.locked).length ===
    GROW_OBJECTS.beach.length - ISLAND_CATEGORY_LIMITS.beach[0] &&
    beachOptions.every((option) => option.action !== "grow" || !option.locked),
  "once the island is full only what already stands there can still grow",
);
assert(
  describeGrowOption(findGrowOption(beachOptions, "hammock")) === "Island too small" &&
    defaultGrowOption(beachOptions)?.object.key === GROW_OBJECTS.beach[0].key &&
    categoryRoom("beach", fullBeach, categoryLimit(1, "beach")).add === 0,
  "a locked object says why, is never preselected and does not count as room",
);
assert(
  growOptions("beach", 3, fullBeach, categoryLimit(3, "beach")).every(
    (option) => !option.locked,
  ),
  "the next island size opens the category up again",
);

// --- every stage a player can reach has a picture ---------------------------
const spriteSets = [PLANT_SPRITES, BUILDING_SPRITES, WATER_SPRITES, BEACH_SPRITES];
const withoutArt: string[] = [];
for (const category of GROW_CATEGORIES) {
  for (const object of GROW_OBJECTS[category.key]) {
    for (let level = 1; level <= object.maxLevel; level += 1) {
      const key = `${object.key}_${level}`;
      if (!spriteSets.some((set) => set[key])) withoutArt.push(key);
    }
  }
}
assert(
  withoutArt.length === 0,
  `every level in the catalog has a sprite (missing: ${withoutArt.join(", ")})`,
);

// --- the category summary must not call a small island "fully grown" --------
const twoPlants: Record<string, { level: number }> = {
  leafy_tree: { level: GROW_OBJECTS.plant[0].maxLevel },
  bush: { level: GROW_OBJECTS.plant[1].maxLevel },
};
const cramped = categoryRoom("plant", twoPlants, 2);
assert(
  // All eight are held back now, the two finished ones included: with copies
  // allowed they would each take another place, and there is none.
  cramped.add === 0 && cramped.grow === 0 && cramped.locked === GROW_OBJECTS.plant.length,
  "an island that is merely too small reports locked objects, not an empty category",
);
const roomy = categoryRoom("plant", twoPlants, GROW_OBJECTS.plant.length + 2);
assert(
  roomy.add === GROW_OBJECTS.plant.length && roomy.locked === 0,
  "with room again the same island offers every remaining object, copies included",
);
// Genuinely finished: every copy of every plant, grown out.
const everythingMaxed: Record<string, { level: number }> = {};
let maxedCount = 0;
for (const object of GROW_OBJECTS.plant) {
  for (let index = 1; index <= object.maxCount; index += 1) {
    everythingMaxed[index === 1 ? object.key : `${object.key}#${index}`] = {
      level: object.maxLevel,
    };
    maxedCount += 1;
  }
}
assert(
  categoryRoom("plant", everythingMaxed, maxedCount).locked === 0,
  "a genuinely finished category has nothing locked",
);

// --- a finished session always leaves something on the island ---------------
const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3600 * 1000).toISOString();
const waiting = (id: string, hours: number) => ({
  sessionId: id,
  endedAt: hoursAgo(hours),
  category: null,
  objectKey: null,
});
assert(
  overdueGrows([waiting("a", 1)], Date.now()).length === 0,
  "a reward the player just earned is left for them to place",
);
assert(
  overdueGrows([waiting("a", AUTO_APPLY_AFTER_HOURS + 1)], Date.now())[0]?.sessionId === "a",
  "a reward nobody came back for is placed by the app",
);
const queue = [waiting("old", 5), waiting("mid", 3), waiting("new", 1), waiting("newest", 0)];
const spilled = overdueGrows(queue, Date.now());
assert(
  queue.length === MAX_WAITING_REWARDS + 1 &&
    spilled.length === 1 &&
    spilled[0].sessionId === "old",
  "when rewards pile up the oldest is placed, so the queue never grows without end",
);
assert(
  overdueGrows([{ ...waiting("broken", 1), endedAt: "not a date" }], Date.now()).length === 1,
  "a reward with an unreadable date is placed rather than kept for ever",
);

const emptyIsland: Record<string, { level: number }> = {};
const noLimit = () => Number.POSITIVE_INFINITY;
assert(
  autoGrowPick({ category: "plant", objectKey: "palm_tree" }, 3, emptyIsland, noLimit)
    ?.objectKey === "palm_tree",
  "an unplaced reward grows the object the player watched in the timer",
);
const palmDone = { palm_tree: { level: GROW_OBJECTS.plant[6].maxLevel } };
assert(
  // A finished palm is not the end of palms: the reward starts the next one,
  // because that is still the object the player watched (§15.10 copies).
  GROW_OBJECTS.plant[6].key === "palm_tree" &&
    autoGrowPick({ category: "plant", objectKey: "palm_tree" }, 3, palmDone, noLimit)
      ?.instanceId === "palm_tree#2",
  "a finished object starts a further copy of itself before moving on",
);
{
  const palmsDone: Record<string, { level: number }> = {};
  const palm = GROW_OBJECTS.plant[6];
  for (let index = 1; index <= palm.maxCount; index += 1) {
    palmsDone[index === 1 ? "palm_tree" : `palm_tree#${index}`] = { level: palm.maxLevel };
  }
  assert(
    autoGrowPick({ category: "plant", objectKey: "palm_tree" }, 3, palmsDone, noLimit)
      ?.objectKey === GROW_OBJECTS.plant[0].key,
    "only when every copy is standing does the reward move to the next object",
  );
}
const plantsDone: Record<string, { level: number }> = {};
for (const object of GROW_OBJECTS.plant) {
  for (let index = 1; index <= object.maxCount; index += 1) {
    plantsDone[index === 1 ? object.key : `${object.key}#${index}`] = { level: object.maxLevel };
  }
}
assert(
  autoGrowPick({ category: "plant", objectKey: null }, 3, plantsDone, noLimit)?.category ===
    "building",
  "a full category passes the reward on instead of losing it",
);
assert(
  autoGrowPick({ category: "plant", objectKey: null }, 3, emptyIsland, () => 0)?.category ===
    undefined,
  "with no room anywhere the reward keeps waiting",
);
const everythingDone: Record<string, { level: number }> = {};
for (const category of GROW_CATEGORIES) {
  for (const object of GROW_OBJECTS[category.key]) {
    for (let index = 1; index <= object.maxCount; index += 1) {
      everythingDone[index === 1 ? object.key : `${object.key}#${index}`] = {
        level: object.maxLevel,
      };
    }
  }
}
assert(
  !islandCanTakeAReward(3, everythingDone, noLimit) && islandCanTakeAReward(3, emptyIsland, noLimit),
  "only a finished island has nowhere left for a reward",
);

assert(
  !sessionEarnsReward(MIN_GROW_SESSION_SECONDS - 1) &&
    sessionEarnsReward(MIN_GROW_SESSION_SECONDS) &&
    sessionEarnsReward(90 * 60) &&
    !sessionEarnsReward(MAX_GROW_SESSION_SECONDS + 1) &&
    !sessionEarnsReward(Number.NaN),
  "one rule decides whether a session earned an object, runaway counters included",
);

// --- two phones, one island -------------------------------------------------
const phoneA = {
  objects: {
    leafy_tree: { objectKey: "leafy_tree", category: "plant" as const, level: 5, updatedAt: "2026-09-15T10:00:00.000Z" },
    house: { objectKey: "house", category: "building" as const, level: 2, updatedAt: "2026-09-15T10:00:00.000Z" },
  },
  spots: { leafy_tree: { i: 1, j: 1 }, house: { i: 4, j: 4 } },
  appliedSessions: ["s1", "s2"],
};
const phoneB = {
  objects: {
    leafy_tree: { objectKey: "leafy_tree", category: "plant" as const, level: 3, updatedAt: "2026-09-15T12:00:00.000Z" },
    windmill: { objectKey: "windmill", category: "building" as const, level: 1, updatedAt: "2026-09-15T12:00:00.000Z" },
  },
  spots: { leafy_tree: { i: 9, j: 9 }, windmill: { i: 2, j: 2 } },
  appliedSessions: ["s2", "s3"],
};
const islandMerged = mergeIslands(phoneA, phoneB);
assert(
  islandMerged.objects.leafy_tree.level === 5 &&
    islandMerged.objects.house.level === 2 &&
    islandMerged.objects.windmill.level === 1,
  "an island never shrinks: every object keeps the higher level and nothing is dropped",
);
assert(
  islandMerged.spots.leafy_tree.i === 9 && islandMerged.spots.house.i === 4 && islandMerged.spots.windmill.i === 2,
  "moving an object is a choice, so the later move wins over the older one",
);
assert(
  islandMerged.appliedSessions.length === 3 &&
    ["s1", "s2", "s3"].every((id) => islandMerged.appliedSessions.includes(id)),
  "a reward already placed on one phone is never placed again on the other",
);
const islandFlipped = mergeIslands(phoneB, phoneA);
assert(
  JSON.stringify(Object.keys(islandMerged.objects).sort()) ===
    JSON.stringify(Object.keys(islandFlipped.objects).sort()) &&
    islandFlipped.objects.leafy_tree.level === 5,
  "it does not matter which side is merged into which",
);
assert(
  JSON.stringify(mergeIslands(islandMerged, islandMerged)) === JSON.stringify(islandMerged),
  "merging an island with itself changes nothing",
);
const flagA = {
  objects: {
    flagpole: { objectKey: "flagpole", category: "milestone" as const, level: 1, variant: "de", updatedAt: "2026-09-15T10:00:00.000Z" },
  },
  spots: {},
  appliedSessions: [],
};
const flagB = {
  objects: {
    flagpole: { objectKey: "flagpole", category: "milestone" as const, level: 1, variant: "jp", updatedAt: "2026-09-15T12:00:00.000Z" },
  },
  spots: {},
  appliedSessions: [],
};
assert(
  mergeIslands(flagA, flagB).objects.flagpole.variant === "jp" &&
    mergeIslands(flagB, flagA).objects.flagpole.variant === "jp" &&
    mergeIslands(EMPTY_ISLAND, flagA).objects.flagpole.variant === "de",
  "the flag on the flagpole survives the trip to the account, and the later choice wins",
);
assert(
  islandIsEmpty(EMPTY_ISLAND) && !islandIsEmpty(phoneA),
  "a fresh install is recognised as empty, so it cannot overwrite a grown island",
);

// --- the landmarks the hours earn -------------------------------------------
assert(earnedMilestones(0).length === 0, "an island with no hours carries no landmark");
assert(
  earnedMilestones(5).length === 1 && earnedMilestones(5)[0].objectKey === "flagpole",
  "the first five hours raise the flag",
);
const everything = earnedMilestones(100000);
assert(
  everything.length === MILESTONE_OBJECT_KEYS.length &&
    everything.filter((entry) => entry.tier === 2).length === 4,
  "every landmark is earned in the end, four of them twice",
);
assert(
  earnedMilestones(300).find((entry) => entry.objectKey === "clock_tower")?.tier === 2 &&
    earnedMilestones(299).find((entry) => entry.objectKey === "clock_tower")?.tier === 1,
  "a landmark keeps the highest tier the hours have reached",
);
assert(
  missingMilestones(100, { flagpole: { level: 1 }, treasure_chest: { level: 1 } }).length ===
    earnedMilestones(100).length - 2,
  "only what is not standing yet is owed",
);
assert(
  missingMilestones(300, { clock_tower: { level: 1 } }).some(
    (entry) => entry.objectKey === "clock_tower" && entry.tier === 2,
  ),
  "a landmark at the lower tier is still owed its second one",
);
assert(
  missingMilestones(100000, Object.fromEntries(
    earnedMilestones(100000).map((entry) => [entry.objectKey, { level: entry.tier }]),
  )).length === 0,
  "a complete island owes nothing, so nothing is placed twice",
);
assert(
  nextMilestone(0)?.milestone.hours === 5 &&
    nextMilestone(7)?.hoursToGo === 3 &&
    nextMilestone(100000) === null,
  "the roadmap always knows what comes next, until there is nothing left",
);
const milestoneArt = MILESTONE_OBJECT_KEYS.flatMap((key) =>
  [1, 2]
    .filter((tier) => earnedMilestones(100000).some((e) => e.objectKey === key && e.tier >= tier))
    .map((tier) => `${key}_${tier}`),
);
assert(
  milestoneArt.every((name) => SPECIAL_SPRITES[name] !== undefined),
  "every landmark tier that can be earned has a picture",
);
assert(
  MILESTONE_OBJECT_KEYS.every((key) => LAND_FOR_MILESTONES[key] !== undefined),
  "every landmark knows what ground it stands on, so it can be placed",
);

// A landmark that cannot be placed would be earned and then silently missing —
// the lighthouse on sand was exactly that. If this breaks after a change to the
// placement or to an object's size, the object needs a different ground or a
// smaller footprint, not a smaller test.
const fullIsland: Record<string, { level: number }> = {};
for (const category of GROW_CATEGORIES) {
  for (const object of GROW_OBJECTS[category.key]) fullIsland[object.key] = { level: object.maxLevel };
}
for (const earned of earnedMilestones(100000)) fullIsland[earned.objectKey] = { level: earned.tier };
for (const seed of [1, 42, 2024]) {
  const placed = resolveSpots(5, standingObjects(fullIsland), {}, seed);
  assert(
    MILESTONE_OBJECT_KEYS.every((key) => placed[key] !== undefined),
    `every landmark finds a place on a finished island (seed ${seed})`,
  );
}

// An object the player owns must never disappear from the island. Placing it
// small and growing it used to lose it: the bigger block no longer fitted the
// thin beach, and nothing drew it any more. Space is now reserved for the fully
// grown size, and a crowded island stands things closer together rather than
// dropping them.
for (const stage of [1, 3, 5] as const) {
  const small: Record<string, { level: number }> = {};
  for (const category of GROW_CATEGORIES) {
    for (const object of GROW_OBJECTS[category.key]) small[object.key] = { level: 1 };
  }
  for (const earned of earnedMilestones(100000)) small[earned.objectKey] = { level: 1 };
  const early = resolveSpots(stage, standingObjects(small), {}, 7);

  const grown: Record<string, { level: number }> = {};
  for (const category of GROW_CATEGORIES) {
    for (const object of GROW_OBJECTS[category.key]) grown[object.key] = { level: object.maxLevel };
  }
  for (const earned of earnedMilestones(100000)) grown[earned.objectKey] = { level: earned.tier };
  const late = resolveSpots(stage, standingObjects(grown), early, 7);

  assert(
    // Keyed by the copy, not by the object: two leafy trees are two places.
    standingObjects(grown).every((object) => late[object.id] !== undefined),
    `island ${stage} keeps every object it carries, even fully grown`,
  );
}

// --- the timer face ---------------------------------------------------------
assert(
  formatTimer(0) === "00:00" &&
    formatTimer(59) === "00:59" &&
    formatTimer(25 * 60) === "25:00" &&
    formatTimer(75 * 60 + 23) === "1:15:23" &&
    formatTimer(3600) === "1:00:00",
  "past an hour the timer rolls over instead of counting minutes forever",
);

// --- a session that sat idle must not collect the gap -----------------------
assert(catchUpAfterGap(0).seconds === 0, "no time passed, nothing to add");
assert(catchUpAfterGap(90).seconds === 90, "a short gap counts fully");
assert(catchUpAfterGap(90).abandoned === false, "a short gap keeps the session");
assert(
  catchUpAfterGap(MAX_CATCH_UP_SECONDS + 600).seconds === MAX_CATCH_UP_SECONDS,
  "a long gap is capped",
);
assert(
  catchUpAfterGap(MAX_CATCH_UP_SECONDS + 600).abandoned === false,
  "a capped gap still keeps the session",
);
assert(
  catchUpAfterGap(SESSION_ABANDONED_AFTER_SECONDS + 1).abandoned === true,
  "beyond the limit the session counts as abandoned",
);
assert(
  catchUpAfterGap(4 * 24 * 3600).seconds === 0,
  "four days add nothing (the bug from 2026-09-14)",
);

const NOW = Date.UTC(2026, 8, 14, 17, 0, 0);
assert(
  isStaleSession({ startTimeMs: NOW - 20 * 60 * 1000, focusedSeconds: 1200, lastTickMs: NOW, nowMs: NOW }) === false,
  "a running session of twenty minutes stays",
);
assert(
  isStaleSession({ startTimeMs: NOW - 4 * 24 * 3600 * 1000, focusedSeconds: 351068, lastTickMs: NOW, nowMs: NOW }) === true,
  "the four day old session with 97 h is dropped even though it ticked just now",
);
assert(
  isStaleSession({ startTimeMs: NOW, focusedSeconds: MAX_PLAUSIBLE_FOCUS_SECONDS + 1, lastTickMs: NOW, nowMs: NOW }) === true,
  "an impossible counter is enough to drop it",
);
assert(
  isStaleSession({ startTimeMs: null, focusedSeconds: 600, lastTickMs: NOW - 9 * 3600 * 1000, nowMs: NOW }) === true,
  "a nine hour gap drops it as well",
);


// A queued session whose end lies before its start (the phone's clock was
// corrected, or the server's start is later than the phone's) is moved to
// start + duration instead of being rejected for ever. A consistent end stays.
assert(
  consistentEndTime("2026-09-17T12:31:13.000Z", "2026-09-17T03:31:39.000Z", 900) ===
    "2026-09-17T12:46:13.000Z",
  "an end before the start is moved to start + duration",
);
assert(
  consistentEndTime("2026-09-17T12:00:00.000Z", "2026-09-17T12:20:00.000Z", 900) ===
    "2026-09-17T12:20:00.000Z",
  "an end after start + duration is kept as it is",
);
assert(
  consistentEndTime("2026-09-17T12:00:00.000Z", "2026-09-17T12:10:00.000Z", 900) ===
    "2026-09-17T12:15:00.000Z",
  "an end earlier than the measured duration allows is moved to start + duration",
);
assert(
  consistentEndTime("not a date", "2026-09-17T12:10:00.000Z", 900) === "2026-09-17T12:10:00.000Z",
  "an unreadable start leaves the end alone",
);


// A streak counts calendar days, and a day around a daylight-saving change is
// 23 or 25 hours long. Three sessions on the three days around the spring
// change (Europe: 2026-03-29) must still read as a run of three.
{
  const dstDays = [
    new Date(2026, 2, 28, 9, 0),
    new Date(2026, 2, 29, 9, 0),
    new Date(2026, 2, 30, 9, 0),
  ];
  const dstStreak = computeStreak(
    dstDays.map((day) => ({
      start_time: day.toISOString(),
      end_time: new Date(day.getTime() + 30 * 60 * 1000).toISOString(),
    })),
    new Date(2026, 2, 30, 20, 0),
  );
  assert(dstStreak.current === 3 && dstStreak.longest === 3, "a streak spans the spring DST change");
  // A session just after midnight belongs to the new day, whatever it did before.
  const lateNight = computeStreak(
    [
      { start_time: new Date(2026, 5, 1, 23, 50).toISOString(), end_time: new Date(2026, 5, 2, 0, 20).toISOString() },
      { start_time: new Date(2026, 5, 2, 0, 5).toISOString(), end_time: new Date(2026, 5, 2, 0, 40).toISOString() },
    ],
    new Date(2026, 5, 2, 8, 0),
  );
  assert(lateNight.current === 2, "a session that starts after midnight counts for the new day");
}

console.log(`Domain smoke tests passed: ${assertionCount} assertions.`);
