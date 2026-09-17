/**
 * How far the island is from its next size, on Home, all the time.
 *
 * The counterpart to "Island too small". That limit was the only thing the app
 * ever said about island size — a wall you run into without ever being told how
 * close you are to it. This is the other half: the same number, read forwards.
 *
 * Deliberately small and see-through. It sits over the island, and the island is
 * the thing it is talking about; a solid card here would hide what it advertises.
 */

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { islandRoman, type IslandGrowth } from "../../lib/islandScene";
import { NEU_FONTS } from "../../theme/neumorphism";
import { PAPER } from "../../theme/paper";

export function IslandProgressPill({
  growth,
  onArrange,
}: {
  growth: IslandGrowth;
  /** Opens the rearrange mode. Only offered once something stands there. */
  onArrange?: () => void;
}) {
  /**
   * Past the last island size the bar stops measuring the next size — there is
   * none — and starts measuring the collection: every object, every copy, at
   * full size. Without that the pill read "fully grown" from the moment the
   * island last grew, with hundreds of levels still to collect and nothing left
   * to work towards.
   */
  const last = growth.toNext === null;
  const roman = islandRoman(growth.stage);
  const label = growth.complete
    ? `Island ${roman} · complete`
    : last
      ? `Island ${roman} · ${growth.toFinish} to finish`
      : `Island ${roman} · ${growth.toNext} to grow`;
  const progress = last ? growth.completion : growth.ratio;
  const spoken = growth.complete
    ? "Your island is complete, every object fully grown"
    : last
      ? `Largest island, ${growth.toFinish} more levels until everything is fully grown`
      : `Island size ${growth.stage}, ${growth.toNext} more levels to the next size`;

  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={spoken}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
    >
      <View style={styles.pill}>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
        <View style={styles.track}>
          <View
            style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]}
            pointerEvents="none"
          />
        </View>
      </View>
      {/*
        Moving things around lives next to the thing it moves. The island has no
        other controls on it, and a button buried in Settings is a button nobody
        finds.
      */}
      {onArrange ? (
        <Pressable
          onPress={onArrange}
          accessibilityRole="button"
          accessibilityLabel="Rearrange your island"
          style={({ pressed }) => [styles.arrangeTouch, { opacity: pressed ? 0.6 : 1 }]}
        >
          <View style={styles.arrange}>
            <Text style={styles.arrangeText}>Arrange</Text>
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 10 },
  arrangeTouch: { minHeight: 44, justifyContent: "center" },
  arrange: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: PAPER.onIslandScrim,
  },
  arrangeText: {
    fontFamily: NEU_FONTS.label,
    fontSize: 12,
    letterSpacing: 0.3,
    color: "#FFFFFF",
  },
  pill: {
    minWidth: 178,
    paddingHorizontal: 14,
    paddingTop: 7,
    paddingBottom: 8,
    borderRadius: 999,
    backgroundColor: PAPER.onIslandScrim,
    alignItems: "center",
  },
  label: {
    fontFamily: NEU_FONTS.label,
    fontSize: 12,
    letterSpacing: 0.3,
    color: PAPER.onIslandInk,
  },
  track: {
    marginTop: 5,
    width: "100%",
    minWidth: 150,
    height: 3,
    borderRadius: 999,
    backgroundColor: PAPER.onIslandTrack,
    overflow: "hidden",
  },
  fill: { height: 3, borderRadius: 999, backgroundColor: PAPER.onIslandInk },
});
