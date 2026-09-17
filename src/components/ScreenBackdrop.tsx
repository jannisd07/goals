/**
 * Shared ocean backdrop for every screen except Home, which paints its own
 * island artwork.
 *
 * `tall` uses the long artwork for scrolling pages such as Settings: it is
 * scaled to the screen width and simply cropped at the bottom, never zoomed.
 * Short pages use the regular artwork.
 *
 * Text-heavy pages pass a `scrim`: a vertical dark-to-clear wash over the water.
 * Without it white copy sits on bright, moving highlights and stops being
 * readable. It is drawn with SVG so no gradient package is needed.
 */

import React from "react";
import { Image, StyleSheet, useWindowDimensions, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

const OCEAN = require("../../assets/home/ocean-bg.png");
const OCEAN_TALL = require("../../assets/home/ocean-tall.png");

/** Aspect ratios of the two source images (width / height). */
const TALL_RATIO = 724 / 2172;

/** Deep blue taken from the artwork's horizon, so the wash reads as depth. */
const SCRIM_COLOR = "#0A4A78";

const styles = StyleSheet.create({
  fill: { width: "100%", height: "100%" },
  scrollLayer: { position: "absolute", top: 0, left: 0, right: 0 },
});

/**
 * Vertical wash that darkens the water where copy sits.
 *
 * Darkest at both edges and lightest in the middle: headers sit at the top and
 * footer actions at the bottom, while the centre stays open so the artwork is
 * still visible. `strength` is the opacity at those edges.
 */
export function Scrim({ strength = 0.45 }: { strength?: number }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="scrimGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={SCRIM_COLOR} stopOpacity={strength} />
            <Stop offset="0.18" stopColor={SCRIM_COLOR} stopOpacity={strength * 0.82} />
            <Stop offset="0.48" stopColor={SCRIM_COLOR} stopOpacity={strength * 0.55} />
            <Stop offset="0.75" stopColor={SCRIM_COLOR} stopOpacity={strength * 0.72} />
            <Stop offset="1" stopColor={SCRIM_COLOR} stopOpacity={strength * 0.95} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#scrimGrad)" />
      </Svg>
    </View>
  );
}

/**
 * Backdrop that spans an exact height, for use *inside* a ScrollView so it
 * scrolls with the content instead of staying put.
 */
export function ScrollBackdrop({
  height,
  scrim = 0,
}: {
  height: number;
  scrim?: number;
}) {
  if (height <= 0) return null;
  return (
    <View style={[styles.scrollLayer, { height }]} pointerEvents="none">
      <Image source={OCEAN_TALL} style={{ width: "100%", height }} resizeMode="cover" />
      {scrim > 0 ? <Scrim strength={scrim} /> : null}
    </View>
  );
}

export function ScreenBackdrop({
  tall = false,
  scrim = 0,
}: {
  tall?: boolean;
  scrim?: number;
}) {
  const { width, height } = useWindowDimensions();

  if (!tall) {
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Image source={OCEAN} style={styles.fill} resizeMode="cover" />
        {scrim > 0 ? <Scrim strength={scrim} /> : null}
      </View>
    );
  }

  // Width-locked so the artwork keeps its scale; whatever exceeds the screen is
  // cropped rather than shrunk.
  const scaledHeight = width / TALL_RATIO;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Image
        source={OCEAN_TALL}
        style={{ width, height: Math.max(scaledHeight, height) }}
        resizeMode="cover"
      />
      {scrim > 0 ? <Scrim strength={scrim} /> : null}
    </View>
  );
}
