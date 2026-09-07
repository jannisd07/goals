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
  detectCoachPatterns,
  patternFingerprint,
  type CoachSession,
} from "../supabase/functions/_shared/coachPatterns";
import {
  buildWriterPayload,
  fallbackNudges,
  mergeWriterResponse,
  MAX_TITLE_CHARS,
} from "../supabase/functions/_shared/coachWriter";
import {
  nudgeSchedule,
  parseCoachNudges,
  selectNudges,
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

const COACH_GOALS = [
  { id: "gym", name: "Gym", type: "physical" },
  { id: "study", name: "Studying", type: "focus" },
];

/** Builds a session at a given UTC day offset, hour, rating and length. */
function coachSession(
  daysAgo: number,
  hour: number,
  rating: number | null,
  minutes = 60,
  goalId = "gym",
): CoachSession {
  // 2026-09-01 was a Tuesday, which keeps the weekday maths readable.
  const base = Date.UTC(2026, 8, 1, hour, 0, 0);
  const start = new Date(base - daysAgo * 86_400_000);
  return {
    start_time: start.toISOString(),
    end_time: new Date(start.getTime() + minutes * 60_000).toISOString(),
    duration_seconds: minutes * 60,
    rating,
    goal_id: goalId,
    trigger: "geofence",
  };
}

const COACH_NOW = new Date(Date.UTC(2026, 8, 1, 20, 0, 0));

// Tuesdays at 14:00 are rated 5, every other visit 3. Exactly the case the
// product promises: "your Tuesday 2pm gym sessions were especially good".
const tuesdaySessions: CoachSession[] = [];
for (let week = 0; week < 10; week += 1) {
  tuesdaySessions.push(coachSession(week * 7, 14, 5));       // Tuesdays 14:00
  tuesdaySessions.push(coachSession(week * 7 + 3, 18, 3));   // Saturdays 18:00
}

const tuesdayPatterns = detectCoachPatterns(
  tuesdaySessions,
  COACH_GOALS,
  0,
  COACH_NOW,
);
const bestSlot = tuesdayPatterns.find((p) => p.kind === "best_slot");
assert(bestSlot !== undefined, "a repeated strong weekday/hour slot is detected");
assert(bestSlot?.weekday === 2, "the detected slot is a Tuesday");
assert(bestSlot?.hour === 14, "the detected slot is the 14:00 hour");
assert(
  (bestSlot?.sampleSize ?? 0) >= 3,
  "a detected slot is backed by at least three sessions",
);
assert(
  String(bestSlot?.fallbackBody ?? "").includes("Tuesday"),
  "the deterministic fallback names the day, so the feature works without a model",
);

// Too little history must stay silent instead of inventing advice.
assert(
  detectCoachPatterns(tuesdaySessions.slice(0, 4), COACH_GOALS, 0, COACH_NOW).length === 0,
  "fewer than eight sessions produce no patterns at all",
);

// Local time matters: a +120 minute offset shifts the slot two hours later.
const shifted = detectCoachPatterns(tuesdaySessions, COACH_GOALS, 120, COACH_NOW)
  .find((p) => p.kind === "best_slot");
assert(shifted?.hour === 16, "the device offset moves the slot into local time");

// An established rhythm that has lapsed becomes an overdue nudge.
const cadence: CoachSession[] = [];
for (let i = 0; i < 12; i += 1) {
  cadence.push(coachSession(9 + i * 3, 17, 4));
}
const cadencePatterns = detectCoachPatterns(cadence, COACH_GOALS, 0, COACH_NOW);
assert(
  cadencePatterns.some((p) => p.kind === "cadence_due"),
  "a three-day rhythm that is nine days idle is reported as overdue",
);
assert(
  cadencePatterns[0].kind === "cadence_due",
  "an overdue goal outranks softer observations",
);

// The fingerprint is what stops repeat model calls.
assert(
  patternFingerprint(tuesdayPatterns) ===
    patternFingerprint(detectCoachPatterns(tuesdaySessions, COACH_GOALS, 0, COACH_NOW)),
  "identical history yields an identical fingerprint, so the cache holds",
);
assert(
  patternFingerprint(tuesdayPatterns) !== patternFingerprint(cadencePatterns),
  "different advice yields a different fingerprint",
);
assert(patternFingerprint([]) === "empty", "no patterns fingerprint as empty");

// The prompt carries computed numbers only, never raw session rows.
const payload = buildWriterPayload(tuesdayPatterns);
assert(!payload.includes("start_time"), "the prompt contains no raw session fields");
assert(payload.includes("Tuesday"), "the prompt contains the computed weekday");

// ---------------------------------------------------------------------------
// Personal coach: model output handling
// ---------------------------------------------------------------------------

const goodCompletion = JSON.stringify({
  nudges: [{ id: "n0", title: "Tuesdays at 2pm suit you", body: "Your Tuesday 2pm visits average 5/5 against 3/5 otherwise. Worth going today." }],
});
const merged = mergeWriterResponse(tuesdayPatterns, goodCompletion);
assert(merged[0].written === true, "valid model copy is used");
assert(merged[0].title === "Tuesdays at 2pm suit you", "model copy is preserved verbatim");
assert(
  merged.length === tuesdayPatterns.length,
  "every pattern still yields exactly one nudge",
);
assert(
  merged.slice(1).every((n) => n.written === false),
  "patterns the model skipped keep their deterministic wording",
);

assert(
  mergeWriterResponse(tuesdayPatterns, "not json").every((n) => !n.written),
  "unparseable model output falls back instead of failing",
);
assert(
  mergeWriterResponse(tuesdayPatterns, JSON.stringify({ nudges: "nope" })).every(
    (n) => !n.written,
  ),
  "a malformed nudges field falls back",
);
assert(
  mergeWriterResponse(
    tuesdayPatterns,
    JSON.stringify({ nudges: [{ id: "n0", title: "Hi", body: "short" }] }),
  )[0].written === false,
  "copy that is too short to be useful is rejected",
);
const overlong = mergeWriterResponse(
  tuesdayPatterns,
  JSON.stringify({
    nudges: [{ id: "n0", title: "x".repeat(200), body: "y".repeat(400) }],
  }),
);
assert(
  overlong[0].title.length <= MAX_TITLE_CHARS,
  "overlong model titles are trimmed to the notification limit",
);
assert(
  fallbackNudges(tuesdayPatterns).every((n) => n.title.length > 0 && n.body.length > 0),
  "every pattern has usable wording without any model at all",
);

// ---------------------------------------------------------------------------
// Personal coach: scheduling
// ---------------------------------------------------------------------------

assert(
  JSON.stringify(
    nudgeSchedule({ kind: "best_slot", goalId: "gym", weekday: 2, hour: 14, title: "t", body: "b", confidence: 0.5, written: true }),
  ) === JSON.stringify({ weekday: 2, hour: 12, minute: 30 }),
  "a 14:00 slot is announced 90 minutes ahead, at 12:30",
);
assert(
  nudgeSchedule({ kind: "best_slot", goalId: "gym", weekday: 1, hour: 6, title: "t", body: "b", confidence: 0.5, written: true }).hour === 8,
  "an early-morning slot never fires during the night",
);
assert(
  nudgeSchedule({ kind: "cadence_due", goalId: "gym", weekday: null, hour: null, title: "t", body: "b", confidence: 0.5, written: true }).hour === 10,
  "a nudge without a time of day becomes a mid-morning reminder",
);
assert(
  selectNudges([
    { kind: "a", goalId: "g", weekday: null, hour: null, title: "t", body: "b", confidence: 0.9, written: true },
    { kind: "b", goalId: "g", weekday: null, hour: null, title: "t", body: "b", confidence: 0.05, written: true },
  ]).length === 1,
  "low-confidence nudges are never scheduled",
);
assert(
  selectNudges(
    Array.from({ length: 6 }, (_, i) => ({
      kind: `k${i}`, goalId: "g", weekday: null, hour: null,
      title: "t", body: "b", confidence: 0.5, written: true,
    })),
  ).length === 3,
  "at most three nudges are scheduled so the app never nags",
);

const parsedNudges = parseCoachNudges({
  status: "ready",
  nudges: [
    { kind: "best_slot", goalId: "gym", weekday: 2, hour: 14, title: "Good", body: "A believable body.", confidence: 0.4, written: true },
    { kind: "broken", goalId: "gym", weekday: 99, hour: 14, title: "x", body: "" },
  ],
  source: "model",
  generated_at: "2026-09-01T10:00:00.000Z",
  sessions_analyzed: 42,
});
assert(parsedNudges.nudges.length === 1, "unusable server entries are dropped");
assert(parsedNudges.sessionsAnalyzed === 42, "the analyzed count is carried through");
assert(
  parseCoachNudges(null).status === "insufficient_data",
  "a missing payload is treated as no advice, not as an error",
);

console.log(`Domain smoke tests passed: ${assertionCount} assertions.`);
