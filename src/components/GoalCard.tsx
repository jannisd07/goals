import React from "react";
import { ActivityIndicator, View, Text, Pressable } from "react-native";
import { NeumorphicSurface } from "./NeumorphicSurface";
import { ProgressBar } from "./ProgressBar";
import { LocationIcon, TimerIcon } from "./TabIcons";
import { useAppStore } from "../store";
import { hapticLight } from "../lib/haptics";
import { getWeekEnd, getWeekStart } from "../lib/time";
import type { Goal } from "../types";
import { NEU, NEU_FONTS } from "../theme/neumorphism";

interface GoalCardProps {
  goal: Goal;
  onStartSession: (goal: Goal) => void;
  /** Long-press on the Start pill opens the session setup popup (one-tap starts directly). */
  onLongPressSession?: (goal: Goal) => void;
  isPhysicalSessionActive?: boolean;
  physicalSessionBusy?: boolean;
  onStartPhysicalSession?: (goal: Goal) => void;
  onEndPhysicalSession?: (goal: Goal) => void;
}

export function GoalCard({
  goal,
  onStartSession,
  onLongPressSession,
  isPhysicalSessionActive = false,
  physicalSessionBusy = false,
  onStartPhysicalSession,
  onEndPhysicalSession,
}: GoalCardProps) {
  const weeklyProgress = useAppStore((s) => s.weeklyProgress[goal.id]);
  const activeSession = useAppStore((s) => s.activeSession);
  const defaultFocusStyle = useAppStore((s) => s.focusStyle);
  const isPhysical = goal.type === "physical";
  const isActive = isPhysical
    ? isPhysicalSessionActive
    : activeSession?.goal_id === goal.id;

  const sessionsCompleted = weeklyProgress?.sessions_completed ?? 0;
  const activeStartTime = activeSession
    ? new Date(activeSession.start_time).getTime()
    : 0;
  const activeStartedThisWeek =
    activeStartTime >= getWeekStart().getTime() &&
    activeStartTime <= getWeekEnd().getTime();
  // The persisted weekly aggregate excludes the open database row. Add only
  // the focus seconds earned in the currently running local session so the
  // card progresses live without prematurely counting it as "completed".
  const liveHours =
    isActive && activeStartedThisWeek && activeSession?.pomodoro
      ? activeSession.pomodoro.focused_seconds / 3600
      : 0;
  const totalHours = (weeklyProgress?.total_hours ?? 0) + liveHours;

  const focusStyle = isActive
    ? activeSession?.pomodoro?.mode ?? defaultFocusStyle
    : defaultFocusStyle;
  const typeLabel = isPhysical
    ? isActive
      ? "Checked in"
      : "Auto Check-In"
    : focusStyle === "flowtime"
      ? "Flowtime"
      : "Intervals";

  const progressValue = isPhysical
    ? goal.target_sessions_per_week > 0
      ? sessionsCompleted / goal.target_sessions_per_week
      : 0
    : goal.target_hours_per_week > 0
      ? totalHours / goal.target_hours_per_week
      : 0;

  const progressText = isPhysical
    ? `${sessionsCompleted} / ${goal.target_sessions_per_week} sessions`
    : `${totalHours.toFixed(1)} / ${goal.target_hours_per_week}h`;

  const handlePress = () => {
    hapticLight();
    if (isPhysical) {
      if (isActive) {
        onEndPhysicalSession?.(goal);
      } else {
        onStartPhysicalSession?.(goal);
      }
    } else {
      onStartSession(goal);
    }
  };

  const handleLongPress = () => {
    if (!isPhysical && !isActive && onLongPressSession) {
      hapticLight();
      onLongPressSession(goal);
    }
  };

  return (
    <View>
      <NeumorphicSurface
        radius={20}
        contentPadding={0}
        style={{ marginHorizontal: 24, marginBottom: 16, padding: 16 }}
      >
        {/* Header row: name + type badge */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <Text
            style={{
              color: NEU.textPrimary,
              fontSize: 16,
              fontFamily: NEU_FONTS.label,
              letterSpacing: -0.2,
              flex: 1,
            }}
            numberOfLines={1}
          >
            {goal.name}
          </Text>

          {/* Type indicator */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginLeft: 10,
            }}
          >
            {isPhysical ? (
              <LocationIcon size={13} color={NEU.textSecondary} />
            ) : (
              <TimerIcon size={13} color={NEU.textSecondary} />
            )}
            <Text
              style={{
                color: NEU.textSecondary,
                fontSize: 12,
                fontFamily: NEU_FONTS.body,
                marginLeft: 4,
              }}
            >
              {typeLabel}
            </Text>
          </View>
        </View>

        {/* Progress bar */}
        <ProgressBar
          progress={progressValue}
          color={NEU.accent}
          height={5}
          trackColor="#C5CDD8"
        />

        {/* Progress text + action row */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 12,
          }}
        >
          <Text
            style={{
              color: NEU.textSecondary,
              fontSize: 13,
              fontFamily: NEU_FONTS.body,
            }}
          >
            {progressText}
          </Text>

          {/* Active / action button */}
          {isActive ? (
            <Pressable
              onPress={handlePress}
              disabled={physicalSessionBusy}
              accessibilityRole="button"
              accessibilityLabel={
                isPhysical
                  ? `End ${goal.name} check-in`
                  : `Resume ${goal.name} focus session`
              }
              style={{
                width: isPhysical ? 94 : 78,
                height: NEU.hitTarget,
                marginRight: -6,
                alignItems: "center",
                justifyContent: "center",
                transform: [{ translateY: 10 }],
                opacity: physicalSessionBusy ? 0.55 : 1,
              }}
            >
              <View
                pointerEvents="none"
                style={{
                  width: isPhysical ? 94 : 78,
                  height: 34,
                  borderRadius: 999,
                  backgroundColor: NEU.accent,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {physicalSessionBusy ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text
                    style={{
                      color: "#FFFFFF",
                      fontSize: 14,
                      fontFamily: NEU_FONTS.label,
                    }}
                  >
                    {isPhysical ? "End session" : "Resume"}
                  </Text>
                )}
              </View>
            </Pressable>
          ) : isPhysical ? (
            <Pressable
              onPress={handlePress}
              disabled={physicalSessionBusy}
              accessibilityRole="button"
              accessibilityLabel={`Start ${goal.name} check-in manually`}
              style={({ pressed }) => ({
                minWidth: 104,
                minHeight: NEU.hitTarget,
                alignItems: "flex-end",
                justifyContent: "center",
                opacity: physicalSessionBusy ? 0.4 : pressed ? 0.5 : 1,
              })}
            >
              {physicalSessionBusy ? (
                <ActivityIndicator size="small" color={NEU.accent} />
              ) : (
                <Text
                  style={{
                    color: NEU.accent,
                    fontSize: 13,
                    fontFamily: NEU_FONTS.label,
                  }}
                >
                  Start manually
                </Text>
              )}
            </Pressable>
          ) : (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginRight: -6,
                transform: [{ translateY: 10 }],
              }}
            >
              {onLongPressSession ? (
                <Pressable
                  onPress={handleLongPress}
                  accessibilityRole="button"
                  accessibilityLabel={`Adjust ${goal.name} focus session`}
                  style={({ pressed }) => ({
                    minWidth: 62,
                    minHeight: NEU.hitTarget,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: pressed ? 0.5 : 1,
                  })}
                >
                  <Text
                    style={{
                      color: NEU.accent,
                      fontSize: 13,
                      fontFamily: NEU_FONTS.label,
                    }}
                  >
                    Adjust
                  </Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={handlePress}
                onLongPress={handleLongPress}
                accessibilityRole="button"
                accessibilityLabel={`Start ${goal.name} focus session`}
                accessibilityHint={`Starts a ${focusStyle === "flowtime" ? "Flowtime count-up" : "countdown interval"} with the current focus settings`}
                style={{
                  width: 68,
                  height: NEU.hitTarget,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <View
                  pointerEvents="none"
                  style={{
                    width: 68,
                    height: 34,
                    borderRadius: 999,
                    backgroundColor: NEU.accent,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      color: "#FFFFFF",
                      fontSize: 14,
                      fontFamily: NEU_FONTS.label,
                      textAlign: "center",
                      includeFontPadding: false,
                    }}
                  >
                    Start
                  </Text>
                </View>
              </Pressable>
            </View>
          )}
        </View>
      </NeumorphicSurface>
    </View>
  );
}
