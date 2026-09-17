/**
 * Art for island objects.
 *
 * All four categories are real pixel sprites, drawn by the generators in
 * island/pixel/ and painted here as SVG rectangles, so they stay sharp at any
 * size and while they grow. The flat shapes further down are only the fallback
 * for a key that has no sprite — with the current catalog nothing reaches them.
 */

import React, { useMemo } from "react";
import Svg, { Circle, Ellipse, G, Path, Polygon, Rect } from "react-native-svg";
import { GROW_OBJECTS, type GrowCategory } from "../../lib/growRewards";
import { BEACH_COLORS, BEACH_SHADOW, BEACH_SPRITES } from "./beachSprites";
import { BUILDING_COLORS, BUILDING_SHADOW, BUILDING_SPRITES } from "./buildingSprites";
import { PLANT_COLORS, PLANT_SHADOW, PLANT_SPRITES } from "./plantSprites";
import { WATER_COLORS, WATER_SHADOW, WATER_SPRITES } from "./waterSprites";

/** Each set brings its own palette, so the letters of the two files cannot clash. */
const SPRITE_SETS = [
  { sprites: PLANT_SPRITES, colors: PLANT_COLORS, shadow: PLANT_SHADOW },
  { sprites: WATER_SPRITES, colors: WATER_COLORS, shadow: WATER_SHADOW },
  { sprites: BUILDING_SPRITES, colors: BUILDING_COLORS, shadow: BUILDING_SHADOW },
  { sprites: BEACH_SPRITES, colors: BEACH_COLORS, shadow: BEACH_SHADOW },
];

/** Highest growth stage any object has (the boat, with its fleet). */
const MAX_LEVEL = 14;

/** Illustration colors for the placeholders only; UI colors stay in PAPER. */
const ART = {
  ground: "#CFE3B4",
  sand: "#EAD6A6",
  sandDark: "#D9BF83",
  water: "#A9D3EC",
  waterDark: "#6FAED6",
  leaf: "#3E8E4F",
  leafLight: "#6DB36B",
  leafDark: "#2F6B3E",
  trunk: "#8A5A3B",
  wall: "#F2E6D0",
  roof: "#C8553D",
  door: "#7A4E33",
  stone: "#B9B4A8",
  stoneDark: "#8F8A7F",
  window: "#8EC3E6",
  white: "#FFFFFF",
  red: "#E06B4F",
  flame: "#F2A541",
  flameCore: "#F7D26A",
  pink: "#E7839C",
  yellow: "#F2C94C",
  grey: "#7D8A96",
} as const;

function Ground({ color = ART.ground }: { color?: string }) {
  return <Ellipse cx={50} cy={90} rx={36} ry={7} fill={color} />;
}

function Water() {
  return (
    <G>
      <Ellipse cx={50} cy={86} rx={44} ry={11} fill={ART.water} />
      <Path d="M20 86 Q28 82 36 86 T52 86" stroke={ART.waterDark} strokeWidth={2} fill="none" />
    </G>
  );
}

const SHAPES: Record<string, () => React.ReactNode> = {
  // ---- plants ----------------------------------------------------------------
  leafy_tree: () => (
    <G>
      <Ground />
      <Rect x={46} y={58} width={8} height={32} rx={2} fill={ART.trunk} />
      <Circle cx={50} cy={42} r={24} fill={ART.leaf} />
      <Circle cx={34} cy={54} r={14} fill={ART.leafLight} />
      <Circle cx={66} cy={56} r={13} fill={ART.leafLight} />
    </G>
  ),
  bush: () => (
    <G>
      <Ground />
      <Circle cx={36} cy={74} r={15} fill={ART.leaf} />
      <Circle cx={64} cy={74} r={14} fill={ART.leaf} />
      <Circle cx={50} cy={62} r={18} fill={ART.leafLight} />
    </G>
  ),
  flower_bed: () => (
    <G>
      <Ellipse cx={50} cy={86} rx={36} ry={10} fill={ART.trunk} />
      {[28, 42, 56, 70].map((x, i) => (
        <G key={x}>
          <Rect x={x - 1} y={62 - (i % 2) * 8} width={2} height={24} fill={ART.leaf} />
          <Circle cx={x} cy={60 - (i % 2) * 8} r={7} fill={i % 2 ? ART.yellow : ART.pink} />
        </G>
      ))}
    </G>
  ),
  grass_tufts: () => (
    <G>
      <Ground />
      {[30, 50, 70].map((x) => (
        <Path
          key={x}
          d={`M${x - 8} 88 Q${x - 6} 70 ${x - 2} 62 M${x} 88 Q${x} 66 ${x + 2} 56 M${x + 8} 88 Q${x + 6} 72 ${x + 10} 64`}
          stroke={ART.leaf}
          strokeWidth={4}
          fill="none"
          strokeLinecap="round"
        />
      ))}
    </G>
  ),
  fir_tree: () => (
    <G>
      <Ground />
      <Rect x={46} y={76} width={8} height={14} fill={ART.trunk} />
      <Polygon points="50,14 72,50 28,50" fill={ART.leafDark} />
      <Polygon points="50,30 78,70 22,70" fill={ART.leaf} />
      <Polygon points="50,46 82,82 18,82" fill={ART.leafDark} />
    </G>
  ),
  fruit_tree: () => (
    <G>
      <Ground />
      <Rect x={46} y={60} width={8} height={30} rx={2} fill={ART.trunk} />
      <Circle cx={50} cy={46} r={26} fill={ART.leafLight} />
      {[
        [38, 40],
        [58, 34],
        [62, 54],
        [42, 58],
        [50, 46],
      ].map(([x, y]) => (
        <Circle key={`${x}-${y}`} cx={x} cy={y} r={4} fill={ART.red} />
      ))}
    </G>
  ),
  palm_tree: () => (
    <G>
      <Ground color={ART.sand} />
      <Path d="M52 90 C49 70 57 54 50 34" stroke={ART.trunk} strokeWidth={7} fill="none" strokeLinecap="round" />
      <Path d="M50 34 C38 24 24 28 14 40 C28 34 40 35 50 34 Z" fill={ART.leaf} />
      <Path d="M50 34 C62 24 76 28 86 40 C72 34 60 35 50 34 Z" fill={ART.leaf} />
      <Path d="M50 34 C44 18 50 8 58 4 C54 16 54 26 50 34 Z" fill={ART.leafLight} />
      <Path d="M50 34 C36 36 28 48 26 58 C34 48 42 40 50 34 Z" fill={ART.leafLight} />
    </G>
  ),
  world_tree: () => (
    <G>
      <Ground />
      <Path d="M40 90 Q44 64 46 50 L54 50 Q56 64 60 90 Z" fill={ART.trunk} />
      <Circle cx={50} cy={34} r={24} fill={ART.leafDark} />
      <Circle cx={28} cy={44} r={18} fill={ART.leaf} />
      <Circle cx={72} cy={44} r={18} fill={ART.leaf} />
      <Circle cx={50} cy={18} r={14} fill={ART.leafLight} />
    </G>
  ),

  // ---- buildings -------------------------------------------------------------
  house: () => (
    <G>
      <Ground />
      <Rect x={26} y={52} width={48} height={36} fill={ART.wall} />
      <Polygon points="20,54 50,26 80,54" fill={ART.roof} />
      <Rect x={44} y={68} width={12} height={20} fill={ART.door} />
      <Rect x={31} y={61} width={9} height={9} fill={ART.window} />
      <Rect x={60} y={61} width={9} height={9} fill={ART.window} />
    </G>
  ),
  windmill: () => (
    <G>
      <Ground />
      <Polygon points="40,90 60,90 56,46 44,46" fill={ART.wall} />
      <Polygon points="42,48 58,48 50,36" fill={ART.roof} />
      <Path d="M50 40 L50 10 M50 40 L80 40 M50 40 L50 70 M50 40 L20 40" stroke={ART.stone} strokeWidth={6} strokeLinecap="round" />
      <Circle cx={50} cy={40} r={4} fill={ART.door} />
      <Rect x={46} y={76} width={8} height={14} fill={ART.door} />
    </G>
  ),
  cafe: () => (
    <G>
      <Ground />
      <Rect x={24} y={54} width={52} height={34} fill={ART.wall} />
      {[0, 1, 2, 3, 4].map((i) => (
        <Rect key={i} x={22 + i * 11.2} y={48} width={11.2} height={10} fill={i % 2 ? ART.wall : ART.red} />
      ))}
      <Rect x={30} y={64} width={14} height={12} fill={ART.window} />
      <Rect x={52} y={64} width={14} height={24} fill={ART.door} />
    </G>
  ),
  library: () => (
    <G>
      <Ground />
      <Rect x={22} y={84} width={56} height={6} fill={ART.stone} />
      <Rect x={24} y={50} width={52} height={34} fill={ART.stone} />
      <Polygon points="20,52 50,32 80,52" fill={ART.wall} />
      {[30, 42, 54, 66].map((x) => (
        <Rect key={x} x={x} y={54} width={5} height={30} fill={ART.wall} />
      ))}
    </G>
  ),
  workshop: () => (
    <G>
      <Ground />
      <Rect x={22} y={52} width={56} height={36} fill={ART.stone} />
      <Polygon points="22,52 36,38 36,52 50,38 50,52 64,38 64,52 78,38 78,52" fill={ART.roof} />
      <Rect x={30} y={64} width={20} height={24} fill={ART.door} />
      <Circle cx={64} cy={70} r={8} fill={ART.grey} />
      <Circle cx={64} cy={70} r={3} fill={ART.stone} />
    </G>
  ),
  greenhouse: () => (
    <G>
      <Ground />
      <Path d="M22 88 L22 60 Q50 30 78 60 L78 88 Z" fill={ART.window} />
      <Path d="M22 60 Q50 30 78 60 M36 88 L36 48 M50 88 L50 42 M64 88 L64 48 M22 74 L78 74" stroke={ART.white} strokeWidth={2} fill="none" />
      <Circle cx={36} cy={82} r={4} fill={ART.leaf} />
      <Circle cx={60} cy={82} r={4} fill={ART.leaf} />
    </G>
  ),
  training_ground: () => (
    <G>
      <Ellipse cx={50} cy={82} rx={42} ry={14} fill={ART.leafLight} />
      <Ellipse cx={50} cy={82} rx={30} ry={9} fill="none" stroke={ART.white} strokeWidth={2} />
      <Rect x={16} y={56} width={3} height={26} fill={ART.grey} />
      <Rect x={81} y={56} width={3} height={26} fill={ART.grey} />
      <Rect x={16} y={56} width={68} height={3} fill={ART.grey} />
    </G>
  ),
  yoga_pavilion: () => (
    <G>
      <Ground />
      <Rect x={20} y={82} width={60} height={6} fill={ART.trunk} />
      <Rect x={26} y={50} width={4} height={32} fill={ART.trunk} />
      <Rect x={70} y={50} width={4} height={32} fill={ART.trunk} />
      <Path d="M16 52 Q50 20 84 52 Z" fill={ART.leaf} />
    </G>
  ),
  observatory: () => (
    <G>
      <Ground />
      <Rect x={28} y={56} width={44} height={32} fill={ART.wall} />
      <Path d="M28 56 A22 22 0 0 1 72 56 Z" fill={ART.stone} />
      <Rect x={52} y={26} width={8} height={26} fill={ART.grey} transform="rotate(35 56 40)" />
      <Rect x={44} y={70} width={12} height={18} fill={ART.door} />
    </G>
  ),
  boathouse: () => (
    <G>
      <Water />
      <Rect x={26} y={54} width={48} height={30} fill={ART.trunk} />
      <Polygon points="20,56 50,32 80,56" fill={ART.roof} />
      <Path d="M38 84 L38 66 Q50 58 62 66 L62 84 Z" fill={ART.door} />
    </G>
  ),

  // ---- water -----------------------------------------------------------------
  boat: () => (
    <G>
      <Water />
      <Path d="M20 70 L80 70 L70 86 L30 86 Z" fill={ART.trunk} />
      <Rect x={49} y={24} width={3} height={46} fill={ART.door} />
      <Polygon points="52,26 52,66 78,66" fill={ART.white} />
      <Polygon points="48,34 48,64 28,64" fill={ART.white} />
    </G>
  ),
  dock: () => (
    <G>
      <Water />
      {[30, 46, 62].map((x) => (
        <Rect key={x} x={x} y={66} width={4} height={24} fill={ART.door} />
      ))}
      <Rect x={18} y={60} width={64} height={9} rx={2} fill={ART.trunk} />
    </G>
  ),
  buoys: () => (
    <G>
      <Water />
      <Path d="M36 84 Q50 40 64 84 Z" fill={ART.red} />
      <Rect x={40} y={64} width={20} height={7} fill={ART.white} />
      <Circle cx={50} cy={50} r={5} fill={ART.yellow} />
    </G>
  ),
  kayaks: () => (
    <G>
      <Water />
      <Ellipse cx={50} cy={78} rx={34} ry={7} fill={ART.yellow} />
      <Ellipse cx={50} cy={76} rx={8} ry={3} fill={ART.grey} />
      <Path d="M24 62 L76 90" stroke={ART.door} strokeWidth={3} strokeLinecap="round" />
    </G>
  ),
  rocks: () => (
    <G>
      <Water />
      <Polygon points="24,86 34,62 50,58 58,70 60,86" fill={ART.stoneDark} />
      <Polygon points="52,86 62,70 74,68 80,86" fill={ART.stone} />
    </G>
  ),
  dolphins: () => (
    <G>
      <Water />
      <Path d="M22 80 Q40 36 74 56 Q60 54 58 64 Q44 56 34 82 Z" fill={ART.grey} />
      <Polygon points="48,48 54,34 58,52" fill={ART.grey} />
      <Circle cx={66} cy={56} r={1.8} fill={ART.white} />
    </G>
  ),
  gulls: () => (
    <G>
      <Water />
      {[
        [30, 40],
        [58, 28],
        [70, 52],
      ].map(([x, y]) => (
        <Path
          key={`${x}-${y}`}
          d={`M${x - 12} ${y} Q${x - 6} ${y - 8} ${x} ${y} Q${x + 6} ${y - 8} ${x + 12} ${y}`}
          stroke={ART.grey}
          strokeWidth={3}
          fill="none"
          strokeLinecap="round"
        />
      ))}
    </G>
  ),

  // ---- beach -----------------------------------------------------------------
  sandcastle: () => (
    <G>
      <Ground color={ART.sand} />
      <Rect x={30} y={56} width={40} height={32} fill={ART.sandDark} />
      <Rect x={22} y={46} width={14} height={42} fill={ART.sandDark} />
      <Rect x={64} y={46} width={14} height={42} fill={ART.sandDark} />
      <Rect x={43} y={36} width={14} height={20} fill={ART.sandDark} />
      <Path d="M44 88 L44 74 Q50 66 56 74 L56 88 Z" fill={ART.trunk} />
      <Polygon points="50,20 50,36 60,28" fill={ART.red} />
    </G>
  ),
  campfire: () => (
    <G>
      <Ground color={ART.sand} />
      <Rect x={28} y={80} width={44} height={8} rx={4} fill={ART.trunk} transform="rotate(-12 50 84)" />
      <Rect x={28} y={80} width={44} height={8} rx={4} fill={ART.door} transform="rotate(12 50 84)" />
      <Path d="M50 30 C66 48 64 70 50 80 C36 70 34 48 50 30 Z" fill={ART.flame} />
      <Path d="M50 50 C58 60 58 72 50 78 C42 72 42 60 50 50 Z" fill={ART.flameCore} />
    </G>
  ),
  deck_chairs: () => (
    <G>
      <Ground color={ART.sand} />
      <Rect x={49} y={34} width={3} height={56} fill={ART.door} />
      <Path d="M20 40 Q50 8 80 40 Z" fill={ART.red} />
      <Path d="M36 40 Q50 18 64 40 Z" fill={ART.white} />
      <Polygon points="56,88 74,70 80,72 64,90" fill={ART.window} />
    </G>
  ),
  shells: () => (
    <G>
      <Ground color={ART.sand} />
      <Path d="M26 84 Q34 64 42 84 Z" fill={ART.pink} />
      <Polygon points="62,62 65,72 76,72 67,78 70,88 62,82 54,88 57,78 48,72 59,72" fill={ART.flame} />
    </G>
  ),
  surfboards: () => (
    <G>
      <Ground color={ART.sand} />
      <Ellipse cx={34} cy={54} rx={8} ry={32} fill={ART.window} />
      <Ellipse cx={50} cy={50} rx={8} ry={36} fill={ART.yellow} />
      <Ellipse cx={66} cy={56} rx={8} ry={30} fill={ART.red} />
    </G>
  ),
  hammock: () => (
    <G>
      <Ground color={ART.sand} />
      <Rect x={18} y={34} width={5} height={56} fill={ART.trunk} />
      <Rect x={77} y={34} width={5} height={56} fill={ART.trunk} />
      <Path d="M22 44 Q50 80 78 44" stroke={ART.red} strokeWidth={7} fill="none" strokeLinecap="round" />
    </G>
  ),
  volleyball_net: () => (
    <G>
      <Ground color={ART.sand} />
      <Rect x={16} y={40} width={4} height={50} fill={ART.grey} />
      <Rect x={80} y={40} width={4} height={50} fill={ART.grey} />
      <Rect x={20} y={44} width={60} height={16} fill="none" stroke={ART.white} strokeWidth={2} />
      <Path d="M32 44 L32 60 M44 44 L44 60 M56 44 L56 60 M68 44 L68 60 M20 52 L80 52" stroke={ART.white} strokeWidth={1.5} />
      <Circle cx={60} cy={30} r={6} fill={ART.yellow} />
    </G>
  ),
  beach_bar: () => (
    <G>
      <Ground color={ART.sand} />
      <Rect x={26} y={60} width={48} height={28} fill={ART.trunk} />
      <Polygon points="16,62 50,30 84,62" fill={ART.flameCore} />
      <Rect x={22} y={60} width={56} height={6} fill={ART.door} />
      <Rect x={40} y={52} width={4} height={8} fill={ART.red} />
      <Rect x={56} y={52} width={4} height={8} fill={ART.window} />
    </G>
  ),
};

interface FoundSprite {
  data: { w: number; h: number; rows: string[] };
  colors: Record<string, string>;
  shadow: string;
}

/** The sprite for a stage, or the fully grown one when no stage is given. */
function findSprite(objectKey: string, level?: number): FoundSprite | null {
  const pick = (candidate: number): FoundSprite | null => {
    for (const set of SPRITE_SETS) {
      const data = set.sprites[`${objectKey}_${candidate}`];
      if (data) return { data, colors: set.colors, shadow: set.shadow };
    }
    return null;
  };
  if (level) {
    const exact = pick(level);
    if (exact) return exact;
  }
  for (let candidate = MAX_LEVEL; candidate >= 1; candidate -= 1) {
    const found = pick(candidate);
    if (found) return found;
  }
  return null;
}

interface Run {
  x: number;
  y: number;
  w: number;
  char: string;
}

/** Pixels of one row merged into runs, so a sprite costs tens of rects, not thousands. */
function spriteRuns(rows: string[]): Run[] {
  const runs: Run[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const char = row[x];
      if (char === ".") {
        x += 1;
        continue;
      }
      let end = x + 1;
      while (end < row.length && row[end] === char) end += 1;
      runs.push({ x, y, w: end - x, char });
      x = end;
    }
  });
  return runs;
}

/** One sprite, centred in a square box and standing on its bottom edge. */
function PixelObject({ found, size }: { found: FoundSprite; size: number }) {
  const sprite = found.data;
  const runs = useMemo(() => spriteRuns(sprite.rows), [sprite]);
  const box = Math.max(sprite.w, sprite.h) * 1.08;
  const left = (box - sprite.w) / 2;
  const top = box - sprite.h - box * 0.04;
  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${box} ${box}`}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <G>
        {runs.map((run, index) => (
          // A hair of overlap so no seams show between runs at odd scales.
          <Rect
            key={index}
            x={run.x + left}
            y={run.y + top}
            width={run.w + 0.02}
            height={1.02}
            fill={run.char === found.shadow ? "#000000" : found.colors[run.char]}
            opacity={run.char === found.shadow ? 0.25 : 1}
          />
        ))}
      </G>
    </Svg>
  );
}

export function GrowObjectArt({
  category,
  objectKey,
  level,
  size,
}: {
  category: GrowCategory;
  objectKey?: string;
  /** Growth stage; without it the object is shown fully grown. */
  level?: number;
  size: number;
}) {
  const key = objectKey ?? GROW_OBJECTS[category][0].key;
  const found = findSprite(key, level);
  if (found) return <PixelObject found={found} size={size} />;
  const draw = SHAPES[key] ?? SHAPES[GROW_OBJECTS[category][0].key];
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {draw ? draw() : null}
    </Svg>
  );
}
