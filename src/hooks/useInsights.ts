import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { parseServerInsight, type ServerInsight } from "../lib/serverInsights";
import { useAppStore } from "../store";

const DAY_MS = 24 * 60 * 60 * 1000;
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

async function requestInsight(force: boolean): Promise<ServerInsight> {
  const { data, error } = await supabase.functions.invoke("analyze-sessions", {
    body: { force },
  });
  if (error) throw await readableFunctionError(error);
  return parseServerInsight(data);
}

export function useServerInsight() {
  const userId = useAppStore((state) => state.userConfig?.id);
  const queryClient = useQueryClient();
  const queryKey = [...INSIGHT_KEY, userId ?? "anon"] as const;

  const query = useQuery({
    queryKey,
    enabled: Boolean(userId),
    queryFn: () => requestInsight(false),
    staleTime: DAY_MS,
    gcTime: 2 * DAY_MS,
    retry: 1,
  });

  const refresh = useMutation({
    mutationFn: () => requestInsight(true),
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
