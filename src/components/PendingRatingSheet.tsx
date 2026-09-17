import React, { useCallback, useEffect, useRef } from "react";
import { Alert } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { RatingSheet } from "./RatingSheet";
import { useRateSession } from "../hooks/useSessions";
import { supabase } from "../lib/supabase";
import { isLocalSessionId, readSessionOutbox, resolveSessionId } from "../lib/sessionOutbox";
import { formatDuration } from "../lib/time";
import { useAppStore } from "../store";

interface RatingContext {
  goalName: string;
  durationSeconds: number;
  cycles: number;
}

/** Shared rating destination for manual sessions and notification-driven check-ins. */
export function PendingRatingSheet() {
  const sessionId = useAppStore((state) => state.lastCompletedSessionId);
  const isAuthenticated = useAppStore((state) => state.isAuthenticated);
  const setSessionId = useAppStore((state) => state.setLastCompletedSessionId);
  const rateSession = useRateSession();

  const lastAlertedSessionRef = useRef<string | null>(null);
  const { data, isError, refetch } = useQuery({
    queryKey: ["pending-rating", sessionId],
    enabled: isAuthenticated && Boolean(sessionId),
    queryFn: async (): Promise<RatingContext> => {
      // A session finished offline may still be waiting in the queue — then
      // everything the sheet needs is there and the rating travels with the
      // entry — or it has been sent since and lives on the server under its own id.
      const resolvedId = await resolveSessionId(sessionId!);
      if (isLocalSessionId(resolvedId)) {
        const queued = (await readSessionOutbox()).find((entry) => entry.id === resolvedId);
        if (!queued) throw new Error("This session is no longer waiting to be sent.");
        const goal = useAppStore.getState().goals.find((entry) => entry.id === queued.goalId);
        return {
          goalName: goal?.name ?? "Focus",
          durationSeconds: queued.durationSeconds,
          cycles: queued.pomodoroCycles,
        };
      }

      const { data: session, error: sessionError } = await supabase
        .from("sessions")
        .select("goal_id,duration_seconds,pomodoro_cycles")
        .eq("id", resolvedId)
        .single();
      if (sessionError) throw sessionError;

      const { data: goal, error: goalError } = await supabase
        .from("goals")
        .select("name,color")
        .eq("id", session.goal_id)
        .single();
      if (goalError) throw goalError;

      return {
        goalName: goal.name as string,
        durationSeconds: session.duration_seconds as number,
        cycles: session.pomodoro_cycles as number,
      };
    },
  });

  useEffect(() => {
    if (!sessionId || !isError || lastAlertedSessionRef.current === sessionId) return;
    lastAlertedSessionRef.current = sessionId;
    Alert.alert(
      "Rating unavailable",
      "The completed session could not be loaded.",
      [
        {
          text: "Skip",
          style: "cancel",
          onPress: () => setSessionId(null),
        },
        {
          text: "Try Again",
          onPress: () => {
            lastAlertedSessionRef.current = null;
            void refetch();
          },
        },
      ],
    );
  }, [isError, refetch, sessionId, setSessionId]);

  const handleSubmit = useCallback(
    async (rating: number, notes: string | null) => {
      if (!sessionId || rateSession.isPending) return;
      try {
        await rateSession.mutateAsync({
          session_id: sessionId,
          rating,
          notes,
        });
        setSessionId(null);
      } catch {
        Alert.alert("Could not save rating", "Check your connection and try again.");
      }
    },
    [rateSession, sessionId, setSessionId],
  );

  if (!sessionId || !data) return null;

  return (
    <RatingSheet
      key={sessionId}
      goalName={data.goalName}
      duration={formatDuration(data.durationSeconds)}
      cycles={data.cycles}
      submitting={rateSession.isPending}
      onSubmit={(rating, notes) => void handleSubmit(rating, notes)}
      onDismiss={() => {
        if (!rateSession.isPending) setSessionId(null);
      }}
    />
  );
}
