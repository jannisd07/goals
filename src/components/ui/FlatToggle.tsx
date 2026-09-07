import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { NEU } from "../../theme/neumorphism";

interface FlatToggleProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  accessibilityLabel: string;
  disabled?: boolean;
}

/**
 * Flat native-style switch. State is communicated by accent color and thumb
 * position only; the control intentionally has no raised or inset shadows.
 */
export function FlatToggle({
  value,
  onValueChange,
  accessibilityLabel,
  disabled = false,
}: FlatToggleProps) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      style={({ pressed }) => [
        styles.hitTarget,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <View style={[styles.track, value && styles.trackActive]}>
        <View style={[styles.thumb, { left: value ? 24 : 4 }]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hitTarget: {
    width: 60,
    minHeight: NEU.hitTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  track: {
    width: 52,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: NEU.dark,
    backgroundColor: NEU.track,
  },
  trackActive: {
    borderColor: NEU.accent,
    backgroundColor: NEU.accent,
  },
  thumb: {
    position: "absolute",
    top: 3,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
  },
  pressed: {
    opacity: 0.72,
  },
  disabled: {
    opacity: 0.4,
  },
});
