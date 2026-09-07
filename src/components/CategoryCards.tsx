import React from "react";
import { Pressable, Text, View } from "react-native";
import { NEU, NEU_FONTS } from "../theme/neumorphism";
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
                borderColor: selected ? NEU.accent : NEU.track,
                backgroundColor: selected ? NEU.accent : NEU.card,
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: 12,
                paddingVertical: 14,
                opacity: pressed ? 0.72 : 1,
              })}
            >
              <Text
                style={{
                  color: selected ? "#FFFFFF" : NEU.textPrimary,
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
      style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 20 }}
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
        <Text style={{ color: NEU.accent, fontSize: 26, fontFamily: NEU_FONTS.label }}>{"−"}</Text>
      </Pressable>

      <View style={{ alignItems: "center", minWidth: 96 }}>
        <Text style={{ color: NEU.textPrimary, fontSize: 34, lineHeight: 38, fontFamily: NEU_FONTS.heading }}>
          {value}
        </Text>
        <Text style={{ color: NEU.textSecondary, fontSize: 13, fontFamily: NEU_FONTS.body }}>{unit}</Text>
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
        <Text style={{ color: NEU.accent, fontSize: 26, fontFamily: NEU_FONTS.label }}>+</Text>
      </Pressable>
    </View>
  );
}
