import React, { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";

interface ProgressBarProps {
  progress: number;
  color?: string;
  height?: number;
  trackColor?: string;
}

export function ProgressBar({
  progress,
  color = "#000000",
  height = 4,
  trackColor = "#E8E8E8",
}: ProgressBarProps) {
  const reveal = useSharedValue(0);
  const clampedProgress = Math.min(1, Math.max(0, progress));

  useEffect(() => {
    reveal.value = withTiming(clampedProgress, {
      duration: 800,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    });
  }, [clampedProgress, reveal]);

  // The fill is drawn statically at full width (percentage-vs-static-parent, always reliable).
  // Progress is revealed by animating a solid mask that covers the un-filled portion — animating
  // a plain View's width works reliably with Reanimated; animating an SVG's own percentage width
  // against a Reanimated-driven ancestor does not (the SVG can get stuck at its initial 0-width layout).
  const maskStyle = useAnimatedStyle(() => ({
    width: `${(1 - reveal.value) * 100}%`,
  }));

  return (
    <View
      style={{
        width: "100%",
        height,
        borderRadius: height / 2,
        backgroundColor: trackColor,
        overflow: "hidden",
      }}
    >
      <View style={{ width: "100%", height, backgroundColor: color }} />
      <Animated.View
        style={[
          { position: "absolute", top: 0, right: 0, height, backgroundColor: trackColor },
          maskStyle,
        ]}
      />
    </View>
  );
}
