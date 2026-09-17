/**
 * Several of the same thing on one island.
 *
 * The catalog says a player may have six leafy trees and eight bushes
 * (island/WACHSTUM.md §15.10), but the island stored exactly one entry per object
 * key — so `maxCount` was a number with nothing behind it. This is the piece that
 * makes it real.
 *
 * **An instance id is the object key, optionally followed by `#n`.** The first
 * leafy tree is `leafy_tree`, the second `leafy_tree#2`, the third
 * `leafy_tree#3`. Two consequences, and they are the whole design:
 *
 *   * Everything that asks *what does this look like* — sprite, footprint,
 *     catalog entry — uses the **base key**. Copies are the same object.
 *   * Everything that asks *which one is this* — its place, its level, what it
 *     collides with — uses the **instance id**. Copies are their own thing and
 *     grow from a seed on their own.
 *
 * Islands saved before this existed hold plain keys, which are exactly the ids of
 * the first instances — so they keep working with nothing to migrate.
 */

const SEPARATOR = "#";

/** The catalog key behind an instance id: `leafy_tree#3` → `leafy_tree`. */
export function baseKeyOf(instanceId: string): string {
  const cut = instanceId.indexOf(SEPARATOR);
  return cut === -1 ? instanceId : instanceId.slice(0, cut);
}

/** The id of the n-th copy, counting from one. The first has no suffix. */
export function instanceId(key: string, index: number): string {
  return index <= 1 ? key : `${key}${SEPARATOR}${index}`;
}

/** Every instance of one object on this island, in the order they were added. */
export function instancesOf(
  island: Readonly<Record<string, { level: number }>>,
  key: string,
): string[] {
  const found: string[] = [];
  for (let index = 1; index <= 64; index += 1) {
    const id = instanceId(key, index);
    if ((island[id]?.level ?? 0) > 0) found.push(id);
  }
  return found;
}

/** How many of this object stand on the island. */
export function countOf(
  island: Readonly<Record<string, { level: number }>>,
  key: string,
): number {
  return instancesOf(island, key).length;
}

/**
 * The id the next copy would get — the first gap, not the count plus one, so a
 * removed middle copy is reused rather than leaving a hole in the numbering.
 */
export function nextInstanceId(
  island: Readonly<Record<string, { level: number }>>,
  key: string,
  maxCount: number,
): string | null {
  for (let index = 1; index <= maxCount; index += 1) {
    const id = instanceId(key, index);
    if ((island[id]?.level ?? 0) <= 0) return id;
  }
  return null;
}

/** "Leafy tree" for the first, "2nd leafy tree" for the next ones. */
export function describeInstance(name: string, id: string): string {
  const cut = id.indexOf(SEPARATOR);
  if (cut === -1) return name;
  const index = Number(id.slice(cut + 1));
  if (!Number.isFinite(index) || index < 2) return name;
  const suffix = index === 2 ? "2nd" : index === 3 ? "3rd" : `${index}th`;
  return `${suffix} ${name.charAt(0).toLowerCase()}${name.slice(1)}`;
}
