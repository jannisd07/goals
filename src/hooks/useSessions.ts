import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Location from "expo-location";
import { supabase } from "../lib/supabase";
import { useAppStore } from "../store";
import { clearPersistedGeofenceVisit } from "../services/geofencing";
import { getWeekStart, getWeekEnd } from "../lib/time";
import type {
  Session,
  SessionTrigger,
  AmbientSoundKey,
  WeeklyProgress,
  Goal,
} from "../types";

const SESSIONS_KEY = ["sessions"];
const WEEKLY_PROGRESS_KEY = ["weekly-progress"];
const ACTIVE_CHECKIN_KEY = ["active-checkin"];

export function useWeeklyProgress() {
  const setWeeklyProgress = useAppStore((s) => s.setWeeklyProgress);
  const setUsedTimeThisWeek = useAppStore((s) => s.setUsedTimeThisWeek);

  return useQuery({
    queryKey: WEEKLY_PROGRESS_KEY,
    queryFn: async (): Promise<Record<string, WeeklyProgress>> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return {};

      const weekStart = getWeekStart().toISOString();
      const weekEnd = getWeekEnd().toISOString();

      const { data, error } = await supabase
        .from("sessions")
        .select("goal_id, duration_seconds")
        .eq("user_id", user.id)
        .gte("start_time", weekStart)
        .lte("start_time", weekEnd)
        .not("end_time", "is", null);

      if (error) throw error;

      const sessions = (data ?? []) as Array<{ goal_id: string; duration_seconds: number }>;
      const progress: Record<string, WeeklyProgress> = {};
      let totalUsedSeconds = 0;

      for (const session of sessions) {
        if (!progress[session.goal_id]) {
          progress[session.goal_id] = {
            goal_id: session.goal_id,
            sessions_completed: 0,
            total_hours: 0,
          };
        }
        progress[session.goal_id].sessions_completed += 1;
        progress[session.goal_id].total_hours += session.duration_seconds / 3600;
        totalUsedSeconds += session.duration_seconds;
      }

      const activeSession = useAppStore.getState().activeSession;
      const activeStart = activeSession ? new Date(activeSession.start_time).getTime() : 0;
      if (
        activeSession?.pomodoro &&
        activeStart >= new Date(weekStart).getTime() &&
        activeStart <= new Date(weekEnd).getTime()
      ) {
        totalUsedSeconds += activeSession.pomodoro.focused_seconds ?? 0;
      }

      setWeeklyProgress(progress);
      setUsedTimeThisWeek(totalUsedSeconds);
      return progress;
    },
  });
}

interface CreateSessionInput {
  goal_id: string;
  trigger: SessionTrigger;
  ambient_sound?: AmbientSoundKey | null;
}

/** Best-effort session start coordinates — never prompts, never blocks the start. */
async function getStartCoordinates(): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const fg = await Location.getForegroundPermissionsAsync();
    if (fg.status !== "granted") return null;
    const position = await Location.getLastKnownPositionAsync({
      maxAge: 15 * 60 * 1000,
      requiredAccuracy: 500,
    });
    if (!position) return null;
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
  } catch {
    return null;
  }
}

export function useCreateSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateSessionInput): Promise<Session> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const coords = await getStartCoordinates();

      const { data, error } = await supabase
        .from("sessions")
        .insert({
          user_id: user.id,
          goal_id: input.goal_id,
          trigger: input.trigger,
          start_time: new Date().toISOString(),
          duration_seconds: 0,
          pomodoro_cycles: 0,
          growth_stage: 0,
          ambient_sound: input.ambient_sound ?? null,
          start_latitude: coords?.latitude ?? null,
          start_longitude: coords?.longitude ?? null,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Session;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
    },
  });
}

export function useActiveCheckIn(goalId: string | null | undefined) {
  return useQuery({
    queryKey: [...ACTIVE_CHECKIN_KEY, goalId ?? "none"],
    enabled: Boolean(goalId),
    queryFn: async (): Promise<Session | null> => {
      if (!goalId) return null;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("sessions")
        .select("*")
        .eq("user_id", user.id)
        .eq("goal_id", goalId)
        .is("end_time", null)
        .order("start_time", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as Session | null) ?? null;
    },
    staleTime: 0,
  });
}

export function useStartManualCheckIn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (goal: Goal): Promise<Session> => {
      if (goal.type !== "physical") {
        throw new Error("Manual check-in requires a physical goal.");
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: existing, error: existingError } = await supabase
        .from("sessions")
        .select("*")
        .eq("user_id", user.id)
        .eq("goal_id", goal.id)
        .is("end_time", null)
        .order("start_time", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existingError) throw existingError;
      if (existing) return existing as Session;

      const coords = await getStartCoordinates();
      const { data, error } = await supabase
        .from("sessions")
        .insert({
          user_id: user.id,
          goal_id: goal.id,
          trigger: "manual_checkin",
          start_time: new Date().toISOString(),
          duration_seconds: 0,
          pomodoro_cycles: 0,
          growth_stage: 0,
          start_latitude: coords?.latitude ?? null,
          start_longitude: coords?.longitude ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Session;
    },
    onSuccess: (session) => {
      queryClient.setQueryData(
        [...ACTIVE_CHECKIN_KEY, session.goal_id],
        session,
      );
      queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
    },
  });
}

export function useEndActiveCheckIn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (session: Session): Promise<Session> => {
      if (session.trigger !== "geofence" && session.trigger !== "manual_checkin") {
        throw new Error("This is not an Auto Check-In session.");
      }

      const endedAt = new Date();
      const durationSeconds = Math.max(
        1,
        Math.floor((endedAt.getTime() - new Date(session.start_time).getTime()) / 1000),
      );
      const { data, error } = await supabase
        .from("sessions")
        .update({
          end_time: endedAt.toISOString(),
          duration_seconds: durationSeconds,
          growth_stage: Math.min(4, Math.floor(durationSeconds / 1800)),
        })
        .eq("id", session.id)
        .is("end_time", null)
        .select()
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("This check-in has already ended.");

      await clearPersistedGeofenceVisit(session.goal_id).catch(() => undefined);
      return data as Session;
    },
    onSuccess: (session) => {
      queryClient.setQueryData(
        [...ACTIVE_CHECKIN_KEY, session.goal_id],
        null,
      );
      queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
      queryClient.invalidateQueries({ queryKey: WEEKLY_PROGRESS_KEY });
      queryClient.invalidateQueries({ queryKey: ["streak"] });
      queryClient.invalidateQueries({ queryKey: ["garden", "sessions"] });
      queryClient.invalidateQueries({ queryKey: ["stats", "server-insight"] });
      useAppStore.getState().setLastCompletedSessionId(session.id);
    },
  });
}

interface EndSessionInput {
  session_id: string;
  duration_seconds: number;
  pomodoro_cycles: number;
  growth_stage: number;
  ambient_sound: AmbientSoundKey | null;
}

export function useEndSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: EndSessionInput): Promise<Session> => {
      if (input.duration_seconds <= 0) {
        const { data, error } = await supabase
          .from("sessions")
          .delete()
          .eq("id", input.session_id)
          .select()
          .single();

        if (error) throw error;
        return data as Session;
      }

      const { data, error } = await supabase
        .from("sessions")
        .update({
          end_time: new Date().toISOString(),
          duration_seconds: input.duration_seconds,
          pomodoro_cycles: input.pomodoro_cycles,
          growth_stage: input.growth_stage,
          ambient_sound: input.ambient_sound,
        })
        .eq("id", input.session_id)
        .select()
        .single();

      if (error) throw error;
      return data as Session;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
      queryClient.invalidateQueries({ queryKey: WEEKLY_PROGRESS_KEY });
      queryClient.invalidateQueries({ queryKey: ["streak"] });
      queryClient.invalidateQueries({ queryKey: ["garden", "sessions"] });
      queryClient.invalidateQueries({ queryKey: ["study-spot-sync"] });
    },
  });
}

interface RateSessionInput {
  session_id: string;
  rating: number;
  notes: string | null;
}

export function useRateSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: RateSessionInput): Promise<Session> => {
      const { data, error } = await supabase
        .from("sessions")
        .update({
          rating: input.rating,
          notes: input.notes,
        })
        .eq("id", input.session_id)
        .select()
        .single();

      if (error) throw error;
      return data as Session;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
      queryClient.invalidateQueries({ queryKey: ["garden", "sessions"] });
    },
  });
}

export function useMonthSessions(year: number, month: number) {
  return useQuery({
    queryKey: [...SESSIONS_KEY, "month", year, month],
    queryFn: async (): Promise<Session[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Include the complete Monday–Sunday weeks touching this month. The
      // analytics screen filters the heatmap/KPIs back to the month, while
      // weekly target calculations need the boundary days to stay truthful.
      const monthStart = new Date(year, month, 1);
      monthStart.setDate(monthStart.getDate() - ((monthStart.getDay() + 6) % 7));
      monthStart.setHours(0, 0, 0, 0);
      const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);
      monthEnd.setDate(monthEnd.getDate() + (6 - ((monthEnd.getDay() + 6) % 7)));
      monthEnd.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from("sessions")
        .select("*")
        .eq("user_id", user.id)
        .gte("start_time", monthStart.toISOString())
        .lte("start_time", monthEnd.toISOString())
        .not("end_time", "is", null)
        .order("start_time", { ascending: true });

      if (error) throw error;
      return (data ?? []) as Session[];
    },
  });
}
