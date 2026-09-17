/**
 * Bringing two copies of an island together.
 *
 * The island belongs to the account, so it can be grown on one phone while the
 * other is offline. Both copies then hold real work and neither may win by
 * simply overwriting the other.
 *
 * The rule that makes this safe: **an island never shrinks.** Levels only ever
 * go up, and a session's reward is applied at most once. So the merge takes the
 * higher level of each object and the union of the applied sessions — the result
 * is the same whichever side is merged into which, and merging twice changes
 * nothing.
 *
 * Only the spot is a real choice rather than a maximum: a player can move an
 * object, and moving it is not "more". There the newer `updatedAt` wins.
 *
 * Pure, so the domain suite can walk through the cases.
 */

import type { GrowCategory } from "./growRewards";

export interface MergeableObject {
  objectKey: string;
  /** "milestone" for the landmarks from the hour roadmap. */
  category: GrowCategory | "milestone";
  level: number;
  /**
   * A second picture of the same object — the flag the flagpole flies. Declared
   * here on purpose: it rode along only because the whole entry is copied, and
   * the next refactor would have dropped a player's flag on the way to the
   * server without anything noticing.
   */
  variant?: string | null;
  updatedAt: string;
}

export interface MergeableSpot {
  i: number;
  j: number;
}

export interface IslandSnapshot {
  objects: Record<string, MergeableObject>;
  spots: Record<string, MergeableSpot>;
  appliedSessions: string[];
}

/** Enough to protect every recent reveal; older sessions cannot be reopened. */
export const MAX_APPLIED_SESSIONS = 500;

export const EMPTY_ISLAND: IslandSnapshot = { objects: {}, spots: {}, appliedSessions: [] };

function when(value: string | undefined): number {
  const parsed = Date.parse(value ?? "");
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * One island out of two. The result is independent of the order of the
 * arguments, apart from which side a same-second edit comes from.
 */
export function mergeIslands(a: IslandSnapshot, b: IslandSnapshot): IslandSnapshot {
  const objects: Record<string, MergeableObject> = {};
  const spots: Record<string, MergeableSpot> = {};

  for (const key of new Set([...Object.keys(a.objects), ...Object.keys(b.objects)])) {
    const mine = a.objects[key];
    const theirs = b.objects[key];
    if (!mine || !theirs) {
      objects[key] = (mine ?? theirs) as MergeableObject;
    } else {
      // Growth only goes one way, so the higher level is the true one. The rest
      // of the entry comes from whichever side was written last.
      // Growth takes the higher level; a choice like the flag takes the later
      // one, which is what the whole newer entry already carries.
      const newer = when(theirs.updatedAt) > when(mine.updatedAt) ? theirs : mine;
      objects[key] = { ...newer, level: Math.max(mine.level, theirs.level) };
    }

    const mySpot = a.spots[key];
    const theirSpot = b.spots[key];
    if (!mySpot || !theirSpot) {
      const only = mySpot ?? theirSpot;
      if (only) spots[key] = only;
    } else {
      // Moving an object is a choice, not growth: the later move wins.
      spots[key] =
        when(b.objects[key]?.updatedAt) > when(a.objects[key]?.updatedAt) ? theirSpot : mySpot;
    }
  }

  // A spot without its object is left behind; it would place nothing.
  const applied = new Set([...a.appliedSessions, ...b.appliedSessions]);
  return {
    objects,
    spots,
    appliedSessions: [...applied].slice(-MAX_APPLIED_SESSIONS),
  };
}

/** Is it worth a round trip? Nothing to send means nothing was grown yet. */
export function islandIsEmpty(snapshot: IslandSnapshot): boolean {
  return (
    Object.keys(snapshot.objects).length === 0 && snapshot.appliedSessions.length === 0
  );
}
