import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { MAX_GROW_HISTORY, MIN_GROW_SESSION_SECONDS } from "../lib/growRewards";

/**
 * Lengths of a goal's earlier finished sessions, newest first. The size of a
 * grown object is measured against them (`computeGrowSize`).
 */
export async function fetchGrowHistory(
  goalId: string,
  excludeSessionId: string | null = null,
): Promise<number[]> {
  const { data, error } = await supabase
    .from("sessions")
    .select("id,duration_seconds")
    .eq("goal_id", goalId)
    .not("end_time", "is", null)
    .gte("duration_seconds", MIN_GROW_SESSION_SECONDS)
    .order("start_time", { ascending: false })
    .limit(MAX_GROW_HISTORY + 1);
  if (error) throw error;
  return ((data ?? []) as Array<{ id: string; duration_seconds: number }>)
    .filter((row) => row.id !== excludeSessionId)
    .slice(0, MAX_GROW_HISTORY)
    .map((row) => Number(row.duration_seconds) || 0);
}

export function useGrowHistory(
  goalId: string | null | undefined,
  excludeSessionId: string | null = null,
) {
  return useQuery({
    queryKey: ["grow-history", goalId ?? null, excludeSessionId],
    enabled: Boolean(goalId),
    queryFn: () => fetchGrowHistory(goalId as string, excludeSessionId),
    staleTime: 5 * 60 * 1000,
  });
}
