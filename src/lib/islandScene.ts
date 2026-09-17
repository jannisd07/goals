/**
 * What the island looks like right now.
 *
 * Pure, so the domain suite covers it: it turns the stored object levels into
 * an island size and into the list of water pieces to draw. The places
 * themselves come from `islandSlots.ts`, which island/pixel/export_layout.py
 * generates from the fixed slot table — every player's boats, buoys, rocks,
 * dolphins and gulls sit in the same spots (island/SPRITES.md §9).
 */

import {
  GROW_CATEGORIES,
  GROW_OBJECTS,
  growCopies,
  growPieceCount,
  type GrowCategory,
  type IslandObjectLevels,
} from "./growRewards";
import { LAND_OBJECTS } from "./islandLand";
import { MILESTONE_OBJECT_KEYS } from "./milestones";
import { ISLAND_WATER_SLOTS, type StageWaterSlots } from "./islandSlots";
import { ISLAND_FLAGS } from "./islandFlags";
import { instancesOf } from "./islandInstances";
import { pathStones } from "./islandPaths";
import { resolveSpots, stageZones, type Spot } from "./islandPlacement";
import { cellCentre } from "./islandZones";

export type IslandStage = 1 | 2 | 3 | 4 | 5;

/** Levels the whole catalog holds; reaching it means the island is finished. */
export const TOTAL_GROWTH_LEVELS = GROW_CATEGORIES.reduce(
  (sum, category) =>
    sum +
    GROW_OBJECTS[category.key].reduce(
      // Every copy has to be grown from a seed, so the whole catalog is the sum
      // over all of them — six leafy trees are six times ten levels. A group
      // counts once: ten buoys are one object that grows, not ten.
      (inner, object) => inner + object.maxLevel * growCopies(object),
      0,
    ),
  0,
);

/**
 * Growth levels needed for each island size. The island grows four times over
 * the whole catalog: early enough that the first step is in reach, late enough
 * that the largest island stays a long-term goal.
 */
export const ISLAND_STAGE_LEVELS: readonly number[] = [0, 25, 70, 145, 240];

/** Every level the player has collected, across all four categories. */
export function totalGrowthLevels(island: IslandObjectLevels): number {
  let total = 0;
  for (const category of GROW_CATEGORIES) {
    for (const object of GROW_OBJECTS[category.key]) {
      // Every copy counts: three trees at stage 10 are thirty levels of work.
      for (const id of instancesOf(island, object.key)) {
        total += Math.max(0, Math.min(object.maxLevel, island[id]?.level ?? 0));
      }
    }
  }
  return total;
}

export interface IslandGrowth {
  stage: IslandStage;
  /** Levels collected across the whole catalog. */
  levels: number;
  /** Levels the next size needs, or null on the largest island. */
  nextAt: number | null;
  /** How many more are missing, or null on the largest island. */
  toNext: number | null;
  /** Progress inside the current size, 0 to 1. On the largest island it is 1. */
  ratio: number;
  /** Levels the whole catalog holds — every object, every copy, fully grown. */
  total: number;
  /** How many of those are still missing. Zero means the island is finished. */
  toFinish: number;
  /** Progress through the whole catalog, 0 to 1. */
  completion: number;
  /** Nothing left to grow anywhere. */
  complete: boolean;
}

/**
 * How far the island is: to the next size, and to a finished island.
 *
 * The island growing is the thing all the collecting works towards, so the
 * player has to be able to see it coming. Without this the app only ever spoke
 * about the limit — "Island too small" — and never about the distance to it,
 * which is the discouraging half of the mechanic without the encouraging one.
 *
 * The largest island arrives at 240 levels and the catalog holds far more, so
 * that is not the end of the road — but until the island stopped growing there
 * was nothing left to read on the way there. Past the last size the goal becomes
 * the collection itself: every object, every copy, at its full size.
 */
export function islandGrowth(island: IslandObjectLevels): IslandGrowth {
  const levels = totalGrowthLevels(island);
  const stage = islandStageFor(island);
  const nextAt = stage < ISLAND_STAGE_LEVELS.length ? ISLAND_STAGE_LEVELS[stage] : null;
  const from = ISLAND_STAGE_LEVELS[stage - 1] ?? 0;
  const toFinish = Math.max(0, TOTAL_GROWTH_LEVELS - levels);
  return {
    stage,
    levels,
    nextAt,
    toNext: nextAt === null ? null : Math.max(0, nextAt - levels),
    ratio:
      nextAt === null || nextAt <= from
        ? 1
        : Math.max(0, Math.min(1, (levels - from) / (nextAt - from))),
    total: TOTAL_GROWTH_LEVELS,
    toFinish,
    completion: Math.max(0, Math.min(1, levels / TOTAL_GROWTH_LEVELS)),
    complete: toFinish === 0,
  };
}

/**
 * Island sizes are named with roman numerals wherever they are shown — on Home,
 * in the growth overlay and in the friends list — so one name comes from here.
 */
export function islandRoman(stage: number): string {
  return ["I", "II", "III", "IV", "V"][Math.round(stage) - 1] ?? String(stage);
}

/** How wide the island is at each size, for telling the player what changed. */
export const ISLAND_STAGE_METRES: readonly number[] = [12, 16, 20, 24, 33];

/** The island size that matches what is on it. */
export function islandStageFor(island: IslandObjectLevels): IslandStage {
  const levels = totalGrowthLevels(island);
  let stage = 1;
  for (let index = 1; index < ISLAND_STAGE_LEVELS.length; index += 1) {
    if (levels >= ISLAND_STAGE_LEVELS[index]) stage = index + 1;
  }
  return stage as IslandStage;
}

/**
 * How many objects of a category fit on each island size, measured with the real
 * placement on `island/pixel/zones.json`: every object with its full block and a
 * gap around it, in eight shuffled orders, because players collect in no
 * particular order and that packs worse than putting the big ones down first.
 *
 * Water is not in here — its places are fixed and always there.
 *
 * Re-measure after changing object sizes or the island shape:
 *     python3 island/pixel/preview_islands.py limits
 */
export const ISLAND_CATEGORY_LIMITS: Readonly<Record<GrowCategory, readonly number[]>> = {
  //          Insel 1  2  3   4   5
  plant: [4, 6, 8, 8, 8],
  building: [3, 6, 9, 10, 10],
  // Am Strand eine Stufe vorsichtiger als die reine Kapazität: bei 5 bzw. 8
  // voll ausgewachsenen Objekten fand auf Insel 1 und 3 nicht mehr jedes einen
  // Platz auf dem Sand, und ein Objekt, das man besitzt, darf nie verschwinden.
  beach: [4, 5, 6, 8, 8],
  water: [7, 7, 7, 7, 7],
};

/** How many objects of this category the island can hold at this size. */
export function categoryLimit(stage: IslandStage, category: GrowCategory): number {
  const row = ISLAND_CATEGORY_LIMITS[category];
  return row[stage - 1] ?? row[row.length - 1];
}

export function waterSlotsFor(stage: IslandStage): StageWaterSlots {
  return ISLAND_WATER_SLOTS[stage - 1] ?? ISLAND_WATER_SLOTS[0];
}

export interface DrawnPiece {
  /** Key in PIECE_SPRITES. */
  sprite: string;
  /** Artwork pixels of the stage background; the sprite's anchor sits here. */
  x: number;
  y: number;
}

function waterObject(key: string) {
  return GROW_OBJECTS.water.find((candidate) => candidate.key === key) ?? null;
}

function levelOf(island: IslandObjectLevels, key: string): number {
  const object = waterObject(key);
  if (!object) return 0;
  return Math.max(0, Math.min(object.maxLevel, Math.round(island[key]?.level ?? 0)));
}

function pieceCount(island: IslandObjectLevels, key: string): number {
  const object = waterObject(key);
  return object ? growPieceCount(object, levelOf(island, key)) : 0;
}

/** Highest hull the boat sprites have; past it the fleet grows instead. */
const MAX_HULL = 10;

/**
 * Everything in the water, back to front. Gulls come last because they fly
 * above the rest and must never end up behind a boat.
 *
 * A small island shows a smaller fleet. `slots.limits` says how many pieces of
 * each kind this island's water holds — measured by the generator, not guessed:
 * twenty-seven dolphins around a twelve-metre island read as a traffic jam, not
 * as a school. Nothing is lost by it; the rest of the fleet comes out as the
 * island grows, which is one more thing growing is good for.
 */
export function waterPieces(stage: IslandStage, island: IslandObjectLevels): DrawnPiece[] {
  const slots = waterSlotsFor(stage);
  const swimming: DrawnPiece[] = [];

  const dock = levelOf(island, "dock");
  if (dock > 0) {
    swimming.push({
      sprite: `dock${slots.dock.mirror ? "_m" : ""}_${Math.min(MAX_HULL, dock)}`,
      x: slots.dock.x,
      y: slots.dock.y,
    });
  }

  const boat = levelOf(island, "boat");
  if (boat > 0 && slots.boats.length > 0) {
    // The first boat is the one that grows; every level past the last hull
    // brings one more boat, in the order the slot table lists them.
    swimming.push({
      sprite: `boat_${Math.min(MAX_HULL, boat)}`,
      x: slots.boats[0].x,
      y: slots.boats[0].y,
    });
    const fleet = Math.min(slots.limits.boats, 1 + Math.max(0, boat - MAX_HULL));
    for (const mate of slots.boats.slice(1, fleet)) {
      swimming.push({ sprite: `boat_${mate.hull}`, x: mate.x, y: mate.y });
    }
  }

  const groups = [
    ["buoys", slots.buoys],
    ["kayaks", slots.kayaks],
    ["rocks", slots.rocks],
    ["dolphins", slots.dolphins],
  ] as const;
  for (const [key, places] of groups) {
    swimming.push(...places.slice(0, Math.min(slots.limits[key], pieceCount(island, key))));
  }

  swimming.sort((a, b) => a.y - b.y);
  return [
    ...swimming,
    ...slots.gulls.slice(0, Math.min(slots.limits.gulls, pieceCount(island, "gulls"))),
  ];
}

/**
 * Everything that stands on the island, in catalog order so the island keeps the
 * same look as it fills up, each with the level that is on it now.
 */
export interface StandingObject {
  /** Which copy this is: `leafy_tree`, `leafy_tree#2` … Identity, not looks. */
  id: string;
  /** The catalog key — sprite, footprint, limits. Copies share it. */
  key: string;
  level: number;
  /** A look the player picked, when the object has one (the flagpole's flag). */
  variant?: string | null;
}

export function standingObjects(island: IslandObjectLevels): StandingObject[] {
  const entry = (id: string, key: string, cap: number): StandingObject => ({
    id,
    key,
    level: Math.min(cap, Math.max(1, Math.round(island[id]?.level ?? 0))),
    variant: island[id]?.variant ?? null,
  });
  // The landmarks from the hour roadmap stand next to the session objects; they
  // are not part of any grow category, so they are added here by hand. They are
  // one-offs and never have copies.
  const landmarks: StandingObject[] = MILESTONE_OBJECT_KEYS.filter(
    (key) => LAND_OBJECTS[key] && (island[key]?.level ?? 0) > 0,
  ).map((key) => entry(key as string, key as string, Number.POSITIVE_INFINITY));
  return landmarks.concat(
    GROW_CATEGORIES.flatMap((category) =>
      GROW_OBJECTS[category.key]
        .filter((object) => LAND_OBJECTS[object.key])
        .flatMap((object) =>
          // Every copy stands on its own: its own level, its own place.
          // Clamped to what the catalog has art for — a saved level above it
          // would point at a picture that does not exist, and the object would
          // silently vanish instead of standing at its top stage.
          instancesOf(island, object.key).map((id) => entry(id, object.key, object.maxLevel)),
        ),
    ),
  );
}

/**
 * The picture an object shows. A variant is a second picture of the same object —
 * the flagpole flying a particular flag — so it hangs off the sprite name and
 * nothing else has to know about it.
 *
 * A variant that no longer exists is dropped rather than trusted: the flag list
 * can change between app versions, and a name with no picture behind it would
 * make the object disappear from the island instead of flying the plain pennant.
 */
export function spriteNameFor(key: string, level: number, variant?: string | null): string {
  const known = variant && ISLAND_FLAGS.some((flag) => flag.code === variant);
  return known ? `${key}_${level}_${variant}` : `${key}_${level}`;
}

/**
 * Everything that stands on the island itself, at the spots the placement found.
 * `spots` is what the player's island already remembers; anything missing or no
 * longer valid gets a fresh place here.
 */
export function landPieces(
  stage: IslandStage,
  island: IslandObjectLevels,
  spots: Readonly<Record<string, Spot>>,
  seed: number,
): DrawnPiece[] {
  const zones = stageZones(stage);
  const order = standingObjects(island);
  const resolved = resolveSpots(stage, order, spots, seed);

  const pieces: DrawnPiece[] = [];
  for (const object of order) {
    const spot = resolved[object.id];
    if (!spot) continue;
    const centre = cellCentre(zones, spot.i, spot.j);
    pieces.push({
      sprite: spriteNameFor(object.key, object.level, object.variant),
      x: centre.x,
      y: centre.y,
    });
  }
  return pieces;
}

/**
 * The stone paths between the buildings, as pieces ready to draw. They lie flat
 * on the ground, so they sort into the scene like everything else.
 */
export function pathPieces(
  stage: IslandStage,
  island: IslandObjectLevels,
  spots: Readonly<Record<string, Spot>>,
  seed: number,
): DrawnPiece[] {
  const zones = stageZones(stage);
  const order = standingObjects(island);
  const resolved = resolveSpots(stage, order, spots, seed);
  const standing = order
    .filter((object) => resolved[object.id])
    .map((object) => ({ ...object, spot: resolved[object.id] }));
  return pathStones(zones, standing).map((stone) => {
    const centre = cellCentre(zones, stone.i, stone.j);
    return { sprite: `path_${stone.variant}`, x: centre.x, y: centre.y };
  });
}

/** The whole island, back to front: land and water together, gulls last. */
export function islandPieces(
  stage: IslandStage,
  island: IslandObjectLevels,
  spots: Readonly<Record<string, Spot>>,
  seed: number,
): DrawnPiece[] {
  const water = waterPieces(stage, island);
  const gullsFrom = water.findIndex((piece) => piece.sprite.startsWith("gull"));
  const swimming = gullsFrom === -1 ? water : water.slice(0, gullsFrom);
  const flying = gullsFrom === -1 ? [] : water.slice(gullsFrom);
  const ground = [
    ...swimming,
    ...pathPieces(stage, island, spots, seed),
    ...landPieces(stage, island, spots, seed),
  ];
  // Flat stones first where two things share a row: a path never covers an object.
  ground.sort((a, b) => a.y - b.y || Number(b.sprite.startsWith("path_")) - Number(a.sprite.startsWith("path_")));
  return [...ground, ...flying];
}
