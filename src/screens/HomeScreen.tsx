import React, { useCallback } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeIn } from "react-native-reanimated";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { BalanceCard } from "../components/BalanceCard";
import { GoalCard } from "../components/GoalCard";
import { GardenPreview } from "../components/GardenPreview";
import { NoiseTexture } from "../components/NoiseTexture";
import { useAppStore } from "../store";
import { useGoals } from "../hooks/useGoals";
import { useWeeklyProgress } from "../hooks/useSessions";
import { getGreeting, formatDate } from "../lib/time";
import type { Goal } from "../types";
import type { RootStackParamList } from "../navigation/types";

type HomeNavProp = NativeStackNavigationProp<RootStackParamList>;

export function HomeScreen() {
  const navigation = useNavigation<HomeNavProp>();
  const userConfig = useAppStore((s) => s.userConfig);
  const goals = useAppStore((s) => s.goals);

  useGoals();
  useWeeklyProgress();

  const displayName = userConfig?.display_name ?? "there";

  const handleStartSession = useCallback((goal: Goal) => {
    navigation.navigate("FocusSession", { goalId: goal.id });
  }, [navigation]);

  const handleSettings = useCallback(() => {
    navigation.navigate("Settings");
  }, [navigation]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <NoiseTexture />
      <Animated.View entering={FadeIn.duration(600)} className="flex-1">
        <View className="flex-row items-center justify-between px-screen-x pt-4 pb-2">
          <View>
            <Text className="text-text-primary text-heading" style={{ fontFamily: "Outfit_600SemiBold" }}>
              {getGreeting()}, {displayName}
            </Text>
            <Text className="text-text-tertiary text-caption mt-0.5" style={{ fontFamily: "Outfit_400Regular" }}>{formatDate()}</Text>
          </View>
          <Pressable
            onPress={handleSettings}
            className="w-10 h-10 items-center justify-center rounded-full bg-white/[0.06]"
          >
            <Text className="text-lg">⚙️</Text>
          </Pressable>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerClassName="pb-8 pt-4"
          showsVerticalScrollIndicator={false}
        >
          <BalanceCard />

          <GardenPreview onPress={() => navigation.navigate("MainTabs", { screen: "Garden" } as never)} />

          {goals.length === 0 ? (
            <View className="mx-screen-x items-center py-12">
              <Text className="text-text-tertiary text-body text-center mb-4">
                No goals yet. Add your first goal to start tracking.
              </Text>
              <Pressable
                onPress={() => navigation.navigate("CreateGoal")}
                className="bg-white/10 px-6 py-3 rounded-button"
              >
                <Text className="text-text-primary text-body font-medium">+ Add Goal</Text>
              </Pressable>
            </View>
          ) : (
            <>
              {goals.map((goal, index) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  index={index}
                  onStartSession={handleStartSession}
                />
              ))}
              <Pressable
                onPress={() => navigation.navigate("CreateGoal")}
                className="mx-screen-x mt-2 items-center py-3 rounded-button border border-dashed border-white/10"
              >
                <Text className="text-text-tertiary text-body">+ Add Goal</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}
