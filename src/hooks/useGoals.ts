import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { currentUser, supabase } from "../lib/supabase";
import { useAppStore } from "../store";
import { clearPersistedGeofenceVisit } from "../services/geofencing";
import { MAX_GEOFENCE_SESSION_MS } from "../lib/geofenceSessions";
import type { Goal } from "../types";

const GOALS_KEY = ["goals"];

export function useGoals() {
  const setGoals = useAppStore((s) => s.setGoals);

  return useQuery({
    queryKey: GOALS_KEY,
    queryFn: async (): Promise<Goal[]> => {
      const user = await currentUser();
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

/**
 * Switches a goal off.
 *
 * Deliberately not a delete: sessions point at the goal, so removing the row
 * would take every hour ever logged against it with it. Switching it off hides
 * it everywhere the app reads goals, stops its geofence, and leaves the history
 * intact — and setting the same goal up again simply turns it back on.
 */
export function useDeactivateGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (goal: Goal): Promise<string> => {
      // An open visit must not stay open on a goal that is being switched off.
      // It is closed with the time actually spent, capped the same way every
      // other path caps a counter that may have run away.
      const { data: open, error: openError } = await supabase
        .from("sessions")
        .select("id, start_time")
        .eq("goal_id", goal.id)
        .is("end_time", null);
      if (openError) throw openError;

      const now = Date.now();
      for (const session of (open ?? []) as Array<{ id: string; start_time: string }>) {
        const durationSeconds = Math.min(
          Math.floor(MAX_GEOFENCE_SESSION_MS / 1000),
          Math.max(0, Math.floor((now - Date.parse(session.start_time)) / 1000)),
        );
        const { error: closeError } = await supabase
          .from("sessions")
          .update({
            end_time: new Date(now).toISOString(),
            duration_seconds: durationSeconds,
            growth_stage: Math.min(4, Math.floor(durationSeconds / 1800)),
          })
          .eq("id", session.id)
          .is("end_time", null);
        if (closeError) throw closeError;
      }

      const { data, error } = await supabase
        .from("goals")
        .update({ is_active: false })
        .eq("id", goal.id)
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("This goal was not found. Reload and try again.");
      }

      await clearPersistedGeofenceVisit(goal.id).catch(() => undefined);
      return goal.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GOALS_KEY });
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      queryClient.invalidateQueries({ queryKey: ["weekly-progress"] });
      queryClient.invalidateQueries({ queryKey: ["active-checkin"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
    },
  });
}
