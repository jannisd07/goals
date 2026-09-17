/**
 * The line on Home that says when a permission has quietly stopped the app
 * from doing its job.
 *
 * Both warnings were already being computed on every Home refresh and written
 * into the store — and then never rendered anywhere. A player who revoked
 * "Location Always" (or was asked once and said no) would see Auto Check-In
 * simply stop working, with the app cheerfully showing 0 visits and no reason.
 *
 * Auto Check-In comes first when both are missing: notifications only delay the
 * news, while a missing location permission means nothing is recorded at all.
 */

import React from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { PAPER } from "../theme/paper";
import { NEU_FONTS } from "../theme/neumorphism";

export function PermissionWarningPill({
  autoCheckInWarning,
  notificationWarning,
}: {
  autoCheckInWarning: string | null;
  notificationWarning: string | null;
}) {
  const problem = autoCheckInWarning
    ? {
        label: "Auto Check-In can’t run — location access is off",
        hint: autoCheckInWarning,
      }
    : notificationWarning
      ? {
          label: "Notifications are off — you won’t hear about sessions",
          hint: notificationWarning,
        }
      : null;

  if (!problem) return null;

  return (
    <Pressable
      onPress={() => void Linking.openSettings()}
      accessibilityRole="button"
      accessibilityLabel={`${problem.hint} Opens the system settings.`}
      style={({ pressed }) => [styles.touch, { opacity: pressed ? 0.85 : 1 }]}
    >
      <View style={styles.pill}>
        <View style={styles.dot} />
        <Text style={styles.text} numberOfLines={2}>
          {problem.label}
        </Text>
        <Text style={styles.action}>Fix</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  touch: { marginHorizontal: 20, marginTop: 10, minHeight: 44, justifyContent: "center" },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  // Monochrome, like every other warning in the app: the ring reads as
  // "unfinished" without inventing an alert colour.
  dot: {
    width: 9,
    height: 9,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: PAPER.ink,
  },
  text: { flex: 1, color: PAPER.ink, fontSize: 14, fontFamily: NEU_FONTS.body },
  action: { color: PAPER.accentInk, fontSize: 14, fontFamily: NEU_FONTS.label },
});
