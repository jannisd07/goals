import React from "react";
import { StyleSheet, View } from "react-native";
import { NEU } from "../theme/neumorphism";

export function AtmosphericBackground() {
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.background]}
    />
  );
}

const styles = StyleSheet.create({
  background: {
    backgroundColor: NEU.bg,
  },
});
