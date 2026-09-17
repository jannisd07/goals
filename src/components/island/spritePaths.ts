/**
 * Pixel rows turned into SVG paths, shared by the island layer and the placing
 * screen so both draw a sprite exactly the same way.
 *
 * One path per colour per picture: React Native blurs a scaled-up PNG, and a
 * rectangle per pixel would be far too many elements. Runs of equal colour in a
 * row become one rectangle each, which is roughly a tenth of the work.
 */

import { islandSprite, type IslandSprite } from "./islandSprites";

interface Run {
  char: string;
  x: number;
  y: number;
  w: number;
}

export interface ColorPath {
  key: string;
  fill: string;
  opacity: number;
  d: string;
}

/** Pictures repeat across pieces and stages, so their runs are found once. */
const RUN_CACHE = new Map<string, Run[]>();

function spriteRuns(name: string, sprite: IslandSprite): Run[] {
  const cached = RUN_CACHE.get(name);
  if (cached) return cached;
  const runs: Run[] = [];
  sprite.rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const char = row[x];
      let end = x;
      while (end + 1 < row.length && row[end + 1] === char) end += 1;
      if (char !== ".") runs.push({ char, x, y, w: end - x + 1 });
      x = end + 1;
    }
  });
  RUN_CACHE.set(name, runs);
  return runs;
}

/** One path per colour of one piece, already sitting at its place on the island. */
export function piecePaths(
  name: string,
  sprite: IslandSprite,
  left: number,
  top: number,
  index: number,
): ColorPath[] {
  const byChar = new Map<string, string[]>();
  for (const run of spriteRuns(name, sprite)) {
    const parts = byChar.get(run.char) ?? [];
    // A hair of overlap, so no seam shows between runs once the layer is scaled.
    const width = run.w + 0.02;
    parts.push(`M${run.x + left} ${run.y + top}h${width}v1.02h-${width}Z`);
    byChar.set(run.char, parts);
  }
  const paths: ColorPath[] = [];
  byChar.forEach((parts, char) => {
    paths.push({
      key: `${index}-${char}`,
      fill: char === sprite.shadow ? "#000000" : sprite.colors[char] ?? "#000000",
      opacity: char === sprite.shadow ? 0.25 : 1,
      d: parts.join(""),
    });
  });
  return paths;
}

/** The paths of a whole list of pieces, in the order they are drawn. */
export function scenePaths(pieces: readonly { sprite: string; x: number; y: number }[]): ColorPath[] {
  const paths: ColorPath[] = [];
  pieces.forEach((piece, index) => {
    const sprite = islandSprite(piece.sprite);
    if (!sprite) return;
    paths.push(
      ...piecePaths(
        piece.sprite,
        sprite,
        Math.round(piece.x) - sprite.ax,
        Math.round(piece.y) - sprite.ay,
        index,
      ),
    );
  });
  return paths;
}
