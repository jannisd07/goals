import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAppStore } from "../store";
import { getWeekStart, getWeekEnd } from "../lib/time";
import type { Session, SessionTrigger, AmbientSoundKey, WeeklyProgress } from "../types";

const SESSIONS_KEY = ["sessions"];
const WEEKLY_PROGRESS_KEY = ["weekly-progress"];

export function useWeeklySessions() {
  return useQuery({
    queryKey: [...SESSIONS_KEY, "weekly"],
    queryFn: async (): Promise<Session[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const weekStart = getWeekStart().toISOString();
      const weekEnd = getWeekEnd().toISOString();

      const { data, error } = await supabase
        .from("sessions")
        .select("*")
        .eq("user_id", user.id)
        .gte("start_time", weekStart)
        .lte("start_time", weekEnd)
        .order("start_time", { ascending: false });

      if (error) throw error;
      return (data ?? []) as Session[];
    },
  });
}

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

export function useCreateSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateSessionInput): Promise<Session> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

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
    },
  });
}

export function useHeatMapData(goalId?: string) {
  return useQuery({
    queryKey: ["heatmap", goalId ?? "all"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const weekStart = getWeekStart().toISOString();
      const weekEnd = getWeekEnd().toISOString();

      let query = supabase
        .from("sessions")
        .select("start_time, duration_seconds")
        .eq("user_id", user.id)
        .gte("start_time", weekStart)
        .lte("start_time", weekEnd)
        .not("end_time", "is", null);

      if (goalId) {
        query = query.eq("goal_id", goalId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const grid: number[][] = Array.from({ length: 24 }, () => Array(7).fill(0) as number[]);

      for (const session of data ?? []) {
        const start = new Date(session.start_time);
        const hour = start.getHours();
        const day = (start.getDay() + 6) % 7;
        grid[hour][day] += (session.duration_seconds as number) / 60;
      }

      return grid;
    },
  });
}

export function useAIInsight() {
  return useQuery({
    queryKey: ["ai-insight"],
    queryFn: async (): Promise<string> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return "";

      const { data, error } = await supabase.functions.invoke("analyze-sessions", {
        body: { user_id: user.id },
      });

      if (error) return "Unable to generate insights at this time.";
      return (data as { insight: string })?.insight ?? "";
    },
    staleTime: 24 * 60 * 60 * 1000,
    retry: 1,
  });
}
