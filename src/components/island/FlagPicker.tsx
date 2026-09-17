/**
 * Choosing the flag the island flies.
 *
 * The flagpole is the first landmark you unlock, and until now it flew a plain
 * pennant nobody chose. This is the choice: thirty flags, drawn from the same
 * pixel data the sprite generator uses (`island/pixel/flags.py` writes both), so
 * the swatch here and the cloth on the island can never disagree.
 *
 * Purely cosmetic. Picking a flag changes no level, no footprint and no place.
 */

import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Rect } from "react-native-svg";
import { hapticLight } from "../../lib/haptics";
import {
  FLAG_COLORS,
  FLAG_HEIGHT,
  FLAG_WIDTH,
  ISLAND_FLAGS,
  type IslandFlag,
} from "../../lib/islandFlags";
import { NEU_FONTS } from "../../theme/neumorphism";
import { PAPER } from "../../theme/paper";

const SWATCH_W = 44;
const SWATCH_H = Math.round((SWATCH_W * FLAG_HEIGHT) / FLAG_WIDTH);

/** One flag, drawn a rectangle per run of equal colour rather than per pixel. */
export function FlagSwatch({ flag, width = SWATCH_W }: { flag: IslandFlag; width?: number }) {
  const height = Math.round((width * FLAG_HEIGHT) / FLAG_WIDTH);
  const rects: React.ReactElement[] = [];
  flag.rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      let end = x;
      while (end + 1 < row.length && row[end + 1] === row[x]) end += 1;
      rects.push(
        <Rect
          key={`${y}-${x}`}
          x={x}
          y={y}
          width={end - x + 1 + 0.02}
          height={1.02}
          fill={FLAG_COLORS[row[x]] ?? "#000000"}
        />,
      );
      x = end + 1;
    }
  });
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${FLAG_WIDTH} ${FLAG_HEIGHT}`}>
      {rects}
    </Svg>
  );
}

export function FlagPicker({
  selected,
  onSelect,
}: {
  selected: string | null;
  onSelect: (code: string | null) => void;
}) {
  return (
    <View>
      <Text style={styles.label}>FLAG</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
      >
        {/* The pennant the pole flew before anyone chose: still an option. */}
        <Pressable
          onPress={() => {
            hapticLight();
            onSelect(null);
          }}
          accessibilityRole="button"
          accessibilityLabel="Plain pennant"
          accessibilityState={{ selected: selected === null }}
          style={styles.cellTouch}
        >
          <View style={[styles.cell, selected === null && styles.cellOn]}>
            <View style={styles.pennant} />
          </View>
          <Text style={styles.caption} numberOfLines={1}>
            Pennant
          </Text>
        </Pressable>

        {ISLAND_FLAGS.map((flag) => {
          const on = flag.code === selected;
          return (
            <Pressable
              key={flag.code}
              onPress={() => {
                hapticLight();
                onSelect(flag.code);
              }}
              accessibilityRole="button"
              accessibilityLabel={flag.name}
              accessibilityState={{ selected: on }}
              style={styles.cellTouch}
            >
              <View style={[styles.cell, on && styles.cellOn]}>
                <FlagSwatch flag={flag} />
              </View>
              <Text style={styles.caption} numberOfLines={1}>
                {flag.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontFamily: NEU_FONTS.label,
    fontSize: 11,
    letterSpacing: 1.2,
    color: PAPER.inkMuted,
    marginBottom: 8,
  },
  strip: { gap: 10, paddingRight: 8, paddingBottom: 2 },
  cellTouch: { width: SWATCH_W + 12, alignItems: "center" },
  cell: {
    width: SWATCH_W + 8,
    height: SWATCH_H + 8,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: PAPER.line,
    backgroundColor: PAPER.sunken,
    alignItems: "center",
    justifyContent: "center",
  },
  cellOn: { borderColor: PAPER.accent },
  pennant: { width: SWATCH_W - 12, height: SWATCH_H - 6, backgroundColor: "#D8552F" },
  caption: {
    marginTop: 5,
    fontFamily: NEU_FONTS.body,
    fontSize: 10,
    color: PAPER.inkMuted,
    textAlign: "center",
  },
});
