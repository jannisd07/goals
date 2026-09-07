import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAppStore } from "../store";
import { detectStudySpot, persistStudySpot } from "../lib/studySpots";
import { registerGeofences } from "../services/geofencing";

const LOOKBACK_DAYS = 60;

/**
 * Learns where the user actually focuses: clusters focus-session start locations
 * and registers a quiet geofence there, so arriving at that spot later can
 * trigger a "want to start a session?" suggestion.
 */
export function useStudySpotSync() {
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const goals = useAppStore((s) => s.goals);
  const focusGoal = goals.find((g) => g.type === "focus" && g.is_active) ?? null;
  const physicalLocationSignature = goals
    .filter((g) => g.type === "physical" && g.is_active && g.location)
    .map((g) => `${g.id}:${g.location!.latitude}:${g.location!.longitude}`)
    .sort()
    .join("|");

  useQuery({
    queryKey: ["study-spot-sync", focusGoal?.id ?? "none", physicalLocationSignature],
    enabled: isAuthenticated && Boolean(focusGoal),
    staleTime: 6 * 60 * 60 * 1000,
    queryFn: async () => {
      if (!focusGoal) return null;

      const since = new Date();
      since.setDate(since.getDate() - LOOKBACK_DAYS);

      const { data, error } = await supabase
        .from("sessions")
        .select("start_latitude, start_longitude")
        .eq("goal_id", focusGoal.id)
        .gte("start_time", since.toISOString())
        .not("end_time", "is", null)
        .not("start_latitude", "is", null);

      if (error) throw error;

      const excludeLocations = goals
        .filter((g) => g.type === "physical" && g.location)
        .map((g) => ({ latitude: g.location!.latitude, longitude: g.location!.longitude }));

      const spot = detectStudySpot(data ?? [], focusGoal, excludeLocations);
      await persistStudySpot(spot);

      // Re-register so the study-spot region is added or removed alongside goal geofences.
      await registerGeofences(useAppStore.getState().goals);
      return spot;
    },
  });
}
