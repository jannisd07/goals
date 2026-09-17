import React, { useEffect, useRef, useState, useCallback } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import * as Location from "expo-location";
import { useQueryClient } from "@tanstack/react-query";
import { MainTabs } from "./MainTabs";
import { FocusSessionScreen } from "../screens/FocusSessionScreen";
import { GrowRevealScreen } from "../screens/GrowRevealScreen";
import { IslandPlaceScreen } from "../screens/IslandPlaceScreen";
import { AnalyticsScreen } from "../screens/AnalyticsScreen";
import { AnalyticsWeekScreen } from "../screens/AnalyticsWeekScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { SetupStudyingScreen } from "../screens/SetupStudyingScreen";
import { SetupGeofenceScreen } from "../screens/SetupGeofenceScreen";
import { OnboardingScreen } from "../screens/OnboardingScreen";
import { AuthScreen } from "../screens/AuthScreen";
import { FriendsScreen } from "../screens/FriendsScreen";
import { FriendIslandScreen } from "../screens/FriendIslandScreen";
import { RewardsScreen } from "../screens/RewardsScreen";
import { PermissionGateScreen } from "../screens/PermissionGateScreen";
import { PasswordResetScreen } from "../screens/PasswordResetScreen";
import { useAppStore } from "../store";
import { completePendingOnboarding } from "../lib/onboarding";
import { isStaleSession } from "../lib/pomodoro";
import { settleAbandonedSession } from "../lib/abandonedSession";
import { supabase } from "../lib/supabase";
import { NEU } from "../theme/neumorphism";
import { NEU_FONTS } from "../theme/neumorphism";
import { describeSetupSaveError, type SetupSaveFailure } from "../lib/setupSaveError";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  // A session left running days ago must not wake up and count the whole gap.
  // The store hydrates from disk after mount, so this watches the session itself
  // instead of looking once.
  const restoredSession = useAppStore((state) => state.activeSession);
  useEffect(() => {
    const pomodoro = restoredSession?.pomodoro;
    if (!pomodoro) return;
    const startTime = restoredSession?.start_time ? Date.parse(restoredSession.start_time) : NaN;
    const stale = isStaleSession({
      startTimeMs: Number.isNaN(startTime) ? null : startTime,
      focusedSeconds: pomodoro.focused_seconds ?? 0,
      lastTickMs: pomodoro.last_tick_at_ms ?? null,
      nowMs: Date.now(),
    });
    if (stale) {
      console.warn("Dropping a stale focus session from the store");
      // Same settlement as the other two places that notice such a session:
      // keep the reward, close the row with the time that was really focused.
      void settleAbandonedSession(restoredSession);
      useAppStore.getState().endSession(false);
    }
  }, [restoredSession]);

  const queryClient = useQueryClient();
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const isLoading = useAppStore((s) => s.isLoading);
  const userConfig = useAppStore((s) => s.userConfig);
  const pendingOnboarding = useAppStore((s) => s.pendingOnboarding);
  const goals = useAppStore((s) => s.goals);
  const permissionGateDismissed = useAppStore((s) => s.permissionGateDismissed);
  const isPasswordRecovery = useAppStore((s) => s.isPasswordRecovery);
  const setPermissionGateDismissed = useAppStore((s) => s.setPermissionGateDismissed);
  const setPendingOnboarding = useAppStore((s) => s.setPendingOnboarding);
  const setUserConfig = useAppStore((s) => s.setUserConfig);
  const [flushingOnboarding, setFlushingOnboarding] = useState(false);
  const [onboardingFlushError, setOnboardingFlushError] = useState<SetupSaveFailure | null>(null);
  const [onboardingFlushAttempt, setOnboardingFlushAttempt] = useState(0);
  const flushingOnboardingRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || userConfig?.onboarding_complete) {
      setOnboardingFlushError(null);
    }
  }, [isAuthenticated, userConfig?.onboarding_complete]);

  // The setup collected before sign-in is saved exactly once, then the
  // navigator falls through to the main app. This also runs for an account that
  // finished onboarding earlier: signing in after a repeated setup used to drop
  // the newly chosen weekly targets without a word.
  useEffect(() => {
    if (!isAuthenticated || !userConfig) return;
    if (!pendingOnboarding || flushingOnboardingRef.current || onboardingFlushError) return;

    // Setup collected before signing in belongs to a NEW account. Signing into
    // an account that is already set up must not let that tour rewrite its
    // goals — someone who signs out, swipes through the tour and then taps
    // "Sign In" would otherwise come back to a single, retargeted goal.
    if (userConfig.onboarding_complete) {
      setPendingOnboarding(null);
      return;
    }

    const userId = userConfig.id;
    flushingOnboardingRef.current = true;
    setFlushingOnboarding(true);
    completePendingOnboarding(userId, pendingOnboarding, {
      // Skipping Auto Check-In in a repeated setup must not remove the check-in
      // goal the account already has.
      preserveExistingPhysicalGoal: userConfig.onboarding_complete,
    })
      .then(() => {
        const current = useAppStore.getState();
        if (!current.isAuthenticated || current.userConfig?.id !== userId) return;
        setPendingOnboarding(null);
        current.setFocusStyle(pendingOnboarding.focus_style);
        setUserConfig({
          ...current.userConfig,
          focus_style: pendingOnboarding.focus_style,
          onboarding_complete: true,
        });
        // Home may already hold the goals loaded at sign-in, with the old targets.
        void queryClient.invalidateQueries({ queryKey: ["goals"] });
      })
      .catch((error) => {
        const current = useAppStore.getState();
        if (!current.isAuthenticated || current.userConfig?.id !== userId) return;
        console.error("Failed to flush onboarding setup:", error);
        setOnboardingFlushError(describeSetupSaveError(error));
      })
      .finally(() => {
        flushingOnboardingRef.current = false;
        setFlushingOnboarding(false);
      });
  }, [
    isAuthenticated,
    userConfig,
    pendingOnboarding,
    onboardingFlushError,
    onboardingFlushAttempt,
    queryClient,
    setPendingOnboarding,
    setUserConfig,
  ]);

  // Permission gate state
  const [permissionsChecked, setPermissionsChecked] = useState(false);
  const [needsPermissions, setNeedsPermissions] = useState(false);
  const [requiresLocationPermission, setRequiresLocationPermission] = useState(false);

  // Check permissions when user is authenticated and onboarding complete
  useEffect(() => {
    if (!isAuthenticated || !userConfig?.onboarding_complete) {
      setPermissionsChecked(false);
      setNeedsPermissions(false);
      setRequiresLocationPermission(false);
      return;
    }

    let cancelled = false;
    const check = async () => {
      const { count, error } = await supabase
        .from("goals")
        .select("id", { count: "exact", head: true })
        .eq("type", "physical")
        .eq("is_active", true);
      if (error) {
        if (!cancelled) {
          setRequiresLocationPermission(false);
          setNeedsPermissions(false);
          setPermissionsChecked(true);
        }
        return;
      }
      const hasPhysicalGoal = (count ?? 0) > 0;
      const [fg, bg] = hasPhysicalGoal
        ? await Promise.all([
            Location.getForegroundPermissionsAsync(),
            Location.getBackgroundPermissionsAsync(),
          ])
        : [null, null];

      const missing =
        hasPhysicalGoal &&
        (fg?.status !== "granted" || bg?.status !== "granted");

      if (cancelled) return;
      setRequiresLocationPermission(hasPhysicalGoal);
      setNeedsPermissions(missing);
      setPermissionsChecked(true);
    };

    void check().catch(() => {
      if (!cancelled) {
        setRequiresLocationPermission(false);
        setNeedsPermissions(false);
        setPermissionsChecked(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [goals, isAuthenticated, userConfig]);

  const handlePermissionGateComplete = useCallback(() => {
    setPermissionGateDismissed(true);
  }, [setPermissionGateDismissed]);

  if (isPasswordRecovery) {
    return (
      <Stack.Navigator
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: NEU.bg } }}
      >
        <Stack.Screen name="PasswordReset" component={PasswordResetScreen} />
      </Stack.Navigator>
    );
  }

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: NEU.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={NEU.accent} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <Stack.Navigator
        initialRouteName={pendingOnboarding ? "Auth" : "Onboarding"}
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: NEU.bg } }}
      >
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="Auth" component={AuthScreen} options={{ animation: "fade" }} />
      </Stack.Navigator>
    );
  }

  // Saving a pending setup blocks the app for every signed-in account, so a
  // failure is visible instead of Home quietly showing the old targets.
  if (userConfig && (pendingOnboarding || flushingOnboarding)) {
    if (onboardingFlushError) {
      return (
        <View
          style={{
            flex: 1,
            backgroundColor: NEU.bg,
            paddingHorizontal: 32,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              color: NEU.textPrimary,
              fontFamily: NEU_FONTS.heading,
              fontSize: 26,
              textAlign: "center",
            }}
          >
            Setup not saved
          </Text>
          <Text
            style={{
              color: NEU.textSecondary,
              fontFamily: NEU_FONTS.body,
              fontSize: 16,
              lineHeight: 24,
              textAlign: "center",
              marginTop: 12,
              marginBottom: 24,
            }}
          >
            {onboardingFlushError.message}
          </Text>
          {/*
            Only where trying again can actually work. A permission failure
            repeats for ever, and a button that does nothing is how somebody
            ends up pressing it for three days.
          */}
          {onboardingFlushError.canRetry ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry saving setup"
            onPress={() => {
              setOnboardingFlushError(null);
              setOnboardingFlushAttempt((attempt) => attempt + 1);
            }}
            style={{
              minHeight: 48,
              paddingHorizontal: 24,
              borderRadius: 24,
              backgroundColor: NEU.accent,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                color: "#FFFFFF",
                fontFamily: NEU_FONTS.label,
                fontSize: 16,
              }}
            >
              Try Again
            </Text>
          </Pressable>
          ) : null}
          {userConfig.onboarding_complete ? (
            // An account that already has goals must never be locked out by a
            // setup it can simply ignore.
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Keep my current goals"
              onPress={() => {
                setOnboardingFlushError(null);
                setPendingOnboarding(null);
              }}
              style={{ minHeight: 48, justifyContent: "center", marginTop: 8 }}
            >
              <Text
                style={{
                  color: NEU.textPrimary,
                  fontFamily: NEU_FONTS.label,
                  fontSize: 15,
                }}
              >
                Keep my current goals
              </Text>
            </Pressable>
          ) : null}
        </View>
      );
    }
    return (
      <View style={{ flex: 1, backgroundColor: NEU.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={NEU.accent} />
      </View>
    );
  }

  if (userConfig && !userConfig.onboarding_complete) {
    return (
      <Stack.Navigator
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: NEU.bg } }}
      >
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="Auth" component={AuthScreen} options={{ animation: "fade" }} />
      </Stack.Navigator>
    );
  }

  // Show permission gate for returning users who are missing permissions
  if (permissionsChecked && needsPermissions && !permissionGateDismissed) {
    return (
      <PermissionGateScreen
        onComplete={handlePermissionGateComplete}
        requireLocation={requiresLocationPermission}
      />
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: NEU.bg },
        animation: "fade",
        animationDuration: 280,
      }}
    >
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen
        name="FocusSession"
        component={FocusSessionScreen}
        getId={() => "active-focus-session"}
        options={{ animation: "fade", animationDuration: 280, gestureEnabled: false }}
      />
      <Stack.Screen
        name="GrowReveal"
        component={GrowRevealScreen}
        options={{ animation: "fade", animationDuration: 320, gestureEnabled: false }}
      />
      <Stack.Screen
        name="IslandPlace"
        component={IslandPlaceScreen}
        options={{ animation: "fade", animationDuration: 260 }}
      />
      <Stack.Screen
        name="Analytics"
        component={AnalyticsScreen}
        options={{ presentation: "card", animation: "fade", animationDuration: 280 }}
      />
      <Stack.Screen
        name="AnalyticsWeek"
        component={AnalyticsWeekScreen}
        options={{ presentation: "card", animation: "fade", animationDuration: 280 }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ presentation: "card", animation: "fade", animationDuration: 280 }}
      />
      <Stack.Screen
        name="SetupStudying"
        component={SetupStudyingScreen}
        options={{ presentation: "card", animation: "fade", animationDuration: 280 }}
      />
      <Stack.Screen
        name="SetupGeofence"
        component={SetupGeofenceScreen}
        options={{ presentation: "card", animation: "fade", animationDuration: 280 }}
      />
      <Stack.Screen
        name="Friends"
        component={FriendsScreen}
        options={{ presentation: "card", animation: "fade", animationDuration: 280 }}
      />
      <Stack.Screen
        name="FriendIsland"
        component={FriendIslandScreen}
        options={{ presentation: "card", animation: "fade", animationDuration: 280 }}
      />
      <Stack.Screen
        name="Rewards"
        component={RewardsScreen}
        options={{ presentation: "card", animation: "fade", animationDuration: 280 }}
      />
    </Stack.Navigator>
  );
}
