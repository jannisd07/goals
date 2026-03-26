import type { StateCreator } from "zustand";
import type { Goal, WeeklyProgress } from "../types";

export interface GoalsSlice {
  goals: Goal[];
  weeklyProgress: Record<string, WeeklyProgress>;
  setGoals: (goals: Goal[]) => void;
  addGoal: (goal: Goal) => void;
  updateGoal: (id: string, updates: Partial<Goal>) => void;
  removeGoal: (id: string) => void;
  setWeeklyProgress: (progress: Record<string, WeeklyProgress>) => void;
  updateGoalProgress: (goalId: string, progress: Partial<WeeklyProgress>) => void;
}

export const createGoalsSlice: StateCreator<GoalsSlice, [], [], GoalsSlice> = (set) => ({
  goals: [],
  weeklyProgress: {},

  setGoals: (goals) => set({ goals }),

  addGoal: (goal) =>
    set((state) => ({ goals: [...state.goals, goal] })),

  updateGoal: (id, updates) =>
    set((state) => ({
      goals: state.goals.map((g) => (g.id === id ? { ...g, ...updates } : g)),
    })),

  removeGoal: (id) =>
    set((state) => ({
      goals: state.goals.filter((g) => g.id !== id),
    })),

  setWeeklyProgress: (progress) => set({ weeklyProgress: progress }),

  updateGoalProgress: (goalId, progress) =>
    set((state) => {
      const existing: WeeklyProgress = state.weeklyProgress[goalId] ?? {
        goal_id: goalId,
        sessions_completed: 0,
        total_hours: 0,
      };
      return {
        weeklyProgress: {
          ...state.weeklyProgress,
          [goalId]: { ...existing, ...progress },
        },
      };
    }),
});
