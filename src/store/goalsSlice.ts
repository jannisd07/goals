import type { StateCreator } from "zustand";
import type { Goal, WeeklyProgress } from "../types";

export interface GoalsSlice {
  goals: Goal[];
  /**
   * Whether the goal list has ever been loaded from the server in this app run.
   * An empty list means "none" only once this is true — before that it just
   * means "not asked yet", and Auto Check-In must not conclude there is nothing
   * to watch and switch itself off.
   */
  goalsLoaded: boolean;
  weeklyProgress: Record<string, WeeklyProgress>;
  setGoals: (goals: Goal[]) => void;
  setWeeklyProgress: (progress: Record<string, WeeklyProgress>) => void;
}

export const createGoalsSlice: StateCreator<GoalsSlice, [], [], GoalsSlice> = (set) => ({
  goals: [],
  goalsLoaded: false,
  weeklyProgress: {},

  setGoals: (goals) => set({ goals, goalsLoaded: true }),

  setWeeklyProgress: (progress) => set({ weeklyProgress: progress }),
});
