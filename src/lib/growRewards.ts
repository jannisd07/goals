/**
 * What a session grows on the island, and how big.
 *
 * Pure, so the domain test suite covers it directly. The objects follow catalog
 * v1 in island/WACHSTUM.md §14.2 without the special objects, which only come
 * from the rewards roadmap (`src/lib/rewards.ts`). Every object has a picture
 * for every level; `maxLevel` is the number of pictures it has.
 *
 * Every finished session earns exactly one reward, there are no points
 * (Jannis, 2026-09-10). Its size is personal: the session is compared with the
 * usual length of the same goal's earlier sessions, so two hours of pilates
 * after a usual hour is huge and two hours of studying after a usual three
 * hours is small. Each object exists once on the island (§14.3): the reward
 * adds an object that is not there yet, starting at a level set by the size, or
 * grows an existing one by that many steps.
 */

import type { GrowCategory } from "../types";
import { countOf, instancesOf, nextInstanceId } from "./islandInstances";

export type { GrowCategory };

export interface GrowCategoryInfo {
  key: GrowCategory;
  label: string;
  /** Used in sentences: "Your plant grew". */
  noun: string;
}

export const GROW_CATEGORIES: readonly GrowCategoryInfo[] = [
  { key: "plant", label: "Plants", noun: "plant" },
  { key: "building", label: "Buildings", noun: "building" },
  { key: "water", label: "Water", noun: "water object" },
  { key: "beach", label: "Beach", noun: "beach object" },
];

/** Sessions shorter than this are taps or abandoned starts: nothing grows. */
export const MIN_GROW_SESSION_SECONDS = 5 * 60;

/** A counter beyond this ran away; nobody focuses for half a day in one go. */
export const MAX_GROW_SESSION_SECONDS = 12 * 60 * 60;

/**
 * Does this much focus earn an object? The one place the rule lives, so every
 * path that ends a session — the End button, a dropped session, a stale one
 * found at startup — agrees on it.
 */
export function sessionEarnsReward(focusedSeconds: number): boolean {
  return (
    Number.isFinite(focusedSeconds) &&
    focusedSeconds >= MIN_GROW_SESSION_SECONDS &&
    focusedSeconds <= MAX_GROW_SESSION_SECONDS
  );
}

/** How an object grows (WACHSTUM.md §14.4). */
export type GrowthKind = "stages" | "resize" | "multiply";

export interface GrowObject {
  key: string;
  name: string;
  growth: GrowthKind;
  /** Highest stage or size, or the largest group for `multiply`. */
  maxLevel: number;
  /**
   * For a `multiply` object whose level is not simply the number of pieces:
   * how many stand on the island at each level. Dolphins swim in schools of
   * three, five, seven and nine, and start a new school when one is full
   * (island/SPRITES.md §9), so twelve levels put up to 27 of them in the water.
   */
  pieces?: readonly number[];
  /**
   * How many of this object an island may ever hold (island/WACHSTUM.md §15.10).
   * Buildings are one-offs, plants have a number per kind that keeps the island
   * looking like an island instead of a nursery, and a group counts its pieces.
   * The full collection needs roughly 306 m² — about a third of a doubled stage
   * III island, so collecting everything means growing the island first.
   *
   * These are the agreed numbers. Several separate trees of one kind still need
   * the growth model to carry more than one instance per key; §14.3 gives each
   * object exactly one place that grows. Until that changes, this is the ceiling
   * the piece count and the capacity maths work with.
   */
  maxCount: number;
}

/**
 * How many separate copies of this object an island may hold.
 *
 * `maxCount` means two different things, and telling them apart matters. For a
 * `stages` or `resize` object it is the number of copies: six leafy trees stand
 * in six places, each growing from its own seed. For a `multiply` object it is
 * the number of **pieces one object shows** — ten buoys come from the one
 * "Buoys" entry, and `shells_10` already draws eight shells in a single
 * picture. Treating that as ten copies would put eighty shells on the beach and
 * hand out levels for buoys the water never draws.
 */
export function growCopies(object: GrowObject): number {
  return object.growth === "multiply" ? 1 : Math.max(1, object.maxCount);
}

/** How many pieces of a group stand on the island at this level, never more than allowed. */
export function growPieceCount(object: GrowObject, level: number): number {
  const clamped = Math.max(0, Math.min(object.maxLevel, Math.round(level)));
  if (clamped === 0) return 0;
  const pieces = object.pieces ? object.pieces[clamped - 1] : clamped;
  return Math.min(pieces, object.maxCount);
}

/**
 * Catalog v1 per category; the first object stands for its category.
 *
 * `maxLevel` of the buildings is the number of sprite stages they have
 * (island/SPRITES.md §5b): stage 1 is the building site, the last one the
 * finished building. Big, detailed buildings have more steps than plain ones.
 */
export const GROW_OBJECTS: Readonly<Record<GrowCategory, readonly GrowObject[]>> = {
  plant: [
    { key: "leafy_tree", name: "Leafy tree", growth: "stages", maxLevel: 10, maxCount: 6 },
    { key: "bush", name: "Bush", growth: "stages", maxLevel: 10, maxCount: 8 },
    { key: "flower_bed", name: "Flower bed", growth: "resize", maxLevel: 10, maxCount: 3 },
    { key: "grass_tufts", name: "Grass tufts", growth: "multiply", maxLevel: 10, maxCount: 12 },
    { key: "fir_tree", name: "Fir tree", growth: "stages", maxLevel: 10, maxCount: 5 },
    { key: "fruit_tree", name: "Fruit tree", growth: "stages", maxLevel: 10, maxCount: 4 },
    { key: "palm_tree", name: "Palm tree", growth: "stages", maxLevel: 10, maxCount: 5 },
    { key: "world_tree", name: "World tree", growth: "stages", maxLevel: 10, maxCount: 1 },
  ],
  building: [
    { key: "house", name: "House", growth: "resize", maxLevel: 10, maxCount: 1 },
    { key: "windmill", name: "Windmill", growth: "resize", maxLevel: 11, maxCount: 1 },
    { key: "cafe", name: "Café", growth: "resize", maxLevel: 10, maxCount: 1 },
    { key: "library", name: "Library", growth: "resize", maxLevel: 12, maxCount: 1 },
    { key: "workshop", name: "Workshop", growth: "resize", maxLevel: 10, maxCount: 1 },
    { key: "greenhouse", name: "Greenhouse", growth: "resize", maxLevel: 9, maxCount: 1 },
    { key: "training_ground", name: "Training ground", growth: "resize", maxLevel: 8, maxCount: 1 },
    { key: "yoga_pavilion", name: "Yoga pavilion", growth: "resize", maxLevel: 9, maxCount: 1 },
    { key: "observatory", name: "Observatory", growth: "resize", maxLevel: 12, maxCount: 1 },
    { key: "boathouse", name: "Boathouse", growth: "resize", maxLevel: 11, maxCount: 1 },
  ],
  water: [
    // Ten stages turn the rowing boat into a yacht, then four more boats join it.
    { key: "boat", name: "Boat", growth: "stages", maxLevel: 14, maxCount: 1 },
    { key: "dock", name: "Dock", growth: "resize", maxLevel: 10, maxCount: 1 },
    { key: "buoys", name: "Buoys", growth: "multiply", maxLevel: 10, maxCount: 10 },
    { key: "kayaks", name: "Kayaks", growth: "multiply", maxLevel: 8, maxCount: 8 },
    { key: "rocks", name: "Rocks", growth: "multiply", maxLevel: 9, maxCount: 9 },
    {
      key: "dolphins",
      name: "Dolphins",
      growth: "multiply",
      maxLevel: 12,
      maxCount: 27,
      pieces: [3, 5, 7, 9, 12, 14, 16, 18, 21, 23, 25, 27],
    },
    // Gulls fly on their own air layer in the catalog; sessions offer them with water.
    { key: "gulls", name: "Gulls", growth: "multiply", maxLevel: 12, maxCount: 12 },
  ],
  beach: [
    { key: "sandcastle", name: "Sandcastle", growth: "stages", maxLevel: 10, maxCount: 1 },
    { key: "campfire", name: "Campfire", growth: "stages", maxLevel: 9, maxCount: 1 },
    { key: "deck_chairs", name: "Deck chairs", growth: "multiply", maxLevel: 9, maxCount: 9 },
    { key: "shells", name: "Shells and starfish", growth: "multiply", maxLevel: 10, maxCount: 10 },
    { key: "surfboards", name: "Surfboards", growth: "multiply", maxLevel: 8, maxCount: 8 },
    { key: "hammock", name: "Hammock", growth: "stages", maxLevel: 9, maxCount: 1 },
    { key: "volleyball_net", name: "Volleyball net", growth: "stages", maxLevel: 9, maxCount: 1 },
    { key: "beach_bar", name: "Beach bar", growth: "resize", maxLevel: 12, maxCount: 1 },
  ],
};

export function isGrowCategory(value: unknown): value is GrowCategory {
  return GROW_CATEGORIES.some((category) => category.key === value);
}

export function growCategoryInfo(key: GrowCategory): GrowCategoryInfo {
  return GROW_CATEGORIES.find((category) => category.key === key) ?? GROW_CATEGORIES[0];
}

/** A stored or received category, or null when a session cannot grow it (such as the old "special"). */
export function asGrowCategory(value: unknown): GrowCategory | null {
  return isGrowCategory(value) ? value : null;
}

// ---------------------------------------------------------------------------
// Size
// ---------------------------------------------------------------------------

export type GrowSizeTier = 1 | 2 | 3 | 4 | 5;

export const GROW_SIZE_LABELS: Readonly<Record<GrowSizeTier, string>> = {
  1: "Tiny",
  2: "Small",
  3: "Medium",
  4: "Large",
  5: "Huge",
};

/** Upper bounds (exclusive) of tiers 1–4 as multiples of the usual length. */
export const GROW_TIER_UPPER_RATIOS = [0.4, 0.75, 1.35, 2] as const;
/**
 * Earlier sessions until the comparison is fully trusted. Before that the size
 * leans towards Medium, so a new goal does not swing between Tiny and Huge.
 */
export const FULL_TRUST_SESSIONS = 8;
/** Only recent habits define "usual". */
export const MAX_GROW_HISTORY = 50;

export interface GrowSize {
  tier: GrowSizeTier;
  label: string;
  /** 0–1 on a log scale: 0.5 = the usual length, 0.75 = twice it, 1 = four times. */
  score: number;
  /** Multiple of the usual length after leaning towards Medium. */
  ratio: number;
  /** Median of the earlier real sessions; null without history. */
  usualSeconds: number | null;
  /** How many earlier sessions the comparison uses. */
  basedOn: number;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function tierForRatio(ratio: number): GrowSizeTier {
  const index = GROW_TIER_UPPER_RATIOS.findIndex((upper) => ratio < upper);
  return (index === -1 ? 5 : index + 1) as GrowSizeTier;
}

/**
 * Size of the reward for a session of `durationSeconds`, measured against the
 * goal's earlier session lengths (newest first). The median is used as "usual"
 * because a single forgotten timer can run for hours.
 */
export function computeGrowSize(
  durationSeconds: number,
  historySeconds: readonly number[],
): GrowSize {
  const real = historySeconds
    .filter((seconds) => Number.isFinite(seconds) && seconds >= MIN_GROW_SESSION_SECONDS)
    .slice(0, MAX_GROW_HISTORY);
  const usualSeconds = real.length > 0 ? median(real) : null;
  const trust = Math.min(1, real.length / FULL_TRUST_SESSIONS);

  let ratio = 1;
  if (usualSeconds !== null) {
    const raw = Math.max(0, durationSeconds) / usualSeconds;
    ratio = raw > 0 ? Math.exp(Math.log(raw) * trust) : 0;
  }
  const tier = tierForRatio(ratio);
  const score = ratio > 0 ? Math.min(1, Math.max(0, (Math.log2(ratio) + 2) / 4)) : 0;

  return {
    tier,
    label: GROW_SIZE_LABELS[tier],
    score: Math.round(score * 1000) / 1000,
    ratio: Math.round(ratio * 100) / 100,
    usualSeconds,
    basedOn: real.length,
  };
}

/** Drawing scale for a placeholder: a visible sprout at 0, full height at 1. */
export function growVisualScale(score: number): number {
  return 0.3 + 0.7 * Math.min(1, Math.max(0, score));
}

/**
 * The object while the session is still running. With history it shows the
 * size earned so far; without history it grows towards Medium over the planned
 * length, because the finished reward will be Medium either way.
 */
export function liveGrowth(
  elapsedSeconds: number,
  historySeconds: readonly number[],
  referenceSeconds: number,
): { size: GrowSize; visualScale: number } {
  const size = computeGrowSize(elapsedSeconds, historySeconds);
  const progress = size.basedOn > 0
    ? size.score
    : 0.5 * Math.min(1, Math.max(0, elapsedSeconds) / Math.max(60, referenceSeconds));
  return { size, visualScale: growVisualScale(progress) };
}

function formatLength(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/** One line under the size badge on the reveal screen. */
export function describeGrowSize(size: GrowSize, durationSeconds: number): string {
  const length = formatLength(durationSeconds);
  if (size.usualSeconds === null) return `${length} · your first sessions grow medium`;
  const raw = durationSeconds / size.usualSeconds;
  if (raw >= 1.15) return `${length} · ${Math.round(raw * 10) / 10}× your usual`;
  if (raw <= 0.87) return `${length} · your usual is ${formatLength(size.usualSeconds)}`;
  return `${length} · about your usual`;
}

// ---------------------------------------------------------------------------
// Adding or growing
// ---------------------------------------------------------------------------

/** Steps one session adds: a new object starts at this level, an existing one grows by it. */
export const GROW_STEPS_BY_TIER: Readonly<Record<GrowSizeTier, number>> = {
  1: 1,
  2: 1,
  3: 2,
  4: 3,
  5: 4,
};

/** What is on the island, by object key; `level` is the stage, size or group count. */
/**
 * What the island holds, as far as the pure logic cares: a level per object, and
 * optionally a look the player picked (the flagpole's flag). Anything else about
 * an object lives in the store.
 */
export type IslandObjectLevels = Readonly<
  Record<string, { level: number; variant?: string | null }>
>;

export interface GrowOption {
  object: GrowObject;
  /**
   * Which copy the reward would go to — `leafy_tree`, `leafy_tree#2` and so on
   * (src/lib/islandInstances.ts). Everything a player owns is an instance; the
   * catalog entry above is only what it looks like.
   */
  instanceId: string;
  /** "add" when this copy is not on the island yet — the first or a further one. */
  action: "add" | "grow";
  /** True when the copy would be an additional one next to others already there. */
  another: boolean;
  fromLevel: number;
  toLevel: number;
  /** Fully grown: this object cannot take the reward. */
  maxed: boolean;
  /**
   * The island is too small for another object of this category. It can still
   * grow what already stands there; the next island size makes room again
   * (`ISLAND_CATEGORY_LIMITS` in src/lib/islandScene.ts).
   */
  locked: boolean;
}

/**
 * How many objects of this category stand on the island — copies counted singly,
 * because each of them takes its own place and its own room.
 */
export function categoryCount(category: GrowCategory, island: IslandObjectLevels): number {
  return GROW_OBJECTS[category].reduce(
    (total, object) => total + countOf(island, object.key),
    0,
  );
}

/**
 * Every object of a category with what this session's reward would do to it.
 * `limit` is how many objects of the category fit on the island right now;
 * beyond it only the ones already standing can still grow.
 */
export function growOptions(
  category: GrowCategory,
  tier: GrowSizeTier,
  island: IslandObjectLevels,
  limit: number = Number.POSITIVE_INFINITY,
): GrowOption[] {
  const steps = GROW_STEPS_BY_TIER[tier];
  const noRoomLeft = categoryCount(category, island) >= limit;
  return GROW_OBJECTS[category].map((object) => {
    // The copy that can still take the reward: the first one that is not fully
    // grown. Only when every copy is finished does another one start.
    const standing = instancesOf(island, object.key);
    const growing = standing.find(
      (id) => (island[id]?.level ?? 0) < object.maxLevel,
    );
    const another =
      growing === undefined ? nextInstanceId(island, object.key, growCopies(object)) : null;
    const target = growing ?? another ?? standing[standing.length - 1] ?? object.key;
    const fromLevel = Math.max(0, Math.min(object.maxLevel, island[target]?.level ?? 0));
    return {
      object,
      instanceId: target,
      action: fromLevel > 0 ? "grow" : "add",
      another: fromLevel === 0 && standing.length > 0,
      fromLevel,
      toLevel: Math.min(object.maxLevel, fromLevel + steps),
      // Nothing left: every copy allowed is standing and finished.
      maxed: growing === undefined && another === null,
      locked: fromLevel === 0 && noRoomLeft,
    };
  });
}

/** The option shown first: the first object of the category that can still take the reward. */
export function defaultGrowOption(options: readonly GrowOption[]): GrowOption | null {
  return options.find((option) => !option.maxed && !option.locked) ?? null;
}

export interface CategoryRoom {
  /** Objects the reward could add right now. */
  add: number;
  /** Objects already standing there that could still grow. */
  grow: number;
  /**
   * Objects that only the island's size is holding back. Kept apart from `add`
   * so the screens can say "island too small" instead of "fully grown" — those
   * are very different messages for the player.
   */
  locked: number;
}

/** What a category still offers: what can be added, grown, and what has to wait. */
export function categoryRoom(
  category: GrowCategory,
  island: IslandObjectLevels,
  limit: number = Number.POSITIVE_INFINITY,
): CategoryRoom {
  let missing = 0;
  let grow = 0;
  const free = Math.max(0, limit - categoryCount(category, island));
  for (const object of GROW_OBJECTS[category]) {
    const standing = instancesOf(island, object.key);
    const growable = standing.some((id) => (island[id]?.level ?? 0) < object.maxLevel);
    if (growable) grow += 1;
    // A further copy counts as something that could be added, exactly like a
    // first one — for the player they are the same offer.
    else if (nextInstanceId(island, object.key, growCopies(object)) !== null) missing += 1;
  }
  const add = Math.min(missing, free);
  return { add, grow, locked: missing - add };
}

/** Where an object stands: "Stage 2 of 10", "Size 4 of 12" or "9 of 27" for a group. */
export function describeGrowLevel(object: GrowObject, level: number): string {
  if (object.growth === "multiply") {
    return `${growPieceCount(object, level)} of ${growPieceCount(object, object.maxLevel)}`;
  }
  return `${object.growth === "stages" ? "Stage" : "Size"} ${level} of ${object.maxLevel}`;
}

/**
 * Short line for an option: "New, stage 2", "Size 1 → 3", "×2 → ×4", "Fully grown".
 *
 * A locked object can say how far the island still has to grow — `toNext` comes
 * from `islandGrowth`. A bare "Island too small" is a wall with no distance
 * marked on it, which is the discouraging half of the mechanic on its own.
 */
export function describeGrowOption(option: GrowOption, toNextIslandSize?: number | null): string {
  if (option.maxed) return "Fully grown";
  // A further copy is a different offer from the first one, and saying so is the
  // only way the player learns that more than one is possible at all.
  if (option.another && !option.locked) {
    if (option.object.growth === "multiply") {
      return `Another one, ×${growPieceCount(option.object, option.toLevel)}`;
    }
    return `Another one, ${option.object.growth === "stages" ? "stage" : "size"} ${option.toLevel}`;
  }
  if (option.locked) {
    return typeof toNextIslandSize === "number" && toNextIslandSize > 0
      ? `Island too small · ${toNextIslandSize} to grow`
      : "Island too small";
  }
  if (option.object.growth === "multiply") {
    const from = growPieceCount(option.object, option.fromLevel);
    const to = growPieceCount(option.object, option.toLevel);
    return option.action === "add" ? `New, ×${to}` : `×${from} → ×${to}`;
  }
  const stages = option.object.growth === "stages";
  return option.action === "add"
    ? `New, ${stages ? "stage" : "size"} ${option.toLevel}`
    : `${stages ? "Stage" : "Size"} ${option.fromLevel} → ${option.toLevel}`;
}
