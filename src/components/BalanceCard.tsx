import React, { useEffect } from "react";
import { View, Text } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from "react-native-reanimated";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import { GlassCard } from "./GlassCard";
import { useAppStore } from "../store";
import { formatHours } from "../lib/time";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const RING_SIZE = 140;
const RING_STROKE = 5;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function BalanceCard() {
  const disposableTimeHours = useAppStore((s) => s.disposableTimeHours);
  const usedTimeThisWeekSeconds = useAppStore((s) => s.usedTimeThisWeekSeconds);
  const remainingHours = Math.max(0, disposableTimeHours - usedTimeThisWeekSeconds / 3600);
  const consumedFraction = disposableTimeHours > 0
    ? Math.min(1, usedTimeThisWeekSeconds / 3600 / disposableTimeHours)
    : 0;

  const progressAnim = useSharedValue(0);

  useEffect(() => {
    progressAnim.value = withTiming(1 - consumedFraction, {
      duration: 1200,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    });
  }, [consumedFraction, progressAnim]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: RING_CIRCUMFERENCE * (1 - progressAnim.value),
  }));

  const glowPulse = useSharedValue(0.15);

  useEffect(() => {
    glowPulse.value = withRepeat(
      withSequence(
        withTiming(0.25, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.15, { duration: 3000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, [glowPulse]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowPulse.value,
  }));

  return (
    <GlassCard className="mx-screen-x mb-4">
      <View className="items-center py-6">
        <View className="relative items-center justify-center mb-4" style={{ width: RING_SIZE + 40, height: RING_SIZE + 40 }}>
          <Animated.View
            style={[
              {
                position: "absolute",
                width: RING_SIZE + 40,
                height: RING_SIZE + 40,
                borderRadius: (RING_SIZE + 40) / 2,
                backgroundColor: "rgba(255,255,255,0.08)",
              },
              glowStyle,
            ]}
          />
          <Svg width={RING_SIZE} height={RING_SIZE} style={{ transform: [{ rotate: "-90deg" }] }}>
            <Defs>
              <RadialGradient id="ring-glow" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor="white" stopOpacity="0.03" />
                <Stop offset="100%" stopColor="white" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              fill="url(#ring-glow)"
            />
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={RING_STROKE}
              fill="none"
            />
            <AnimatedCircle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              stroke="rgba(255,255,255,0.6)"
              strokeWidth={RING_STROKE}
              fill="none"
              strokeDasharray={`${RING_CIRCUMFERENCE}`}
              strokeLinecap="round"
              animatedProps={animatedProps}
            />
          </Svg>
          <View className="absolute items-center">
            <Text
              className="text-text-primary"
              style={{ fontSize: 52, lineHeight: 60, fontFamily: "Outfit_700Bold", letterSpacing: -1 }}
            >
              {formatHours(remainingHours)}
            </Text>
          </View>
        </View>

        <Text className="text-text-secondary text-body" style={{ fontFamily: "Outfit_400Regular" }}>
          hours left this week
        </Text>
        {disposableTimeHours > 0 && (
          <Text className="text-text-tertiary text-caption mt-1" style={{ fontFamily: "Outfit_400Regular" }}>
            {Math.round(consumedFraction * 100)}% of {formatHours(disposableTimeHours)}h used
          </Text>
        )}
      </View>
    </GlassCard>
  );
}
