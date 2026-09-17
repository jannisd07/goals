/**
 * The object that grows while a focus session runs.
 *
 * It has to say three things without any text:
 * - it keeps growing as long as you keep focusing (a slow, steady scale);
 * - the moment the session has earned another stage, the object visibly steps
 *   up — the new picture takes over from the old one with a short pop and a
 *   handful of sparks, so the step is a moment and not a silent swap;
 * - nothing is growing right now — on a break or while paused it dims, because
 *   the focused seconds are what feed it.
 *
 * Catching up after the app was in the background can skip several stages at
 * once. That is not a moment the player lived through, so it swaps quietly.
 */

import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { GrowObjectArt } from "./GrowObjectArt";
import { hapticLight } from "../../lib/haptics";
import { PAPER } from "../../theme/paper";
import type { GrowCategory } from "../../lib/growRewards";

/** How long the new stage takes over from the old one. */
const SWAP_MS = 380;
/** The sparks of one step. */
const SPARK_MS = 720;
const SPARK_ANGLES = [18, 74, 130, 198, 262, 322];

function Spark({
  angle,
  progress,
  distance,
}: {
  angle: number;
  progress: SharedValue<number>;
  distance: number;
}) {
  const radians = (angle * Math.PI) / 180;
  const style = useAnimatedStyle(() => {
    const t = progress.value;
    const reach = distance * (0.35 + 0.65 * t);
    return {
      opacity: t <= 0 || t >= 1 ? 0 : t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8,
      transform: [
        { translateX: Math.cos(radians) * reach },
        { translateY: -Math.sin(radians) * reach },
        { scale: 1 - 0.35 * t },
      ],
    };
  });
  return <Animated.View pointerEvents="none" style={[styles.spark, style]} />;
}

export function GrowingObject({
  category,
  objectKey,
  level,
  scale,
  resting,
  size,
}: {
  category: GrowCategory;
  objectKey: string;
  /** The stage this session would leave on the island right now. */
  level: number;
  /** 0.3 to 1: how far the session has come, from `liveGrowth`. */
  scale: number;
  /** On a break or paused — nothing is growing. */
  resting: boolean;
  size: number;
}) {
  const reduceMotion = useReducedMotion();
  const grow = useSharedValue(scale);
  const pop = useSharedValue(0);
  const burst = useSharedValue(0);
  const swap = useSharedValue(1);
  const dim = useSharedValue(resting ? 1 : 0);
  // The stage that is fading out, while the new one fades in over it.
  const [trail, setTrail] = useState<{ key: string; level: number } | null>(null);
  const last = useRef({ key: objectKey, level });

  useEffect(() => {
    grow.value = withTiming(scale, {
      duration: reduceMotion ? 0 : 1600,
      easing: Easing.out(Easing.cubic),
    });
  }, [grow, reduceMotion, scale]);

  useEffect(() => {
    dim.value = withTiming(resting ? 1 : 0, { duration: reduceMotion ? 0 : 320 });
  }, [dim, reduceMotion, resting]);

  useEffect(() => {
    const from = last.current;
    last.current = { key: objectKey, level };
    if (from.key === objectKey && from.level === level) return;
    // Only one honest step forward is worth celebrating; a different object or a
    // jump from catching up just changes the picture.
    const stepped = from.key === objectKey && level === from.level + 1;
    if (!stepped || reduceMotion) {
      swap.value = 1;
      setTrail(null);
      return;
    }
    setTrail(from);
    swap.value = 0;
    swap.value = withTiming(1, { duration: SWAP_MS, easing: Easing.out(Easing.quad) });
    pop.value = withSequence(
      withTiming(1, { duration: 170, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 280, easing: Easing.out(Easing.quad) }),
    );
    burst.value = 0;
    burst.value = withTiming(1, { duration: SPARK_MS, easing: Easing.out(Easing.quad) });
    hapticLight();
    const clear = setTimeout(() => setTrail(null), SWAP_MS + 80);
    return () => clearTimeout(clear);
  }, [burst, level, objectKey, pop, reduceMotion, swap]);

  const bodyStyle = useAnimatedStyle(() => ({
    opacity: 1 - 0.45 * dim.value,
    transform: [{ scale: grow.value * (1 + 0.09 * pop.value) }],
  }));
  const freshStyle = useAnimatedStyle(() => ({ opacity: swap.value }));
  const trailStyle = useAnimatedStyle(() => ({ opacity: 1 - swap.value }));

  return (
    <Animated.View style={[{ width: size, height: size }, styles.body, bodyStyle]}>
      {trail ? (
        <Animated.View style={[StyleSheet.absoluteFill, trailStyle]}>
          <GrowObjectArt
            category={category}
            objectKey={trail.key}
            level={trail.level}
            size={size}
          />
        </Animated.View>
      ) : null}
      <Animated.View style={[StyleSheet.absoluteFill, freshStyle]}>
        <GrowObjectArt category={category} objectKey={objectKey} level={level} size={size} />
      </Animated.View>
      {reduceMotion ? null : (
        <View pointerEvents="none" style={styles.sparkStage}>
          {SPARK_ANGLES.map((angle) => (
            <Spark key={angle} angle={angle} progress={burst} distance={size * 0.34} />
          ))}
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  body: { transformOrigin: "bottom" },
  sparkStage: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  spark: {
    position: "absolute",
    width: 4,
    height: 4,
    backgroundColor: PAPER.accent,
  },
});
