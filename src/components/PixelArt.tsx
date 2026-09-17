/**
 * Pixel-art sprites drawn with SVG rects.
 *
 * The island moves to a pixel look. Until real sprite sheets exist, the reward
 * objects live here as 16×16 character maps. Every row is merged into runs of
 * the same color, so one icon costs a few dozen rects instead of 256.
 */

import React, { useMemo } from "react";
import Svg, { G, Rect } from "react-native-svg";
import type { RewardObjectKey } from "../lib/rewards";

const GRID = 16;

const PALETTE: Record<string, string> = {
  k: "#2B2D42", // outline
  w: "#FFFFFF",
  r: "#E5533D",
  y: "#F6C945",
  b: "#9A6636",
  B: "#6B4424",
  g: "#B7BEC4",
  G: "#7C858D",
  c: "#4FC3F0",
  C: "#BDEBFB",
  s: "#EFD9A8",
  S: "#D9B978",
  l: "#F4C534",
  L: "#C9921D",
};

const SPRITES: Record<string, string[]> = {
  flagpole_1: [
    "................",
    "....kkkkkkkk....",
    "....krrrrrrrk...",
    "....krrwwrrrk...",
    "....krwwwwrrk...",
    "....krrwwrrrk...",
    "....krrrrrrrk...",
    "....kkkkkkkk....",
    "....kG..........",
    "....kG..........",
    "....kG..........",
    "....kG..........",
    "....kG..........",
    "...kkGkk........",
    "..kggggggk......",
    "..kkkkkkkk......",
  ],
  treasure_chest_1: [
    "................",
    "................",
    "................",
    "...kkkkkkkkkk...",
    "..kbbbbbbbbbbk..",
    "..kbBBBBBBBBbk..",
    "..kbbbbbbbbbbk..",
    "..kkkkkyykkkkk..",
    "..kbbbkyykbbbk..",
    "..kbBBBkkBBBbk..",
    "..kbbbbbbbbbbk..",
    "..kbBBBBBBBBbk..",
    "..kbbbbbbbbbbk..",
    "..kkkkkkkkkkkk..",
    "................",
    "................",
  ],
  treasure_chest_2: [
    "..w.........w...",
    ".www.......www..",
    "..w.........w...",
    "...kkkkkkkkkk...",
    "..kllllllllllk..",
    "..klLLLLLLLLlk..",
    "..kllllllllllk..",
    "..kkkkkwwkkkkk..",
    "..klllkwwklllk..",
    "..klLLLkkLLLlk..",
    "..kllllllllllk..",
    "..klLLLLLLLLlk..",
    "..kllllllllllk..",
    "..kkkkkkkkkkkk..",
    "................",
    "................",
  ],
  fountain_1: [
    "................",
    ".......CC.......",
    "......C..C......",
    ".....C.cc.C.....",
    "....C..cc..C....",
    ".......kk.......",
    "......kGGk......",
    "...kkkkGGkkkk...",
    "..kcccccccccck..",
    "..kCccccccccCk..",
    "..kggggggggggk..",
    "..kGGGGGGGGGGk..",
    "...kkkkkkkkkk...",
    "................",
    "................",
    "................",
  ],
  fountain_2: [
    ".......CC.......",
    "......CccC......",
    ".....C.cc.C.....",
    "....C..cc..C....",
    "...C...cc...C...",
    ".......kk.......",
    "......kyyk......",
    "....kkkGGkkk....",
    ".kcccccccccccck.",
    ".kCccccccccccCk.",
    ".kggggggggggggk.",
    ".kGGGyGGGGyGGGk.",
    "..kkkkkkkkkkkk..",
    "................",
    "................",
    "................",
  ],
  clock_tower_1: [
    ".......kk.......",
    "......krrk......",
    ".....krrrrk.....",
    "....krrrrrrk....",
    "....kssssssk....",
    "....kswwwwsk....",
    "....kswkwwsk....",
    "....kswwkwsk....",
    "....kswwwwsk....",
    "....kssssssk....",
    "....kSssssSk....",
    "....ksskkssk....",
    "....kssbbssk....",
    "....kssbbssk....",
    "...kkkkkkkkkk...",
    "................",
  ],
  clock_tower_2: [
    ".......ky.......",
    "......krrk......",
    ".....kryyrk.....",
    "....krryyrrk....",
    "....kssssssk....",
    "....kswwwwsk....",
    "....kswkwwsk....",
    "....kswwkwsk....",
    "....kswwwwsk....",
    "....kssssssk....",
    "....kSssssSk....",
    "....ksskkssk....",
    "....kssbbssk....",
    "....kssbbssk....",
    "...kkkkkkkkkk...",
    "................",
  ],
  lighthouse_1: [
    "......kkkk......",
    ".....kyyyyk.....",
    ".....kkkkkk.....",
    "......kwwk......",
    "......krrk......",
    ".....kwwwwk.....",
    ".....krrrrk.....",
    ".....kwwwwk.....",
    "....krrrrrrk....",
    "....kwwwwwwk....",
    "....krrrrrrk....",
    "....kwwwbwwk....",
    "...kGGGGGGGGk...",
    "...kkkkkkkkkk...",
    "................",
    "................",
  ],
  lighthouse_2: [
    "yy....kkkk....yy",
    "..yy.kyyyyk.yy..",
    ".....kkkkkk.....",
    "......kwwk......",
    "......krrk......",
    ".....kwwwwk.....",
    ".....krrrrk.....",
    ".....kwwwwk.....",
    "....krrrrrrk....",
    "....kwwwwwwk....",
    "....krrrrrrk....",
    "....kwwwbwwk....",
    "...kGGGGGGGGk...",
    "...kkkkkkkkkk...",
    "................",
    "................",
  ],
  monument_1: [
    ".......kk.......",
    "......kgwk......",
    "......kgwk......",
    "......kgwk......",
    ".....kggwwk.....",
    ".....kggwwk.....",
    ".....kggwwk.....",
    ".....kggwwk.....",
    "....kgggwwwk....",
    "....kgggwwwk....",
    "...kkkkkkkkkk...",
    "...kGGGllGGGk...",
    "..kkkkkkkkkkkk..",
    "................",
    "................",
    "................",
  ],
  trophy: [
    "................",
    "...kkkkkkkkkk...",
    "..kkllllllllkk..",
    ".kLkllllllllkLk.",
    ".kLkllwlllllkLk.",
    "..kkllwlllllkk..",
    "...kllllllllk...",
    "....kllllllk....",
    ".....kllllk.....",
    "......kllk......",
    ".......kk.......",
    "......kLLk......",
    ".....kllllk.....",
    "....kkkkkkkk....",
    "................",
    "................",
  ],
};

interface Run {
  x: number;
  y: number;
  w: number;
  color: string;
}

function toRuns(rows: string[]): Run[] {
  const runs: Run[] = [];
  for (let y = 0; y < GRID; y++) {
    const row = (rows[y] ?? "").padEnd(GRID, ".").slice(0, GRID);
    let x = 0;
    while (x < GRID) {
      const color = PALETTE[row[x]];
      if (!color) {
        x += 1;
        continue;
      }
      let end = x + 1;
      while (end < GRID && row[end] === row[x]) end += 1;
      runs.push({ x, y, w: end - x, color });
      x = end;
    }
  }
  return runs;
}

export function rewardSpriteName(object: RewardObjectKey, tier: 1 | 2): string {
  const key = `${object}_${tier}`;
  return SPRITES[key] ? key : `${object}_1`;
}

export function PixelSprite({
  name,
  size = 48,
  silhouette,
  opacity = 1,
}: {
  name: string;
  size?: number;
  /** Paint every pixel in one color: the locked look on the roadmap. */
  silhouette?: string;
  opacity?: number;
}) {
  const runs = useMemo(() => toRuns(SPRITES[name] ?? []), [name]);
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${GRID} ${GRID}`}>
      <G opacity={opacity}>
        {runs.map((run, index) => (
          // A hair of overlap so no seams show between runs at odd scales.
          <Rect
            key={index}
            x={run.x}
            y={run.y}
            width={run.w + 0.02}
            height={1.02}
            fill={silhouette ?? run.color}
          />
        ))}
      </G>
    </Svg>
  );
}
