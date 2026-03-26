import React, { useEffect, useState, useCallback } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  FadeIn,
  Easing,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import { useRoute, useNavigation } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { usePomodoro } from "../hooks/usePomodoro";
import { useAmbientSound } from "../hooks/useAmbientSound";
import { useAppStore } from "../store";
import { useRateSession } from "../hooks/useSessions";
import { RatingSheet } from "../components/RatingSheet";
import { hapticLight, hapticMedium } from "../lib/haptics";
import { formatTimer, formatDuration } from "../lib/time";
import { ACCENT_COLORS, AMBIENT_SOUNDS } from "../types";
import type { AmbientSoundKey } from "../types";
import type { RootStackParamList } from "../navigation/types";
import { NoiseTexture } from "../components/NoiseTexture";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const RING_SIZE = 260;
const RING_STROKE = 6;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

type FocusRoute = RouteProp<RootStackParamList, "FocusSession">;
type FocusNav = NativeStackNavigationProp<RootStackParamList>;

export function FocusSessionScreen() {
  const route = useRoute<FocusRoute>();
  const navigation = useNavigation<FocusNav>();
  const { goalId } = route.params;

  const goals = useAppStore((s) => s.goals);
  const goal = goals.find((g) => g.id === goalId);

  const {
    activeSession,
    startFocusSession,
    stopFocusSession,
    togglePause,
    skipBreak,
    isRunning,
  } = usePomodoro();

  const { currentSound, selectSound, volume, setVolume } = useAmbientSound();
  const rateSessionMutation = useRateSession();
  const [showRating, setShowRating] = useState(false);
  const [sessionDuration, setSessionDuration] = useState(0);

  const pomodoro = activeSession?.pomodoro;
  const elapsed = pomodoro?.elapsed_seconds ?? 0;
  const duration = pomodoro?.is_break || pomodoro?.is_long_break
    ? pomodoro?.break_duration_seconds ?? 300
    : pomodoro?.duration_seconds ?? 1500;
  const progress = duration > 0 ? elapsed / duration : 0;

  const progressAnim = useSharedValue(0);

  useEffect(() => {
    progressAnim.value = withTiming(progress, {
      duration: 900,
      easing: Easing.linear,
    });
  }, [progress, progressAnim]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: RING_CIRCUMFERENCE * (1 - progressAnim.value),
  }));

  const hasStartedRef = React.useRef(false);
  useEffect(() => {
    if (goal && !activeSession && !hasStartedRef.current) {
      hasStartedRef.current = true;
      startFocusSession(goal);
    }
  }, [goal, activeSession, startFocusSession]);

  const accentColor = goal ? ACCENT_COLORS[goal.color] : "#4A9EFF";

  const handleStop = useCallback(async () => {
    if (!activeSession) return;
    const startTime = new Date(activeSession.start_time).getTime();
    const dur = Math.floor((Date.now() - startTime) / 1000);
    setSessionDuration(dur);
    await stopFocusSession();
    hapticMedium();
    setShowRating(true);
  }, [activeSession, stopFocusSession]);

  const handleRate = useCallback(async (rating: number, notes: string | null) => {
    const lastId = useAppStore.getState().lastCompletedSessionId;
    if (lastId) {
      await rateSessionMutation.mutateAsync({
        session_id: lastId,
        rating,
        notes,
      });
    }
    setShowRating(false);
    navigation.goBack();
  }, [rateSessionMutation, navigation]);

  const handleDismissRating = useCallback(() => {
    setShowRating(false);
    navigation.goBack();
  }, [navigation]);

  if (!goal) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <Text className="text-text-secondary text-body">Goal not found</Text>
      </SafeAreaView>
    );
  }

  const statusLabel = pomodoro?.is_long_break
    ? "Long Break"
    : pomodoro?.is_break
      ? "Short Break"
      : `Cycle ${pomodoro?.current_cycle ?? 1}`;

  const remainingSeconds = Math.max(0, duration - elapsed);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <NoiseTexture />
      <Animated.View entering={FadeIn.duration(500)} className="flex-1">
        <View className="flex-row items-center justify-between px-screen-x pt-4">
          <Pressable onPress={handleStop} className="px-4 py-2 rounded-button bg-white/[0.06]">
            <Text className="text-text-secondary text-body">End</Text>
          </Pressable>
          <Text className="text-text-secondary text-caption">{statusLabel}</Text>
          <View className="w-16" />
        </View>

        <View className="flex-1 items-center justify-center">
          <Text className="text-text-primary text-heading mb-2" style={{ color: accentColor, fontFamily: "Outfit_600SemiBold" }}>
            {goal.name}
          </Text>

          <View style={{ width: RING_SIZE, height: RING_SIZE }} className="items-center justify-center mb-6">
            <Svg width={RING_SIZE} height={RING_SIZE} className="absolute" style={{ transform: [{ rotate: "-90deg" }] }}>
              <Circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                stroke="rgba(255,255,255,0.06)"
                strokeWidth={RING_STROKE}
                fill="none"
              />
              <AnimatedCircle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                stroke={accentColor}
                strokeWidth={RING_STROKE}
                fill="none"
                strokeDasharray={`${RING_CIRCUMFERENCE}`}
                strokeLinecap="round"
                animatedProps={animatedProps}
              />
            </Svg>
            <Text className="text-text-primary text-5xl font-light tracking-wider" style={{ fontFamily: "Outfit_700Bold", letterSpacing: 4 }}>
              {formatTimer(remainingSeconds)}
            </Text>
          </View>

          {pomodoro && (
            <Text className="text-text-tertiary text-caption mb-8">
              {pomodoro.total_cycles} {pomodoro.total_cycles === 1 ? "cycle" : "cycles"} completed
            </Text>
          )}

          <View className="flex-row gap-4">
            <Pressable
              onPress={() => { togglePause(); hapticLight(); }}
              className="w-16 h-16 items-center justify-center rounded-full bg-white/10"
            >
              <Text className="text-text-primary text-xl">{isRunning ? "⏸" : "▶️"}</Text>
            </Pressable>
            {(pomodoro?.is_break || pomodoro?.is_long_break) && (
              <Pressable
                onPress={() => { skipBreak(); hapticLight(); }}
                className="w-16 h-16 items-center justify-center rounded-full bg-white/10"
              >
                <Text className="text-text-primary text-xl">⏭</Text>
              </Pressable>
            )}
          </View>
        </View>

        <View className="px-screen-x pb-6">
          <Text className="text-text-tertiary text-caption mb-3">Ambient Sound</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
            <View className="flex-row gap-2">
              <Pressable
                onPress={() => { selectSound(null); hapticLight(); }}
                className={`px-4 py-2 rounded-full ${!currentSound ? "bg-white/20" : "bg-white/[0.06]"}`}
              >
                <Text className="text-text-secondary text-caption">Off</Text>
              </Pressable>
              {AMBIENT_SOUNDS.map((s) => (
                <Pressable
                  key={s.key}
                  onPress={() => { selectSound(s.key as AmbientSoundKey); hapticLight(); }}
                  className={`px-4 py-2 rounded-full ${currentSound === s.key ? "bg-white/20" : "bg-white/[0.06]"}`}
                >
                  <Text className="text-text-secondary text-caption">{s.icon} {s.label}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          {currentSound && (
            <View className="flex-row items-center gap-3">
              <Text className="text-text-tertiary text-tiny">🔈</Text>
              <View className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                <Pressable
                  onPress={(e) => {
                    const nativeEvent = e.nativeEvent;
                    const newVolume = Math.max(0, Math.min(1, nativeEvent.locationX / 280));
                    setVolume(newVolume);
                  }}
                  className="flex-1"
                >
                  <View
                    className="h-1 bg-white/40 rounded-full"
                    style={{ width: `${volume * 100}%` }}
                  />
                </Pressable>
              </View>
              <Text className="text-text-tertiary text-tiny">🔊</Text>
            </View>
          )}
        </View>
      </Animated.View>

      {showRating && (
        <RatingSheet
          goalName={goal.name}
          goalColor={goal.color}
          duration={formatDuration(sessionDuration)}
          cycles={pomodoro?.total_cycles}
          onSubmit={handleRate}
          onDismiss={handleDismissRating}
        />
      )}
    </SafeAreaView>
  );
}
