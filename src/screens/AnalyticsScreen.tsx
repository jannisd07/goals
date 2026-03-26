import React, { useState, useMemo } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { GlassCard } from "../components/GlassCard";
import { useHeatMapData, useAIInsight } from "../hooks/useSessions";
import { useAppStore } from "../store";
import { ACCENT_COLORS } from "../types";
import { NoiseTexture } from "../components/NoiseTexture";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const CELL_SIZE = 36;
const CELL_GAP = 2;

function HeatMapCell({ value, maxValue }: { value: number; maxValue: number }) {
  const intensity = maxValue > 0 ? Math.min(1, value / maxValue) : 0;
  const backgroundColor = intensity === 0
    ? "rgba(255,255,255,0.03)"
    : `rgba(255,255,255,${0.06 + intensity * 0.35})`;

  return (
    <View
      style={{
        width: CELL_SIZE,
        height: CELL_SIZE,
        backgroundColor,
        borderRadius: 4,
        margin: CELL_GAP / 2,
      }}
    />
  );
}

export function AnalyticsScreen() {
  const goals = useAppStore((s) => s.goals);
  const [selectedGoalId, setSelectedGoalId] = useState<string | undefined>(undefined);
  const { data: heatMapGrid, isLoading: heatMapLoading } = useHeatMapData(selectedGoalId);
  const { data: aiInsight, isLoading: aiLoading } = useAIInsight();

  const maxValue = useMemo(() => {
    if (!heatMapGrid) return 0;
    let max = 0;
    for (const row of heatMapGrid) {
      for (const val of row) {
        if (val > max) max = val;
      }
    }
    return max;
  }, [heatMapGrid]);

  const visibleHours = useMemo(() => {
    const hours: number[] = [];
    for (let h = 6; h <= 23; h++) hours.push(h);
    for (let h = 0; h <= 5; h++) hours.push(h);
    return hours;
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <NoiseTexture />
      <Animated.View entering={FadeIn.duration(600)} className="flex-1">
        <View className="px-screen-x pt-4 pb-2">
          <Text className="text-text-primary text-heading">Analytics</Text>
          <Text className="text-text-tertiary text-caption mt-0.5">Your weekly rhythm</Text>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerClassName="pb-8"
          showsVerticalScrollIndicator={false}
        >
          <View className="px-screen-x mb-4">
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-2">
                <Pressable
                  onPress={() => setSelectedGoalId(undefined)}
                  className={`px-3 py-1.5 rounded-full ${!selectedGoalId ? "bg-white/20" : "bg-white/[0.06]"}`}
                >
                  <Text className="text-text-secondary text-caption">All Goals</Text>
                </Pressable>
                {goals.map((goal) => (
                  <Pressable
                    key={goal.id}
                    onPress={() => setSelectedGoalId(goal.id)}
                    className={`px-3 py-1.5 rounded-full flex-row items-center gap-1.5 ${selectedGoalId === goal.id ? "bg-white/20" : "bg-white/[0.06]"}`}
                  >
                    <View
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: ACCENT_COLORS[goal.color] }}
                    />
                    <Text className="text-text-secondary text-caption">{goal.name}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>

          <Animated.View entering={FadeInDown.delay(100).duration(400)}>
            <GlassCard className="mx-screen-x mb-4">
              <Text className="text-text-secondary text-caption mb-3">Activity Heat Map</Text>

              {heatMapLoading ? (
                <View className="items-center py-8">
                  <Text className="text-text-tertiary text-caption">Loading...</Text>
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View>
                    <View className="flex-row mb-1 ml-8">
                      {DAYS.map((day) => (
                        <View key={day} style={{ width: CELL_SIZE + CELL_GAP }} className="items-center">
                          <Text className="text-text-tertiary text-tiny">{day}</Text>
                        </View>
                      ))}
                    </View>

                    {visibleHours.map((hour) => (
                      <View key={hour} className="flex-row items-center">
                        <View style={{ width: 32 }}>
                          <Text className="text-text-tertiary text-tiny text-right pr-1">
                            {hour.toString().padStart(2, "0")}
                          </Text>
                        </View>
                        {DAYS.map((_, dayIdx) => (
                          <HeatMapCell
                            key={`${hour}-${dayIdx}`}
                            value={heatMapGrid?.[hour]?.[dayIdx] ?? 0}
                            maxValue={maxValue}
                          />
                        ))}
                      </View>
                    ))}
                  </View>
                </ScrollView>
              )}
            </GlassCard>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200).duration(400)}>
            <GlassCard className="mx-screen-x">
              <Text className="text-text-secondary text-caption mb-2">AI Insights</Text>
              {aiLoading ? (
                <View className="py-4">
                  <Text className="text-text-tertiary text-caption">Analyzing your patterns...</Text>
                </View>
              ) : aiInsight ? (
                <Text className="text-text-primary text-body leading-6">{aiInsight}</Text>
              ) : (
                <Text className="text-text-tertiary text-body">
                  Complete more sessions to unlock personalized insights.
                </Text>
              )}
            </GlassCard>
          </Animated.View>
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}
