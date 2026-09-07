import React, { useMemo } from "react";
import { View, Text, Pressable } from "react-native";
import { NeumorphicSurface } from "./NeumorphicSurface";
import { ChevronRightIcon } from "./TabIcons";
import { useAppStore } from "../store";
import { NEU, NEU_FONTS } from "../theme/neumorphism";

const PREVIEW_WIDTH = 280;
const PREVIEW_HEIGHT = 116;
const GROVE_BOTTOM_RADIUS = 31;

interface GardenPreviewProps {
  onPress: () => void;
  fill?: boolean;
}

export function GardenPreview({ onPress, fill = false }: GardenPreviewProps) {
  const goals = useAppStore((s) => s.goals);
  const weeklyProgress = useAppStore((s) => s.weeklyProgress);

  const focusGoals = useMemo(
    () => goals.filter((g) => g.type === "focus"),
    [goals],
  );

  const dots = useMemo(() => {
    if (focusGoals.length === 0) return [];

    const padding = 20;
    const usableW = PREVIEW_WIDTH - padding * 2;
    const usableH = PREVIEW_HEIGHT - padding * 2;
    const cx = PREVIEW_WIDTH / 2;
    const cy = PREVIEW_HEIGHT / 2;

    return focusGoals.map((goal, i, arr) => {
      const progress = weeklyProgress[goal.id];
      const totalSessions = progress?.sessions_completed ?? 0;
      const stage = Math.min(4, Math.floor(totalSessions / 2));
      const angle =
        (i / Math.max(1, arr.length)) * Math.PI * 2 + Math.PI / 4;
      const rx = usableW * 0.35;
      const ry = usableH * 0.35;

      return {
        id: goal.id,
        stage,
        x: cx + Math.cos(angle) * rx,
        y: cy + Math.sin(angle) * ry,
      };
    });
  }, [focusGoals, weeklyProgress]);

  return (
    <NeumorphicSurface
      radius={20}
      bottomRadius={fill ? GROVE_BOTTOM_RADIUS : 20}
      darkShadowOpacity={fill ? 0.45 : 1}
      contentPadding={0}
      style={
        fill
          ? { flex: 1, padding: 16 }
          : { marginHorizontal: 24, marginTop: 4, marginBottom: 28, padding: 18 }
      }
    >
        {/* Header row */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <Text
            style={{
              color: NEU.textPrimary,
              fontSize: 15,
              fontFamily: NEU_FONTS.label,
            }}
          >
            Island
          </Text>
          <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel="Open island"
            accessibilityHint="Shows the constellation created by your completed sessions"
            style={({ pressed }) => ({
              minWidth: 64,
              minHeight: NEU.hitTarget,
              marginVertical: -10,
              alignItems: "flex-end",
              justifyContent: "center",
              opacity: pressed ? 0.5 : 1,
            })}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text
              style={{
                color: NEU.accent,
                fontSize: 12.5,
                fontFamily: NEU_FONTS.label,
                marginRight: 2,
              }}
            >
              View
            </Text>
            <ChevronRightIcon size={14} color={NEU.accent} />
            </View>
          </Pressable>
        </View>

        {/* Garden preview area with dots */}
        <View
          style={{
            width: "100%",
            ...(fill ? { flex: 1 } : { height: PREVIEW_HEIGHT }),
            borderRadius: 18,
            backgroundColor: NEU.bg,
            overflow: "hidden",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View style={{ width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT }}>
            {dots.map((dot) => {
              const size = 6 + dot.stage * 3;
              const opacity = 0.3 + dot.stage * 0.15;
              return (
                <View
                  key={dot.id}
                  style={{
                    position: "absolute",
                    left: dot.x - size / 2,
                    top: dot.y - size / 2,
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor: NEU.accent,
                    opacity,
                  }}
                />
              );
            })}
            {dots.length === 0 && (
              <View
                style={{
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    color: NEU.textSecondary,
                    fontSize: 12,
                    fontFamily: NEU_FONTS.body,
                  }}
                >
                  Complete focus sessions to grow
                </Text>
              </View>
            )}
          </View>
        </View>
    </NeumorphicSurface>
  );
}
