/**
 * Every finished session leaves something on the island — whatever the player does.
 *
 * The reward is earned the moment the session ends. The reveal screen is only
 * the choice of *what* it becomes, never a gate: a player who taps "Later",
 * kills the app, or never opens it again must still find their island grown.
 *
 * So a reward that is not placed waits in `pendingGrows`, and this module decides
 * when the app stops waiting and places it itself. Two rules trigger that:
 *
 * - it has waited longer than `AUTO_APPLY_AFTER_HOURS`, or
 * - more than `MAX_WAITING_REWARDS` have piled up, in which case the oldest
 *   ones are placed so the queue never grows without end.
 *
 * Everything here is pure, so the domain suite can walk through the cases.
 */

import {
  defaultGrowOption,
  GROW_CATEGORIES,
  growOptions,
  type GrowCategory,
  type GrowSizeTier,
  type IslandObjectLevels,
} from "./growRewards";

/** A reward that has waited this long is placed without asking. */
export const AUTO_APPLY_AFTER_HOURS = 24;

/** More than this waiting at once and the oldest are placed straight away. */
export const MAX_WAITING_REWARDS = 3;

/** What `overdueGrows` and `autoGrowPick` need to know about a waiting reward. */
export interface WaitingGrow {
  sessionId: string;
  endedAt: string;
  category: GrowCategory | null;
  objectKey: string | null;
}

/**
 * The rewards the app should stop waiting for, oldest first. Anything that is
 * still fresh and inside the queue limit is left for the player to place.
 */
export function overdueGrows<T extends WaitingGrow>(grows: readonly T[], nowMs: number): T[] {
  const byAge = [...grows].sort(
    (a, b) => Date.parse(a.endedAt || "") - Date.parse(b.endedAt || ""),
  );
  const tooOld = (grow: T): boolean => {
    const ended = Date.parse(grow.endedAt || "");
    // An unreadable date counts as old: it can never become fresh again.
    if (Number.isNaN(ended)) return true;
    return nowMs - ended >= AUTO_APPLY_AFTER_HOURS * 3600 * 1000;
  };
  const overflow = Math.max(0, byAge.length - MAX_WAITING_REWARDS);
  return byAge.filter((grow, index) => index < overflow || tooOld(grow));
}

export interface AutoGrowPick {
  category: GrowCategory;
  objectKey: string;
  /** Which copy it goes to — a second palm starts from a seed of its own. */
  instanceId: string;
  fromLevel: number;
  toLevel: number;
}

/**
 * What an unplaced reward grows.
 *
 * The player's own choice comes first — the object they watched in the timer
 * ring, then the category they picked. Only when neither can take it does the
 * reward move to another category, so nothing is lost just because the island
 * ran out of room for bushes. `null` means the whole island cannot take it right
 * now; then the reward keeps waiting instead of being thrown away.
 */
export function autoGrowPick(
  grow: Pick<WaitingGrow, "category" | "objectKey">,
  tier: GrowSizeTier,
  island: IslandObjectLevels,
  limitFor: (category: GrowCategory) => number,
): AutoGrowPick | null {
  const pickFrom = (category: GrowCategory): AutoGrowPick | null => {
    const options = growOptions(category, tier, island, limitFor(category));
    const wanted = grow.objectKey
      ? options.find((option) => option.object.key === grow.objectKey)
      : undefined;
    const option =
      wanted && !wanted.maxed && !wanted.locked ? wanted : defaultGrowOption(options);
    if (!option) return null;
    return {
      category,
      objectKey: option.object.key,
      instanceId: option.instanceId,
      fromLevel: option.fromLevel,
      toLevel: option.toLevel,
    };
  };

  if (grow.category) {
    const own = pickFrom(grow.category);
    if (own) return own;
  }
  for (const category of GROW_CATEGORIES) {
    if (category.key === grow.category) continue;
    const other = pickFrom(category.key);
    if (other) return other;
  }
  return null;
}

/** Is there anywhere at all for a reward to go right now? */
export function islandCanTakeAReward(
  tier: GrowSizeTier,
  island: IslandObjectLevels,
  limitFor: (category: GrowCategory) => number,
): boolean {
  return autoGrowPick({ category: null, objectKey: null }, tier, island, limitFor) !== null;
}
