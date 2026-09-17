/**
 * Building blocks for the paper light mode (Stats, Friends, Settings).
 *
 * Deliberately small: a page frame, one header, one card, one section label and
 * one list row. Everything on those three screens is built from these, so the
 * spacing rhythm stays the same across all of them without each screen
 * inventing its own numbers.
 */

import React from "react";
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PAPER } from "../../theme/paper";
import { NEU_FONTS } from "../../theme/neumorphism";

/**
 * Opaque page root. `edges` is empty by default so content runs to the device
 * edges and no reserved strip appears at the bottom.
 */
export function PaperScreen({
  children,
  edges = [],
}: {
  children: React.ReactNode;
  edges?: ("top" | "bottom" | "left" | "right")[];
}) {
  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      {children}
    </SafeAreaView>
  );
}

/**
 * The single header shape for all three screens: centred title, Close on the
 * right, and a matching invisible block on the left so the title stays
 * optically centred.
 */
export function PaperHeader({
  title,
  onClose,
  closeLabel = "Close",
}: {
  title: string;
  onClose: () => void;
  closeLabel?: string;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerSide} />
      <Text style={styles.headerTitle} accessibilityRole="header">
        {title}
      </Text>
      <View style={[styles.headerSide, styles.headerSideRight]}>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
          hitSlop={12}
          style={({ pressed }) => [styles.closeTouch, { opacity: pressed ? 0.5 : 1 }]}
        >
          <Text style={styles.closeLabel}>{closeLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Small uppercase label that names the block below it. */
export function PaperLabel({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.labelWrap, style]}>
      <Text style={styles.label}>{children}</Text>
    </View>
  );
}

/**
 * Flat white surface with a hairline outline. No shadow — depth comes from the
 * page tint behind it.
 */
export function PaperCard({
  children,
  style,
  padding = 16,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: number;
}) {
  return <View style={[styles.card, { padding }, style]}>{children}</View>;
}

/**
 * Row inside a `PaperCard` group. Rows carry their own top hairline instead of
 * a separate divider element, so a group is just rows stacked together.
 */
export function PaperRow({
  children,
  first = false,
  style,
}: {
  children: React.ReactNode;
  first?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.row, !first && styles.rowDivided, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: PAPER.page,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: PAPER.gutter,
    paddingTop: 14,
    paddingBottom: 10,
  },
  headerSide: {
    width: 72,
  },
  headerSideRight: {
    alignItems: "flex-end",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    color: PAPER.ink,
    fontSize: 17,
    fontFamily: NEU_FONTS.label,
  },
  closeTouch: {
    minHeight: PAPER.hitTarget,
    justifyContent: "center",
  },
  closeLabel: {
    color: PAPER.accentInk,
    fontSize: 16,
    fontFamily: NEU_FONTS.label,
  },
  labelWrap: {
    paddingHorizontal: PAPER.gutter + 4,
    marginTop: 26,
    marginBottom: 10,
  },
  label: {
    color: PAPER.inkFaint,
    fontSize: 11,
    fontFamily: NEU_FONTS.label,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  card: {
    marginHorizontal: PAPER.gutter,
    backgroundColor: PAPER.surface,
    borderRadius: PAPER.radius,
    borderWidth: 1,
    borderColor: PAPER.line,
  },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: PAPER.hitTarget,
    justifyContent: "center",
  },
  rowDivided: {
    borderTopWidth: 1,
    borderTopColor: PAPER.line,
  },
});
