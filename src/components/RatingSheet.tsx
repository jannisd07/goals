import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Animated, {
  FadeIn,
} from "react-native-reanimated";
import { hapticSelection, hapticMedium } from "../lib/haptics";
import { PopupCard } from "./ui/PopupCard";
import { PrimaryButton } from "./ui/PrimaryButton";
import { MinimalTextInput } from "./ui/MinimalTextInput";
import { NEU, NEU_FONTS } from "../theme/neumorphism";

interface RatingSheetProps {
  onSubmit: (rating: number, notes: string | null) => void;
  onDismiss: () => void;
  goalName: string;
  duration: string;
  cycles?: number;
  submitting?: boolean;
}

const RATING_COUNT = 5;

export function RatingSheet({
  onSubmit,
  onDismiss,
  goalName,
  duration,
  cycles,
  submitting = false,
}: RatingSheetProps) {
  const [rating, setRating] = useState<number | null>(null);
  const [notes, setNotes] = useState("");

  const handleRating = (value: number) => {
    setRating(value);
    hapticSelection();
  };

  const handleSubmit = () => {
    if (rating === null || submitting) return;
    hapticMedium();
    onSubmit(rating, notes.trim() || null);
  };

  const cycleText =
    cycles !== undefined && cycles > 0
      ? `${cycles} ${cycles === 1 ? "cycle" : "cycles"}`
      : null;

  const subtitle = cycleText
    ? `${duration} \u00B7 ${cycleText}`
    : duration;

  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.overlay}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Close rating"
      />

      <Animated.View
        accessibilityViewIsModal
        entering={FadeIn.duration(220)}
        style={styles.sheetWrap}
      >
        <PopupCard>
          {/* Header */}
          <Text style={styles.headerTitle}>{goalName}</Text>
          <Text style={styles.headerSubtitle}>{subtitle}</Text>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Rating */}
          <Text style={styles.ratingPrompt}>How was it?</Text>
          <View style={styles.ratingRow}>
            {Array.from({ length: RATING_COUNT }, (_, i) => {
              const value = i + 1;
              const isSelected = rating === value;
              return (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityLabel={`Rate ${value} out of ${RATING_COUNT}`}
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => handleRating(value)}
                  style={({ pressed }) => [
                    styles.ratingCircle,
                    isSelected && styles.ratingCircleSelected,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text
                    style={[
                      styles.ratingNumber,
                      isSelected && styles.ratingNumberSelected,
                    ]}
                  >
                    {value}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Rating label */}
          {rating !== null && (
            <Animated.Text
              entering={FadeIn.duration(200)}
              style={styles.ratingLabel}
            >
              {rating === 1
                ? "Poor"
                : rating === 2
                  ? "Okay"
                  : rating === 3
                    ? "Good"
                    : rating === 4
                      ? "Great"
                      : "Amazing"}
            </Animated.Text>
          )}

          {/* Notes input */}
          <MinimalTextInput
            placeholder="Quick note (optional)"
            placeholderTextColor={NEU.textSecondary}
            value={notes}
            onChangeText={setNotes}
            style={styles.notesInput}
            containerStyle={{ marginTop: 16, marginBottom: 20 }}
            maxLength={140}
            multiline={false}
          />

          {/* Save button */}
          <PrimaryButton
            label={submitting ? "Saving…" : "Save"}
            onPress={handleSubmit}
            disabled={rating === null || submitting}
          />

          {/* Skip text link */}
          <Pressable
            onPress={() => {
              if (!submitting) onDismiss();
            }}
            accessibilityRole="button"
            accessibilityLabel="Skip rating"
            accessibilityState={{ disabled: submitting }}
            disabled={submitting}
            style={({ pressed }) => [
              styles.skipButton,
              pressed && { opacity: 0.5 },
            ]}
          >
            <Text style={styles.skipButtonText}>Skip</Text>
          </Pressable>
        </PopupCard>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },

  sheetWrap: {
    width: "100%",
    maxWidth: 420,
  },

  // Header
  headerTitle: {
    color: NEU.textPrimary,
    fontSize: 22,
    fontFamily: "Outfit_700Bold",
    textAlign: "center",
    marginBottom: 4,
  },
  headerSubtitle: {
    color: NEU.textSecondary,
    fontSize: 16,
    fontFamily: "Outfit_500Medium",
    textAlign: "center",
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: NEU.track,
    opacity: 0.6,
    marginVertical: 20,
  },

  // Rating
  ratingPrompt: {
    color: NEU.textSecondary,
    fontSize: 16,
    fontFamily: "Outfit_500Medium",
    textAlign: "center",
    marginBottom: 16,
  },
  ratingRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    marginBottom: 8,
  },
  ratingCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: NEU.track,
    backgroundColor: NEU.card,
    alignItems: "center",
    justifyContent: "center",
  },
  ratingCircleSelected: {
    borderColor: NEU.accent,
    backgroundColor: NEU.accent,
  },
  ratingNumber: {
    color: NEU.textPrimary,
    fontSize: 18,
    fontFamily: NEU_FONTS.label,
  },
  ratingNumberSelected: {
    color: "#FFFFFF",
  },
  ratingLabel: {
    color: NEU.textSecondary,
    fontSize: 13,
    fontFamily: "Outfit_500Medium",
    textAlign: "center",
    marginBottom: 4,
  },

  // Notes
  notesInput: {
    minHeight: 48,
  },

  // Skip
  skipButton: {
    alignItems: "center",
    paddingVertical: 14,
    marginTop: 4,
  },
  skipButtonText: {
    color: NEU.textSecondary,
    fontSize: 14,
    fontFamily: "Outfit_500Medium",
  },
});
