import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Location from "expo-location";
import { supabase } from "../lib/supabase";
import { useAppStore } from "../store";
import { clearPersistedGeofenceVisit } from "../services/geofencing";
import { getWeekStart, getWeekEnd } from "../lib/time";
import { MAX_GEOFENCE_SESSION_MS } from "../lib/geofenceSessions";
import { normalizeMinVisitMinutes } from "../types";
import {
  flushSessionOutbox,
  isLocalSessionId,
  queueSession,
  rateQueuedSession,
  removeQueuedSession,
} from "../lib/sessionOutbox";
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

/**
 * Whether a failed write is worth keeping for a later attempt.
 *
 * A session that is gone or points at a deleted goal can never be written, and
 * queueing it would block everything behind it. Everything else — no
 * connection, server asleep, a timeout — is exactly what the outbox is for.
 */
function isRetryable(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  // PGRST116: the update matched no row. 23503: the goal no longer exists.
  return code !== "PGRST116" && code !== "23503";
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
    mutationFn: async (session: Session): Promise<Session | null> => {
      if (session.trigger !== "geofence" && session.trigger !== "manual_checkin") {
        throw new Error("This is not an Auto Check-In session.");
      }

      const endedAt = new Date();
      // A visit whose Exit was never delivered can sit open for days. Ending it
      // by hand must not book all of that as time at the place — every other
      // path in the app caps a run-away counter, this one did not.
      const durationSeconds = Math.min(
        Math.floor(MAX_GEOFENCE_SESSION_MS / 1000),
        Math.max(
          1,
          Math.floor((endedAt.getTime() - new Date(session.start_time).getTime()) / 1000),
        ),
      );
      const growthStage = Math.min(4, Math.floor(durationSeconds / 1800));

      // The start sheet promises that "visits shorter than X are not counted, so
      // passing by never becomes a session". Auto Check-In keeps that promise on
      // the way out (geofencing.ts); ending by hand used to log a three-second
      // visit as a full session — one more towards the weekly target, a streak
      // day, a rated session. Below the minimum the row is removed instead.
      const goal = useAppStore.getState().goals.find((entry) => entry.id === session.goal_id);
      const minVisitSeconds =
        normalizeMinVisitMinutes(goal?.min_visit_minutes ?? null) * 60;
      if (durationSeconds < minVisitSeconds) {
        await removeQueuedSession(session.id);
        if (!isLocalSessionId(session.id)) {
          const { error } = await supabase
            .from("sessions")
            .delete()
            .eq("id", session.id)
            .is("end_time", null);
          // Offline the open row stays; the next Enter for this goal discards it.
          if (error && !isRetryable(error)) throw error;
        }
        await clearPersistedGeofenceVisit(session.goal_id).catch(() => undefined);
        return null;
      }

      const keepForLater = async (): Promise<null> => {
        await queueSession({
          id: session.id,
          serverId: isLocalSessionId(session.id) ? null : session.id,
          goalId: session.goal_id,
          trigger: session.trigger,
          startTime: session.start_time,
          endTime: endedAt.toISOString(),
          durationSeconds,
          pomodoroCycles: 0,
          growthStage,
          ambientSound: null,
          startLatitude: session.start_latitude ?? null,
          startLongitude: session.start_longitude ?? null,
          rating: null,
          notes: null,
          queuedAt: new Date().toISOString(),
        });
        await clearPersistedGeofenceVisit(session.goal_id).catch(() => undefined);
        return null;
      };

      if (isLocalSessionId(session.id)) return keepForLater();

      let data: Session | null;
      try {
        const result = await supabase
          .from("sessions")
          .update({
            end_time: endedAt.toISOString(),
            duration_seconds: durationSeconds,
            growth_stage: growthStage,
          })
          .eq("id", session.id)
          .is("end_time", null)
          .select()
          .maybeSingle();
        if (result.error) {
          if (isRetryable(result.error)) return keepForLater();
          throw result.error;
        }
        data = result.data as Session | null;
      } catch (error) {
        if (isRetryable(error)) return keepForLater();
        throw error;
      }
      if (!data) throw new Error("This check-in has already ended.");

      await clearPersistedGeofenceVisit(session.goal_id).catch(() => undefined);
      return data as Session;
    },
    onSuccess: (result, session) => {
      void flushSessionOutbox();
      queryClient.setQueryData(
        [...ACTIVE_CHECKIN_KEY, session.goal_id],
        null,
      );
      queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
      // The week view keeps its own key; without this a session that just ended
      // is missing from the chart for the next five minutes.
      queryClient.invalidateQueries({ queryKey: ["analytics", "week"] });
      queryClient.invalidateQueries({ queryKey: WEEKLY_PROGRESS_KEY });
      queryClient.invalidateQueries({ queryKey: ["streak"] });
      queryClient.invalidateQueries({ queryKey: ["stats", "server-insight"] });
      // A visit that was too short to count has nothing to rate.
      if (result !== null || isLocalSessionId(session.id)) {
        useAppStore.getState().setLastCompletedSessionId(session.id);
      }
    },
  });
}

interface EndSessionInput {
  session_id: string;
  duration_seconds: number;
  pomodoro_cycles: number;
  growth_stage: number;
  ambient_sound: AmbientSoundKey | null;
  /** Needed to write the whole row later if this one cannot be sent now. */
  goal_id: string;
  start_time: string;
}

export function useEndSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: EndSessionInput): Promise<Session | null> => {
      const startedOffline = isLocalSessionId(input.session_id);

      if (input.duration_seconds <= 0) {
        // Nothing worth keeping. A session that never reached the server has no
        // row to remove, so there is nothing to do but forget it.
        if (startedOffline) {
          await removeQueuedSession(input.session_id);
          return null;
        }
        const { data, error } = await supabase
          .from("sessions")
          .delete()
          .eq("id", input.session_id)
          .select()
          .single();

        if (error) throw error;
        return data as Session;
      }

      const endedAt = new Date().toISOString();
      const keepForLater = async (): Promise<null> => {
        await queueSession({
          id: input.session_id,
          serverId: startedOffline ? null : input.session_id,
          goalId: input.goal_id,
          trigger: "manual_pomodoro",
          startTime: input.start_time,
          endTime: endedAt,
          durationSeconds: input.duration_seconds,
          pomodoroCycles: input.pomodoro_cycles,
          growthStage: input.growth_stage,
          ambientSound: input.ambient_sound,
          startLatitude: null,
          startLongitude: null,
          rating: null,
          notes: null,
          queuedAt: new Date().toISOString(),
        });
        return null;
      };

      // The row only exists if the session could be started online.
      if (startedOffline) return keepForLater();

      try {
        const { data, error } = await supabase
          .from("sessions")
          .update({
            end_time: endedAt,
            duration_seconds: input.duration_seconds,
            pomodoro_cycles: input.pomodoro_cycles,
            growth_stage: input.growth_stage,
            ambient_sound: input.ambient_sound,
          })
          .eq("id", input.session_id)
          .select()
          .single();

        if (error) {
          if (isRetryable(error)) return keepForLater();
          throw error;
        }
        return data as Session;
      } catch (error) {
        // A thrown fetch error means the request never left the phone.
        if (isRetryable(error)) return keepForLater();
        throw error;
      }
    },
    onSuccess: () => {
      void flushSessionOutbox();
      queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
      queryClient.invalidateQueries({ queryKey: ["analytics", "week"] });
      queryClient.invalidateQueries({ queryKey: WEEKLY_PROGRESS_KEY });
      queryClient.invalidateQueries({ queryKey: ["streak"] });
      queryClient.invalidateQueries({ queryKey: ["stats", "server-insight"] });
      queryClient.invalidateQueries({ queryKey: ["study-spot-sync"] });
    },
  });
}

/**
 * Removes a session the user marks as wrong, e.g. an Auto Check-In that fired while
 * they only drove past the gym. RLS allows deleting one's own sessions; an empty
 * result means the row was already gone or not ours, which is reported as an error
 * instead of a silent no-op.
 */
export function useDeleteSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionId: string): Promise<string> => {
      // If it is still waiting to be sent, deleting it means never sending it.
      await removeQueuedSession(sessionId);
      if (isLocalSessionId(sessionId)) return sessionId;

      const { data, error } = await supabase
        .from("sessions")
        .delete()
        .eq("id", sessionId)
        .select("id");

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("This session was not found. Reload the week and try again.");
      }
      return sessionId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
      queryClient.invalidateQueries({ queryKey: WEEKLY_PROGRESS_KEY });
      // The week list lives under its own key, not under ["sessions"].
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      queryClient.invalidateQueries({ queryKey: ["streak"] });
      queryClient.invalidateQueries({ queryKey: ["stats", "server-insight"] });
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
    mutationFn: async (input: RateSessionInput): Promise<Session | null> => {
      // A session that has not reached the server yet carries its rating along
      // in the queue instead of failing in front of the player.
      const keepForLater = async (): Promise<null> => {
        const queued = await rateQueuedSession(
          input.session_id,
          input.rating,
          input.notes,
        );
        if (!queued) throw new Error("Your rating could not be saved.");
        return null;
      };

      if (isLocalSessionId(input.session_id)) return keepForLater();

      try {
        const { data, error } = await supabase
          .from("sessions")
          .update({
            rating: input.rating,
            notes: input.notes,
          })
          .eq("id", input.session_id)
          .select()
          .single();

        if (error) {
          if (isRetryable(error)) return keepForLater();
          throw error;
        }
        return data as Session;
      } catch (error) {
        if (isRetryable(error)) return keepForLater();
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
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
