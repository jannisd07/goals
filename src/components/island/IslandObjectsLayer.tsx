/**
 * Everything the player has grown, drawn on top of the island background.
 *
 * The background asset holds sky, sea, island and shallows. This layer adds the
 * objects: plants and buildings on the meadow, beach things on the sand, boats,
 * buoys, rocks, dolphins and gulls in the water. Water objects sit at fixed
 * places that are the same for everyone (`islandSlots.ts`); land objects get
 * their spot from `islandPlacement.ts` the first time they appear.
 *
 * Pixel art is drawn as SVG paths, not images: React Native blurs a scaled-up
 * PNG, and one path per colour per piece keeps the element count manageable.
 * Positions are baked into the path data and the camera lives in the viewBox —
 * a `transform` on a `<G>` has already proved unreliable here once.
 */

import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { scenePaths, type ColorPath } from "./spritePaths";
import { islandPieces, waterSlotsFor, type IslandStage } from "../../lib/islandScene";
import type { Spot } from "../../lib/islandPlacement";
import type { IslandObjectLevels } from "../../lib/growRewards";

export function IslandObjectsLayer({
  stage,
  island,
  spots,
  seed,
  screenWidth,
  screenHeight,
  transform,
}: {
  stage: IslandStage;
  island: IslandObjectLevels;
  spots: Readonly<Record<string, Spot>>;
  seed: number;
  screenWidth: number;
  screenHeight: number;
  /** The transform of the background image, so the objects move with the island. */
  transform?: object;
}) {
  const slots = waterSlotsFor(stage);

  const scene = useMemo(() => {
    if (screenWidth <= 0 || screenHeight <= 0) return null;
    const pieces = islandPieces(stage, island, spots, seed);
    if (pieces.length === 0) return null;
    // The asset is the artwork scaled by `zoom`, laid out with resizeMode="cover"
    // and centred — the same cover maths the island layer uses.
    const cover = Math.max(
      screenWidth / (slots.artW * slots.zoom),
      screenHeight / (slots.artH * slots.zoom),
    );
    const scale = cover * slots.zoom; // points per artwork pixel
    const paths: ColorPath[] = scenePaths(pieces);
    // The viewBox is the camera: artwork pixels in, points out.
    const minX = (slots.artW * scale - screenWidth) / 2 / scale;
    const minY = (slots.artH * scale - screenHeight) / 2 / scale;
    return {
      paths,
      viewBox: `${minX} ${minY} ${screenWidth / scale} ${screenHeight / scale}`,
    };
  }, [stage, island, spots, seed, screenWidth, screenHeight, slots]);

  if (!scene) return null;

  return (
    <View style={[StyleSheet.absoluteFill, transform]} pointerEvents="none">
      <Svg
        width={screenWidth}
        height={screenHeight}
        viewBox={scene.viewBox}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {scene.paths.map((path) => (
          <Path key={path.key} d={path.d} fill={path.fill} opacity={path.opacity} />
        ))}
      </Svg>
    </View>
  );
}
