import { useEffect } from "react";
import { AppState } from "react-native";
import { useAppStore } from "../store";
import { useActiveCheckIn } from "./useSessions";
import {
  endFocusLiveActivities,
  isFocusLiveActivitySupported,
  startFocusLiveActivity,
  updateFocusLiveActivity,
  type FocusLiveActivityState,
} from "../../modules/expo-focus-live-activity";
import { asGrowCategory, GROW_OBJECTS } from "../lib/growRewards";
import type { ActiveSession } from "../types";

let lastFingerprint: string | null = null;
let syncQueue: Promise<void> = Promise.resolve();

/**
 * The open Auto Check-In, if there is one.
 *
 * Kept outside React because the synchronisation also runs from a store
 * subscription and from the AppState listener, neither of which is a render.
 */
let openVisit: { sessionId: string; goalId: string; goalName: string; startMs: number } | null =
  null;

function formatTime(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * What this session is growing on the island — the reason the timer is running,
 * and worth saying on the lock screen. The exact size needs the goal's history
 * from the server, so the line names the object and what it is doing instead.
 */
function growthOf(session: ActiveSession): Pick<
  FocusLiveActivityState,
  "growName" | "growDetail" | "growCategory"
> {
  const category = asGrowCategory(session.grow_category) ?? "plant";
  const objects = GROW_OBJECTS[category];
  const object =
    objects.find((entry) => entry.key === session.grow_object_key) ?? objects[0];
  const pomodoro = session.pomodoro;
  const onBreak = Boolean(pomodoro?.is_break || pomodoro?.is_long_break);
  const detail = onBreak
    ? "waiting for your focus"
    : pomodoro?.is_running
      ? "growing"
      : "paused";
  return { growName: object.name, growDetail: detail, growCategory: category };
}

function buildFocusProps(
  session: ActiveSession,
  nowMs = Date.now(),
): FocusLiveActivityState | null {
  const pomodoro = session.pomodoro;
  if (!pomodoro) return null;

  const mode = pomodoro.mode === "flowtime" ? "flowtime" : "interval";
  const isBreak = pomodoro.is_break || pomodoro.is_long_break;
  const timerCountsUp = mode === "flowtime";
  const displaySeconds =
    mode === "flowtime"
      ? isBreak
        ? pomodoro.elapsed_seconds
        : pomodoro.focused_seconds
      : Math.max(
          0,
          (isBreak
            ? pomodoro.break_duration_seconds
            : pomodoro.duration_seconds) - pomodoro.elapsed_seconds,
        );
  const cursorMs = pomodoro.last_tick_at_ms || nowMs;
  const timerDateMs = timerCountsUp
    ? cursorMs - displaySeconds * 1000
    : cursorMs + displaySeconds * 1000;

  return {
    kind: "focus",
    sessionId: session.session_id,
    goalId: session.goal_id,
    goalName: session.goal_name,
    modeLabel: mode === "flowtime" ? "FLOWTIME" : "INTERVALS",
    phaseLabel: isBreak
      ? mode === "flowtime"
        ? "RECOVERY MODE"
        : "BREAK MODE"
      : "FOCUS MODE",
    isBreak,
    isRunning: pomodoro.is_running,
    timerCountsUp,
    timerDateMs,
    staticTime: formatTime(displaySeconds),
    ...growthOf(session),
  };
}

/**
 * An Auto Check-In on the lock screen: it only counts, because a visit has
 * nothing to pause — it ends when you leave. Nothing is growing yet either; the
 * object is chosen after the check-out.
 */
function buildVisitProps(
  visit: NonNullable<typeof openVisit>,
  nowMs = Date.now(),
): FocusLiveActivityState | null {
  const startMs = visit.startMs;
  if (Number.isNaN(startMs)) return null;
  return {
    kind: "visit",
    sessionId: visit.sessionId,
    goalId: visit.goalId,
    goalName: visit.goalName,
    modeLabel: "CHECKED IN",
    phaseLabel: "AT YOUR SPOT",
    isBreak: false,
    isRunning: true,
    timerCountsUp: true,
    timerDateMs: startMs,
    staticTime: formatTime((nowMs - startMs) / 1000),
    growName: "",
    growDetail: "",
    growCategory: "",
  };
}

function activityFingerprint(props: FocusLiveActivityState): string {
  return [
    props.kind,
    props.sessionId,
    props.goalId,
    props.goalName,
    props.modeLabel,
    props.phaseLabel,
    props.isBreak,
    props.isRunning,
    props.timerCountsUp,
    props.timerDateMs,
    props.staticTime,
    props.growName,
    props.growDetail,
  ].join("|");
}

async function synchronizeLiveActivity(force = false): Promise<void> {
  if (!isFocusLiveActivitySupported()) return;
  const session = useAppStore.getState().activeSession;
  // A running timer wins: it is the one with buttons on it.
  const props = session
    ? buildFocusProps(session)
    : openVisit
      ? buildVisitProps(openVisit)
      : null;
  const nextFingerprint = props ? activityFingerprint(props) : "none";
  if (!force && nextFingerprint === lastFingerprint) return;

  try {
    if (!props) {
      await endFocusLiveActivities();
      lastFingerprint = nextFingerprint;
      return;
    }

    const didUpdate = await updateFocusLiveActivity(props);
    if (!didUpdate) {
      await startFocusLiveActivity(props);
    }
    lastFingerprint = nextFingerprint;
  } catch (error) {
    // Unsupported devices and users who disabled Live Activities must still be
    // able to run timers normally.
    console.warn("Could not synchronize focus Live Activity:", error);
  }
}

function queueSynchronization(force = false): void {
  syncQueue = syncQueue
    .catch(() => undefined)
    .then(() => synchronizeLiveActivity(force));
}

export function useFocusLiveActivity(): void {
  // Auto Check-In: the visit is a row in Supabase, not store state, so it is
  // read here. A geofence entry happens in the background, where iOS does not
  // let an app start a Live Activity — so the banner appears the next time the
  // app is in the foreground, which is also when this query runs.
  const checkInGoal = useAppStore(
    (state) => state.goals.find((goal) => goal.type === "physical") ?? null,
  );
  const activeCheckIn = useActiveCheckIn(checkInGoal?.id);
  // Only plain values in the dependencies: a query result is a fresh object on
  // some renders, and depending on it would re-run this on every one of them.
  const visitId = activeCheckIn.data?.id ?? null;
  const visitStart = activeCheckIn.data?.start_time ?? null;
  const visitGoalId = activeCheckIn.data?.goal_id ?? null;
  const goalName = checkInGoal?.name ?? null;

  useEffect(() => {
    openVisit =
      visitId && visitGoalId && visitStart && goalName
        ? {
            sessionId: visitId,
            goalId: visitGoalId,
            goalName,
            startMs: Date.parse(visitStart),
          }
        : null;
    queueSynchronization(true);
  }, [goalName, visitGoalId, visitId, visitStart]);

  useEffect(() => {
    queueSynchronization(true);

    const unsubscribeStore = useAppStore.subscribe((state, previousState) => {
      const current = state.activeSession;
      const previous = previousState.activeSession;
      const currentPomodoro = current?.pomodoro;
      const previousPomodoro = previous?.pomodoro;
      const meaningfulChange =
        current?.session_id !== previous?.session_id ||
        current?.goal_name !== previous?.goal_name ||
        current?.grow_object_key !== previous?.grow_object_key ||
        current?.grow_category !== previous?.grow_category ||
        currentPomodoro?.mode !== previousPomodoro?.mode ||
        currentPomodoro?.is_break !== previousPomodoro?.is_break ||
        currentPomodoro?.is_long_break !== previousPomodoro?.is_long_break ||
        currentPomodoro?.is_running !== previousPomodoro?.is_running ||
        currentPomodoro?.duration_seconds !==
          previousPomodoro?.duration_seconds ||
        currentPomodoro?.break_duration_seconds !==
          previousPomodoro?.break_duration_seconds ||
        (!current && Boolean(previous));
      if (meaningfulChange) queueSynchronization();
    });

    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") queueSynchronization(true);
    });

    return () => {
      unsubscribeStore();
      appState.remove();
    };
  }, []);
}
