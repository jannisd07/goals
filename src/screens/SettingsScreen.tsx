import React, { useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { GlassCard } from "../components/GlassCard";
import { useAppStore } from "../store";
import { useGoals, useDeleteGoal } from "../hooks/useGoals";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import { hapticMedium, hapticLight } from "../lib/haptics";
import { computeDisposableTime } from "../lib/time";
import { NoiseTexture } from "../components/NoiseTexture";
import { ACCENT_COLORS } from "../types";
import type { FixedCommitments } from "../types";
import type { RootStackParamList } from "../navigation/types";

type SettingsNav = NativeStackNavigationProp<RootStackParamList>;

function NumberInput({
  label,
  value,
  onChange,
  max = 24,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  max?: number;
}) {
  return (
    <View className="flex-row items-center justify-between py-3">
      <Text className="text-text-secondary text-body flex-1">{label}</Text>
      <View className="flex-row items-center gap-2">
        <Pressable
          onPress={() => {
            if (value > 0) { onChange(value - 0.5); hapticLight(); }
          }}
          className="w-9 h-9 items-center justify-center rounded-full bg-white/[0.06]"
        >
          <Text className="text-text-primary text-body">−</Text>
        </Pressable>
        <Text className="text-text-primary text-body font-medium w-12 text-center">
          {value}
        </Text>
        <Pressable
          onPress={() => {
            if (value < max) { onChange(value + 0.5); hapticLight(); }
          }}
          className="w-9 h-9 items-center justify-center rounded-full bg-white/[0.06]"
        >
          <Text className="text-text-primary text-body">+</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function SettingsScreen() {
  const navigation = useNavigation<SettingsNav>();
  const { signOut } = useAuth();
  const goals = useAppStore((s) => s.goals);
  const fixedCommitments = useAppStore((s) => s.fixedCommitments);
  const setFixedCommitments = useAppStore((s) => s.setFixedCommitments);
  const userConfig = useAppStore((s) => s.userConfig);
  const deleteGoalMutation = useDeleteGoal();

  useGoals();

  const [sleep, setSleep] = useState(fixedCommitments.sleep_hours_per_night);
  const [work, setWork] = useState(fixedCommitments.work_hours_per_day);
  const [workDays, setWorkDays] = useState(fixedCommitments.work_days_per_week);
  const [overhead, setOverhead] = useState(fixedCommitments.daily_overhead_hours);

  const newCommitments: FixedCommitments = {
    sleep_hours_per_night: sleep,
    work_hours_per_day: work,
    work_days_per_week: workDays,
    daily_overhead_hours: overhead,
  };

  const newDisposable = computeDisposableTime(newCommitments);
  const hasChanges =
    sleep !== fixedCommitments.sleep_hours_per_night ||
    work !== fixedCommitments.work_hours_per_day ||
    workDays !== fixedCommitments.work_days_per_week ||
    overhead !== fixedCommitments.daily_overhead_hours;

  const handleSaveCommitments = useCallback(async () => {
    setFixedCommitments(newCommitments);
    hapticMedium();

    if (userConfig?.id) {
      await supabase
        .from("users")
        .update({ fixed_commitments: newCommitments, updated_at: new Date().toISOString() })
        .eq("id", userConfig.id);
    }
  }, [newCommitments, setFixedCommitments, userConfig]);

  const handleDeleteGoal = useCallback((goalId: string, goalName: string) => {
    Alert.alert(
      "Delete Goal",
      `Are you sure you want to delete "${goalName}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteGoalMutation.mutate(goalId),
        },
      ]
    );
  }, [deleteGoalMutation]);

  const handleSignOut = useCallback(() => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: signOut },
    ]);
  }, [signOut]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <NoiseTexture />
      <Animated.View entering={FadeIn.duration(400)} className="flex-1">
        <View className="flex-row items-center justify-between px-screen-x pt-4 pb-4">
          <Pressable onPress={() => navigation.goBack()}>
            <Text className="text-text-secondary text-body">← Back</Text>
          </Pressable>
          <Text className="text-text-primary text-subheading">Settings</Text>
          <View className="w-12" />
        </View>

        <ScrollView
          className="flex-1"
          contentContainerClassName="pb-8"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInDown.delay(50).duration(400)}>
            <GlassCard className="mx-screen-x mb-4">
              <Text className="text-text-primary text-subheading mb-1">Fixed Commitments</Text>
              <Text className="text-text-tertiary text-caption mb-3">
                Disposable time: {newDisposable.toFixed(1)}h / week
              </Text>

              <NumberInput label="Sleep (hrs/night)" value={sleep} onChange={setSleep} max={12} />
              <NumberInput label="Work (hrs/day)" value={work} onChange={setWork} max={16} />
              <NumberInput label="Work days/week" value={workDays} onChange={setWorkDays} max={7} />
              <NumberInput label="Daily overhead (hrs)" value={overhead} onChange={setOverhead} max={8} />

              {hasChanges && (
                <Pressable
                  onPress={handleSaveCommitments}
                  className="mt-3 items-center py-3 rounded-button bg-white"
                >
                  <Text className="text-background text-body font-semibold">Save Changes</Text>
                </Pressable>
              )}
            </GlassCard>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(100).duration(400)}>
            <GlassCard className="mx-screen-x mb-4">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-text-primary text-subheading">Goals</Text>
                <Pressable
                  onPress={() => navigation.navigate("CreateGoal")}
                  className="px-3 py-1.5 rounded-button bg-white/10"
                >
                  <Text className="text-text-primary text-caption font-medium">+ New</Text>
                </Pressable>
              </View>

              {goals.length === 0 ? (
                <Text className="text-text-tertiary text-body py-4 text-center">No goals yet</Text>
              ) : (
                goals.map((goal) => (
                  <View
                    key={goal.id}
                    className="flex-row items-center justify-between py-3 border-b border-white/[0.06]"
                  >
                    <View className="flex-row items-center gap-3 flex-1">
                      <View
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: ACCENT_COLORS[goal.color] }}
                      />
                      <View className="flex-1">
                        <Text className="text-text-primary text-body">{goal.name}</Text>
                        <Text className="text-text-tertiary text-caption">
                          {goal.type === "physical" ? "Physical • Geofence" : `Focus • ${goal.pomodoro_duration_minutes}min`}
                        </Text>
                      </View>
                    </View>
                    <Pressable
                      onPress={() => handleDeleteGoal(goal.id, goal.name)}
                      className="px-3 py-1.5"
                    >
                      <Text className="text-red-400 text-caption">Delete</Text>
                    </Pressable>
                  </View>
                ))
              )}
            </GlassCard>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(150).duration(400)}>
            <GlassCard className="mx-screen-x mb-4">
              <Text className="text-text-primary text-subheading mb-2">Account</Text>
              <Text className="text-text-tertiary text-caption mb-4">
                {userConfig?.display_name ?? "User"}
              </Text>
              <Pressable
                onPress={handleSignOut}
                className="items-center py-3 rounded-button bg-red-500/20"
              >
                <Text className="text-red-400 text-body font-medium">Sign Out</Text>
              </Pressable>
            </GlassCard>
          </Animated.View>
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}
