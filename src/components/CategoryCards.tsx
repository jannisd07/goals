import React from "react";
import { Pressable, Text, View } from "react-native";
import { NEU, NEU_FONTS } from "../theme/neumorphism";
import { PAPER } from "../theme/paper";
import type { GoalCategory } from "../types";

interface CategoryCardsProps {
  categories: GoalCategory[];
  selectedKey: string | null;
  onSelect: (category: GoalCategory) => void;
}

/**
 * "What is it for" selection grid. The chosen label becomes the goal name
 * and therefore the card title on the home screen.
 */
export function CategoryCards({ categories, selectedKey, onSelect }: CategoryCardsProps) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -6 }}>
      {categories.map((category) => {
        const selected = category.key === selectedKey;
        return (
          <View key={category.key} style={{ width: "50%", paddingHorizontal: 6, marginBottom: 12 }}>
            <Pressable
              onPress={() => onSelect(category)}
              accessibilityRole="button"
              accessibilityLabel={category.label}
              accessibilityState={{ selected }}
              style={({ pressed }) => ({
                minHeight: 56,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: selected ? PAPER.accent : PAPER.line,
                backgroundColor: selected ? PAPER.accentWash : PAPER.surface,
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: 12,
                paddingVertical: 14,
                opacity: pressed ? 0.72 : 1,
              })}
            >
              <Text
                style={{
                  color: selected ? PAPER.accentInk : PAPER.ink,
                  fontSize: 16,
                  fontFamily: NEU_FONTS.label,
                  textAlign: "center",
                }}
              >
                {category.label}
              </Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  unit: string;
  accessibilityLabel: string;
}

export function ValueStepper({ value, onChange, min, max, unit, accessibilityLabel }: StepperProps) {
  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min, max, now: value, text: `${value} ${unit}` }}
      accessibilityActions={[
        { name: "increment", label: "Increase" },
        { name: "decrement", label: "Decrease" },
      ]}
      onAccessibilityAction={(event) => {
        const delta = event.nativeEvent.actionName === "increment" ? 1 : -1;
        onChange(Math.min(max, Math.max(min, value + delta)));
      }}
      // The stepper sits on the ocean artwork on every setup page. Without its
      // own white body the value and the green +/- read as invisible marks on
      // the water, which is why it looked like the control was dead.
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        alignSelf: "center",
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: PAPER.radiusLg,
        backgroundColor: PAPER.surface,
        borderWidth: 1,
        borderColor: PAPER.line,
      }}
    >
      <Pressable
        onPress={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        accessibilityLabel="Decrease"
        accessibilityRole="button"
        accessibilityState={{ disabled: value <= min }}
        style={({ pressed }) => ({
          width: NEU.hitTarget,
          height: NEU.hitTarget,
          alignItems: "center",
          justifyContent: "center",
          opacity: value <= min ? 0.35 : pressed ? 0.5 : 1,
        })}
      >
        <Text style={{ color: PAPER.accentInk, fontSize: 26, fontFamily: NEU_FONTS.label }}>{"−"}</Text>
      </Pressable>

      <View style={{ alignItems: "center", minWidth: 96 }}>
        <Text style={{ color: PAPER.ink, fontSize: 34, lineHeight: 38, fontFamily: NEU_FONTS.heading }}>
          {value}
        </Text>
        <Text style={{ color: PAPER.inkMuted, fontSize: 13, fontFamily: NEU_FONTS.body }}>{unit}</Text>
      </View>

      <Pressable
        onPress={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        accessibilityLabel="Increase"
        accessibilityRole="button"
        accessibilityState={{ disabled: value >= max }}
        style={({ pressed }) => ({
          width: NEU.hitTarget,
          height: NEU.hitTarget,
          alignItems: "center",
          justifyContent: "center",
          opacity: value >= max ? 0.35 : pressed ? 0.5 : 1,
        })}
      >
        <Text style={{ color: PAPER.accentInk, fontSize: 26, fontFamily: NEU_FONTS.label }}>+</Text>
      </Pressable>
    </View>
  );
}
