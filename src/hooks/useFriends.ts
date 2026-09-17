import { useCallback } from "react";
import { Share } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { supabase } from "../lib/supabase";
import { useAppStore } from "../store";
import { getWeekStart, getWeekEnd } from "../lib/time";
import type { FriendWeekly } from "../types";
import type { IslandObjectLevels } from "../lib/growRewards";
import type { Spot } from "../lib/islandPlacement";

/** A friend's island as it is drawn: what stands on it, and where. */
export interface FriendIsland {
  stage: number;
  levels: number;
  objects: IslandObjectLevels;
  spots: Record<string, Spot>;
}

const FRIENDS_KEY = ["friends-weekly"];

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

async function generateCode(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(6);
  return Array.from(
    bytes,
    (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length],
  ).join("");
}

/** Returns the user's friend code, creating one on first use. */
export function useMyFriendCode() {
  const userConfig = useAppStore((s) => s.userConfig);
  const setUserConfig = useAppStore((s) => s.setUserConfig);

  return useQuery({
    queryKey: ["friend-code", userConfig?.id ?? "anon"],
    enabled: Boolean(userConfig?.id),
    queryFn: async (): Promise<string | null> => {
      if (!userConfig) return null;
      if (userConfig.friend_code) return userConfig.friend_code;

      let lastError: Error | null = null;
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const candidate = await generateCode();
        const { data, error } = await supabase.rpc("set_my_friend_code", {
          code: candidate,
        });
        if (!error && data) {
          setUserConfig({ ...userConfig, friend_code: data as string });
          return data as string;
        }
        if (error) lastError = error;
        // Unique-index conflict: try another candidate.
      }
      throw lastError ?? new Error("Could not create a friend code.");
    },
  });
}

export function useFriendsWeekly() {
  return useQuery({
    queryKey: FRIENDS_KEY,
    queryFn: async (): Promise<FriendWeekly[]> => {
      const { data, error } = await supabase.rpc("get_friends_weekly", {
        week_start: getWeekStart().toISOString(),
        week_end: getWeekEnd().toISOString(),
      });
      if (error) throw error;
      return (data ?? []) as FriendWeekly[];
    },
  });
}

export function useAddFriend() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (code: string): Promise<{ display_name: string }> => {
      const { data, error } = await supabase.rpc("add_friend_by_code", {
        code: code.trim().toUpperCase(),
      });
      if (error) {
        const message = error.message?.includes("FRIEND_CODE_NOT_FOUND")
          ? "No one found with this code. Double-check it."
          : error.message?.includes("CANNOT_ADD_SELF")
            ? "That is your own code."
            : "Could not add friend. Please try again.";
        throw new Error(message);
      }
      const row = (data as Array<{ friend_id: string; display_name: string }>)?.[0];
      return { display_name: row?.display_name ?? "Friend" };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FRIENDS_KEY });
    },
  });
}

export function useRemoveFriend() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (friendId: string): Promise<void> => {
      const { error } = await supabase.rpc("remove_friend", {
        friend: friendId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FRIENDS_KEY });
    },
  });
}

/**
 * Share sheet with the player's own code.
 *
 * `Share` is imported at the top of the file on purpose. It used to be pulled in
 * with `await import("react-native")` inside the handler, which crashed the app
 * on every tap in a release build: the dynamic import builds a module namespace
 * for all of React Native, and doing that reads every lazy export getter at
 * once — including ones whose native side is not in the binary, which throws
 * "`new NativeEventEmitter()` requires a non-null argument" and takes the whole
 * app down (crash report 2026-09-16 15:22). There was never a reason to load
 * it late.
 */
export function useShareFriendCode(code: string | null | undefined) {
  return useCallback(async () => {
    if (!code) return;
    await Share.share({
      message: `Add me on Goals — my friend code is ${code}`,
    }).catch(() => null);
  }, [code]);
}

/**
 * What stands on a friend's island, fetched only when you actually go and look.
 *
 * Deliberately not part of the friends list: the list shows everyone at once and
 * a whole island each would be a lot of data for a screen that only needs a
 * size. `get_friend_island` checks the friend link itself, so a missing link is
 * an error from the server rather than something this hook has to police.
 */
export function useFriendIsland(friendId: string | null) {
  return useQuery({
    queryKey: ["friend-island", friendId ?? "none"],
    enabled: Boolean(friendId),
    queryFn: async (): Promise<FriendIsland> => {
      const { data, error } = await supabase.rpc("get_friend_island", { friend: friendId });
      if (error) throw error;
      const row = (Array.isArray(data) ? data[0] : data) as
        | { stage: number; levels: number; objects: unknown; spots: unknown }
        | undefined;
      // A friend who has never grown anything has no row at all, and an empty
      // island of size one is the honest picture of that.
      if (!row) return { stage: 1, levels: 0, objects: {}, spots: {} };
      return {
        stage: Math.max(1, Math.min(5, Math.round(row.stage ?? 1))),
        levels: Math.max(0, Math.round(row.levels ?? 0)),
        objects: (row.objects ?? {}) as FriendIsland["objects"],
        spots: (row.spots ?? {}) as FriendIsland["spots"],
      };
    },
  });
}
