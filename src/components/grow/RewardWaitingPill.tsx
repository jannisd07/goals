/**
 * The line on Home that makes sure no reward is ever forgotten.
 *
 * A finished session always earns an object. If the player tapped "Later", or a
 * check-in ended while the phone was in a pocket, the reward waits — and without
 * a sign on Home the only way back to it would be luck. So it says so, and one
 * tap opens it.
 *
 * It also reports what the app placed on its own after a reward had waited too
 * long (src/lib/growDelivery.ts), because something appearing on the island
 * unannounced is worse than a short note.
 */

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { GrowObjectArt } from "./GrowObjectArt";
import { PAPER } from "../../theme/paper";
import { NEU_FONTS } from "../../theme/neumorphism";
import { GROW_OBJECTS, type GrowCategory } from "../../lib/growRewards";

export interface DeliveredNote {
  goalName: string;
  category: GrowCategory;
  objectKey: string;
  isNew: boolean;
}

function objectName(category: GrowCategory, objectKey: string): string {
  return GROW_OBJECTS[category].find((object) => object.key === objectKey)?.name ?? "object";
}

export function RewardWaitingPill({
  waiting,
  delivered,
  onOpen,
  onDismiss,
}: {
  /** How many rewards are waiting to be placed. */
  waiting: number;
  /** What the app placed by itself since this app start. */
  delivered: readonly DeliveredNote[];
  onOpen: () => void;
  onDismiss: () => void;
}) {
  // News first: something already changed on the island and the player should
  // hear it from us, not discover it.
  if (delivered.length > 0) {
    const first = delivered[0];
    const name = objectName(first.category, first.objectKey);
    const label =
      delivered.length === 1
        ? `${first.isNew ? "A new" : "Your"} ${name.toLowerCase()} grew while you were away`
        : `${delivered.length} rewards grew while you were away`;
    return (
      <Pressable
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel={`${label}. Tap to dismiss.`}
        style={({ pressed }) => [styles.touch, { opacity: pressed ? 0.85 : 1 }]}
      >
        <View style={styles.pill}>
          <GrowObjectArt category={first.category} objectKey={first.objectKey} size={28} />
          <Text style={styles.text} numberOfLines={1}>
            {label}
          </Text>
          <Text style={styles.dismiss}>Got it</Text>
        </View>
      </Pressable>
    );
  }

  if (waiting <= 0) return null;

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={
        waiting === 1 ? "One reward is waiting. Tap to place it." : `${waiting} rewards are waiting. Tap to place them.`
      }
      style={({ pressed }) => [styles.touch, { opacity: pressed ? 0.85 : 1 }]}
    >
      <View style={styles.pill}>
        <View style={styles.dot} />
        <Text style={styles.text} numberOfLines={1}>
          {waiting === 1 ? "A reward is waiting for your island" : `${waiting} rewards are waiting`}
        </Text>
        <Text style={styles.action}>Place</Text>
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
  dot: { width: 9, height: 9, borderRadius: 999, backgroundColor: PAPER.accent },
  text: { flex: 1, color: PAPER.ink, fontSize: 14, fontFamily: NEU_FONTS.body },
  action: { color: PAPER.accentInk, fontSize: 14, fontFamily: NEU_FONTS.label },
  dismiss: { color: PAPER.inkMuted, fontSize: 14, fontFamily: NEU_FONTS.label },
});
