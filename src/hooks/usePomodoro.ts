import { useEffect, useRef, useCallback } from "react";
import { AppState } from "react-native";
import { snapFlowTarget } from "../lib/flowTarget";
import { useAppStore } from "../store";
import { useCreateSession, useEndSession } from "./useSessions";
import { hapticMedium, hapticSuccess } from "../lib/haptics";
import {
  advancePomodoro,
  catchUpAfterGap,
  computeAdaptiveBreakMinutes,
} from "../lib/pomodoro";
import { syncFocusPhaseBoundary } from "../lib/notifications";
import { settleAbandonedSession } from "../lib/abandonedSession";
import { localSessionId } from "../lib/sessionOutbox";
import type { Goal, GrowCategory } from "../types";
import { asGrowCategory } from "../lib/growRewards";

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

  const startFocusSession = useCallback((
    goal: Goal,
    sessionLengthMinutes?: number,
    growCategory?: GrowCategory,
    growObjectKey?: string | null,
  ): Promise<boolean> => {
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
      const category =
        asGrowCategory(growCategory) ??
        asGrowCategory(useAppStore.getState().focusGrowCategory) ??
        "plant";
      const durationMinutes = sessionLengthMinutes ?? goal.pomodoro_duration_minutes ?? 25;
      // Flowtime remains open-ended, but duration_seconds stores its adjustable
      // visual target. advancePomodoro deliberately ignores it in flowtime mode.
      const durationSeconds = durationMinutes * 60;
      const { shortBreakMinutes } = computeAdaptiveBreakMinutes(durationMinutes, breakDuration);

      // Starting must not depend on a connection. If the row cannot be created
      // now, the session runs under a local id and the finished session is sent
      // from the outbox as soon as the phone is back.
      let sessionId: string;
      let startTime: string;
      try {
        const session = await createSessionMutation.mutateAsync({
          goal_id: goal.id,
          trigger: "manual_pomodoro",
          ambient_sound: preferredAmbientSound,
        });
        sessionId = session.id;
        startTime = session.start_time;
      } catch (error) {
        console.warn("Starting offline; this session is sent later:", error);
        sessionId = localSessionId();
        startTime = new Date().toISOString();
      }

      try {
        startSessionStore({
          session_id: sessionId,
          goal_id: goal.id,
          goal_name: goal.name,
          goal_color: goal.color,
          trigger: "manual_pomodoro",
          start_time: startTime,
          ambient_sound: preferredAmbientSound,
          grow_category: category,
          // Held on the session, so the reward at the end is the object the
          // session was started with, whatever the start sheet says later.
          grow_object_key:
            growObjectKey ?? useAppStore.getState().focusGrowObjectKey ?? null,
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
        useAppStore.getState().setFocusGrowCategory(category);
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
    const gap = Math.max(0, Math.floor((now - lastTick) / 1000));
    const catchUp = catchUpAfterGap(gap);
    if (catchUp.abandoned) {
      // The app was closed for hours: drop the session instead of counting the
      // whole gap as focus time. The focus before the gap was real, so its
      // reward is kept and the row is closed with exactly that time
      // (src/lib/abandonedSession.ts) — losing an hour of work to a flat
      // battery would be unfair, and so would an island that grew from hours
      // the stats never saw.
      console.warn(`Dropping a focus session that sat idle for ${Math.round(gap / 3600)} h`);
      void settleAbandonedSession(useAppStore.getState().activeSession);
      endSessionStore(false);
      return;
    }
    const seconds = catchUp.seconds;
    if (seconds === 0) return;

    const result = advancePomodoro(pomodoro, seconds, state.breakDuration);
    updatePomodoro({
      ...result.pomodoro,
      // When the gap was capped the rest must not come back on the next tick.
      last_tick_at_ms: seconds === gap ? lastTick + seconds * 1000 : now,
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
  }, [endSessionStore, incrementUsedTime, updatePomodoro]);

  const stopFocusSession = useCallback(async (
    options?: { requestRating?: boolean },
  ): Promise<number | null> => {
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
          goal_id: latestSession.goal_id,
          start_time: latestSession.start_time,
        });

        // The grow reveal asks for the rating itself, after the island moment.
        endSessionStore(options?.requestRating !== false && pomodoro.focused_seconds > 0);
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

  /**
   * Interval: add extra minutes to the running focus block — and only to that
   * one. `duration_seconds` is the template for every later block and the basis
   * of the adaptive break (lib/pomodoro.ts), so raising it would quietly turn a
   * 25-minute session into a 30-minute one with longer breaks for the rest of
   * the day. Winding back the elapsed time of this block leaves the recorded
   * focus untouched and gives back exactly the minutes that were asked for.
   */
  const extendFocus = useCallback((minutes: number) => {
    advanceToNow(false);
    const pom = useAppStore.getState().activeSession?.pomodoro;
    if (!pom || pom.mode === "flowtime" || pom.is_break || pom.is_long_break) return;
    updatePomodoro({
      elapsed_seconds: Math.max(0, pom.elapsed_seconds - minutes * 60),
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

    // Snapped to the dial's own scale, so a value can never land between two
    // steps and make the ring jump on the next turn (src/lib/flowTarget.ts).
    updatePomodoro({ duration_seconds: snapFlowTarget(minutes) * 60 });
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
