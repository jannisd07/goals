import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { PAPER } from "../../theme/paper";

interface PopupCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function PopupCard({ children, style }: PopupCardProps) {
  return (
    <View style={[styles.card, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    maxWidth: 420,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 24,
    borderRadius: PAPER.radiusLg,
    backgroundColor: PAPER.surface,
  },
});
