/**
 * Puts the hour milestones on the island, and makes each one a moment.
 *
 * A milestone is not an event that can be missed — it is a fact about the total
 * hours tracked. So this does not wait for anything: every time the hours are
 * known it compares them with the island and puts right whatever is missing.
 * Close the app for a month, come back, and the landmarks you earned are simply
 * there.
 *
 * The first time one is placed it also becomes a moment: a notification, and a
 * celebration the next time the player looks at the app. Landmarks restored on a
 * new phone are placed silently — they were celebrated once already.
 */

import { useEffect, useRef } from "react";
import { useAppStore } from "../store";
import { useLifetimeHours } from "./useLifetimeHours";
import { milestoneFor, missingMilestones } from "../lib/milestones";
import { sendMilestoneReached } from "../lib/notifications";

export function useMilestoneDelivery(): void {
  const userId = useAppStore((state) => state.userConfig?.id ?? null);
  const island = useAppStore((state) =>
    userId ? state.islandObjectsByUser[userId] : undefined,
  );
  const applyMilestone = useAppStore((state) => state.applyMilestone);
  const syncedFor = useAppStore((state) => state.islandSyncedFor);
  const noteMilestone = useAppStore((state) => state.noteMilestoneArrived);
  const lifetimeHours = useLifetimeHours();

  /** Landmarks already announced in this app run, so a re-render says nothing twice. */
  const announced = useRef(new Set<string>());

  useEffect(() => {
    const hours = lifetimeHours.data;
    if (!userId || hours === undefined || lifetimeHours.isLoading) return;
    // Wait for the account's island: without it every landmark would look
    // missing, and a new phone would celebrate what it already owns.
    if (syncedFor !== userId) return;
    const missing = missingMilestones(hours, island ?? {});
    if (missing.length === 0) return;

    for (const landmark of missing) {
      applyMilestone(userId, landmark.objectKey, landmark.tier);
      const entry = milestoneFor(landmark.objectKey, landmark.tier);
      if (!entry) continue;
      const stamp = `${userId}:${entry.id}`;
      if (announced.current.has(stamp)) continue;
      announced.current.add(stamp);
      void sendMilestoneReached(entry.title, entry.description, entry.hours);
      noteMilestone({
        id: entry.id,
        objectKey: landmark.objectKey,
        tier: landmark.tier,
        title: entry.title,
        description: entry.description,
        hours: entry.hours,
      });
    }
  }, [
    applyMilestone,
    island,
    lifetimeHours.data,
    lifetimeHours.isLoading,
    noteMilestone,
    syncedFor,
    userId,
  ]);
}
