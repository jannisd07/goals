/**
 * Places the rewards the player never came back for.
 *
 * `src/lib/growDelivery.ts` decides *which* rewards the app should stop waiting
 * for and *what* they become. This is the part that actually does it — and
 * until now it did not exist, so nothing ever called that module: a reward that
 * was not placed by hand waited in `pendingGrows` for ever, while the reveal
 * screen promised it would "land by itself as soon as your island grows" and
 * Home held a celebration ("grew while you were away") that could never run.
 *
 * The rule the rest of the app is written around: **the reward is earned when
 * the session ends, not when the player taps.** Tapping only chooses what it
 * becomes.
 *
 * Runs when the app comes back, when a session ends and when the island
 * changes — the three moments at which something can newly be overdue or newly
 * fit. It never runs before the account's island has arrived: without it every
 * object would look missing and a fresh install would place rewards on an
 * island it has not seen yet.
 */

import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useAppStore } from "../store";
import { fetchGrowHistory } from "./useGrowHistory";
import { autoGrowPick, overdueGrows } from "../lib/growDelivery";
import { computeGrowSize, type IslandObjectLevels } from "../lib/growRewards";
import { categoryLimit, islandStageFor } from "../lib/islandScene";
import { readPendingGrows, removePendingGrow } from "../lib/pendingGrows";
import { revealIsOpenFor } from "../lib/openReveal";
import type { AutoDeliveredGrow } from "../store/islandSlice";

export function useGrowDelivery(): void {
  const userId = useAppStore((state) => state.userConfig?.id ?? null);
  const island = useAppStore((state) =>
    userId ? state.islandObjectsByUser[userId] : undefined,
  );
  const syncedFor = useAppStore((state) => state.islandSyncedFor);
  const sessionRunning = useAppStore((state) => state.activeSession !== null);

  /** One pass at a time: the passes read and write the same waiting list. */
  const running = useRef(false);

  const deliver = useCallback(async () => {
    if (!userId || syncedFor !== userId || running.current) return;
    running.current = true;
    try {
      const waiting = await readPendingGrows();
      const overdue = overdueGrows(waiting, Date.now());
      if (overdue.length === 0) return;

      const history = new Map<string, number[]>();
      const delivered: AutoDeliveredGrow[] = [];

      for (const grow of overdue) {
        // Not the one the player has open in front of them: answering the
        // question while they are choosing is worse than waiting another day.
        if (revealIsOpenFor(grow.sessionId)) continue;
        // The island is re-read for every reward: two of them must not both be
        // offered the last free place.
        const current = (useAppStore.getState().islandObjectsByUser[userId] ??
          {}) as IslandObjectLevels;
        const stage = islandStageFor(current);

        if (!history.has(grow.goalId)) {
          history.set(
            grow.goalId,
            await fetchGrowHistory(grow.goalId, grow.sessionId).catch(() => []),
          );
        }
        const size = computeGrowSize(grow.durationSeconds, history.get(grow.goalId) ?? []);
        const pick = autoGrowPick(grow, size.tier, current, (category) =>
          categoryLimit(stage, category),
        );
        // Nowhere for it to go: it keeps waiting rather than being thrown away,
        // and so does everything behind it.
        if (!pick) break;

        useAppStore.getState().applyGrowReward(userId, {
          sessionId: grow.sessionId,
          category: pick.category,
          objectKey: pick.objectKey,
          instanceId: pick.instanceId,
          toLevel: pick.toLevel,
        });
        await removePendingGrow(grow.sessionId).catch(() => undefined);
        delivered.push({
          goalName: grow.goalName,
          category: pick.category,
          objectKey: pick.objectKey,
          level: pick.toLevel,
          isNew: pick.fromLevel === 0,
        });
      }

      if (delivered.length > 0) {
        useAppStore.getState().noteAutoDeliveredGrows(delivered);
      }
    } catch (error) {
      // Never in the way of anything: the rewards stay in the list and the next
      // pass tries again.
      console.warn("Could not place a waiting reward by itself:", error);
    } finally {
      running.current = false;
    }
  }, [syncedFor, userId]);

  useEffect(() => {
    void deliver();
  }, [deliver, island, sessionRunning]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") void deliver();
    });
    return () => subscription.remove();
  }, [deliver]);
}
