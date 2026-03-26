import React, { useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, TextInput, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { GlassCard } from "../components/GlassCard";
import { useCreateGoal } from "../hooks/useGoals";
import { hapticMedium, hapticLight, hapticSuccess } from "../lib/haptics";
import { NoiseTexture } from "../components/NoiseTexture";
import { ACCENT_COLORS } from "../types";
import type { AccentColor, GoalType, GoalLocation } from "../types";
import type { RootStackParamList } from "../navigation/types";

type CreateGoalNav = NativeStackNavigationProp<RootStackParamList>;

const COLOR_OPTIONS: AccentColor[] = ["blue", "purple", "green", "orange", "pink", "cyan", "red", "yellow"];
const POMODORO_OPTIONS = [25, 30, 45, 60];

export function CreateGoalScreen() {
  const navigation = useNavigation<CreateGoalNav>();
  const createGoalMutation = useCreateGoal();

  const [name, setName] = useState("");
  const [type, setType] = useState<GoalType>("focus");
  const [color, setColor] = useState<AccentColor>("blue");
  const [targetSessions, setTargetSessions] = useState(4);
  const [targetHours, setTargetHours] = useState(10);
  const [pomodoroDuration, setPomodoroDuration] = useState(25);
  const [locationAddress, setLocationAddress] = useState("");
  const [locationLat, setLocationLat] = useState("");
  const [locationLng, setLocationLng] = useState("");
  const [locationRadius, setLocationRadius] = useState(150);

  const handleCreate = useCallback(async () => {
    if (!name.trim()) {
      Alert.alert("Name Required", "Please enter a name for your goal.");
      return;
    }

    let location: GoalLocation | null = null;
    if (type === "physical") {
      const lat = parseFloat(locationLat);
      const lng = parseFloat(locationLng);
      if (isNaN(lat) || isNaN(lng)) {
        Alert.alert("Location Required", "Please enter valid coordinates for your physical goal.");
        return;
      }
      location = {
        latitude: lat,
        longitude: lng,
        radius_meters: locationRadius,
        address: locationAddress || "Custom Location",
      };
    }

    try {
      await createGoalMutation.mutateAsync({
        name: name.trim(),
        type,
        target_sessions_per_week: targetSessions,
        target_hours_per_week: targetHours,
        color,
        location,
        pomodoro_duration_minutes: pomodoroDuration,
      });
      hapticSuccess();
      navigation.goBack();
    } catch (error) {
      Alert.alert("Error", "Failed to create goal. Please try again.");
    }
  }, [name, type, color, targetSessions, targetHours, pomodoroDuration, locationAddress, locationLat, locationLng, locationRadius, createGoalMutation, navigation]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <NoiseTexture />
      <Animated.View entering={FadeIn.duration(400)} className="flex-1">
        <View className="flex-row items-center justify-between px-screen-x pt-4 pb-4">
          <Pressable onPress={() => navigation.goBack()}>
            <Text className="text-text-secondary text-body">Cancel</Text>
          </Pressable>
          <Text className="text-text-primary text-subheading">New Goal</Text>
          <Pressable onPress={handleCreate} disabled={createGoalMutation.isPending}>
            <Text className="text-text-primary text-body font-semibold">
              {createGoalMutation.isPending ? "..." : "Create"}
            </Text>
          </Pressable>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerClassName="pb-8"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInDown.delay(50).duration(400)}>
            <GlassCard className="mx-screen-x mb-4">
              <Text className="text-text-secondary text-caption mb-2">Goal Name</Text>
              <TextInput
                placeholder="e.g., Study, Gym, Read"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={name}
                onChangeText={setName}
                className="bg-white/[0.06] text-text-primary text-body px-4 py-3 rounded-button border border-surface-border"
                maxLength={40}
                autoFocus
              />
            </GlassCard>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(100).duration(400)}>
            <GlassCard className="mx-screen-x mb-4">
              <Text className="text-text-secondary text-caption mb-3">Type</Text>
              <View className="flex-row gap-3">
                <Pressable
                  onPress={() => { setType("focus"); hapticLight(); }}
                  className={`flex-1 items-center py-3 rounded-button ${type === "focus" ? "bg-white/20" : "bg-white/[0.06]"}`}
                >
                  <Text className="text-lg mb-1">🧠</Text>
                  <Text className="text-text-primary text-caption font-medium">Focus</Text>
                  <Text className="text-text-tertiary text-tiny">Pomodoro timer</Text>
                </Pressable>
                <Pressable
                  onPress={() => { setType("physical"); hapticLight(); }}
                  className={`flex-1 items-center py-3 rounded-button ${type === "physical" ? "bg-white/20" : "bg-white/[0.06]"}`}
                >
                  <Text className="text-lg mb-1">📍</Text>
                  <Text className="text-text-primary text-caption font-medium">Physical</Text>
                  <Text className="text-text-tertiary text-tiny">Geofence auto</Text>
                </Pressable>
              </View>
            </GlassCard>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(150).duration(400)}>
            <GlassCard className="mx-screen-x mb-4">
              <Text className="text-text-secondary text-caption mb-3">Color</Text>
              <View className="flex-row flex-wrap gap-3">
                {COLOR_OPTIONS.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => { setColor(c); hapticLight(); }}
                    className={`w-10 h-10 rounded-full items-center justify-center ${color === c ? "border-2 border-white" : ""}`}
                    style={{ backgroundColor: ACCENT_COLORS[c] }}
                  >
                    {color === c && <Text className="text-white text-xs">✓</Text>}
                  </Pressable>
                ))}
              </View>
            </GlassCard>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200).duration(400)}>
            <GlassCard className="mx-screen-x mb-4">
              <Text className="text-text-secondary text-caption mb-3">Weekly Target</Text>
              <View className="flex-row items-center justify-between py-2">
                <Text className="text-text-secondary text-body">Sessions / week</Text>
                <View className="flex-row items-center gap-2">
                  <Pressable
                    onPress={() => { if (targetSessions > 1) { setTargetSessions(targetSessions - 1); hapticLight(); } }}
                    className="w-8 h-8 items-center justify-center rounded-full bg-white/[0.06]"
                  >
                    <Text className="text-text-primary">−</Text>
                  </Pressable>
                  <Text className="text-text-primary text-body font-medium w-8 text-center">{targetSessions}</Text>
                  <Pressable
                    onPress={() => { if (targetSessions < 14) { setTargetSessions(targetSessions + 1); hapticLight(); } }}
                    className="w-8 h-8 items-center justify-center rounded-full bg-white/[0.06]"
                  >
                    <Text className="text-text-primary">+</Text>
                  </Pressable>
                </View>
              </View>

              {type === "focus" && (
                <View className="flex-row items-center justify-between py-2">
                  <Text className="text-text-secondary text-body">Hours / week</Text>
                  <View className="flex-row items-center gap-2">
                    <Pressable
                      onPress={() => { if (targetHours > 1) { setTargetHours(targetHours - 1); hapticLight(); } }}
                      className="w-8 h-8 items-center justify-center rounded-full bg-white/[0.06]"
                    >
                      <Text className="text-text-primary">−</Text>
                    </Pressable>
                    <Text className="text-text-primary text-body font-medium w-8 text-center">{targetHours}</Text>
                    <Pressable
                      onPress={() => { if (targetHours < 40) { setTargetHours(targetHours + 1); hapticLight(); } }}
                      className="w-8 h-8 items-center justify-center rounded-full bg-white/[0.06]"
                    >
                      <Text className="text-text-primary">+</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </GlassCard>
          </Animated.View>

          {type === "focus" && (
            <Animated.View entering={FadeInDown.delay(250).duration(400)}>
              <GlassCard className="mx-screen-x mb-4">
                <Text className="text-text-secondary text-caption mb-3">Pomodoro Duration</Text>
                <View className="flex-row gap-2">
                  {POMODORO_OPTIONS.map((dur) => (
                    <Pressable
                      key={dur}
                      onPress={() => { setPomodoroDuration(dur); hapticLight(); }}
                      className={`flex-1 items-center py-2.5 rounded-button ${pomodoroDuration === dur ? "bg-white/20" : "bg-white/[0.06]"}`}
                    >
                      <Text className="text-text-primary text-body font-medium">{dur}</Text>
                      <Text className="text-text-tertiary text-tiny">min</Text>
                    </Pressable>
                  ))}
                </View>
              </GlassCard>
            </Animated.View>
          )}

          {type === "physical" && (
            <Animated.View entering={FadeInDown.delay(250).duration(400)}>
              <GlassCard className="mx-screen-x mb-4">
                <Text className="text-text-secondary text-caption mb-3">Location</Text>
                <TextInput
                  placeholder="Address or place name"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={locationAddress}
                  onChangeText={setLocationAddress}
                  className="bg-white/[0.06] text-text-primary text-body px-4 py-3 rounded-button border border-surface-border mb-3"
                />
                <View className="flex-row gap-3 mb-3">
                  <View className="flex-1">
                    <Text className="text-text-tertiary text-tiny mb-1">Latitude</Text>
                    <TextInput
                      placeholder="0.000000"
                      placeholderTextColor="rgba(255,255,255,0.3)"
                      value={locationLat}
                      onChangeText={setLocationLat}
                      keyboardType="numeric"
                      className="bg-white/[0.06] text-text-primary text-body px-4 py-2.5 rounded-button border border-surface-border"
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-text-tertiary text-tiny mb-1">Longitude</Text>
                    <TextInput
                      placeholder="0.000000"
                      placeholderTextColor="rgba(255,255,255,0.3)"
                      value={locationLng}
                      onChangeText={setLocationLng}
                      keyboardType="numeric"
                      className="bg-white/[0.06] text-text-primary text-body px-4 py-2.5 rounded-button border border-surface-border"
                    />
                  </View>
                </View>
                <View className="flex-row items-center justify-between">
                  <Text className="text-text-secondary text-body">Radius (meters)</Text>
                  <View className="flex-row items-center gap-2">
                    <Pressable
                      onPress={() => { if (locationRadius > 50) { setLocationRadius(locationRadius - 50); hapticLight(); } }}
                      className="w-8 h-8 items-center justify-center rounded-full bg-white/[0.06]"
                    >
                      <Text className="text-text-primary">−</Text>
                    </Pressable>
                    <Text className="text-text-primary text-body font-medium w-12 text-center">{locationRadius}</Text>
                    <Pressable
                      onPress={() => { if (locationRadius < 500) { setLocationRadius(locationRadius + 50); hapticLight(); } }}
                      className="w-8 h-8 items-center justify-center rounded-full bg-white/[0.06]"
                    >
                      <Text className="text-text-primary">+</Text>
                    </Pressable>
                  </View>
                </View>
              </GlassCard>
            </Animated.View>
          )}
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}
