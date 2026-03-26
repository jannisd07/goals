import React, { useState, useCallback } from "react";
import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeIn } from "react-native-reanimated";
import { GlassCard } from "../components/GlassCard";
import { useAppStore } from "../store";
import { supabase } from "../lib/supabase";
import { hapticMedium, hapticSuccess, hapticLight } from "../lib/haptics";
import { computeDisposableTime } from "../lib/time";
import { NoiseTexture } from "../components/NoiseTexture";
import type { FixedCommitments } from "../types";

function NumberStepper({
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
          onPress={() => { if (value > 0) { onChange(value - 0.5); hapticLight(); } }}
          className="w-9 h-9 items-center justify-center rounded-full bg-white/[0.06]"
        >
          <Text className="text-text-primary text-body">−</Text>
        </Pressable>
        <Text className="text-text-primary text-body font-medium w-12 text-center">{value}</Text>
        <Pressable
          onPress={() => { if (value < max) { onChange(value + 0.5); hapticLight(); } }}
          className="w-9 h-9 items-center justify-center rounded-full bg-white/[0.06]"
        >
          <Text className="text-text-primary text-body">+</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function OnboardingScreen() {
  const setFixedCommitments = useAppStore((s) => s.setFixedCommitments);
  const userConfig = useAppStore((s) => s.userConfig);
  const setUserConfig = useAppStore((s) => s.setUserConfig);

  const [sleep, setSleep] = useState(8);
  const [work, setWork] = useState(8);
  const [workDays, setWorkDays] = useState(5);
  const [overhead, setOverhead] = useState(2);
  const [saving, setSaving] = useState(false);

  const commitments: FixedCommitments = {
    sleep_hours_per_night: sleep,
    work_hours_per_day: work,
    work_days_per_week: workDays,
    daily_overhead_hours: overhead,
  };
  const disposable = computeDisposableTime(commitments);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setFixedCommitments(commitments);
    hapticMedium();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("users")
          .update({
            fixed_commitments: commitments,
            onboarding_complete: true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", user.id);

        if (userConfig) {
          setUserConfig({
            ...userConfig,
            fixed_commitments: commitments,
            onboarding_complete: true,
          });
        }
      }
      hapticSuccess();
    } catch (err) {
      console.error("Failed to save commitments:", err);
    } finally {
      setSaving(false);
    }
  }, [commitments, setFixedCommitments, userConfig, setUserConfig]);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <NoiseTexture />
      <Animated.View entering={FadeIn.duration(600)} className="flex-1 justify-center px-screen-x">
        <Text className="text-text-primary text-4xl font-bold text-center mb-2" style={{ fontFamily: "Outfit_700Bold" }}>VibeTime</Text>
        <Text className="text-text-tertiary text-body text-center mb-2">
          Your time, your currency.
        </Text>
        <Text className="text-text-primary text-heading text-center mb-2 mt-8">
          Set Your Time Budget
        </Text>
        <Text className="text-text-tertiary text-body text-center mb-8">
          Tell us about your fixed commitments.
        </Text>

        <GlassCard className="mb-6">
          <NumberStepper label="Sleep (hrs/night)" value={sleep} onChange={setSleep} max={12} />
          <NumberStepper label="Work (hrs/day)" value={work} onChange={setWork} max={16} />
          <NumberStepper label="Work days/week" value={workDays} onChange={setWorkDays} max={7} />
          <NumberStepper label="Daily overhead (hrs)" value={overhead} onChange={setOverhead} max={8} />
        </GlassCard>

        <View className="items-center mb-6">
          <Text className="text-text-primary text-balance" style={{ fontFamily: "Outfit_700Bold" }}>{disposable.toFixed(1)}</Text>
          <Text className="text-text-secondary text-body">hours of disposable time per week</Text>
        </View>

        <Pressable
          onPress={handleSave}
          disabled={saving}
          className="items-center py-3.5 rounded-button bg-white"
        >
          <Text className="text-background text-body font-semibold">
            {saving ? "Saving..." : "Get Started"}
          </Text>
        </Pressable>
      </Animated.View>
    </SafeAreaView>
  );
}
