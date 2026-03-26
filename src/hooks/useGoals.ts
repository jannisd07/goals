import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAppStore } from "../store";
import type { Goal, AccentColor, GoalType, GoalLocation } from "../types";

const GOALS_KEY = ["goals"];

export function useGoals() {
  const setGoals = useAppStore((s) => s.setGoals);

  return useQuery({
    queryKey: GOALS_KEY,
    queryFn: async (): Promise<Goal[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("goals")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: true });

      if (error) throw error;
      const goals = (data ?? []) as Goal[];
      setGoals(goals);
      return goals;
    },
  });
}

interface CreateGoalInput {
  name: string;
  type: GoalType;
  target_sessions_per_week: number;
  target_hours_per_week: number;
  color: AccentColor;
  location: GoalLocation | null;
  pomodoro_duration_minutes: number;
}

export function useCreateGoal() {
  const queryClient = useQueryClient();
  const addGoal = useAppStore((s) => s.addGoal);

  return useMutation({
    mutationFn: async (input: CreateGoalInput): Promise<Goal> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("goals")
        .insert({
          user_id: user.id,
          ...input,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Goal;
    },
    onSuccess: (goal) => {
      addGoal(goal);
      queryClient.invalidateQueries({ queryKey: GOALS_KEY });
    },
  });
}

export function useUpdateGoal() {
  const queryClient = useQueryClient();
  const updateGoal = useAppStore((s) => s.updateGoal);

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Goal> & { id: string }): Promise<Goal> => {
      const { data, error } = await supabase
        .from("goals")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as Goal;
    },
    onSuccess: (goal) => {
      updateGoal(goal.id, goal);
      queryClient.invalidateQueries({ queryKey: GOALS_KEY });
    },
  });
}

export function useDeleteGoal() {
  const queryClient = useQueryClient();
  const removeGoal = useAppStore((s) => s.removeGoal);

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from("goals")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, id) => {
      removeGoal(id);
      queryClient.invalidateQueries({ queryKey: GOALS_KEY });
    },
  });
}
