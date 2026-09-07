import React from "react";
import { Pressable, Text, View, ViewStyle, TextStyle } from "react-native";
import { NEU, NEU_FONTS } from "../../theme/neumorphism";

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  containerStyle?: ViewStyle;
  textStyle?: TextStyle;
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  containerStyle,
  textStyle,
}: PrimaryButtonProps) {
  // Fill lives on an inner View: backgrounds set directly on a (nested) Pressable
  // can fail to render in some states (documented pitfall, CLAUDE.md §20.10).
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={({ pressed }) => [
        {
          minHeight: 50,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        containerStyle,
      ]}
    >
      <View
        pointerEvents="none"
        style={{
          minHeight: 50,
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: NEU.radiusSmall,
          backgroundColor: NEU.accent,
          opacity: disabled ? 0.45 : 1,
        }}
      >
        <Text
          style={[
            {
              color: "#FFFFFF",
              fontSize: 17,
              fontFamily: NEU_FONTS.label,
            },
            textStyle,
          ]}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
