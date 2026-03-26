import React, { useMemo } from "react";
import { View, Text, Pressable, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeIn } from "react-native-reanimated";
import { useAppStore } from "../store";
import { useWeeklySessions } from "../hooks/useSessions";
import { ACCENT_COLORS } from "../types";
import { GardenOrbComponent } from "../components/GardenOrb";
import { NoiseTexture } from "../components/NoiseTexture";
import type { GrowthOrb } from "../types";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const GARDEN_WIDTH = SCREEN_WIDTH;
const GARDEN_HEIGHT = SCREEN_HEIGHT * 0.65;

export function GardenScreen() {
  const goals = useAppStore((s) => s.goals);
  const weeklyProgress = useAppStore((s) => s.weeklyProgress);
  const { data: sessions } = useWeeklySessions();
  const [selectedOrb, setSelectedOrb] = React.useState<GrowthOrb | null>(null);

  const orbs = useMemo((): GrowthOrb[] => {
    if (goals.length === 0) return [];

    const padding = 60;
    const usableWidth = GARDEN_WIDTH - padding * 2;
    const usableHeight = GARDEN_HEIGHT - padding * 2;

    return goals
      .filter((g) => g.type === "focus")
      .map((goal, index, arr): GrowthOrb => {
        const progress = weeklyProgress[goal.id];
        const totalSessions = progress?.sessions_completed ?? 0;
        const stage = Math.min(4, Math.floor(totalSessions / 2));

        const angle = (index / Math.max(1, arr.length)) * Math.PI * 2 + Math.PI / 4;
        const radiusX = usableWidth * 0.35;
        const radiusY = usableHeight * 0.3;
        const centerX = GARDEN_WIDTH / 2;
        const centerY = GARDEN_HEIGHT / 2;

        return {
          id: goal.id,
          goal_id: goal.id,
          goal_name: goal.name,
          color: goal.color,
          stage,
          total_sessions: totalSessions,
          x: centerX + Math.cos(angle) * radiusX,
          y: centerY + Math.sin(angle) * radiusY,
        };
      });
  }, [goals, weeklyProgress]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <Animated.View entering={FadeIn.duration(600)} className="flex-1">
        <View className="px-screen-x pt-4 pb-2">
          <Text className="text-text-primary text-heading">Your Garden</Text>
          <Text className="text-text-tertiary text-caption mt-0.5">
            Each orb grows with your consistency
          </Text>
        </View>

        <View style={{ width: GARDEN_WIDTH, height: GARDEN_HEIGHT }} className="relative">
          <NoiseTexture opacity={0.025} />
          {orbs.length === 0 ? (
            <View className="flex-1 items-center justify-center">
              <Text className="text-text-tertiary text-body text-center px-12" style={{ fontFamily: "Outfit_400Regular" }}>
                Complete focus sessions to see your garden grow
              </Text>
            </View>
          ) : (
            orbs.map((orb) => (
              <GardenOrbComponent key={orb.id} orb={orb} onPress={setSelectedOrb} />
            ))
          )}
        </View>

        {selectedOrb && (
          <Animated.View entering={FadeIn.duration(200)} className="px-screen-x">
            <Pressable onPress={() => setSelectedOrb(null)}>
              <View className="bg-white/[0.06] border border-surface-border rounded-card p-card-padding">
                <View className="flex-row items-center gap-3 mb-2">
                  <View
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: ACCENT_COLORS[selectedOrb.color] }}
                  />
                  <Text className="text-text-primary text-subheading">{selectedOrb.goal_name}</Text>
                </View>
                <Text className="text-text-secondary text-body">
                  {selectedOrb.total_sessions} sessions this week
                </Text>
                <Text className="text-text-tertiary text-caption mt-1">
                  Growth stage {selectedOrb.stage + 1} / 5
                </Text>
              </View>
            </Pressable>
          </Animated.View>
        )}
      </Animated.View>
    </SafeAreaView>
  );
}
