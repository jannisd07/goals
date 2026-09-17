/**
 * The moment the island grows.
 *
 * Reaching the next island size is what all the collecting works towards, and
 * until now it happened between two frames: the background swapped, every object
 * jumped to a new pixel, and a player could miss it completely. This makes it an
 * event — the old island fades out over the new one, then it is said out loud
 * which size was reached and how wide the island now is.
 *
 * Shown once per size. `markIslandStageSeen` in the island slice remembers it,
 * and it only ever counts forwards, so an island merged in from another phone
 * cannot announce a size the player was already shown.
 *
 * With reduced motion the fade is skipped and the card appears straight away.
 * It is never a blocker: the button dismisses it, and so does the backdrop.
 */

import React, { useEffect } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { HOME_ISLAND_STAGES } from "../../lib/homeIslandStages";
import { hapticSuccess } from "../../lib/haptics";
import { ISLAND_STAGE_METRES } from "../../lib/islandScene";
import { NEU_FONTS } from "../../theme/neumorphism";
import { PAPER } from "../../theme/paper";

/** How long the old island stays over the new one. */
const FADE_MS = 900;

/** Indexed by island size, so size 2 reads "second". Size 1 is never announced. */
const ORDINALS = ["first", "second", "third", "fourth", "fifth"];

interface Props {
  /** The size that was left behind, for the picture that fades out. */
  from: number;
  /** The size that was just reached. */
  to: number;
  /** The transform the island background is drawn with, so the fade lines up. */
  transform?: object;
  onDone: () => void;
}

export function IslandGrewOverlay({ from, to, transform, onDone }: Props) {
  const reduceMotion = useReducedMotion();
  const cover = useSharedValue(reduceMotion ? 0 : 1);
  const card = useSharedValue(0);

  useEffect(() => {
    hapticSuccess();
    if (reduceMotion) {
      card.value = 1;
      return;
    }
    // The old island holds for a beat, then gives way — long enough to notice
    // that something changed underneath, short enough not to feel like a wait.
    cover.value = withDelay(
      260,
      withTiming(0, { duration: FADE_MS, easing: Easing.inOut(Easing.quad) }),
    );
    card.value = withDelay(FADE_MS * 0.7, withTiming(1, { duration: 320 }));
  }, [cover, card, reduceMotion]);

  const coverStyle = useAnimatedStyle(() => ({ opacity: cover.value }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: card.value,
    transform: [{ scale: 0.94 + card.value * 0.06 }],
  }));

  const previous = HOME_ISLAND_STAGES[from - 1];
  const metres = ISLAND_STAGE_METRES[to - 1] ?? ISLAND_STAGE_METRES[ISLAND_STAGE_METRES.length - 1];
  const ordinal = ORDINALS[Math.max(0, Math.min(ORDINALS.length - 1, to - 1))];

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {previous && !reduceMotion ? (
        <Animated.View
          style={[StyleSheet.absoluteFill, transform, coverStyle]}
          pointerEvents="none"
        >
          <Image source={previous.background} style={styles.previous} resizeMode="cover" />
        </Animated.View>
      ) : null}

      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, cardStyle]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onDone}
        />
        <Animated.View
          entering={reduceMotion ? undefined : FadeIn.duration(300)}
          style={styles.card}
          accessibilityRole="alert"
        >
          <Text style={styles.eyebrow}>YOUR ISLAND GREW</Text>
          <Text style={styles.headline} accessibilityRole="header">
            {to >= HOME_ISLAND_STAGES.length ? "The full island" : `The ${ordinal} island`}
          </Text>
          <Text style={styles.line}>
            {`It is about ${metres} m across now — more room on the meadow, and a wider beach.`}
          </Text>
          <Pressable
            onPress={onDone}
            accessibilityRole="button"
            accessibilityLabel="Have a look"
            style={({ pressed }) => [styles.cta, { transform: [{ scale: pressed ? 0.98 : 1 }] }]}
          >
            <Text style={styles.ctaText}>Have a look</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

/** A soft pulse for the moment the island appears at its new size. */
export function useIslandGrowPulse(active: boolean) {
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (!active || reduceMotion) return;
    pulse.value = withSequence(
      withTiming(1.035, { duration: 420, easing: Easing.out(Easing.quad) }),
      withSpring(1, { damping: 12, stiffness: 120 }),
    );
  }, [active, pulse, reduceMotion]);
  return useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
}

const styles = StyleSheet.create({
  previous: { width: "100%", height: "100%" },
  backdrop: {
    backgroundColor: PAPER.onIslandVeil,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 20,
    backgroundColor: PAPER.surface,
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 20,
  },
  eyebrow: {
    fontFamily: NEU_FONTS.label,
    fontSize: 12,
    letterSpacing: 1.4,
    color: PAPER.accent,
  },
  headline: {
    fontFamily: NEU_FONTS.heading,
    fontSize: 26,
    color: PAPER.ink,
    marginTop: 6,
  },
  line: {
    fontFamily: NEU_FONTS.body,
    fontSize: 16,
    lineHeight: 23,
    color: PAPER.inkMuted,
    marginTop: 10,
  },
  cta: {
    marginTop: 20,
    height: 50,
    borderRadius: 14,
    backgroundColor: PAPER.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: { fontFamily: NEU_FONTS.label, fontSize: 17, color: "#FFFFFF" },
});
