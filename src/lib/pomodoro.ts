import type { PomodoroState } from "../types";
import { CYCLES_BEFORE_LONG_BREAK } from "../types";

export const MIN_SESSION_MINUTES = 5;
export const MAX_SESSION_MINUTES = 60;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function sessionRatioToMinutes(ratio: number): number {
  const clampedRatio = clamp(ratio, 0, 1);
  const growth = MAX_SESSION_MINUTES / MIN_SESSION_MINUTES;
  const minutes = MIN_SESSION_MINUTES * Math.pow(growth, clampedRatio);
  return clamp(Math.round(minutes), MIN_SESSION_MINUTES, MAX_SESSION_MINUTES);
}

export function sessionMinutesToRatio(minutes: number): number {
  const clampedMinutes = clamp(minutes, MIN_SESSION_MINUTES, MAX_SESSION_MINUTES);
  const growth = MAX_SESSION_MINUTES / MIN_SESSION_MINUTES;
  return Math.log(clampedMinutes / MIN_SESSION_MINUTES) / Math.log(growth);
}

/**
 * Flowtime: suggested break scales with the focus stretch just worked (~1/5 of it).
 */
export function computeFlowtimeBreakMinutes(workedSeconds: number): number {
  const workedMinutes = workedSeconds / 60;
  return clamp(Math.round(workedMinutes / 5), 2, 30);
}

export function computeAdaptiveBreakMinutes(
  sessionMinutes: number,
  baseShortBreakMinutes = 5,
): { shortBreakMinutes: number; longBreakMinutes: number } {
  const safeSession = clamp(sessionMinutes, MIN_SESSION_MINUTES, MAX_SESSION_MINUTES);
  const scaledShort = baseShortBreakMinutes * Math.sqrt(safeSession / 25);
  const shortBreakMinutes = clamp(Math.round(scaledShort), 2, 15);
  const longBreakMinutes = clamp(Math.round(shortBreakMinutes * 1.8), 5, 25);

  return {
    shortBreakMinutes,
    longBreakMinutes,
  };
}

export interface PomodoroAdvanceResult {
  pomodoro: PomodoroState;
  focusedSecondsAdded: number;
  completedFocusBlocks: number;
  completedBreaks: number;
}

/**
 * Advances a running timer by wall-clock seconds.
 *
 * This function is intentionally pure so foreground ticks, background recovery,
 * and process-restart recovery all use exactly the same accounting. It can cross
 * multiple focus/break boundaries in one call. Only focus phases contribute to
 * focused_seconds.
 */
export function advancePomodoro(
  current: PomodoroState,
  seconds: number,
  baseShortBreakMinutes = 5,
): PomodoroAdvanceResult {
  const wholeSeconds = Math.max(0, Math.floor(seconds));
  const next: PomodoroState = {
    ...current,
    focused_seconds: Math.max(0, current.focused_seconds ?? 0),
  };

  if (!next.is_running || wholeSeconds === 0) {
    return {
      pomodoro: next,
      focusedSecondsAdded: 0,
      completedFocusBlocks: 0,
      completedBreaks: 0,
    };
  }

  let remaining = wholeSeconds;
  let focusedSecondsAdded = 0;
  let completedFocusBlocks = 0;
  let completedBreaks = 0;

  // Every phase consumes at least one second, so this guard is defensive only.
  let transitions = 0;
  const maxTransitions = wholeSeconds + 2;

  while (remaining > 0 && transitions < maxTransitions) {
    const onBreak = next.is_break || next.is_long_break;

    if (onBreak) {
      if (next.mode === "flowtime") {
        // A Flowtime break is an open-ended recovery stopwatch. It only ends
        // when the user explicitly resumes focus; no configured or suggested
        // duration may advance it automatically.
        next.elapsed_seconds += remaining;
        remaining = 0;
        continue;
      }
      const phaseDuration = Math.max(1, next.break_duration_seconds);
      const available = Math.max(0, phaseDuration - next.elapsed_seconds);
      if (available === 0) {
        const interruptedFocusElapsed =
          next.interrupted_focus_elapsed_seconds;
        next.is_break = false;
        next.is_long_break = false;
        next.elapsed_seconds = interruptedFocusElapsed ?? 0;
        next.interrupted_focus_elapsed_seconds = undefined;
        next.flow_stretch_seconds = 0;
        if (interruptedFocusElapsed === undefined) {
          next.current_cycle += 1;
        }
        completedBreaks += 1;
        transitions += 1;
        continue;
      }
      const consumed = Math.min(remaining, available);
      next.elapsed_seconds = Math.min(phaseDuration, next.elapsed_seconds + consumed);
      remaining -= consumed;

      if (next.elapsed_seconds >= phaseDuration) {
        const interruptedFocusElapsed =
          next.interrupted_focus_elapsed_seconds;
        next.is_break = false;
        next.is_long_break = false;
        next.elapsed_seconds = interruptedFocusElapsed ?? 0;
        next.interrupted_focus_elapsed_seconds = undefined;
        next.flow_stretch_seconds = 0;
        if (interruptedFocusElapsed === undefined) {
          next.current_cycle += 1;
        }
        completedBreaks += 1;
        transitions += 1;
      }
      continue;
    }

    if (next.mode === "flowtime") {
      next.elapsed_seconds += remaining;
      next.flow_stretch_seconds = (next.flow_stretch_seconds ?? 0) + remaining;
      next.focused_seconds += remaining;
      focusedSecondsAdded += remaining;
      remaining = 0;
      continue;
    }

    const phaseDuration = Math.max(1, next.duration_seconds);
    const available = Math.max(0, phaseDuration - next.elapsed_seconds);
    if (available === 0) {
      const completedCycles = next.total_cycles + 1;
      const isLongBreak = completedCycles % CYCLES_BEFORE_LONG_BREAK === 0;
      const currentSessionMinutes = Math.max(5, Math.round(phaseDuration / 60));
      const { shortBreakMinutes, longBreakMinutes } = computeAdaptiveBreakMinutes(
        currentSessionMinutes,
        baseShortBreakMinutes,
      );
      next.total_cycles = completedCycles;
      next.elapsed_seconds = 0;
      next.is_break = !isLongBreak;
      next.is_long_break = isLongBreak;
      next.break_duration_seconds =
        (isLongBreak ? longBreakMinutes : shortBreakMinutes) * 60;
      completedFocusBlocks += 1;
      transitions += 1;
      continue;
    }
    const consumed = Math.min(remaining, available);
    next.elapsed_seconds = Math.min(phaseDuration, next.elapsed_seconds + consumed);
    next.focused_seconds += consumed;
    focusedSecondsAdded += consumed;
    remaining -= consumed;

    if (next.elapsed_seconds >= phaseDuration) {
      const completedCycles = next.total_cycles + 1;
      const isLongBreak = completedCycles % CYCLES_BEFORE_LONG_BREAK === 0;
      const currentSessionMinutes = Math.max(5, Math.round(phaseDuration / 60));
      const { shortBreakMinutes, longBreakMinutes } = computeAdaptiveBreakMinutes(
        currentSessionMinutes,
        baseShortBreakMinutes,
      );

      next.total_cycles = completedCycles;
      next.elapsed_seconds = 0;
      next.is_break = !isLongBreak;
      next.is_long_break = isLongBreak;
      next.break_duration_seconds =
        (isLongBreak ? longBreakMinutes : shortBreakMinutes) * 60;
      completedFocusBlocks += 1;
      transitions += 1;
    }
  }

  return {
    pomodoro: next,
    focusedSecondsAdded,
    completedFocusBlocks,
    completedBreaks,
  };
}
