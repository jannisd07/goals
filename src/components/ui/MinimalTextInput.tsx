import React, { useState } from "react";
import {
  StyleProp,
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native";
import { NEU, NEU_FONTS } from "../../theme/neumorphism";

interface MinimalTextInputProps extends TextInputProps {
  containerStyle?: StyleProp<ViewStyle>;
  error?: boolean;
  rightAccessory?: React.ReactNode;
}

export function MinimalTextInput({
  containerStyle,
  style,
  error = false,
  rightAccessory,
  onFocus,
  onBlur,
  placeholderTextColor = NEU.textSecondary,
  accessibilityLabel,
  placeholder,
  ...props
}: MinimalTextInputProps) {
  const [focused, setFocused] = useState(false);
  const highlighted = focused || error;

  return (
    <View
      style={[
        styles.container,
        highlighted && styles.highlighted,
        containerStyle,
      ]}
    >
      <TextInput
        {...props}
        accessibilityLabel={accessibilityLabel ?? placeholder}
        placeholder={placeholder}
        placeholderTextColor={placeholderTextColor}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[
          styles.input,
          rightAccessory ? styles.inputWithAccessory : null,
          style,
        ]}
      />
      {rightAccessory ? (
        <View pointerEvents="box-none" style={styles.accessory}>
          {rightAccessory}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 52,
    borderRadius: NEU.radiusSmall,
    backgroundColor: NEU.card,
    borderWidth: 1,
    borderColor: NEU.track,
  },
  highlighted: {
    borderWidth: 2,
    borderColor: NEU.accent,
  },
  input: {
    minHeight: 50,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: NEU.textPrimary,
    fontSize: 16,
    fontFamily: NEU_FONTS.body,
  },
  inputWithAccessory: {
    paddingRight: 96,
  },
  accessory: {
    position: "absolute",
    right: 8,
    top: 0,
    bottom: 0,
    minWidth: NEU.hitTarget,
    alignItems: "center",
    justifyContent: "center",
  },
});
