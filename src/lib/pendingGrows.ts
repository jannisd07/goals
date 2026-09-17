/**
 * Finished sessions whose reward has not been placed on the island yet.
 *
 * Kept under its own AsyncStorage key rather than in the Zustand store: the
 * Auto Check-In background task writes here while the app may not be running,
 * and the persisted store is not guaranteed to be hydrated in that context.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { asGrowCategory, sessionEarnsReward, type GrowCategory } from "./growRewards";
import type { ActiveSession } from "../types";

export const PENDING_GROWS_KEY = "goals-pending-grows";

/**
 * A ceiling against a runaway writer, not a product limit.
 *
 * It used to be 20, which is reachable: rewards only leave this list when the
 * island can take them, so a player whose island is full while every category
 * is room-limited collects them here. Silently dropping the oldest meant
 * throwing away earned rewards without anybody noticing.
 */
const MAX_PENDING_GROWS = 200;

export interface PendingGrow {
  sessionId: string;
  goalId: string;
  goalName: string;
  durationSeconds: number;
  endedAt: string;
  /** Chosen before a focus session; null after Auto Check-In, picked on the reveal screen. */
  category: GrowCategory | null;
  /** Object chosen before a focus session, if any. */
  objectKey: string | null;
}

/**
 * A stored entry, or null when it is unusable. A category a session can no
 * longer grow (the old "special") becomes null, so the reward is still offered.
 */
function toPendingGrow(value: unknown): PendingGrow | null {
  if (!value || typeof value !== "object") return null;
  const entry = value as Record<string, unknown>;
  if (
    typeof entry.sessionId !== "string" ||
    typeof entry.goalId !== "string" ||
    typeof entry.goalName !== "string" ||
    typeof entry.durationSeconds !== "number" ||
    !Number.isFinite(entry.durationSeconds) ||
    typeof entry.endedAt !== "string"
  ) {
    return null;
  }
  return {
    sessionId: entry.sessionId,
    goalId: entry.goalId,
    goalName: entry.goalName,
    durationSeconds: entry.durationSeconds,
    endedAt: entry.endedAt,
    category: asGrowCategory(entry.category),
    objectKey: typeof entry.objectKey === "string" ? entry.objectKey : null,
  };
}

/** Oldest first. */
export async function readPendingGrows(): Promise<PendingGrow[]> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_GROWS_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(toPendingGrow)
      .filter((entry): entry is PendingGrow => entry !== null);
  } catch {
    return [];
  }
}

async function writePendingGrows(grows: PendingGrow[]): Promise<void> {
  const kept = grows.slice(-MAX_PENDING_GROWS);
  if (kept.length < grows.length) {
    console.warn(
      `Dropping ${grows.length - kept.length} of the oldest waiting rewards: the list is full.`,
    );
  }
  await AsyncStorage.setItem(PENDING_GROWS_KEY, JSON.stringify(kept));
}

/**
 * Changes go through one queue.
 *
 * Reading, changing and writing the list is three awaits, and the geofence task
 * writes here while the app is running: without the queue a check-in that ends
 * while the reveal screen is being confirmed could drop one of the two — either
 * the new reward is never offered, or the confirmed one comes back.
 */
let queue: Promise<unknown> = Promise.resolve();

function change(edit: (grows: PendingGrow[]) => PendingGrow[] | null): Promise<void> {
  const next = queue.then(async () => {
    const current = await readPendingGrows();
    const updated = edit(current);
    if (updated) await writePendingGrows(updated);
  });
  // A failed change must not block the ones behind it.
  queue = next.catch(() => undefined);
  return next;
}

export async function addPendingGrow(grow: PendingGrow): Promise<void> {
  await change((current) => {
    const known = current.find((entry) => entry.sessionId === grow.sessionId);
    return [
      ...current.filter((entry) => entry.sessionId !== grow.sessionId),
      // When a session ended never changes, so writing the same reward again
      // must not make it look fresh — otherwise reopening the reveal screen
      // would keep resetting how long it has been waiting.
      known ? { ...grow, endedAt: known.endedAt } : grow,
    ];
  });
}

export async function removePendingGrow(sessionId: string): Promise<void> {
  await change((current) =>
    current.some((entry) => entry.sessionId === sessionId)
      ? current.filter((entry) => entry.sessionId !== sessionId)
      : null,
  );
}

/**
 * Keep the reward of a session that is ending, whatever the reason.
 *
 * Used where a session leaves the app without the player pressing anything —
 * dropped after the phone was off for hours, closed on sign-out. The focus time
 * up to that point was real, so the reward is too: it waits like any other and
 * lands on the island by itself if nobody comes back for it.
 *
 * Returns whether anything was kept, so callers can say so.
 */
export async function rememberSessionReward(
  session: ActiveSession | null | undefined,
): Promise<boolean> {
  const focusedSeconds = session?.pomodoro?.focused_seconds ?? 0;
  // Same rule as the End button, including the upper bound: a counter that ran
  // away is not focus time and must not become a reward.
  if (!session || !sessionEarnsReward(focusedSeconds)) return false;
  await addPendingGrow({
    sessionId: session.session_id,
    goalId: session.goal_id,
    goalName: session.goal_name,
    durationSeconds: focusedSeconds,
    endedAt: new Date().toISOString(),
    category: asGrowCategory(session.grow_category),
    objectKey: session.grow_object_key ?? null,
  }).catch(() => undefined);
  return true;
}

/** Pending rewards belong to the signed-in account and never survive a sign-out. */
export async function clearPendingGrows(): Promise<void> {
  await AsyncStorage.removeItem(PENDING_GROWS_KEY);
}
