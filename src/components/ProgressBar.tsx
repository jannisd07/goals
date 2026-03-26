import React, { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { ACCENT_COLORS, type AccentColor } from "../types";

interface ProgressBarProps {
  progress: number;
  color: AccentColor;
  height?: number;
}

export function ProgressBar({ progress, color, height = 4 }: ProgressBarProps) {
  const width = useSharedValue(0);
  const clampedProgress = Math.min(1, Math.max(0, progress));

  useEffect(() => {
    width.value = withTiming(clampedProgress, {
      duration: 800,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    });
  }, [clampedProgress, width]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${width.value * 100}%`,
    backgroundColor: ACCENT_COLORS[color],
    height,
    borderRadius: height / 2,
  }));

  return (
    <View
      className="w-full bg-white/[0.08] overflow-hidden"
      style={{ height, borderRadius: height / 2 }}
    >
      <Animated.View style={animatedStyle} />
    </View>
  );
}
