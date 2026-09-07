import { useEffect } from "react";
import { AppState } from "react-native";
import { useAppStore } from "../store";
import {
  endFocusLiveActivities,
  isFocusLiveActivitySupported,
  startFocusLiveActivity,
  updateFocusLiveActivity,
  type FocusLiveActivityState,
} from "../../modules/expo-focus-live-activity";
import type { ActiveSession } from "../types";

let lastFingerprint: string | null = null;
let syncQueue: Promise<void> = Promise.resolve();

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

function buildActivityProps(
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
  };
}

function activityFingerprint(props: FocusLiveActivityState): string {
  return [
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
  ].join("|");
}

async function synchronizeLiveActivity(force = false): Promise<void> {
  if (!isFocusLiveActivitySupported()) return;
  const session = useAppStore.getState().activeSession;
  const props = session ? buildActivityProps(session) : null;
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
