import React from "react";
import { Pressable, Text, ViewStyle, TextStyle } from "react-native";
import { NEU, NEU_FONTS } from "../../theme/neumorphism";

interface TextActionProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  align?: "left" | "right" | "center";
  containerStyle?: ViewStyle;
  textStyle?: TextStyle;
}

export function TextAction({
  label,
  onPress,
  disabled,
  align = "left",
  containerStyle,
  textStyle,
}: TextActionProps) {
  const alignItems = align === "right" ? "flex-end" : align === "center" ? "center" : "flex-start";

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        {
          minWidth: 72,
          minHeight: 44,
          justifyContent: "center",
          alignItems,
          opacity: disabled ? 0.35 : pressed ? 0.5 : 1,
        },
        containerStyle,
      ]}
    >
      <Text
        style={[
          {
            color: NEU.accent,
            fontSize: 16,
            fontFamily: NEU_FONTS.label,
          },
          textStyle,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
