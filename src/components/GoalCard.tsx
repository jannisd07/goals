import React from "react";
import { View, Text, Pressable } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { GlassCard } from "./GlassCard";
import { ProgressBar } from "./ProgressBar";
import { useAppStore } from "../store";
import { hapticLight } from "../lib/haptics";
import { ACCENT_COLORS, type Goal } from "../types";

interface GoalCardProps {
  goal: Goal;
  index: number;
  onStartSession: (goal: Goal) => void;
}

export function GoalCard({ goal, index, onStartSession }: GoalCardProps) {
  const weeklyProgress = useAppStore((s) => s.weeklyProgress[goal.id]);
  const activeSession = useAppStore((s) => s.activeSession);
  const isActive = activeSession?.goal_id === goal.id;

  const sessionsCompleted = weeklyProgress?.sessions_completed ?? 0;
  const totalHours = weeklyProgress?.total_hours ?? 0;

  const isPhysical = goal.type === "physical";
  const progressValue = isPhysical
    ? goal.target_sessions_per_week > 0
      ? sessionsCompleted / goal.target_sessions_per_week
      : 0
    : goal.target_hours_per_week > 0
      ? totalHours / goal.target_hours_per_week
      : 0;

  const progressText = isPhysical
    ? `${sessionsCompleted} / ${goal.target_sessions_per_week} sessions`
    : `${totalHours.toFixed(1)} / ${goal.target_hours_per_week}h`;

  const handlePress = () => {
    if (!isPhysical && !isActive) {
      hapticLight();
      onStartSession(goal);
    }
  };

  return (
    <Animated.View entering={FadeInDown.delay(index * 80).duration(400).springify()}>
      <Pressable onPress={handlePress} disabled={isPhysical || isActive}>
        <GlassCard className="mx-screen-x mb-3">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center gap-3">
              <View
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: ACCENT_COLORS[goal.color] }}
              />
              <Text className="text-text-primary text-subheading">{goal.name}</Text>
            </View>
            {isPhysical ? (
              <View className="flex-row items-center gap-1.5 bg-white/[0.06] px-2.5 py-1 rounded-full">
                <Text className="text-tiny text-text-tertiary">📍 Auto-tracking</Text>
              </View>
            ) : isActive ? (
              <View className="flex-row items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-full">
                <View className="w-1.5 h-1.5 rounded-full bg-green-400" />
                <Text className="text-tiny text-green-400">Active</Text>
              </View>
            ) : (
              <View className="bg-white/10 px-3 py-1.5 rounded-button">
                <Text className="text-tiny text-text-primary font-medium">Start</Text>
              </View>
            )}
          </View>

          <ProgressBar progress={progressValue} color={goal.color} />

          <Text className="text-text-tertiary text-caption mt-2">{progressText}</Text>
        </GlassCard>
      </Pressable>
    </Animated.View>
  );
}
