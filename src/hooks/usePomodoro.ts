import { useEffect, useRef, useCallback } from "react";
import { useAppStore } from "../store";
import { useCreateSession, useEndSession } from "./useSessions";
import { hapticMedium, hapticSuccess } from "../lib/haptics";
import {
  SHORT_BREAK_DURATION,
  LONG_BREAK_DURATION,
  CYCLES_BEFORE_LONG_BREAK,
} from "../types";
import type { Goal, AmbientSoundKey } from "../types";

export function usePomodoro() {
  const activeSession = useAppStore((s) => s.activeSession);
  const startSessionStore = useAppStore((s) => s.startSession);
  const endSessionStore = useAppStore((s) => s.endSession);
  const updatePomodoro = useAppStore((s) => s.updatePomodoro);
  const incrementUsedTime = useAppStore((s) => s.incrementUsedTime);
  const setLiveDecrement = useAppStore((s) => s.setLiveDecrement);
  const preferredAmbientSound = useAppStore((s) => s.preferredAmbientSound);

  const createSessionMutation = useCreateSession();
  const endSessionMutation = useEndSession();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startFocusSession = useCallback(async (goal: Goal) => {
    const durationMinutes = goal.pomodoro_duration_minutes || 25;
    const durationSeconds = durationMinutes * 60;

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
          break_duration_seconds: SHORT_BREAK_DURATION * 60,
        },
      });

      setLiveDecrement(true);
      hapticMedium();
    } catch (error) {
      console.error("Failed to start focus session:", error);
    }
  }, [createSessionMutation, startSessionStore, setLiveDecrement, preferredAmbientSound]);

  const stopFocusSession = useCallback(async () => {
    if (!activeSession?.pomodoro) return;

    const pomodoro = activeSession.pomodoro;
    const startTime = new Date(activeSession.start_time).getTime();
    const durationSeconds = Math.floor((Date.now() - startTime) / 1000);

    try {
      await endSessionMutation.mutateAsync({
        session_id: activeSession.session_id,
        duration_seconds: durationSeconds,
        pomodoro_cycles: pomodoro.total_cycles,
        growth_stage: Math.min(4, Math.floor(pomodoro.total_cycles / 2) + 1),
        ambient_sound: activeSession.ambient_sound,
      });

      endSessionStore();
      setLiveDecrement(false);
      hapticSuccess();
    } catch (error) {
      console.error("Failed to end focus session:", error);
    }
  }, [activeSession, endSessionMutation, endSessionStore, setLiveDecrement]);

  const isRunningNow = activeSession?.pomodoro?.is_running ?? false;

  useEffect(() => {
    if (!isRunningNow) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      const state = useAppStore.getState();
      const pom = state.activeSession?.pomodoro;
      if (!pom || !pom.is_running) return;

      const newElapsed = pom.elapsed_seconds + 1;

      if (pom.is_break || pom.is_long_break) {
        const breakDuration = pom.is_long_break
          ? LONG_BREAK_DURATION * 60
          : SHORT_BREAK_DURATION * 60;

        if (newElapsed >= breakDuration) {
          updatePomodoro({
            is_break: false,
            is_long_break: false,
            elapsed_seconds: 0,
            current_cycle: pom.current_cycle + 1,
            is_running: true,
          });
          hapticMedium();
        } else {
          updatePomodoro({ elapsed_seconds: newElapsed });
        }
      } else {
        if (newElapsed >= pom.duration_seconds) {
          const completedCycles = pom.total_cycles + 1;
          const isLongBreak = completedCycles % CYCLES_BEFORE_LONG_BREAK === 0;

          updatePomodoro({
            total_cycles: completedCycles,
            elapsed_seconds: 0,
            is_break: !isLongBreak,
            is_long_break: isLongBreak,
            is_running: true,
          });
          hapticSuccess();
        } else {
          updatePomodoro({ elapsed_seconds: newElapsed });
          incrementUsedTime(1);
        }
      }
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunningNow, updatePomodoro, incrementUsedTime]);

  const togglePause = useCallback(() => {
    if (!activeSession?.pomodoro) return;
    updatePomodoro({ is_running: !activeSession.pomodoro.is_running });
  }, [activeSession?.pomodoro, updatePomodoro]);

  const skipBreak = useCallback(() => {
    if (!activeSession?.pomodoro) return;
    updatePomodoro({
      is_break: false,
      is_long_break: false,
      elapsed_seconds: 0,
      current_cycle: activeSession.pomodoro.current_cycle + 1,
      is_running: true,
    });
  }, [activeSession?.pomodoro, updatePomodoro]);

  return {
    activeSession,
    startFocusSession,
    stopFocusSession,
    togglePause,
    skipBreak,
    isRunning: activeSession?.pomodoro?.is_running ?? false,
  };
}
