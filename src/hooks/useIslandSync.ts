/**
 * Keeps the island on the account.
 *
 * Mounted once at the app root. After signing in it reads the island stored for
 * the account, merges it with whatever is on this phone (`islandMerge.ts`) and
 * writes the result back. From then on every change is sent again, a moment
 * after it settles.
 *
 * Two rules protect a player's work, and both are needed:
 *
 *   1. **Nothing is sent before the account's island has been read.** A fresh
 *      install starts empty, and sending that first would wipe out everything
 *      grown on another phone. If the read fails — offline, server asleep — the
 *      app keeps growing locally and tries again from the foreground.
 *   2. **Nothing is read before this phone's own island has been loaded from
 *      disk.** The persisted store hydrates asynchronously, so the account id
 *      can arrive first. Merging then compares the server against an island that
 *      only *looks* empty, and `replaceIsland` writes that emptiness over the
 *      real one. That is not theoretical: it cost a session's rewards on
 *      2026-09-15.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useAppStore } from "../store";
import { mergeIslands, type IslandSnapshot } from "../lib/islandMerge";
import { fetchIsland, pushIsland } from "../lib/islandSync";

/** How long changes are collected before they are sent. */
const PUSH_DELAY_MS = 1500;

/**
 * How long to wait before trying a failed write again.
 *
 * Without this, a write that failed was only ever repeated by the *next* thing
 * that grew. A player who finishes for the day right after a failed write would
 * have that growth sitting on the phone alone until they came back.
 */
const RETRY_DELAY_MS = 60_000;

function snapshotOf(userId: string): IslandSnapshot {
  const state = useAppStore.getState();
  return {
    objects: state.islandObjectsByUser[userId] ?? {},
    spots: state.islandSpotsByUser[userId] ?? {},
    appliedSessions: state.appliedGrowSessionsByUser[userId] ?? [],
  };
}

export function useIslandSync(): void {
  const userId = useAppStore((state) => state.userConfig?.id ?? null);
  const objects = useAppStore((state) => (userId ? state.islandObjectsByUser[userId] : undefined));
  const spots = useAppStore((state) => (userId ? state.islandSpotsByUser[userId] : undefined));
  const applied = useAppStore((state) =>
    userId ? state.appliedGrowSessionsByUser[userId] : undefined,
  );
  const replaceIsland = useAppStore((state) => state.replaceIsland);

  /** The account whose island has been read; only then may anything be sent. */
  const readFor = useRef<string | null>(null);
  const hydrated = useStoreHydrated();
  /**
   * When the last write failed, as a timestamp rather than a flag: a second
   * failure has to restart the retry timer, and a flag that is already true
   * would not change and would silently end the retries after one attempt.
   */
  const [failedAt, setFailedAt] = useState<number | null>(null);

  const push = useCallback(async (snapshot?: IslandSnapshot) => {
    if (!userId) return;
    const ok = await pushIsland(userId, snapshot ?? snapshotOf(userId));
    setFailedAt(ok ? null : Date.now());
  }, [userId]);

  const pull = useCallback(async () => {
    if (!hydrated || !userId || readFor.current === userId) return;
    const remote = await fetchIsland(userId);
    if (!remote) return; // could not read: keep growing locally, try again later
    const merged = mergeIslands(snapshotOf(userId), remote);
    replaceIsland(userId, merged);
    readFor.current = userId;
    // Only now may anything judge what is missing from this island.
    useAppStore.getState().setIslandSyncedFor(userId);
    await push(merged);
  }, [hydrated, push, replaceIsland, userId]);

  useEffect(() => {
    if (!userId) {
      readFor.current = null;
      useAppStore.getState().setIslandSyncedFor(null);
      return;
    }
    void pull();
  }, [pull, userId]);

  // A phone that was offline at sign-in gets its island as soon as it is back.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next !== "active") return;
      void pull();
      if (failedAt !== null) void push();
    });
    return () => subscription.remove();
  }, [failedAt, pull, push]);

  useEffect(() => {
    if (!hydrated || !userId || readFor.current !== userId) return;
    // Growing usually comes in bursts — one reward changes objects, spots and
    // the applied sessions — so the write waits for the burst to end.
    const timer = setTimeout(() => {
      void push();
    }, PUSH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [applied, hydrated, objects, push, spots, userId]);

  // Keep trying until it lands. Nothing else would: the next attempt otherwise
  // depends on the player growing something again.
  useEffect(() => {
    if (failedAt === null || !userId || readFor.current !== userId) return;
    const timer = setTimeout(() => {
      void push();
    }, RETRY_DELAY_MS);
    return () => clearTimeout(timer);
  }, [failedAt, push, userId]);
}

/**
 * Whether the persisted store has finished loading from disk.
 *
 * `hasHydrated` can already be true on the first render (a warm start), and it
 * can flip between that render and the subscription — both cases are checked.
 */
function useStoreHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => useAppStore.persist.hasHydrated());
  useEffect(() => {
    if (hydrated) return undefined;
    const stop = useAppStore.persist.onFinishHydration(() => setHydrated(true));
    if (useAppStore.persist.hasHydrated()) setHydrated(true);
    return stop;
  }, [hydrated]);
  return hydrated;
}
