/**
 * Stone paths between the buildings (island/WACHSTUM.md §15.11).
 *
 * Two decisions do the work:
 *
 *   * **Which pairs get a path.** Not every building to every other — that turns
 *     the island into a net. A minimum spanning tree over the buildings gives
 *     n − 1 paths: everything is connected, nothing is laid twice.
 *   * **How one path runs.** Cheapest route on the half-metre grid. Grass costs
 *     1, sand 2 (a path prefers the meadow but may cross a beach), and a cell
 *     that already carries a path costs almost nothing — so paths bundle instead
 *     of running side by side. Objects and water are walls.
 *
 * The stones themselves sit on every second cell of the route, so there is a
 * hair of grass between them instead of a grey ribbon.
 *
 * Pure and deterministic: the same island always gets the same paths, which is
 * what lets the domain suite check them.
 */

import { GROW_OBJECTS } from "./growRewards";
import { objectCells, type Spot } from "./islandPlacement";
import { zoneAt, type StageZones } from "./islandZones";

export interface PathStone {
  i: number;
  j: number;
  /** Which of the four slab pictures to draw, so a path does not look stamped. */
  variant: number;
}

const BUILDING_KEYS: readonly string[] = GROW_OBJECTS.building.map((object) => object.key);

/** What one step onto a cell costs, or null when nothing may go there. */
const COST_GRASS = 10;
const COST_SAND = 20;
/** Almost free, so a second path joins an existing one instead of running beside it. */
const COST_PAVED = 3;

/**
 * Largest value an Int32Array can hold — `Number.MAX_SAFE_INTEGER` silently wraps
 * to -1 in one, and then every comparison against it says "already cheaper".
 */
const UNREACHED = 0x7fffffff;

/** Steps in half-metre cells: along both ground axes and diagonally between them. */
const STEPS: readonly Spot[] = [
  { i: 1, j: 0 },
  { i: -1, j: 0 },
  { i: 0, j: 1 },
  { i: 0, j: -1 },
  { i: 1, j: 1 },
  { i: -1, j: -1 },
  { i: 1, j: -1 },
  { i: -1, j: 1 },
];

interface Grid {
  width: number;
  height: number;
  iMin: number;
  jMin: number;
  /** Cost of entering each cell, 0 when it is a wall. */
  cost: Int32Array;
  at: (i: number, j: number) => number;
}

function buildGrid(
  zones: StageZones,
  standing: readonly { key: string; level: number; spot: Spot }[],
  openFor: ReadonlySet<string>,
): Grid {
  const height = zones.rows.length;
  const width = Math.max(...zones.rows.map((row) => row.length));
  const at = (i: number, j: number) => {
    const row = i - zones.iMin;
    const column = j - zones.jMin;
    if (row < 0 || row >= height || column < 0 || column >= width) return -1;
    return row * width + column;
  };

  const cost = new Int32Array(width * height);
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const zone = zoneAt(zones, zones.iMin + row, zones.jMin + column);
      cost[row * width + column] = zone === "G" ? COST_GRASS : zone === "B" ? COST_SAND : 0;
    }
  }
  // Everything standing is a wall — except the buildings the path has to reach.
  for (const object of standing) {
    if (openFor.has(object.key)) continue;
    for (const cell of objectCells(object.key, object.level, object.spot)) {
      const index = at(cell.i, cell.j);
      if (index >= 0) cost[index] = 0;
    }
  }
  return { width, height, iMin: zones.iMin, jMin: zones.jMin, cost, at };
}

/**
 * Cheapest routes from one cell to everywhere, as a came-from map.
 * Plain Dijkstra with a binary heap: the grid is a few thousand cells and this
 * runs once per pair of buildings, not once per frame.
 */
function cheapestFrom(grid: Grid, start: number, paved: Uint8Array) {
  const total = grid.cost.length;
  const dist = new Int32Array(total).fill(UNREACHED);
  const from = new Int32Array(total).fill(-1);
  const heap: number[] = [start];
  const heapCost: number[] = [0];
  dist[start] = 0;

  const swap = (a: number, b: number) => {
    [heap[a], heap[b]] = [heap[b], heap[a]];
    [heapCost[a], heapCost[b]] = [heapCost[b], heapCost[a]];
  };
  const push = (cell: number, value: number) => {
    heap.push(cell);
    heapCost.push(value);
    let index = heap.length - 1;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (heapCost[parent] <= heapCost[index]) break;
      swap(parent, index);
      index = parent;
    }
  };
  const pop = () => {
    const top = heap[0];
    const topCost = heapCost[0];
    const last = heap.pop() as number;
    const lastCost = heapCost.pop() as number;
    if (heap.length > 0) {
      heap[0] = last;
      heapCost[0] = lastCost;
      let index = 0;
      for (;;) {
        const left = index * 2 + 1;
        const right = left + 1;
        let smallest = index;
        if (left < heap.length && heapCost[left] < heapCost[smallest]) smallest = left;
        if (right < heap.length && heapCost[right] < heapCost[smallest]) smallest = right;
        if (smallest === index) break;
        swap(index, smallest);
        index = smallest;
      }
    }
    return [top, topCost] as const;
  };

  while (heap.length > 0) {
    const [cell, spent] = pop();
    if (spent > dist[cell]) continue;
    const i = grid.iMin + Math.floor(cell / grid.width);
    const j = grid.jMin + (cell % grid.width);
    for (const step of STEPS) {
      const next = grid.at(i + step.i, j + step.j);
      if (next < 0) continue;
      const enter = grid.cost[next];
      if (enter === 0) continue;
      const price = paved[next] === 1 ? COST_PAVED : enter;
      const value = spent + price;
      if (value >= dist[next]) continue;
      dist[next] = value;
      from[next] = cell;
      push(next, value);
    }
  }
  return { dist, from };
}

function walkBack(from: Int32Array, start: number, target: number): number[] {
  const cells: number[] = [];
  let cell = target;
  while (cell !== -1 && cell !== start) {
    cells.push(cell);
    cell = from[cell];
  }
  if (cell === start) cells.push(start);
  return cells.reverse();
}

/**
 * The stones of every path on this island. Empty until a second building stands
 * there — a single building has nothing to be connected to.
 */
export function pathStones(
  zones: StageZones,
  standing: readonly { key: string; level: number; spot: Spot }[],
): PathStone[] {
  const buildings = standing.filter((object) => BUILDING_KEYS.includes(object.key));
  if (buildings.length < 2) return [];

  const openFor = new Set(buildings.map((building) => building.key));
  const grid = buildGrid(zones, standing, openFor);
  const doors = buildings.map((building) => grid.at(building.spot.i, building.spot.j));
  if (doors.some((door) => door < 0)) return [];

  // Where something stands, including the buildings themselves. A route may run
  // through a building — that is how it reaches the door — but a stone laid
  // there would sit behind the house and the path would look torn in two.
  const covered = new Uint8Array(grid.cost.length);
  for (const object of standing) {
    for (const cell of objectCells(object.key, object.level, object.spot)) {
      const index = grid.at(cell.i, cell.j);
      if (index >= 0) covered[index] = 1;
    }
  }

  const paved = new Uint8Array(grid.cost.length);
  // Distances between every pair, so the tree is built on real walking distance
  // and not on how far apart two buildings happen to look.
  const runs = doors.map((door) => cheapestFrom(grid, door, paved));

  const inTree = [0];
  const outside = doors.map((_, index) => index).slice(1);
  const stones = new Map<number, PathStone>();

  while (outside.length > 0) {
    let bestFrom = -1;
    let bestTo = -1;
    let best = UNREACHED;
    for (const from of inTree) {
      for (const to of outside) {
        const value = runs[from].dist[doors[to]];
        if (value < best) {
          best = value;
          bestFrom = from;
          bestTo = to;
        }
      }
    }
    if (bestFrom === -1 || best === UNREACHED) break;

    // Walked again with the stones laid so far, so this path joins them.
    const run = cheapestFrom(grid, doors[bestFrom], paved);
    const route = walkBack(run.from, doors[bestFrom], doors[bestTo]);
    // Counted over the open cells only, so a stone lands on every second cell of
    // what you actually see rather than every second cell of the whole route.
    let openStep = 0;
    for (const cell of route) {
      paved[cell] = 1;
      if (covered[cell] === 1) continue;
      openStep += 1;
      if (openStep % 2 === 0) continue;
      const i = grid.iMin + Math.floor(cell / grid.width);
      const j = grid.jMin + (cell % grid.width);
      stones.set(cell, { i, j, variant: Math.abs(i * 3 + j * 5) % 4 });
    }

    inTree.push(bestTo);
    outside.splice(outside.indexOf(bestTo), 1);
  }

  return [...stones.values()].sort((a, b) => a.i + a.j - (b.i + b.j));
}
