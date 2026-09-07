import type { StateCreator } from "zustand";
import type { Goal, WeeklyProgress } from "../types";

export interface GoalsSlice {
  goals: Goal[];
  weeklyProgress: Record<string, WeeklyProgress>;
  setGoals: (goals: Goal[]) => void;
  setWeeklyProgress: (progress: Record<string, WeeklyProgress>) => void;
}

export const createGoalsSlice: StateCreator<GoalsSlice, [], [], GoalsSlice> = (set) => ({
  goals: [],
  weeklyProgress: {},

  setGoals: (goals) => set({ goals }),

  setWeeklyProgress: (progress) => set({ weeklyProgress: progress }),
});
