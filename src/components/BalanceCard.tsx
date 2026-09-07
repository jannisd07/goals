import React from "react";
import { Text } from "react-native";
import { NeumorphicSurface } from "./NeumorphicSurface";
import { NEU, NEU_FONTS } from "../theme/neumorphism";
import { ProgressBar } from "./ProgressBar";
import { useAppStore } from "../store";

export function BalanceCard() {
  const disposableTimeHours = useAppStore((s) => s.disposableTimeHours);
  const usedTimeThisWeekSeconds = useAppStore((s) => s.usedTimeThisWeekSeconds);

  const remainingSeconds = Math.max(
    0,
    disposableTimeHours * 3600 - usedTimeThisWeekSeconds,
  );
  const remainingHrs = Math.floor(remainingSeconds / 3600);
  const remainingMins = Math.floor((remainingSeconds % 3600) / 60);

  const consumedFraction =
    disposableTimeHours > 0
      ? Math.min(1, usedTimeThisWeekSeconds / 3600 / disposableTimeHours)
      : 0;
  const remainingFraction = 1 - consumedFraction;

  return (
    <NeumorphicSurface
      radius={20}
      contentPadding={0}
      style={{ marginHorizontal: 24, marginBottom: 16, padding: 20 }}
    >
      {/* Primary figure */}
      <Text
        style={{
          color: NEU.textPrimary,
          fontSize: 34,
          fontFamily: NEU_FONTS.heading,
          letterSpacing: -1,
          lineHeight: 38,
        }}
      >
        {remainingHrs}h {remainingMins.toString().padStart(2, "0")}m
      </Text>

      <Text
        style={{
          color: NEU.textSecondary,
          fontSize: 13,
          fontFamily: NEU_FONTS.body,
          marginTop: 4,
          marginBottom: 14,
        }}
      >
        remaining of {Math.round(disposableTimeHours)} hrs this week
      </Text>

      {/* Progress bar */}
      <ProgressBar
        progress={remainingFraction}
        color={NEU.accent}
        height={7}
        trackColor="#C5CDD8"
      />
    </NeumorphicSurface>
  );
}
