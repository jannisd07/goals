/**
 * The landmarks that long hours leave on the island.
 *
 * Unlike a session reward, a milestone is not an event that can be missed: it
 * is a fact about the total hours tracked. So there is nothing to queue and
 * nothing to lose — at any moment the island simply *should* carry every
 * landmark the hours have earned, and this module works out the difference.
 *
 * That makes delivery reliable by construction: whatever happened while the app
 * was closed, the next look at the hours puts the island right.
 *
 * Pure, so the domain suite can walk through it.
 */

import { REWARD_MILESTONES, type RewardMilestone, type RewardObjectKey } from "./rewards";

/** What a landmark looks like once it is standing. */
export interface StandingMilestone {
  objectKey: RewardObjectKey;
  /** 1 when it arrived, 2 after it grew. */
  tier: 1 | 2;
}

/** The highest tier of each landmark the hours have earned. */
export function earnedMilestones(lifetimeHours: number): StandingMilestone[] {
  const best = new Map<RewardObjectKey, 1 | 2>();
  for (const milestone of REWARD_MILESTONES) {
    if (lifetimeHours < milestone.hours) continue;
    const known = best.get(milestone.object) ?? 0;
    if (milestone.tier > known) best.set(milestone.object, milestone.tier);
  }
  return [...best].map(([objectKey, tier]) => ({ objectKey, tier }));
}

/** What the island still owes the player, given what already stands on it. */
export function missingMilestones(
  lifetimeHours: number,
  island: Readonly<Record<string, { level: number }>>,
): StandingMilestone[] {
  return earnedMilestones(lifetimeHours).filter(
    (earned) => (island[earned.objectKey]?.level ?? 0) < earned.tier,
  );
}

/** The entry in the roadmap a landmark at this tier came from. */
export function milestoneFor(
  objectKey: RewardObjectKey,
  tier: 1 | 2,
): RewardMilestone | null {
  return (
    REWARD_MILESTONES.find(
      (milestone) => milestone.object === objectKey && milestone.tier === tier,
    ) ?? null
  );
}

/** The next landmark to work towards, and how far away it is. */
export function nextMilestone(
  lifetimeHours: number,
): { milestone: RewardMilestone; hoursToGo: number } | null {
  const next = REWARD_MILESTONES.find((milestone) => lifetimeHours < milestone.hours);
  if (!next) return null;
  return {
    milestone: next,
    hoursToGo: Math.max(0, Math.round((next.hours - lifetimeHours) * 10) / 10),
  };
}

/** Every key a landmark can take on the island, for the drawing side. */
export const MILESTONE_OBJECT_KEYS: readonly RewardObjectKey[] = [
  ...new Set(REWARD_MILESTONES.map((milestone) => milestone.object)),
];
