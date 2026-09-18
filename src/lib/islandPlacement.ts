/**
 * Where a new object goes on the island.
 *
 * The rule Jannis asked for: put it where there is the most room, but not always
 * in exactly the same place. So every free cell is scored by how far the nearest
 * blocked cell is, and the spot is drawn at random from the roomiest ones. The
 * first objects therefore land in the open middle, later ones spread outwards,
 * and two players with the same island still get different gardens.
 *
 * Pure and deterministic: the same seed and the same island always give the same
 * spot, which is what lets the previews show exactly what the app will draw.
 */

import { LAND_FOOT, LAND_OBJECTS, type LandFoot } from "./islandLand";
import { ISLAND_ZONES, zoneAt, type StageZones } from "./islandZones";

export interface Spot {
  i: number;
  j: number;
}

export interface PlacedObject {
  /**
   * Which copy this is (`leafy_tree#2`). Identity: its place, what it blocks.
   * Geometry comes from `key` instead, because copies look the same.
   */
  id: string;
  key: string;
  /** What stands there now; a sapling keeps far less ground than a full tree. */
  level: number;
  spot: Spot;
}

/**
 * The block and foot of the picture that is on the island right now. Placement
 * works with the level that stands there, not with the biggest one an object can
 * ever reach — otherwise a fresh island would have no room for its own first
 * objects. An object that outgrows its place is given a new one in `resolveSpots`.
 */
export function footOf(key: string, level: number): LandFoot | null {
  const rounded = Math.max(1, Math.round(level));
  return LAND_FOOT[`${key}_${rounded}`] ?? LAND_OBJECTS[key] ?? null;
}

/**
 * The room an object will need once it is fully grown.
 *
 * Space is claimed by this, never by the size the object happens to have today:
 * a beach bar placed as a small stand and then grown to full size would
 * otherwise no longer fit its own spot, find nowhere else on the thin strip of
 * sand, and silently disappear from an island it had been standing on. Reserving
 * the final size from the first day means **nothing can ever outgrow its place.**
 *
 * `footOf` stays the size it covers right now — that is still the right answer
 * for which cells have to be sand under a small umbrella.
 */
export function maxFootOf(key: string): LandFoot | null {
  return LAND_OBJECTS[key] ?? null;
}

const ZONE_CHARS: Record<string, string> = { grass: "G", beach: "B" };

/** Free cells around an object, so things do not stand shoulder to shoulder. */
const PREFERRED_GAP = 1;

/**
 * How strongly open ground is preferred. Every spot that fits is in the draw,
 * weighted by its room to this power: 1 would scatter objects anywhere they fit,
 * a hard "only the roomiest" rule would line them up in the middle and then push
 * the rest into whatever corner is left. Three keeps them in the open and still
 * gives every island its own layout.
 */
const ROOM_BIAS = 3;

export function stageZones(stage: number): StageZones {
  return ISLAND_ZONES[stage - 1] ?? ISLAND_ZONES[0];
}

/** One island per player: the same account always gets the same layout. */
export function seedForUser(userId: string | null | undefined): number {
  return hash(0, userId ?? "guest");
}

/** Small deterministic hash, so a spot depends only on the seed and the object. */
function hash(seed: number, key: string): number {
  let value = (seed >>> 0) ^ 2166136261;
  for (let index = 0; index < key.length; index += 1) {
    value ^= key.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

/** The cells an object keeps to itself, centred on its spot. */
export function objectCells(key: string, level: number, spot: Spot): Spot[] {
  const foot = footOf(key, level);
  return foot ? blockCells(spot, foot.cells) : [];
}

/** The cells an object holds for good — its fully grown block. */
export function reservedCells(key: string, spot: Spot): Spot[] {
  const foot = maxFootOf(key);
  return foot ? blockCells(spot, foot.cells) : [];
}

/**
 * The cells an object actually stands on — its foot, not its outline. Only these
 * have to be the right ground, and all of them do: a crown may hang over the
 * beach, but a sun umbrella may not have half its stand in the water
 * (island/SPRITES.md §5c).
 *
 * The foot is a strip, not a square. Stepping (+1, -1) moves the picture eight
 * pixels sideways at the same height, stepping (+1, +1) moves it four pixels
 * towards the back — so `ground` counts cells along the shore and `depth` counts
 * how far back the foot reaches from its front tip.
 */
export function groundCells(key: string, level: number, spot: Spot): Spot[] {
  return footCells(footOf(key, level), spot);
}

function footCells(foot: LandFoot | null, spot: Spot): Spot[] {
  if (!foot) return [];
  const cells: Spot[] = [];
  const from = -Math.floor((foot.ground - 1) / 2);
  for (let along = 0; along < foot.ground; along += 1) {
    const u = from + along;
    for (let back = 0; back < foot.depth; back += 1) {
      cells.push({ i: spot.i + u + back, j: spot.j - u + back });
    }
  }
  return cells;
}

/**
 * Which cells the foot could stand on at all — the exact strip, not a distance
 * map, because the foot reaches backwards only and a symmetric radius would
 * throw away the row right at the water where a beach object belongs.
 * Computed once per object and reused by every retry below.
 */
function standableMap(
  zones: StageZones,
  key: string,
  level: number,
  wanted: string,
  width: number,
) {
  const height = zones.rows.length;
  const map = new Uint8Array(width * height);
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const spot = { i: zones.iMin + row, j: zones.jMin + column };
      const cells = groundCells(key, level, spot);
      let fits = cells.length > 0;
      for (const cell of cells) {
        if (zoneAt(zones, cell.i, cell.j) !== wanted) {
          fits = false;
          break;
        }
      }
      map[row * width + column] = fits ? 1 : 0;
    }
  }
  return map;
}

function blockCells(spot: Spot, size: number): Spot[] {
  const from = -Math.floor((size - 1) / 2);
  const cells: Spot[] = [];
  for (let di = 0; di < size; di += 1) {
    for (let dj = 0; dj < size; dj += 1) {
      cells.push({ i: spot.i + from + di, j: spot.j + from + dj });
    }
  }
  return cells;
}

/** Steps to the nearest blocked cell, counted in king moves. */
function spread(width: number, height: number, blocked: Uint8Array): Int16Array {
  const room = new Int16Array(width * height).fill(FAR);
  const queue: number[] = [];
  for (let index = 0; index < blocked.length; index += 1) {
    if (blocked[index]) {
      room[index] = 0;
      queue.push(index);
    }
  }
  for (let head = 0; head < queue.length; head += 1) {
    const index = queue[head];
    const row = Math.floor(index / width);
    const column = index % width;
    for (let di = -1; di <= 1; di += 1) {
      for (let dj = -1; dj <= 1; dj += 1) {
        if (di === 0 && dj === 0) continue;
        const nextRow = row + di;
        const nextColumn = column + dj;
        if (nextRow < 0 || nextRow >= height || nextColumn < 0 || nextColumn >= width) continue;
        const next = nextRow * width + nextColumn;
        if (room[next] !== FAR) continue;
        room[next] = room[index] + 1;
        queue.push(next);
      }
    }
  }
  return room;
}

/** Room enough that nothing else is near, on an island where nothing stands yet. */
const FAR = 999;

/**
 * Two different questions, so two maps.
 *
 * `free` is how far the nearest object is — that decides whether a thing fits at
 * all, and a wide beach chair may well reach over the water line with its edge.
 * `open` also counts the wrong ground as taken, and that is what makes a spot
 * attractive: in the middle of the meadow it is high, in a corner it is low.
 */
function roomMaps(zones: StageZones, wanted: string, taken: readonly PlacedObject[]) {
  const height = zones.rows.length;
  const width = Math.max(...zones.rows.map((row) => row.length));
  const at = (i: number, j: number) => (i - zones.iMin) * width + (j - zones.jMin);

  const used = new Uint8Array(width * height);
  const offGround = new Uint8Array(width * height);
  for (const object of taken) {
    for (const cell of reservedCells(object.key, object.spot)) {
      const index = at(cell.i, cell.j);
      if (index >= 0 && index < used.length) used[index] = 1;
    }
  }
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const index = row * width + column;
      offGround[index] = zones.rows[row][column] === wanted && !used[index] ? 0 : 1;
    }
  }
  return { free: spread(width, height, used), open: spread(width, height, offGround), width };
}

/**
 * A spot for one object, or null when the island has no room left for it even
 * shoulder to shoulder. Tighter tries come after roomy ones, so a crowded island
 * packs together instead of dropping the object.
 */
export function findSpot(
  zones: StageZones,
  taken: readonly PlacedObject[],
  key: string,
  level: number,
  seed: number,
  /** Without this the object only gets its full block with a gap around it. */
  relax = true,
  /** What the draw is keyed on — the instance, so two copies land apart. */
  id: string = key,
): Spot | null {
  const info = LAND_OBJECTS[key];
  // The spot has to hold the object once it is fully grown, not only today —
  // otherwise it loses its place the moment it grows and vanishes from the
  // island. Which cells have to be the right ground still follows this level.
  const foot = maxFootOf(key);
  if (!info || !foot) return null;
  const wanted = ZONE_CHARS[info.zone];
  const { free, open, width } = roomMaps(zones, wanted, taken);
  const footFits = standableMap(zones, key, level, wanted, width);
  const standable = (index: number) => footFits[index] === 1;

  for (let size = foot.cells; size >= 1; size -= 1) {
    if (size < foot.cells && !relax) break;
    for (const gap of size === foot.cells ? (relax ? [PREFERRED_GAP, 0] : [PREFERRED_GAP]) : [0]) {
      const needed = Math.floor(size / 2) + 1 + gap;
      let total = 0;
      for (let index = 0; index < free.length; index += 1) {
        if (standable(index) && free[index] >= needed) total += open[index] ** ROOM_BIAS;
      }
      if (total === 0) continue;
      let ticket = (hash(seed, id) / 4294967296) * total;
      for (let index = 0; index < free.length; index += 1) {
        if (!standable(index) || free[index] < needed) continue;
        ticket -= open[index] ** ROOM_BIAS;
        if (ticket > 0) continue;
        return {
          i: zones.iMin + Math.floor(index / width),
          j: zones.jMin + (index % width),
        };
      }
    }
  }

  // Last resort: the right ground, whatever the neighbours. An island this
  // crowded stands two things shoulder to shoulder rather than dropping one —
  // an object the player earned must never simply not be there.
  let crowded = -1;
  let fallback: Spot | null = null;
  for (let index = 0; index < free.length; index += 1) {
    if (!standable(index) || open[index] <= crowded) continue;
    crowded = open[index];
    fallback = {
      i: zones.iMin + Math.floor(index / width),
      j: zones.jMin + (index % width),
    };
  }
  return fallback;
}

/** Does this spot still work — right ground under the foot, and nothing in the way? */
export function spotFits(
  zones: StageZones,
  taken: readonly PlacedObject[],
  key: string,
  level: number,
  spot: Spot,
): boolean {
  const info = LAND_OBJECTS[key];
  const foot = footOf(key, level);
  if (!info || !foot) return false;
  const wanted = ZONE_CHARS[info.zone];
  // The whole foot has to be the right ground. Checking only the middle cell was
  // what let beach chairs hang over the water line.
  if (groundCells(key, level, spot).some((cell) => zoneAt(zones, cell.i, cell.j) !== wanted)) {
    return false;
  }
  const used = new Set<string>();
  for (const object of taken) {
    for (const cell of reservedCells(object.key, object.spot)) {
      used.add(`${cell.i},${cell.j}`);
    }
  }
  void foot;
  return !reservedCells(key, spot).some((cell) => used.has(`${cell.i},${cell.j}`));
}

/**
 * How many of these objects fit side by side in this order, each with its full
 * block and a gap around it — no squeezing. Used to work out the per-island
 * limits, and the order matters: players collect objects in no particular one,
 * which packs worse than putting the big ones down first.
 */
export function capacityFor(
  stage: number,
  keys: readonly string[],
  seed = 1,
  /** The size the objects have here; a limit is about adding, so level 1. */
  level = 1,
): number {
  const zones = stageZones(stage);
  const placed: PlacedObject[] = [];
  for (const key of keys) {
    const spot = findSpot(zones, placed, key, level, seed, false);
    if (!spot) break;
    placed.push({ id: key, key, level, spot });
  }
  return placed.length;
}

/**
 * Keep every spot that still works and find one for everything else. Objects are
 * handled in the order they were added, so nothing that already stands moves
 * because of something new — except when the island grew and the beach moved out
 * from under a beach object.
 */
/**
 * The last few answers, because the same question gets asked over and over.
 *
 * Nothing stores the places the search finds, so every screen that draws the
 * island asks for them again — and a finished island is 57 searches, measured
 * at 3.5 seconds on a phone. The inputs are the same every time, so the answer
 * can be. Small on purpose: a handful of entries covers Home, the placing
 * screen and a friend's island without holding onto islands nobody is looking
 * at any more.
 */
const ANSWERS = new Map<string, Record<string, Spot>>();
const MAX_ANSWERS = 6;

function askedFor(
  stage: number,
  objects: readonly { id?: string; key: string; level: number }[],
  stored: Readonly<Record<string, Spot>>,
  seed: number,
): string {
  let key = `${stage}|${seed}`;
  for (const object of objects) key += `|${object.id ?? object.key}:${object.level}`;
  key += "|";
  for (const id of Object.keys(stored).sort()) {
    const spot = stored[id];
    key += `${id}@${spot.i},${spot.j};`;
  }
  return key;
}

export function resolveSpots(
  stage: number,
  /**
   * What stands on the island, in the order it was collected. `id` is the copy,
   * `key` what it looks like — two leafy trees share a key and must not share a
   * place, which is why the result is keyed on the id.
   */
  objects: readonly { id?: string; key: string; level: number }[],
  stored: Readonly<Record<string, Spot>>,
  seed: number,
): Record<string, Spot> {
  const question = askedFor(stage, objects, stored, seed);
  const known = ANSWERS.get(question);
  if (known) return known;
  const zones = stageZones(stage);
  const placed: PlacedObject[] = [];
  const spots: Record<string, Spot> = {};
  const later: { id: string; key: string; level: number }[] = [];

  for (const object of objects) {
    const id = object.id ?? object.key;
    const spot = stored[id];
    if (spot && spotFits(zones, placed, object.key, object.level, spot)) {
      placed.push({ id, key: object.key, level: object.level, spot });
      spots[id] = spot;
    } else if (LAND_OBJECTS[object.key]) {
      later.push({ id, key: object.key, level: object.level });
    }
  }
  for (const object of later) {
    const found = findSpot(zones, placed, object.key, object.level, seed, true, object.id);
    // An object the player owns must never disappear. When a crowded island has
    // nowhere left, it keeps the place it already had — standing a little too
    // close to its neighbour is a blemish, vanishing is a loss.
    const spot = found ?? stored[object.id] ?? null;
    if (!spot) continue;
    placed.push({ ...object, spot });
    spots[object.id] = spot;
  }
  if (ANSWERS.size >= MAX_ANSWERS) {
    const oldest = ANSWERS.keys().next().value;
    if (oldest !== undefined) ANSWERS.delete(oldest);
  }
  ANSWERS.set(question, spots);
  return spots;
}
