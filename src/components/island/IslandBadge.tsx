/**
 * A friend's island, small.
 *
 * The friends list used to be hours and nothing else, while the island — the
 * thing every session actually builds — was invisible to anyone but its owner.
 * This is the smallest honest version of showing it: the island at the size that
 * friend has grown it to.
 *
 * It is the real artwork, not an icon: the same five pictures Home uses, cropped
 * to the island. Nothing of what stands on the island is shown, and nothing of
 * it leaves the account — only the size travels (`get_friends_weekly`).
 */

import React from "react";
import { Image, StyleSheet, View } from "react-native";
import { HOME_ISLAND_STAGES } from "../../lib/homeIslandStages";
import { ISLAND_STAGE_METRES } from "../../lib/islandScene";
import { PAPER } from "../../theme/paper";

/**
 * The island sits in the middle of its picture and always fills the same share
 * of it, whatever the size — the camera steps back as the island grows, so all
 * five pictures show an island of the same width. These two numbers say where
 * to cut: how much of the width to keep, and how far down the island's middle
 * sits.
 */
const CROP_WIDTH = 0.96;
const CROP_CENTRE_Y = 0.53;
/** Every stage picture is this wide; the height varies by a couple of pixels. */
const ART_WIDTH = 1320;
const ART_HEIGHT = 2868;

/**
 * Because every picture shows its island at the same width, the picture alone
 * cannot say whose island is bigger — and that is the one thing this badge is
 * here for. So the badge itself grows instead: its side follows the island's
 * real width in metres, from twelve to thirty-three. Side by side in a list, a
 * friend three sizes ahead is visibly ahead.
 */
export function badgeSize(stage: number, largest: number): number {
  const metres = ISLAND_STAGE_METRES;
  const index = Math.max(1, Math.min(metres.length, Math.round(stage))) - 1;
  const smallest = largest * 0.68;
  const span = metres[metres.length - 1] - metres[0];
  return Math.round(smallest + ((metres[index] - metres[0]) / span) * (largest - smallest));
}

export function IslandBadge({ stage, largest = 56 }: { stage: number; largest?: number }) {
  const index = Math.max(1, Math.min(HOME_ISLAND_STAGES.length, Math.round(stage))) - 1;
  const size = badgeSize(stage, largest);
  // Shown at the scale that makes the kept slice exactly as wide as the badge.
  const scale = size / (ART_WIDTH * CROP_WIDTH);
  const width = ART_WIDTH * scale;
  const height = ART_HEIGHT * scale;
  return (
    <View style={[styles.frame, { width: size, height: size, borderRadius: size / 4 }]}>
      <Image
        source={HOME_ISLAND_STAGES[index].background}
        style={{
          position: "absolute",
          width,
          height,
          left: size / 2 - width / 2,
          top: size / 2 - height * CROP_CENTRE_Y,
        }}
        // The artwork is pixel art: keep it crisp rather than smoothing it.
        resizeMode="cover"
        fadeDuration={0}
        accessible={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: "hidden",
    backgroundColor: PAPER.sunken,
  },
});
