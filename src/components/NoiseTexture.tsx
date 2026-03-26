import React, { useMemo } from "react";
import { Dimensions, StyleSheet } from "react-native";
import Svg, { Rect, Defs, Pattern } from "react-native-svg";
import Animated, { FadeIn } from "react-native-reanimated";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const CELL = 4;
const COLS = Math.ceil(SCREEN_W / CELL);
const ROWS = Math.ceil(SCREEN_H / CELL);
const PATTERN_SIZE = 80;
const PATTERN_CELLS = PATTERN_SIZE / CELL;

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

interface NoiseTextureProps {
  opacity?: number;
}

export function NoiseTexture({ opacity = 0.04 }: NoiseTextureProps) {
  const cells = useMemo(() => {
    const rand = seededRandom(42);
    const result: Array<{ x: number; y: number; o: number }> = [];
    for (let row = 0; row < PATTERN_CELLS; row++) {
      for (let col = 0; col < PATTERN_CELLS; col++) {
        const o = rand();
        if (o > 0.5) {
          result.push({ x: col * CELL, y: row * CELL, o: o * 0.6 });
        }
      }
    }
    return result;
  }, []);

  return (
    <Animated.View
      entering={FadeIn.duration(1000)}
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { opacity, zIndex: 1 }]}
    >
      <Svg width={SCREEN_W} height={SCREEN_H} style={StyleSheet.absoluteFill}>
        <Defs>
          <Pattern
            id="grain"
            x="0"
            y="0"
            width={PATTERN_SIZE}
            height={PATTERN_SIZE}
            patternUnits="userSpaceOnUse"
          >
            {cells.map((c, i) => (
              <Rect
                key={i}
                x={c.x}
                y={c.y}
                width={CELL}
                height={CELL}
                fill="white"
                opacity={c.o}
              />
            ))}
          </Pattern>
        </Defs>
        <Rect width={SCREEN_W} height={SCREEN_H} fill="url(#grain)" />
      </Svg>
    </Animated.View>
  );
}
