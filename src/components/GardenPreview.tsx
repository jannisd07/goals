import React, { useMemo } from "react";
import { View, Text, Pressable } from "react-native";
import { GlassCard } from "./GlassCard";
import { MiniOrbComponent } from "./GardenOrb";
import { useAppStore } from "../store";
import { ACCENT_COLORS } from "../types";

const PREVIEW_WIDTH = 280;
const PREVIEW_HEIGHT = 100;

interface GardenPreviewProps {
  onPress: () => void;
}

export function GardenPreview({ onPress }: GardenPreviewProps) {
  const goals = useAppStore((s) => s.goals);
  const weeklyProgress = useAppStore((s) => s.weeklyProgress);

  const focusGoals = useMemo(
    () => goals.filter((g) => g.type === "focus"),
    [goals]
  );

  const orbs = useMemo(() => {
    if (focusGoals.length === 0) return [];

    const padding = 20;
    const usableW = PREVIEW_WIDTH - padding * 2;
    const usableH = PREVIEW_HEIGHT - padding * 2;
    const cx = PREVIEW_WIDTH / 2;
    const cy = PREVIEW_HEIGHT / 2;

    return focusGoals.map((goal, i, arr) => {
      const progress = weeklyProgress[goal.id];
      const totalSessions = progress?.sessions_completed ?? 0;
      const stage = Math.min(4, Math.floor(totalSessions / 2));
      const angle = (i / Math.max(1, arr.length)) * Math.PI * 2 + Math.PI / 4;
      const rx = usableW * 0.35;
      const ry = usableH * 0.35;

      return {
        id: goal.id,
        color: ACCENT_COLORS[goal.color],
        stage,
        x: cx + Math.cos(angle) * rx,
        y: cy + Math.sin(angle) * ry,
      };
    });
  }, [focusGoals, weeklyProgress]);

  if (focusGoals.length === 0) return null;

  return (
    <Pressable onPress={onPress}>
      <GlassCard className="mx-screen-x mb-3">
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-text-secondary text-caption">Your Garden</Text>
          <Text className="text-text-tertiary text-tiny">Tap to explore →</Text>
        </View>
        <View
          style={{ width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT }}
          className="self-center overflow-hidden rounded-xl"
        >
          {orbs.map((orb) => (
            <MiniOrbComponent key={orb.id} {...orb} />
          ))}
          {orbs.length === 0 && (
            <View className="flex-1 items-center justify-center">
              <Text className="text-text-tertiary text-tiny">
                Complete focus sessions to grow
              </Text>
            </View>
          )}
        </View>
      </GlassCard>
    </Pressable>
  );
}
