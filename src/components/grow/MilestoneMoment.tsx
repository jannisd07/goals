/**
 * The moment a landmark arrives on the island.
 *
 * These are the rarest rewards in the app — five hours, then ten, twenty-five,
 * and on up to a thousand — so each one gets the whole screen for a breath
 * instead of a line in a list. The hours are the headline, because the hours are
 * what was earned; the landmark is already standing on the island behind it.
 *
 * It appears over Home rather than as its own route: a celebration should never
 * be something the player has to navigate back out of.
 */

import React, { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
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
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { GrowObjectArt } from "./GrowObjectArt";
import { hapticSuccess } from "../../lib/haptics";
import { PAPER } from "../../theme/paper";
import { NEU_FONTS } from "../../theme/neumorphism";
import type { ArrivedMilestone } from "../../store/islandSlice";

const RAYS = 12;
const SPARKS = [22, 68, 112, 158, 202, 248, 292, 338];

/** A quiet sunburst behind the landmark; it fades in once and then holds. */
function Rays() {
  const wedges = Array.from({ length: RAYS }, (_, index) => {
    const from = (index * 360) / RAYS;
    const to = from + 360 / RAYS / 2;
    const point = (angle: number, radius: number) => {
      const radians = ((angle - 90) * Math.PI) / 180;
      return `${160 + Math.cos(radians) * radius} ${160 + Math.sin(radians) * radius}`;
    };
    return `M160 160 L${point(from, 160)} L${point(to, 160)} Z`;
  });
  return (
    <Svg width={320} height={320} style={styles.rays} pointerEvents="none">
      {wedges.map((d, index) => (
        <Path key={index} d={d} fill={PAPER.accent} opacity={0.07} />
      ))}
    </Svg>
  );
}

function Spark({ angle, progress }: { angle: number; progress: SharedValue<number> }) {
  const radians = (angle * Math.PI) / 180;
  const style = useAnimatedStyle(() => {
    const t = progress.value;
    const reach = 40 + 90 * t;
    return {
      opacity: t <= 0 || t >= 1 ? 0 : t < 0.25 ? t / 0.25 : 1 - (t - 0.25) / 0.75,
      transform: [
        { translateX: Math.cos(radians) * reach },
        { translateY: -Math.sin(radians) * reach },
        { scale: 1 - 0.4 * t },
      ],
    };
  });
  return <Animated.View pointerEvents="none" style={[styles.spark, style]} />;
}

export function MilestoneMoment({
  milestone,
  onDone,
}: {
  milestone: ArrivedMilestone;
  onDone: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(reduceMotion ? 1 : 0.4);
  const lift = useSharedValue(reduceMotion ? 0 : 18);
  const burst = useSharedValue(0);

  useEffect(() => {
    hapticSuccess();
    if (reduceMotion) return;
    scale.value = withSequence(
      withSpring(1.08, { damping: 9, stiffness: 150 }),
      withTiming(1, { duration: 220, easing: Easing.out(Easing.quad) }),
    );
    lift.value = withSpring(0, { damping: 12, stiffness: 120 });
    burst.value = withDelay(140, withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) }));
  }, [burst, lift, reduceMotion, scale]);

  const artStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: lift.value }],
  }));

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeIn.duration(260)}
      style={StyleSheet.absoluteFill}
    >
      <View style={styles.sheet}>
        <Text style={styles.eyebrow}>{`${milestone.hours} HOURS`}</Text>
        <View style={styles.stage}>
          {reduceMotion ? null : <Rays />}
          <Animated.View style={artStyle}>
            <GrowObjectArt
              category="building"
              objectKey={milestone.objectKey}
              level={milestone.tier}
              size={190}
            />
          </Animated.View>
          {reduceMotion
            ? null
            : SPARKS.map((angle) => <Spark key={angle} angle={angle} progress={burst} />)}
        </View>
        <Text style={styles.title} accessibilityRole="header">
          {milestone.title}
        </Text>
        <Text style={styles.description}>{milestone.description}</Text>
        <Text style={styles.note}>It is already standing on your island.</Text>

        <Pressable
          onPress={onDone}
          accessibilityRole="button"
          accessibilityLabel="See it on the island"
          style={({ pressed }) => [styles.ctaTouch, { transform: [{ scale: pressed ? 0.98 : 1 }] }]}
        >
          <View style={styles.cta}>
            <Text style={styles.ctaText}>See it on my island</Text>
          </View>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: PAPER.page,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  eyebrow: {
    color: PAPER.accentInk,
    fontSize: 13,
    letterSpacing: 1.6,
    fontFamily: NEU_FONTS.label,
    marginBottom: 6,
  },
  stage: { width: 320, height: 320, alignItems: "center", justifyContent: "center" },
  rays: { position: "absolute" },
  spark: { position: "absolute", width: 6, height: 6, backgroundColor: PAPER.accent },
  title: {
    color: PAPER.ink,
    fontSize: 30,
    fontFamily: NEU_FONTS.heading,
    textAlign: "center",
    marginTop: 4,
  },
  description: {
    color: PAPER.inkMuted,
    fontSize: 16,
    lineHeight: 23,
    fontFamily: NEU_FONTS.body,
    textAlign: "center",
    marginTop: 10,
  },
  note: {
    color: PAPER.inkMuted,
    fontSize: 13,
    fontFamily: NEU_FONTS.body,
    textAlign: "center",
    marginTop: 18,
  },
  ctaTouch: { position: "absolute", left: 28, right: 28, bottom: 42 },
  cta: {
    minHeight: 56,
    borderRadius: PAPER.radius,
    backgroundColor: PAPER.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: { color: "#FFFFFF", fontSize: 17, fontFamily: NEU_FONTS.label },
});
