import React, { useState, useEffect } from "react";
import { View, Text, Pressable, TextInput } from "react-native";
import Animated, {
  FadeIn,
  SlideInDown,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  Easing,
} from "react-native-reanimated";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import { hapticSelection, hapticMedium, hapticSuccess } from "../lib/haptics";
import { ACCENT_COLORS, type AccentColor } from "../types";

interface RatingSheetProps {
  onSubmit: (rating: number, notes: string | null) => void;
  onDismiss: () => void;
  goalName: string;
  duration: string;
  cycles?: number;
  goalColor?: AccentColor;
}

const RATING_EMOJIS = ["😔", "😐", "🙂", "😊", "🤩"];
const ORB_SIZE = 80;

function BloomOrb({ color }: { color: string }) {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withSequence(
      withTiming(1.3, { duration: 500, easing: Easing.bezier(0.34, 1.56, 0.64, 1) }),
      withTiming(1, { duration: 300, easing: Easing.out(Easing.ease) })
    );
    opacity.value = withTiming(1, { duration: 400 });
    hapticSuccess();
  }, [scale, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={animatedStyle} className="items-center justify-center mb-4">
      <Svg width={ORB_SIZE * 2} height={ORB_SIZE * 2}>
        <Defs>
          <RadialGradient id="bloom-grad" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={color} stopOpacity="0.95" />
            <Stop offset="40%" stopColor={color} stopOpacity="0.5" />
            <Stop offset="70%" stopColor={color} stopOpacity="0.15" />
            <Stop offset="100%" stopColor={color} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx={ORB_SIZE} cy={ORB_SIZE} r={ORB_SIZE} fill="url(#bloom-grad)" />
        <Circle cx={ORB_SIZE} cy={ORB_SIZE} r={ORB_SIZE * 0.35} fill={color} opacity={0.7} />
        <Circle cx={ORB_SIZE} cy={ORB_SIZE} r={ORB_SIZE * 0.15} fill="white" opacity={0.4} />
      </Svg>
    </Animated.View>
  );
}

export function RatingSheet({ onSubmit, onDismiss, goalName, duration, cycles, goalColor }: RatingSheetProps) {
  const [rating, setRating] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const accentHex = goalColor ? ACCENT_COLORS[goalColor] : "#4A9EFF";

  const handleRating = (value: number) => {
    setRating(value);
    hapticSelection();
  };

  const handleSubmit = () => {
    if (rating === null) return;
    hapticMedium();
    onSubmit(rating, notes.trim() || null);
  };

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      className="absolute inset-0 bg-black/60 justify-end"
    >
      <Animated.View
        entering={SlideInDown.duration(400).springify()}
        className="bg-[#1A1A24] rounded-t-3xl px-6 pt-6 pb-10"
      >
        <View className="w-10 h-1 bg-white/20 rounded-full self-center mb-4" />

        <BloomOrb color={accentHex} />

        <Text className="text-text-primary text-heading text-center mb-1">
          Session Complete
        </Text>
        <Text className="text-text-secondary text-body text-center mb-1">
          {goalName} — {duration}
        </Text>
        {cycles !== undefined && cycles > 0 && (
          <Text className="text-text-tertiary text-caption text-center mb-6">
            {cycles} {cycles === 1 ? "cycle" : "cycles"} completed
          </Text>
        )}

        <Text className="text-text-secondary text-body text-center mb-4">
          How was this session?
        </Text>

        <View className="flex-row justify-center gap-4 mb-6">
          {RATING_EMOJIS.map((emoji, index) => {
            const value = index + 1;
            const isSelected = rating === value;
            return (
              <Pressable
                key={value}
                onPress={() => handleRating(value)}
                className={`w-14 h-14 items-center justify-center rounded-2xl ${isSelected ? "bg-white/20 scale-110" : "bg-white/[0.06]"
                  }`}
              >
                <Text className="text-2xl">{emoji}</Text>
              </Pressable>
            );
          })}
        </View>

        <TextInput
          placeholder="Quick note (optional)"
          placeholderTextColor="rgba(255,255,255,0.3)"
          value={notes}
          onChangeText={setNotes}
          className="bg-white/[0.06] text-text-primary text-body px-4 py-3 rounded-button mb-6 border border-surface-border"
          maxLength={140}
        />

        <View className="flex-row gap-3">
          <Pressable
            onPress={onDismiss}
            className="flex-1 items-center py-3.5 rounded-button bg-white/[0.06]"
          >
            <Text className="text-text-secondary text-body font-medium">Skip</Text>
          </Pressable>
          <Pressable
            onPress={handleSubmit}
            disabled={rating === null}
            className={`flex-1 items-center py-3.5 rounded-button ${rating !== null ? "bg-white" : "bg-white/20"
              }`}
          >
            <Text
              className={`text-body font-semibold ${rating !== null ? "text-background" : "text-text-tertiary"
                }`}
            >
              Done
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    </Animated.View>
  );
}
