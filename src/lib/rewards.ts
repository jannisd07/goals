/**
 * Hour-based reward roadmap.
 *
 * Total tracked time counts every finished session, Focus Timer and Auto
 * Check-In together. Each milestone hands out one of the island's special
 * objects or grows one that was already earned. Pure and deterministic, so the
 * domain suite and a later server check share the same rules.
 */

export type RewardObjectKey =
  | "flagpole"
  | "treasure_chest"
  | "fountain"
  | "clock_tower"
  | "lighthouse"
  | "monument";

export interface RewardMilestone {
  id: string;
  hours: number;
  object: RewardObjectKey;
  /** 1 = the object arrives on the island, 2 = the object grows. */
  tier: 1 | 2;
  title: string;
  description: string;
}

export const REWARD_MILESTONES: readonly RewardMilestone[] = [
  { id: "flagpole", hours: 5, object: "flagpole", tier: 1, title: "Flagpole", description: "Your island gets its first flag." },
  { id: "treasure_chest", hours: 10, object: "treasure_chest", tier: 1, title: "Treasure Chest", description: "A chest washes up on your beach." },
  { id: "fountain", hours: 25, object: "fountain", tier: 1, title: "Fountain", description: "A small fountain for your village." },
  { id: "clock_tower", hours: 50, object: "clock_tower", tier: 1, title: "Clock Tower", description: "Time well spent, now on display." },
  { id: "lighthouse", hours: 100, object: "lighthouse", tier: 1, title: "Lighthouse", description: "100 hours. A lighthouse on your coast." },
  { id: "fountain_2", hours: 200, object: "fountain", tier: 2, title: "Grand Fountain", description: "Your fountain grows into a grand one." },
  { id: "clock_tower_2", hours: 300, object: "clock_tower", tier: 2, title: "Bell Tower", description: "The clock tower gets its golden bell." },
  { id: "lighthouse_2", hours: 500, object: "lighthouse", tier: 2, title: "Beacon", description: "Your lighthouse lights up the sea." },
  { id: "treasure_chest_2", hours: 750, object: "treasure_chest", tier: 2, title: "Golden Chest", description: "The chest turns to gold." },
  { id: "monument", hours: 1000, object: "monument", tier: 1, title: "Monument", description: "1,000 hours. A monument to your work." },
];

export interface RewardProgress {
  totalHours: number;
  unlocked: RewardMilestone[];
  next: RewardMilestone | null;
  /** Share of the way from the previous milestone to the next one, 0 to 1. */
  progressToNext: number;
  hoursToNext: number;
}

export function rewardProgress(
  totalHours: number,
  milestones: readonly RewardMilestone[] = REWARD_MILESTONES,
): RewardProgress {
  const hours = Number.isFinite(totalHours) ? Math.max(0, totalHours) : 0;
  const unlocked = milestones.filter((m) => hours >= m.hours);
  const next = milestones.find((m) => hours < m.hours) ?? null;
  if (!next) {
    return { totalHours: hours, unlocked, next: null, progressToNext: 1, hoursToNext: 0 };
  }
  const previous = unlocked.length > 0 ? unlocked[unlocked.length - 1].hours : 0;
  const span = next.hours - previous;
  return {
    totalHours: hours,
    unlocked,
    next,
    progressToNext: span > 0 ? Math.min(1, Math.max(0, (hours - previous) / span)) : 0,
    hoursToNext: Math.max(0, next.hours - hours),
  };
}

/** Finished sessions only; an open session counts once it ends. */
export function totalTrackedHours(
  sessions: ReadonlyArray<{ duration_seconds: number | null; end_time: string | null }>,
): number {
  let seconds = 0;
  for (const session of sessions) {
    if (!session.end_time) continue;
    const duration = Number(session.duration_seconds);
    if (Number.isFinite(duration) && duration > 0) seconds += duration;
  }
  return seconds / 3600;
}

function groupThousands(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Tracked total: one decimal while small, whole hours once it is double digits. */
export function formatRewardHours(hours: number): string {
  const safe = Number.isFinite(hours) ? Math.max(0, hours) : 0;
  if (safe < 10) return `${(Math.floor(safe * 10) / 10).toFixed(1)} h`;
  return `${groupThousands(Math.floor(safe))} h`;
}

/** Milestone thresholds are whole numbers: "5 h", "1,000 h". */
export function formatMilestoneHours(hours: number): string {
  return `${groupThousands(Math.round(hours))} h`;
}
