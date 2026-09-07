import React, { useEffect, useRef, useState, useCallback } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import * as Location from "expo-location";
import { MainTabs } from "./MainTabs";
import { FocusSessionScreen } from "../screens/FocusSessionScreen";
import { AnalyticsScreen } from "../screens/AnalyticsScreen";
import { AnalyticsWeekScreen } from "../screens/AnalyticsWeekScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { SetupStudyingScreen } from "../screens/SetupStudyingScreen";
import { SetupGeofenceScreen } from "../screens/SetupGeofenceScreen";
import { OnboardingScreen } from "../screens/OnboardingScreen";
import { AuthScreen } from "../screens/AuthScreen";
import { FriendsScreen } from "../screens/FriendsScreen";
import { PermissionGateScreen } from "../screens/PermissionGateScreen";
import { PasswordResetScreen } from "../screens/PasswordResetScreen";
import { useAppStore } from "../store";
import { completePendingOnboarding } from "../lib/onboarding";
import { supabase } from "../lib/supabase";
import { NEU } from "../theme/neumorphism";
import { NEU_FONTS } from "../theme/neumorphism";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
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
  const [onboardingFlushError, setOnboardingFlushError] = useState<string | null>(null);
  const [onboardingFlushAttempt, setOnboardingFlushAttempt] = useState(0);
  const flushingOnboardingRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || userConfig?.onboarding_complete) {
      setOnboardingFlushError(null);
    }
  }, [isAuthenticated, userConfig?.onboarding_complete]);

  // User finished the pre-auth tour, then signed up: persist the collected setup
  // exactly once, then let the navigator fall through to the main app.
  useEffect(() => {
    if (!isAuthenticated || !userConfig || userConfig.onboarding_complete) return;
    if (!pendingOnboarding || flushingOnboardingRef.current || onboardingFlushError) return;

    const userId = userConfig.id;
    flushingOnboardingRef.current = true;
    setFlushingOnboarding(true);
    completePendingOnboarding(userId, pendingOnboarding)
      .then(() => {
        const current = useAppStore.getState();
        if (!current.isAuthenticated || current.userConfig?.id !== userId) return;
        setPendingOnboarding(null);
        setUserConfig({
          ...current.userConfig,
          focus_style: pendingOnboarding.focus_style,
          onboarding_complete: true,
        });
      })
      .catch((error) => {
        const current = useAppStore.getState();
        if (!current.isAuthenticated || current.userConfig?.id !== userId) return;
        console.error("Failed to flush onboarding setup:", error);
        setOnboardingFlushError(
          "Your setup could not be saved. Check your connection and try again.",
        );
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

  if (userConfig && !userConfig.onboarding_complete) {
    if (pendingOnboarding || flushingOnboarding) {
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
              {onboardingFlushError}
            </Text>
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
          </View>
        );
      }
      return (
        <View style={{ flex: 1, backgroundColor: NEU.bg, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={NEU.accent} />
        </View>
      );
    }
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
      }}
    >
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen
        name="FocusSession"
        component={FocusSessionScreen}
        getId={() => "active-focus-session"}
        options={{ animation: "fade", gestureEnabled: false }}
      />
      <Stack.Screen
        name="Analytics"
        component={AnalyticsScreen}
        options={{ presentation: "card", animation: "fade" }}
      />
      <Stack.Screen
        name="AnalyticsWeek"
        component={AnalyticsWeekScreen}
        options={{ presentation: "card", animation: "fade" }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ presentation: "card", animation: "fade" }}
      />
      <Stack.Screen
        name="SetupStudying"
        component={SetupStudyingScreen}
        options={{ presentation: "card", animation: "fade" }}
      />
      <Stack.Screen
        name="SetupGeofence"
        component={SetupGeofenceScreen}
        options={{ presentation: "card", animation: "fade" }}
      />
      <Stack.Screen
        name="Friends"
        component={FriendsScreen}
        options={{ presentation: "card", animation: "fade" }}
      />
    </Stack.Navigator>
  );
}
