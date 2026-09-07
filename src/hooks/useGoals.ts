import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAppStore } from "../store";
import type { Goal } from "../types";

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
