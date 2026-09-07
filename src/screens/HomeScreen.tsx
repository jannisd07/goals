import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  View,
  Text,
  Linking,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeIn } from "react-native-reanimated";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { BalanceCard } from "../components/BalanceCard";
import { GoalCard } from "../components/GoalCard";
import { GardenPreview } from "../components/GardenPreview";
import { FocusSetupSheet } from "../components/FocusSetupSheet";
import { AnalyticsIcon, FriendsIcon, SettingsIcon } from "../components/TabIcons";
import {
  NeumorphicSurface,
} from "../components/NeumorphicSurface";
import { AtmosphericBackground } from "../components/AtmosphericBackground";
import { useAppStore } from "../store";
import { useGoals } from "../hooks/useGoals";
import {
  useActiveCheckIn,
  useEndActiveCheckIn,
  useStartManualCheckIn,
  useWeeklyProgress,
} from "../hooks/useSessions";
import { useStreak } from "../hooks/useStreak";
import { usePageRefreshAnimation } from "../hooks/usePageRefreshAnimation";
import { useRefreshPermissionWarnings } from "../hooks/useRefreshPermissionWarnings";
import { formatDate } from "../lib/time";
import { persistFocusStyle } from "../lib/focusStyle";
import type { Goal } from "../types";
import type { RootStackParamList } from "../navigation/types";
import { NEU, NEU_FONTS } from "../theme/neumorphism";

type HomeNavProp = NativeStackNavigationProp<RootStackParamList>;

function HeaderActionButton({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      accessibilityRole="button"
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: NEU.accent,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.76 : 1,
        transform: [{ scale: pressed ? 0.96 : 1 }],
      })}
    >
      {children}
    </Pressable>
  );
}

export function HomeScreen() {
  const navigation = useNavigation<HomeNavProp>();
  const [sessionPickerGoal, setSessionPickerGoal] = useState<Goal | null>(null);
  const userConfig = useAppStore((s) => s.userConfig);
  const goals = useAppStore((s) => s.goals);
  const breakDuration = useAppStore((s) => s.breakDuration);
  const lastSessionMinutes = useAppStore((s) => s.lastSessionMinutes);
  const focusStyle = useAppStore((s) => s.focusStyle);
  const setFocusStyle = useAppStore((s) => s.setFocusStyle);
  const setLastSessionMinutes = useAppStore((s) => s.setLastSessionMinutes);
  const autoCheckInPermissionWarning = useAppStore((s) => s.autoCheckInPermissionWarning);

  const goalsQuery = useGoals();
  const progressQuery = useWeeklyProgress();
  const streak = useStreak();
  const refreshKey = usePageRefreshAnimation();
  useRefreshPermissionWarnings(refreshKey);

  const rawName = userConfig?.display_name ?? "there";
  const firstName = rawName.split(" ")[0];
  const focusGoal = goals.find((g) => g.type === "focus") ?? null;
  const autoCheckInGoal = goals.find((g) => g.type === "physical") ?? null;
  const activeCheckIn = useActiveCheckIn(autoCheckInGoal?.id);
  const startManualCheckIn = useStartManualCheckIn();
  const endActiveCheckIn = useEndActiveCheckIn();

  useEffect(() => {
    if (!autoCheckInGoal) return;
    void activeCheckIn.refetch();
  }, [activeCheckIn.refetch, autoCheckInGoal, refreshKey]);

  // One-tap start with the last-used configuration; long-press opens the setup popup.
  const handleStartSession = useCallback(
    (goal: Goal) => {
      navigation.navigate("FocusSession", {
        goalId: goal.id,
        sessionLengthMinutes: lastSessionMinutes,
      });
    },
    [navigation, lastSessionMinutes],
  );

  const handleLongPressSession = useCallback((goal: Goal) => {
    setSessionPickerGoal(goal);
  }, []);

  const handleStartManualCheckIn = useCallback(
    (goal: Goal) => {
      void startManualCheckIn.mutateAsync(goal).catch(() => {
        Alert.alert(
          "Couldn’t start check-in",
          "Check your connection and try again.",
        );
      });
    },
    [startManualCheckIn],
  );

  const handleEndActiveCheckIn = useCallback(
    (_goal: Goal) => {
      const session = activeCheckIn.data;
      if (!session) return;
      void endActiveCheckIn.mutateAsync(session).catch((error: unknown) => {
        Alert.alert(
          "Couldn’t end check-in",
          error instanceof Error
            ? error.message
            : "Check your connection and try again.",
        );
      });
    },
    [activeCheckIn.data, endActiveCheckIn],
  );

  const handleSettings = useCallback(() => {
    navigation.navigate("Settings");
  }, [navigation]);

  const handleStats = useCallback(() => {
    navigation.navigate("Analytics");
  }, [navigation]);

  const handleOpenSystemSettings = useCallback(() => {
    void Linking.openSettings();
  }, []);

  if (goals.length === 0 && goalsQuery.isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: NEU.bg }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={NEU.accent} />
          <Text
            style={{
              color: NEU.textSecondary,
              fontSize: 16,
              fontFamily: NEU_FONTS.body,
              marginTop: 14,
            }}
          >
            Loading your goals…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (goals.length === 0 && goalsQuery.isError) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: NEU.bg }}>
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 32,
          }}
        >
          <Text
            style={{
              color: NEU.textPrimary,
              fontSize: 24,
              fontFamily: NEU_FONTS.heading,
              textAlign: "center",
            }}
          >
            Your goals could not be loaded
          </Text>
          <Text
            style={{
              color: NEU.textSecondary,
              fontSize: 16,
              fontFamily: NEU_FONTS.body,
              lineHeight: 23,
              textAlign: "center",
              marginTop: 10,
            }}
          >
            Check your connection before creating or changing anything.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry loading goals"
            onPress={() => {
              void goalsQuery.refetch();
              void progressQuery.refetch();
            }}
            style={{
              minHeight: NEU.hitTarget,
              justifyContent: "center",
              paddingHorizontal: 20,
              marginTop: 14,
            }}
          >
            <Text
              style={{
                color: NEU.accent,
                fontSize: 16,
                fontFamily: NEU_FONTS.label,
              }}
            >
              Try Again
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: NEU.bg }} edges={["top"]}>
      <AtmosphericBackground />
      <Animated.View key={refreshKey} entering={FadeIn.duration(400)} style={{ flex: 1 }}>
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 22,
            paddingTop: 12,
            paddingBottom: 16,
          }}
        >
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text
              style={{
                color: NEU.textPrimary,
                fontSize: 28,
                fontFamily: NEU_FONTS.heading,
                letterSpacing: -0.3,
              }}
            >
              Hey {firstName}
            </Text>
            <Text
              style={{
                color: NEU.textSecondary,
                fontSize: 13,
                fontFamily: NEU_FONTS.body,
                marginTop: 3,
              }}
            >
              {formatDate()}
              {streak && streak.current > 0 ? (
                <Text style={{ color: NEU.accent, fontFamily: NEU_FONTS.label }}>
                  {`  ·  ${streak.current}-day streak`}
                </Text>
              ) : null}
            </Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <HeaderActionButton
              label="Open friends"
              onPress={() => navigation.navigate("Friends")}
            >
              <FriendsIcon size={20} color="#FFFFFF" />
            </HeaderActionButton>
            <HeaderActionButton label="Open stats" onPress={handleStats}>
              <AnalyticsIcon size={20} color="#FFFFFF" />
            </HeaderActionButton>
            <HeaderActionButton label="Open settings" onPress={handleSettings}>
              <SettingsIcon size={20} color="#FFFFFF" />
            </HeaderActionButton>
          </View>
        </View>

        {/* Content — fills the screen, no scroll */}
        <View style={{ flex: 1, paddingTop: 12 }}>
          {progressQuery.isError ? (
            <NeumorphicSurface
              radius={20}
              contentPadding={16}
              style={{ marginHorizontal: 24, marginBottom: 16 }}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text
                  style={{
                    flex: 1,
                    color: NEU.textSecondary,
                    fontSize: 13,
                    fontFamily: NEU_FONTS.body,
                  }}
                >
                  Weekly progress is temporarily unavailable.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Retry weekly progress"
                  onPress={() => void progressQuery.refetch()}
                  style={{
                    minHeight: NEU.hitTarget,
                    justifyContent: "center",
                    paddingHorizontal: 8,
                  }}
                >
                  <Text
                    style={{
                      color: NEU.accent,
                      fontSize: 14,
                      fontFamily: NEU_FONTS.label,
                    }}
                  >
                    Retry
                  </Text>
                </Pressable>
              </View>
            </NeumorphicSurface>
          ) : (
            <BalanceCard />
          )}

          <>
            <Text
              style={{
                color: NEU.textSecondary,
                fontSize: 13,
                fontFamily: NEU_FONTS.label,
                letterSpacing: 1.2,
                textTransform: "uppercase",
                marginHorizontal: 22,
                marginTop: 4,
                marginBottom: 14,
              }}
            >
              Goals
            </Text>

            {focusGoal ? (
              <GoalCard
                key={focusGoal.id}
                goal={focusGoal}
                onStartSession={handleStartSession}
                onLongPressSession={handleLongPressSession}
              />
            ) : (
              <NeumorphicSurface
                radius={20}
                contentPadding={0}
                style={{ marginHorizontal: 24, marginBottom: 16, padding: 22 }}
              >
                <Text
                  style={{
                    color: NEU.textPrimary,
                    fontSize: 18,
                    fontFamily: NEU_FONTS.label,
                  }}
                >
                  Focus Time
                </Text>
                <Text
                  style={{
                    color: NEU.textSecondary,
                    fontSize: 16,
                    fontFamily: NEU_FONTS.body,
                    marginTop: 8,
                    marginBottom: 14,
                  }}
                >
                  Track hours with the focus timer for work, reading, and learning.
                </Text>
                <Pressable
                  onPress={() => navigation.navigate("SetupStudying")}
                  accessibilityLabel="Set up focus time"
                  accessibilityRole="button"
                  style={{
                    alignSelf: "flex-start",
                    paddingHorizontal: 16,
                    minHeight: NEU.hitTarget,
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      color: NEU.accent,
                      fontSize: 16,
                      fontFamily: NEU_FONTS.label,
                    }}
                  >
                    Set Up
                  </Text>
                </Pressable>
              </NeumorphicSurface>
            )}

            {autoCheckInPermissionWarning ? (
              <NeumorphicSurface
                style={{ marginHorizontal: 24, marginBottom: 12 }}
                contentPadding={12}
              >
                <View
                  style={{
                    minHeight: NEU.hitTarget,
                    flexDirection: "row",
                    alignItems: "center",
                  }}
                >
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text
                      style={{
                        color: NEU.textPrimary,
                        fontSize: 15,
                        fontFamily: NEU_FONTS.label,
                      }}
                    >
                      Auto Check-In is off
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={{
                        color: NEU.textSecondary,
                        fontSize: 13,
                        fontFamily: NEU_FONTS.body,
                        marginTop: 2,
                      }}
                    >
                      Location Always permission is needed
                    </Text>
                  </View>
                  <Pressable
                    onPress={handleOpenSystemSettings}
                    accessibilityLabel="Open system settings"
                    accessibilityRole="button"
                    style={{
                      minWidth: NEU.hitTarget,
                      minHeight: NEU.hitTarget,
                      alignItems: "center",
                      justifyContent: "center",
                      paddingHorizontal: 6,
                    }}
                  >
                    <Text
                      style={{
                        color: NEU.accent,
                        fontSize: 15,
                        fontFamily: NEU_FONTS.label,
                      }}
                    >
                      Settings
                    </Text>
                  </Pressable>
                </View>
              </NeumorphicSurface>
            ) : null}

            {autoCheckInGoal ? (
              <GoalCard
                key={autoCheckInGoal.id}
                goal={autoCheckInGoal}
                onStartSession={handleStartSession}
                isPhysicalSessionActive={Boolean(activeCheckIn.data)}
                physicalSessionBusy={
                  activeCheckIn.isLoading ||
                  activeCheckIn.isFetching ||
                  startManualCheckIn.isPending ||
                  endActiveCheckIn.isPending
                }
                onStartPhysicalSession={handleStartManualCheckIn}
                onEndPhysicalSession={handleEndActiveCheckIn}
              />
            ) : (
              <NeumorphicSurface
                radius={20}
                contentPadding={0}
                style={{ marginHorizontal: 24, marginBottom: 16, padding: 22 }}
              >
                <Text
                  style={{
                    color: NEU.textPrimary,
                    fontSize: 18,
                    fontFamily: NEU_FONTS.label,
                  }}
                >
                  Auto Check-In
                </Text>
                <Text
                  style={{
                    color: NEU.textSecondary,
                    fontSize: 16,
                    fontFamily: NEU_FONTS.body,
                    marginTop: 8,
                    marginBottom: 14,
                  }}
                >
                  Auto-log visit counts when you arrive at a location like gym or office.
                </Text>
                <Pressable
                  onPress={() => navigation.navigate("SetupGeofence")}
                  accessibilityLabel="Set up auto check-in"
                  accessibilityRole="button"
                  style={{
                    alignSelf: "flex-start",
                    paddingHorizontal: 16,
                    minHeight: NEU.hitTarget,
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      color: NEU.accent,
                      fontSize: 16,
                      fontFamily: NEU_FONTS.label,
                    }}
                  >
                    Set Up
                  </Text>
                </Pressable>
              </NeumorphicSurface>
            )}
          </>

          <View style={{ flex: 1, marginHorizontal: 24, marginTop: 0, marginBottom: 24 }}>
            <GardenPreview
              onPress={() =>
                navigation.navigate("MainTabs", { screen: "Grove" })
              }
              fill
            />
          </View>
        </View>

        <FocusSetupSheet
          visible={Boolean(sessionPickerGoal)}
          goalName={sessionPickerGoal?.name ?? "Focus"}
          initialMinutes={lastSessionMinutes}
          initialStyle={focusStyle}
          baseBreakMinutes={breakDuration}
          onClose={() => setSessionPickerGoal(null)}
          onConfirm={(minutes, style) => {
            const currentGoal = sessionPickerGoal;
            if (!currentGoal) return;
            setSessionPickerGoal(null);
            const previousStyle = focusStyle;
            setFocusStyle(style);
            setLastSessionMinutes(minutes);
            if (userConfig?.id && style !== previousStyle) {
              const requestUserId = userConfig.id;
              void persistFocusStyle(requestUserId, style)
                .then(() => undefined)
                .catch(() => {
                  const current = useAppStore.getState();
                  if (
                    current.userConfig?.id !== requestUserId ||
                    current.focusStyle !== style
                  ) {
                    return;
                  }
                  setFocusStyle(previousStyle);
                });
            }
            navigation.navigate("FocusSession", {
              goalId: currentGoal.id,
              sessionLengthMinutes: minutes,
            });
          }}
        />
      </Animated.View>
    </SafeAreaView>
  );
}
