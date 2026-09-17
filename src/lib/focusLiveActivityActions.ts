import { useAppStore } from "../store";
import type { PomodoroState } from "../types";
import { advancePomodoro, catchUpAfterGap } from "./pomodoro";
import { settleAbandonedSession } from "./abandonedSession";
import { syncFocusPhaseBoundary } from "./notifications";

export type FocusLiveActivityAction = "toggle-pause" | "toggle-break";

function advanceToActionTime(timestamp: number): PomodoroState | null {
  const store = useAppStore.getState();
  const pomodoro = store.activeSession?.pomodoro;
  if (!pomodoro) return null;
  if (!pomodoro.is_running) return pomodoro;

  // Same catch-up rule as in the app (usePomodoro.ts): a phone that was asleep
  // for hours must not turn the whole gap into focus time, and a session that
  // sat idle for most of a day is dropped instead of saved. Without this, a tap
  // on the Live Activity after a long sleep books the entire gap.
  const cursor = pomodoro.last_tick_at_ms || timestamp;
  const gap = Math.max(0, Math.floor((timestamp - cursor) / 1_000));
  const catchUp = catchUpAfterGap(gap);
  if (catchUp.abandoned) {
    console.warn(`Dropping a focus session that sat idle for ${Math.round(gap / 3600)} h`);
    void settleAbandonedSession(store.activeSession);
    store.endSession(false);
    return null;
  }
  const seconds = catchUp.seconds;
  if (seconds === 0) return pomodoro;

  const result = advancePomodoro(pomodoro, seconds, store.breakDuration);
  store.updatePomodoro({
    ...result.pomodoro,
    // When the gap was capped the rest must not come back on the next tick.
    last_tick_at_ms: seconds === gap ? cursor + seconds * 1_000 : timestamp,
  });
  if (result.focusedSecondsAdded > 0) {
    store.incrementUsedTime(result.focusedSecondsAdded);
  }
  return useAppStore.getState().activeSession?.pomodoro ?? null;
}

function togglePauseAt(timestamp: number): void {
  const current = advanceToActionTime(timestamp);
  if (!current || current.mode === "flowtime") return;
  useAppStore.getState().updatePomodoro({
    is_running: !current.is_running,
    last_tick_at_ms: timestamp,
  });
}

function toggleBreakAt(timestamp: number): void {
  const current = advanceToActionTime(timestamp);
  if (!current) return;

  const store = useAppStore.getState();
  const isBreak = current.is_break || current.is_long_break;
  if (isBreak) {
    const interruptedFocusElapsed =
      current.interrupted_focus_elapsed_seconds;
    store.updatePomodoro({
      is_break: false,
      is_long_break: false,
      elapsed_seconds: interruptedFocusElapsed ?? 0,
      interrupted_focus_elapsed_seconds: undefined,
      flow_stretch_seconds: 0,
      current_cycle:
        current.mode === "flowtime"
          ? 1
          : interruptedFocusElapsed === undefined
            ? current.current_cycle + 1
            : current.current_cycle,
      is_running: true,
      last_tick_at_ms: timestamp,
    });
    return;
  }

  store.updatePomodoro({
    is_break: true,
    is_long_break: false,
    interrupted_focus_elapsed_seconds:
      current.mode === "flowtime" ? undefined : current.elapsed_seconds,
    elapsed_seconds: 0,
    break_duration_seconds:
      current.mode === "flowtime"
        ? 0
        : Math.max(60, current.break_duration_seconds),
    is_running: true,
    last_tick_at_ms: timestamp,
  });
}

export async function handleFocusLiveActivityAction(
  action: FocusLiveActivityAction,
  timestamp = Date.now(),
): Promise<void> {
  if (action === "toggle-pause") {
    togglePauseAt(timestamp);
  } else {
    toggleBreakAt(timestamp);
  }
  await syncFocusPhaseBoundary(
    useAppStore.getState().activeSession?.pomodoro,
  );
}
