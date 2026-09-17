import type { ImageSourcePropType } from "react-native";

/**
 * Island stages on Home (island/WACHSTUM.md §15.8–15.9). Each stage is an ocean
 * background with a shallow-water patch plus the island sprite drawn on top.
 *
 * - `zoom` and `shiftY` transform the background. The island layer uses the same
 *   transform, so the island always moves with the background.
 * - `islandRect` is in background asset pixels and follows the cover scaling.
 */
export interface HomeIslandStage {
  /** Pre-scaled with nearest neighbour so iOS does not blur the pixels. */
  background: ImageSourcePropType;
  zoom: number;
  /** translateY applied after `scale`, so the rendered shift is zoom · shiftY pt. */
  shiftY: number;
  /** Some backgrounds already contain the island; then there is no extra layer. */
  island?: ImageSourcePropType;
  islandRect?: { left: number; top: number; width: number; height: number };
}

export const HOME_ISLAND_STAGES: readonly HomeIslandStage[] = [
  // One island that grows, drawn by island/pixel/ocean.py with the same coastline
  // (variant B) at five sizes. Sky, sea, island, beach and shallows are one picture
  // per stage, so no island layer and no transform. The camera steps back as the
  // island grows: 8 m at D 6, then 12, 15, 19 and 26 m at D 6, 5, 4 and 3 — that is
  // why the trees get smaller from stage to stage while the island stays on screen.
  { background: require("../../assets/home/pixel-island-1.png"), zoom: 1, shiftY: 0 },
  { background: require("../../assets/home/pixel-island-2.png"), zoom: 1, shiftY: 0 },
  { background: require("../../assets/home/pixel-island-3.png"), zoom: 1, shiftY: 0 },
  { background: require("../../assets/home/pixel-island-4.png"), zoom: 1, shiftY: 0 },
  { background: require("../../assets/home/pixel-island-5.png"), zoom: 1, shiftY: 0 },
];

// Which stage Home shows is no longer a constant: `islandStageFor` in
// src/lib/islandScene.ts picks it from everything that stands on the island.
