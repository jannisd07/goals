import type { StateCreator } from "zustand";
import type { FixedCommitments } from "../types";
import { computeDisposableTime } from "../lib/time";

export interface WalletSlice {
  fixedCommitments: FixedCommitments;
  disposableTimeHours: number;
  usedTimeThisWeekSeconds: number;
  setFixedCommitments: (commitments: FixedCommitments) => void;
  setUsedTimeThisWeek: (seconds: number) => void;
  incrementUsedTime: (seconds: number) => void;
}

export const createWalletSlice: StateCreator<WalletSlice, [], [], WalletSlice> = (set) => ({
  fixedCommitments: {
    sleep_hours_per_night: 8,
    work_hours_per_day: 8,
    work_days_per_week: 5,
    daily_overhead_hours: 2,
  },
  disposableTimeHours: 0,
  usedTimeThisWeekSeconds: 0,

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
});
