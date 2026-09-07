import React from "react";
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import type { FocusStyle } from "../../types";
import { hapticLight } from "../../lib/haptics";
import { NEU, NEU_FONTS } from "../../theme/neumorphism";

const MODE_COPY: Record<
  FocusStyle,
  { title: string; behavior: string; accessibilityLabel: string }
> = {
  interval: {
    title: "Intervals",
    behavior: "Countdown",
    accessibilityLabel: "Intervals, countdown with automatic breaks",
  },
  flowtime: {
    title: "Flowtime",
    behavior: "Count up",
    accessibilityLabel: "Flowtime, open-ended count up",
  },
};

interface FocusModeSwitchProps {
  value: FocusStyle;
  onChange: (value: FocusStyle) => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * Flat, two-line focus-mode selector. The behavior label is intentionally
 * always visible so the two timer models are distinguishable before selection.
 */
export function FocusModeSwitch({
  value,
  onChange,
  style,
}: FocusModeSwitchProps) {
  return (
    <View style={[styles.row, style]}>
      {(["interval", "flowtime"] as const).map((option) => {
        const selected = value === option;
        const copy = MODE_COPY[option];

        return (
          <Pressable
            key={option}
            onPress={() => {
              if (!selected) {
                onChange(option);
                hapticLight();
              }
            }}
            accessibilityRole="button"
            accessibilityLabel={copy.accessibilityLabel}
            accessibilityState={{ selected }}
            style={({ pressed }) => [
              styles.touch,
              { opacity: pressed ? 0.72 : 1 },
            ]}
          >
            <View
              pointerEvents="none"
              style={[styles.option, selected && styles.optionSelected]}
            >
              <Text style={[styles.title, selected && styles.textSelected]}>
                {copy.title}
              </Text>
              <Text style={[styles.behavior, selected && styles.detailSelected]}>
                {copy.behavior}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 10,
  },
  touch: {
    flex: 1,
    minHeight: 64,
  },
  option: {
    flex: 1,
    minHeight: 64,
    borderRadius: NEU.radiusSmall,
    borderWidth: 1,
    borderColor: NEU.track,
    backgroundColor: NEU.card,
    alignItems: "flex-start",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  optionSelected: {
    borderColor: NEU.accent,
    backgroundColor: NEU.accent,
  },
  title: {
    color: NEU.textPrimary,
    fontSize: 16,
    fontFamily: NEU_FONTS.label,
  },
  behavior: {
    color: NEU.textSecondary,
    fontSize: 13,
    fontFamily: NEU_FONTS.body,
    marginTop: 2,
  },
  textSelected: {
    color: "#FFFFFF",
  },
  detailSelected: {
    color: "rgba(255,255,255,0.84)",
  },
});
