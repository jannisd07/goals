import { useEffect, useRef, useCallback } from "react";
import { AppState } from "react-native";
import { useAppStore } from "../store";
import { useCreateSession, useEndSession } from "./useSessions";
import { hapticMedium, hapticSuccess } from "../lib/haptics";
import {
  advancePomodoro,
  computeAdaptiveBreakMinutes,
} from "../lib/pomodoro";
import { syncFocusPhaseBoundary } from "../lib/notifications";
import type { Goal } from "../types";

interface PendingSessionStart {
  goalId: string;
  promise: Promise<boolean>;
}

let pendingSessionStart: PendingSessionStart | null = null;

export function usePomodoro() {
  const activeSession = useAppStore((s) => s.activeSession);
  const startSessionStore = useAppStore((s) => s.startSession);
  const endSessionStore = useAppStore((s) => s.endSession);
  const updatePomodoro = useAppStore((s) => s.updatePomodoro);
  const incrementUsedTime = useAppStore((s) => s.incrementUsedTime);
  const preferredAmbientSound = useAppStore((s) => s.preferredAmbientSound);
  const breakDuration = useAppStore((s) => s.breakDuration);

  const createSessionMutation = useCreateSession();
  const endSessionMutation = useEndSession();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingSessionStopRef = useRef<Promise<number | null> | null>(null);

  const startFocusSession = useCallback((goal: Goal, sessionLengthMinutes?: number): Promise<boolean> => {
    const existingSession = useAppStore.getState().activeSession;
    if (existingSession) {
      return Promise.resolve(existingSession.goal_id === goal.id);
    }
    if (pendingSessionStart) {
      const pending = pendingSessionStart;
      if (pending.goalId === goal.id) return pending.promise;

      // A rapid tap on another goal must never treat the first goal's
      // successful mutation as a successful start for this goal.
      return pending.promise.then(
        () => useAppStore.getState().activeSession?.goal_id === goal.id,
      );
    }

    const operation = (async () => {
      const mode = useAppStore.getState().focusStyle;
      const durationMinutes = sessionLengthMinutes ?? goal.pomodoro_duration_minutes ?? 25;
      // Flowtime remains open-ended, but duration_seconds stores its adjustable
      // visual target. advancePomodoro deliberately ignores it in flowtime mode.
      const durationSeconds = durationMinutes * 60;
      const { shortBreakMinutes } = computeAdaptiveBreakMinutes(durationMinutes, breakDuration);

      try {
        const session = await createSessionMutation.mutateAsync({
          goal_id: goal.id,
          trigger: "manual_pomodoro",
          ambient_sound: preferredAmbientSound,
        });

        startSessionStore({
          session_id: session.id,
          goal_id: goal.id,
          goal_name: goal.name,
          goal_color: goal.color,
          trigger: "manual_pomodoro",
          start_time: session.start_time,
          ambient_sound: preferredAmbientSound,
          pomodoro: {
            is_running: true,
            is_break: false,
            is_long_break: false,
            current_cycle: 1,
            total_cycles: 0,
            elapsed_seconds: 0,
            duration_seconds: durationSeconds,
            break_duration_seconds: shortBreakMinutes * 60,
            mode,
            flow_stretch_seconds: 0,
            focused_seconds: 0,
            last_tick_at_ms: Date.now(),
          },
        });

        if (mode === "interval") {
          useAppStore.getState().setLastSessionMinutes(durationMinutes);
        }
        hapticMedium();
        return true;
      } catch (error) {
        console.error("Failed to start focus session:", error);
        return false;
      }
    })();

    pendingSessionStart = { goalId: goal.id, promise: operation };
    void operation.finally(() => {
      if (pendingSessionStart?.promise === operation) pendingSessionStart = null;
    });
    return operation;
  }, [createSessionMutation, startSessionStore, preferredAmbientSound, breakDuration]);

  const advanceToNow = useCallback((withFeedback = true) => {
    const state = useAppStore.getState();
    const pomodoro = state.activeSession?.pomodoro;
    if (!pomodoro?.is_running) return;

    const now = Date.now();
    const lastTick = pomodoro.last_tick_at_ms || now;
    const seconds = Math.max(0, Math.floor((now - lastTick) / 1000));
    if (seconds === 0) return;

    const result = advancePomodoro(pomodoro, seconds, state.breakDuration);
    updatePomodoro({
      ...result.pomodoro,
      last_tick_at_ms: lastTick + seconds * 1000,
    });
    if (result.focusedSecondsAdded > 0) {
      incrementUsedTime(result.focusedSecondsAdded);
    }

    if (withFeedback && AppState.currentState === "active") {
      if (result.completedFocusBlocks > 0) {
        hapticSuccess();
      } else if (result.completedBreaks > 0) {
        hapticMedium();
      }
    }
  }, [incrementUsedTime, updatePomodoro]);

  const stopFocusSession = useCallback(async (): Promise<number | null> => {
    if (pendingSessionStopRef.current) return pendingSessionStopRef.current;

    const operation = (async () => {
      advanceToNow(false);
      void syncFocusPhaseBoundary(null);
      const latestSession = useAppStore.getState().activeSession;
      if (!latestSession?.pomodoro) return null;

      const wasRunning = latestSession.pomodoro.is_running;
      const pomodoro = latestSession.pomodoro;
      updatePomodoro({ is_running: false, last_tick_at_ms: Date.now() });

      try {
        await endSessionMutation.mutateAsync({
          session_id: latestSession.session_id,
          duration_seconds: pomodoro.focused_seconds,
          pomodoro_cycles: pomodoro.total_cycles,
          growth_stage: Math.min(4, Math.floor(pomodoro.focused_seconds / 1800)),
          ambient_sound: latestSession.ambient_sound,
        });

        endSessionStore(pomodoro.focused_seconds > 0);
        hapticSuccess();
        return pomodoro.focused_seconds;
      } catch (error) {
        console.error("Failed to end focus session:", error);
        updatePomodoro({
          is_running: wasRunning,
          last_tick_at_ms: Date.now(),
        });
        return null;
      }
    })();

    pendingSessionStopRef.current = operation;
    try {
      return await operation;
    } finally {
      if (pendingSessionStopRef.current === operation) {
        pendingSessionStopRef.current = null;
      }
    }
  }, [
    advanceToNow,
    endSessionMutation,
    endSessionStore,
    updatePomodoro,
  ]);

  const isRunningNow = activeSession?.pomodoro?.is_running ?? false;

  useEffect(() => {
    if (!isRunningNow) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    advanceToNow(false);
    intervalRef.current = setInterval(() => advanceToNow(), 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunningNow, advanceToNow]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void syncFocusPhaseBoundary(null);
        advanceToNow();
      } else {
        advanceToNow(false);
        void syncFocusPhaseBoundary(
          useAppStore.getState().activeSession?.pomodoro,
        );
      }
    });
    return () => subscription.remove();
  }, [advanceToNow]);

  const togglePause = useCallback(() => {
    if (!activeSession?.pomodoro) return;
    if (activeSession.pomodoro.mode === "flowtime") return;
    if (activeSession.pomodoro.is_running) {
      advanceToNow(false);
    }
    const latest = useAppStore.getState().activeSession?.pomodoro;
    if (!latest || latest.mode === "flowtime") return;
    updatePomodoro({
      is_running: !latest.is_running,
      last_tick_at_ms: Date.now(),
    });
  }, [activeSession?.pomodoro, advanceToNow, updatePomodoro]);

  const skipBreak = useCallback(() => {
    if (!activeSession?.pomodoro) return;
    advanceToNow(false);
    const latest = useAppStore.getState().activeSession?.pomodoro;
    if (!latest) return;
    const interruptedFocusElapsed =
      latest.interrupted_focus_elapsed_seconds;
    updatePomodoro({
      is_break: false,
      is_long_break: false,
      elapsed_seconds: interruptedFocusElapsed ?? 0,
      interrupted_focus_elapsed_seconds: undefined,
      flow_stretch_seconds: 0,
      current_cycle:
        latest.mode === "flowtime"
          ? 1
          : interruptedFocusElapsed === undefined
            ? latest.current_cycle + 1
            : latest.current_cycle,
      is_running: true,
      last_tick_at_ms: Date.now(),
    });
  }, [activeSession?.pomodoro, advanceToNow, updatePomodoro]);

  /** Flowtime: pause the single focus total and start an open recovery stopwatch. */
  const takeBreak = useCallback(() => {
    advanceToNow(false);
    const pom = useAppStore.getState().activeSession?.pomodoro;
    if (!pom || pom.is_break) return;
    if (pom.focused_seconds <= 0) return;
    updatePomodoro({
      is_break: true,
      is_long_break: false,
      elapsed_seconds: 0,
      break_duration_seconds: 0,
      is_running: true,
      last_tick_at_ms: Date.now(),
    });
    hapticSuccess();
  }, [advanceToNow, updatePomodoro]);

  /** Interval: add extra minutes to the running focus block. */
  const extendFocus = useCallback((minutes: number) => {
    advanceToNow(false);
    const pom = useAppStore.getState().activeSession?.pomodoro;
    if (!pom || pom.is_break || pom.is_long_break) return;
    updatePomodoro({
      duration_seconds: pom.duration_seconds + minutes * 60,
      last_tick_at_ms: Date.now(),
    });
    hapticMedium();
  }, [advanceToNow, updatePomodoro]);

  /** Flowtime: adjust the optional visual target without changing recorded time. */
  const setFlowtimeTarget = useCallback((minutes: number) => {
    const pom = useAppStore.getState().activeSession?.pomodoro;
    if (
      !pom ||
      pom.mode !== "flowtime" ||
      pom.is_break ||
      pom.is_long_break ||
      !Number.isFinite(minutes)
    ) {
      return;
    }

    const targetMinutes = Math.max(5, Math.round(minutes / 5) * 5);
    updatePomodoro({ duration_seconds: targetMinutes * 60 });
  }, [updatePomodoro]);

  return {
    activeSession,
    startFocusSession,
    stopFocusSession,
    togglePause,
    skipBreak,
    takeBreak,
    extendFocus,
    setFlowtimeTarget,
    isRunning: activeSession?.pomodoro?.is_running ?? false,
  };
}
