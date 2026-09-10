import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { parseServerInsight, type ServerInsight } from "../lib/serverInsights";
import { deviceTimeZone } from "../lib/time";
import { useAppStore } from "../store";

const DAY_MS = 24 * 60 * 60 * 1000;
/** The server computes the insight fresh, so a short cache keeps it current after new sessions. */
const INSIGHT_STALE_MS = 10 * 60 * 1000;
const INSIGHT_KEY = ["stats", "server-insight"] as const;

async function readableFunctionError(error: unknown): Promise<Error> {
  const context = (error as { context?: { json?: () => Promise<unknown> } } | null)
    ?.context;
  if (context?.json) {
    try {
      const payload = await context.json();
      if (
        typeof payload === "object" &&
        payload !== null &&
        "code" in payload &&
        payload.code === "INSIGHT_REFRESH_LIMIT"
      ) {
        return new Error("You have used today’s three insight refreshes.");
      }
    } catch {
      // Fall through to a stable user-facing error.
    }
  }
  return new Error("The insight could not be refreshed right now.");
}

async function requestInsight(force: boolean, goalId: string | null): Promise<ServerInsight> {
  const { data, error } = await supabase.functions.invoke("analyze-sessions", {
    body: {
      force,
      goal_id: goalId,
      time_zone: deviceTimeZone(),
      // getTimezoneOffset counts minutes *behind* UTC, the server expects ahead.
      utc_offset_minutes: -new Date().getTimezoneOffset(),
    },
  });
  if (error) throw await readableFunctionError(error);
  return parseServerInsight(data);
}

/** Pattern insight for one goal; the Stats screen passes the selected goal. */
export function useServerInsight(goalId: string | null = null) {
  const userId = useAppStore((state) => state.userConfig?.id);
  const queryClient = useQueryClient();
  const queryKey = [...INSIGHT_KEY, userId ?? "anon", goalId ?? "all"] as const;

  const query = useQuery({
    queryKey,
    enabled: Boolean(userId),
    queryFn: () => requestInsight(false, goalId),
    staleTime: INSIGHT_STALE_MS,
    gcTime: DAY_MS,
    retry: 1,
  });

  const refresh = useMutation({
    mutationFn: () => requestInsight(true, goalId),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKey, data);
    },
  });

  return {
    ...query,
    refresh: refresh.mutateAsync,
    isRefreshing: refresh.isPending,
    refreshError: refresh.error,
  };
}
