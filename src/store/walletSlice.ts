import type { StateCreator } from "zustand";
import type { FixedCommitments } from "../types";
import { computeDisposableTime } from "../lib/time";

export interface WalletSlice {
  fixedCommitments: FixedCommitments;
  disposableTimeHours: number;
  usedTimeThisWeekSeconds: number;
  liveDecrementActive: boolean;
  setFixedCommitments: (commitments: FixedCommitments) => void;
  setUsedTimeThisWeek: (seconds: number) => void;
  incrementUsedTime: (seconds: number) => void;
  setLiveDecrement: (active: boolean) => void;
  getRemainingHours: () => number;
}

export const createWalletSlice: StateCreator<WalletSlice, [], [], WalletSlice> = (set, get) => ({
  fixedCommitments: {
    sleep_hours_per_night: 8,
    work_hours_per_day: 8,
    work_days_per_week: 5,
    daily_overhead_hours: 2,
  },
  disposableTimeHours: 0,
  usedTimeThisWeekSeconds: 0,
  liveDecrementActive: false,

  setFixedCommitments: (commitments) =>
    set({
      fixedCommitments: commitments,
      disposableTimeHours: computeDisposableTime(commitments),
    }),

  setUsedTimeThisWeek: (seconds) =>
    set({ usedTimeThisWeekSeconds: seconds }),

  incrementUsedTime: (seconds) =>
    set((state) => ({
      usedTimeThisWeekSeconds: state.usedTimeThisWeekSeconds + seconds,
    })),

  setLiveDecrement: (active) =>
    set({ liveDecrementActive: active }),

  getRemainingHours: () => {
    const state = get();
    const usedHours = state.usedTimeThisWeekSeconds / 3600;
    return Math.max(0, state.disposableTimeHours - usedHours);
  },
});
