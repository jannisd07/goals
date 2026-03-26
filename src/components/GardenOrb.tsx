import React, { useEffect } from "react";
import { Pressable } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  Easing,
} from "react-native-reanimated";
import Svg, { Circle, Polygon, Defs, RadialGradient, Stop, Line } from "react-native-svg";
import { ACCENT_COLORS } from "../types";
import type { GrowthOrb } from "../types";

function computeOrbSize(stage: number): number {
  switch (stage) {
    case 0: return 8;
    case 1: return 16;
    case 2: return 28;
    case 3: return 42;
    case 4: return 58;
    default: return 58;
  }
}

function computeOrbOpacity(stage: number): number {
  switch (stage) {
    case 0: return 0.3;
    case 1: return 0.5;
    case 2: return 0.65;
    case 3: return 0.8;
    case 4: return 1.0;
    default: return 1.0;
  }
}

function hexPoints(cx: number, cy: number, r: number, sides: number): string {
  const points: string[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = (Math.PI * 2 * i) / sides - Math.PI / 2;
    points.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
  }
  return points.join(" ");
}

interface Stage3ShapeProps {
  size: number;
  color: string;
  gradientId: string;
}

function Stage3Shape({ size, color, gradientId }: Stage3ShapeProps) {
  const cx = size;
  const cy = size;
  return (
    <Svg width={size * 2} height={size * 2}>
      <Defs>
        <RadialGradient id={gradientId} cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={color} stopOpacity="0.95" />
          <Stop offset="50%" stopColor={color} stopOpacity="0.35" />
          <Stop offset="100%" stopColor={color} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Circle cx={cx} cy={cy} r={size} fill={`url(#${gradientId})`} />
      <Polygon
        points={hexPoints(cx, cy, size * 0.7, 6)}
        fill="none"
        stroke={color}
        strokeWidth={1.2}
        strokeOpacity={0.5}
      />
      <Polygon
        points={hexPoints(cx, cy, size * 0.45, 6)}
        fill={color}
        fillOpacity={0.25}
        stroke={color}
        strokeWidth={0.8}
        strokeOpacity={0.3}
      />
      <Circle cx={cx} cy={cy} r={size * 0.2} fill={color} opacity={0.6} />
    </Svg>
  );
}

interface Stage4ShapeProps {
  size: number;
  color: string;
  gradientId: string;
}

function Stage4Shape({ size, color, gradientId }: Stage4ShapeProps) {
  const cx = size;
  const cy = size;
  const arms = 8;
  return (
    <Svg width={size * 2} height={size * 2}>
      <Defs>
        <RadialGradient id={gradientId} cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="white" stopOpacity="0.5" />
          <Stop offset="25%" stopColor={color} stopOpacity="0.9" />
          <Stop offset="60%" stopColor={color} stopOpacity="0.3" />
          <Stop offset="100%" stopColor={color} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Circle cx={cx} cy={cy} r={size} fill={`url(#${gradientId})`} />
      <Polygon
        points={hexPoints(cx, cy, size * 0.8, 8)}
        fill="none"
        stroke={color}
        strokeWidth={1}
        strokeOpacity={0.4}
      />
      <Polygon
        points={hexPoints(cx, cy, size * 0.55, 8)}
        fill={color}
        fillOpacity={0.15}
        stroke={color}
        strokeWidth={0.8}
        strokeOpacity={0.35}
      />
      <Polygon
        points={hexPoints(cx, cy, size * 0.35, 4)}
        fill={color}
        fillOpacity={0.3}
        stroke={color}
        strokeWidth={0.6}
        strokeOpacity={0.2}
      />
      {Array.from({ length: arms }).map((_, i) => {
        const angle = (Math.PI * 2 * i) / arms;
        const inner = size * 0.25;
        const outer = size * 0.75;
        return (
          <Line
            key={i}
            x1={cx + Math.cos(angle) * inner}
            y1={cy + Math.sin(angle) * inner}
            x2={cx + Math.cos(angle) * outer}
            y2={cy + Math.sin(angle) * outer}
            stroke={color}
            strokeWidth={0.6}
            strokeOpacity={0.2}
          />
        );
      })}
      <Circle cx={cx} cy={cy} r={size * 0.18} fill={color} opacity={0.7} />
      <Circle cx={cx} cy={cy} r={size * 0.08} fill="white" opacity={0.5} />
    </Svg>
  );
}

interface GardenOrbComponentProps {
  orb: GrowthOrb;
  onPress: (orb: GrowthOrb) => void;
}

export function GardenOrbComponent({ orb, onPress }: GardenOrbComponentProps) {
  const size = computeOrbSize(orb.stage);
  const opacity = computeOrbOpacity(orb.stage);
  const color = ACCENT_COLORS[orb.color];

  const scale = useSharedValue(0);
  const pulse = useSharedValue(1);
  const rotate = useSharedValue(0);

  useEffect(() => {
    scale.value = withTiming(1, { duration: 800, easing: Easing.bezier(0.34, 1.56, 0.64, 1) });

    if (orb.stage >= 2) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.08, { duration: 2000 + orb.stage * 500, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 2000 + orb.stage * 500, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    }

    if (orb.stage >= 3) {
      rotate.value = withRepeat(
        withTiming(360, { duration: 60000 + orb.stage * 20000, easing: Easing.linear }),
        -1,
        false
      );
    }
  }, [orb.stage, scale, pulse, rotate]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value * pulse.value },
      { rotate: `${rotate.value}deg` },
    ],
    opacity,
  }));

  const gradientId = `garden-grad-${orb.id}`;

  const renderShape = () => {
    if (orb.stage >= 4) {
      return <Stage4Shape size={size} color={color} gradientId={gradientId} />;
    }
    if (orb.stage >= 3) {
      return <Stage3Shape size={size} color={color} gradientId={gradientId} />;
    }

    return (
      <Svg width={size * 2} height={size * 2}>
        <Defs>
          <RadialGradient id={gradientId} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={color} stopOpacity="0.9" />
            <Stop offset="60%" stopColor={color} stopOpacity="0.3" />
            <Stop offset="100%" stopColor={color} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx={size} cy={size} r={size} fill={`url(#${gradientId})`} />
        {orb.stage >= 2 && (
          <Circle cx={size} cy={size} r={size * 0.4} fill={color} opacity={0.35} />
        )}
      </Svg>
    );
  };

  return (
    <Pressable
      onPress={() => onPress(orb)}
      style={{
        position: "absolute",
        left: orb.x - size,
        top: orb.y - size,
      }}
    >
      <Animated.View style={animatedStyle}>
        {renderShape()}
      </Animated.View>
    </Pressable>
  );
}

interface MiniOrbProps {
  color: string;
  stage: number;
  x: number;
  y: number;
  id: string;
}

export function MiniOrbComponent({ color, stage, x, y, id }: MiniOrbProps) {
  const size = 4 + stage * 5;
  const opacity = 0.3 + stage * 0.15;

  const pulse = useSharedValue(1);

  useEffect(() => {
    if (stage >= 2) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 2500, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    }
  }, [stage, pulse]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity,
  }));

  const gradId = `mini-${id}`;

  return (
    <Animated.View
      style={[
        animatedStyle,
        { position: "absolute", left: x - size, top: y - size },
      ]}
    >
      <Svg width={size * 2} height={size * 2}>
        <Defs>
          <RadialGradient id={gradId} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={color} stopOpacity="0.9" />
            <Stop offset="100%" stopColor={color} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx={size} cy={size} r={size} fill={`url(#${gradId})`} />
        {stage >= 3 && (
          <Polygon
            points={hexPoints(size, size, size * 0.5, 6)}
            fill="none"
            stroke={color}
            strokeWidth={0.6}
            strokeOpacity={0.4}
          />
        )}
        {stage >= 3 && (
          <Circle cx={size} cy={size} r={size * 0.3} fill={color} opacity={0.5} />
        )}
      </Svg>
    </Animated.View>
  );
}
