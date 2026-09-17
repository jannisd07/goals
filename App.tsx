import React, { useEffect, useCallback, useRef } from "react";
import { StatusBar } from "expo-status-bar";
import {
  AppState,
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Alert,
  Linking,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer, createNavigationContainerRef } from "@react-navigation/native";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import * as SplashScreen from "expo-splash-screen";
import {
  useFonts,
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
} from "@expo-google-fonts/outfit";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { PendingRatingSheet } from "./src/components/PendingRatingSheet";
import { useAuthBootstrap } from "./src/hooks/useAuth";
import { useIslandSync } from "./src/hooks/useIslandSync";
import { useMilestoneDelivery } from "./src/hooks/useMilestoneDelivery";
import { useCoachNudges } from "./src/hooks/useCoachNudges";
import { useStudySpotSync } from "./src/hooks/useStudySpotSync";
import { useFocusLiveActivity } from "./src/hooks/useFocusLiveActivity";
import { useAppStore } from "./src/store";
import { registerGeofences, setupNotifications } from "./src/services/geofencing";
import { syncWeeklySummary } from "./src/lib/notifications";
import { readPendingGrows, removePendingGrow } from "./src/lib/pendingGrows";
import { flushSessionOutbox } from "./src/lib/sessionOutbox";
import { autoGrowPick, overdueGrows } from "./src/lib/growDelivery";
import { computeGrowSize } from "./src/lib/growRewards";
import { categoryLimit, islandStageFor } from "./src/lib/islandScene";
import type { AutoDeliveredGrow } from "./src/store/islandSlice";
import {
  handleFocusLiveActivityAction,
  type FocusLiveActivityAction,
} from "./src/lib/focusLiveActivityActions";
import { supabase } from "./src/lib/supabase";
import { NEU } from "./src/theme/neumorphism";
import type { RootStackParamList } from "./src/navigation/types";

void SplashScreen.preventAutoHideAsync().catch((error) => {
  console.warn("Could not hold the native splash screen:", error);
});

const navigationRef = createNavigationContainerRef<RootStackParamList>();
type NotificationDestination = {
  type?: string;
  sessionId?: string;
  goalId?: string;
  goalName?: string;
  durationSeconds?: number;
};
let pendingNotificationDestination: NotificationDestination | null = null;

function openNotificationDestination(data: NotificationDestination): void {
  const state = useAppStore.getState();
  if (!navigationRef.isReady() || state.isLoading || !state.isAuthenticated) {
    pendingNotificationDestination = data;
    return;
  }

  if (data.type === "rate_session" && data.sessionId) {
    state.setLastCompletedSessionId(data.sessionId);
  } else if (data.type === "weekly_summary") {
    navigationRef.navigate("Analytics");
  } else if (
    (data.type === "study_spot" || data.type === "focus_session") &&
    data.goalId
  ) {
    navigationRef.navigate("FocusSession", {
      goalId: data.goalId,
      sessionLengthMinutes: useAppStore.getState().lastSessionMinutes,
    });
  } else if (data.type === "grow_reveal" && data.sessionId && data.goalId) {
    navigationRef.navigate("GrowReveal", {
      sessionId: data.sessionId,
      goalId: data.goalId,
      goalName: data.goalName ?? "Your visit",
      durationSeconds: Number(data.durationSeconds) || 0,
      category: null,
    });
  }
}

function flushPendingNotificationDestination(): void {
  if (!pendingNotificationDestination) return;
  const destination = pendingNotificationDestination;
  pendingNotificationDestination = null;
  openNotificationDestination(destination);
}

/**
 * Places the rewards nobody came back for.
 *
 * A finished session has earned its object; the reveal screen only decides what
 * it becomes. So a reward that has waited a day, or that is stuck behind a pile
 * of newer ones, is placed here without asking — the player's own object and
 * category first, another category only if theirs has no room. Should the whole
 * island be unable to take it, it keeps waiting instead of being thrown away.
 *
 * The size is the one a session without history gets (medium): the exact size
 * needs the goal's earlier sessions from the server, and a reward the player
 * never opened is not worth going online for.
 */
async function deliverOverduePendingGrows(): Promise<void> {
  const state = useAppStore.getState();
  const userId = state.userConfig?.id;
  if (!userId) return;
  // Wait for the account's island. Placing against a local copy that is behind
  // the server would spend the reward on a level the island has long passed.
  if (state.islandSyncedFor !== userId) return;
  const waiting = await readPendingGrows();
  const overdue = overdueGrows(waiting, Date.now());
  if (overdue.length === 0) return;

  const delivered: AutoDeliveredGrow[] = [];
  for (const grow of overdue) {
    const store = useAppStore.getState();
    // Applying is already guarded against running twice; without the same guard
    // here a failed cleanup would announce the same reward again on every start.
    if (store.appliedGrowSessionsByUser[userId]?.includes(grow.sessionId)) {
      await removePendingGrow(grow.sessionId).catch(() => undefined);
      continue;
    }
    const island = store.islandObjectsByUser[userId] ?? {};
    const stage = islandStageFor(island);
    const tier = computeGrowSize(grow.durationSeconds, []).tier;
    const pick = autoGrowPick(grow, tier, island, (category) => categoryLimit(stage, category));
    if (!pick) continue; // no room anywhere yet — try again next time
    store.applyGrowReward(userId, {
      sessionId: grow.sessionId,
      category: pick.category,
      objectKey: pick.objectKey,
      toLevel: pick.toLevel,
    });
    await removePendingGrow(grow.sessionId).catch(() => undefined);
    delivered.push({
      goalName: grow.goalName,
      category: pick.category,
      objectKey: pick.objectKey,
      level: pick.toLevel,
      isNew: pick.fromLevel === 0,
    });
  }
  if (delivered.length > 0) useAppStore.getState().noteAutoDeliveredGrows(delivered);
}

/**
 * Reopens an object that grew but was never added, for example after an Auto
 * Check-In whose notification was not tapped. Only from Home, never on top of a
 * running session, onboarding or another reveal.
 */
async function openNextPendingGrow(): Promise<void> {
  const state = useAppStore.getState();
  if (!navigationRef.isReady() || state.isLoading || !state.isAuthenticated) return;
  if (state.activeSession) return;
  // "MainTabs" is the main screen itself since Grove was removed (2026-09-14) and
  // the container stopped being a navigator with its own leaf routes.
  const onHome = () => navigationRef.getCurrentRoute()?.name === "MainTabs";
  if (!onHome()) return;
  const [next] = await readPendingGrows();
  if (!next || !onHome()) return;
  navigationRef.navigate("GrowReveal", {
    sessionId: next.sessionId,
    goalId: next.goalId,
    goalName: next.goalName,
    durationSeconds: next.durationSeconds,
    category: next.category,
    // The object the session actually grew; without it the reveal preselects
    // the first one of the category instead of the one in the timer ring.
    objectKey: next.objectKey,
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 2,
    },
  },
});

const navigationTheme = {
  dark: false,
  colors: {
    primary: NEU.accent,
    background: NEU.bg,
    card: NEU.bg,
    text: NEU.textPrimary,
    border: NEU.dark,
    notification: NEU.accent,
  },
  fonts: {
    regular: { fontFamily: "Outfit_400Regular", fontWeight: "400" as const },
    medium: { fontFamily: "Outfit_500Medium", fontWeight: "500" as const },
    bold: { fontFamily: "Outfit_700Bold", fontWeight: "700" as const },
    heavy: { fontFamily: "Outfit_700Bold", fontWeight: "800" as const },
  },
};

type AppErrorBoundaryState = {
  hasError: boolean;
};

class AppErrorBoundary extends React.Component<
  React.PropsWithChildren,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error("Goals failed to render:", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View
        style={{
          flex: 1,
          backgroundColor: NEU.bg,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 32,
        }}
      >
        <Text
          style={{
            color: NEU.textPrimary,
            fontSize: 26,
            fontWeight: "700",
            textAlign: "center",
          }}
        >
          Goals could not start
        </Text>
        <Text
          style={{
            color: NEU.textSecondary,
            fontSize: 16,
            lineHeight: 23,
            textAlign: "center",
            marginTop: 10,
          }}
        >
          Your data is safe. Try loading the app again.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Try loading Goals again"
          onPress={() => this.setState({ hasError: false })}
          style={{
            minHeight: NEU.hitTarget,
            justifyContent: "center",
            paddingHorizontal: 20,
            marginTop: 16,
          }}
        >
          <Text
            style={{
              color: NEU.accent,
              fontSize: 16,
              fontWeight: "600",
            }}
          >
            Try Again
          </Text>
        </Pressable>
      </View>
    );
  }
}

function AppContent() {

  const { bootstrapError, retryBootstrap } = useAuthBootstrap();
  useStudySpotSync();
  useFocusLiveActivity();
  useCoachNudges();
  // The island belongs to the account: read it once after signing in, then keep
  // it in step (src/hooks/useIslandSync.ts).
  useIslandSync();
  // The hour milestones are derived from the total tracked time, so they put
  // themselves on the island whenever the hours are known.
  useMilestoneDelivery();
  const queryCache = useQueryClient();
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const isLoading = useAppStore((s) => s.isLoading);
  const userId = useAppStore((s) => s.userConfig?.id ?? null);
  const goals = useAppStore((s) => s.goals);
  const setAutoCheckInPermissionWarning = useAppStore((s) => s.setAutoCheckInPermissionWarning);
  const setNotificationPermissionWarning = useAppStore((s) => s.setNotificationPermissionWarning);
  const weeklySummaryEnabled = useAppStore((s) => s.notificationPrefs.weeklySummary);
  const notificationPermissionWarning = useAppStore(
    (s) => s.notificationPermissionWarning,
  );
  const setPasswordRecovery = useAppStore((s) => s.setPasswordRecovery);
  const previousUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const handleAppUrl = async (url: string | null) => {
      const isFocusActivity = Boolean(
        url?.startsWith("com.goals.app://focus"),
      );
      const isPasswordReset = Boolean(
        url?.startsWith("com.goals.app://reset-password"),
      );
      const isEmailConfirmation = Boolean(
        url?.startsWith("com.goals.app://auth-confirmed"),
      );
      if (!url) return;

      if (isFocusActivity) {
        try {
          const goalId = new URL(url).searchParams.get("goalId");
          const action = new URL(url).searchParams.get("action");
          if (
            action === "toggle-pause" ||
            action === "toggle-break"
          ) {
            await handleFocusLiveActivityAction(
              action as FocusLiveActivityAction,
            );
          }
          if (goalId) {
            openNotificationDestination({
              type: "focus_session",
              goalId,
            });
          }
        } catch (error) {
          console.warn("Could not open focus Live Activity URL:", error);
        }
        return;
      }

      if (!isPasswordReset && !isEmailConfirmation) return;

      try {
        const parsed = new URL(url);
        const hashParams = new URLSearchParams(parsed.hash.replace(/^#/, ""));
        const code = parsed.searchParams.get("code");
        const accessToken =
          hashParams.get("access_token") ?? parsed.searchParams.get("access_token");
        const refreshToken =
          hashParams.get("refresh_token") ?? parsed.searchParams.get("refresh_token");
        const errorDescription =
          hashParams.get("error_description") ??
          parsed.searchParams.get("error_description");

        if (errorDescription) throw new Error(errorDescription.replace(/\+/g, " "));

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
        } else {
          throw new Error(
            isPasswordReset
              ? "This password reset link is incomplete or expired."
              : "This confirmation link is incomplete or expired.",
          );
        }

        if (isPasswordReset) {
          setPasswordRecovery(true);
        } else {
          Alert.alert(
            "Email confirmed",
            "Your email is verified. Goals is signing you in now.",
          );
        }
      } catch (error) {
        Alert.alert(
          isPasswordReset
            ? "Reset link unavailable"
            : "Confirmation link unavailable",
          error instanceof Error
            ? error.message
            : isPasswordReset
              ? "Request a new password reset link and try again."
              : "Request a new confirmation email and try again.",
        );
      }
    };

    const subscription = Linking.addEventListener("url", ({ url }) => {
      void handleAppUrl(url);
    });
    void Linking.getInitialURL().then(handleAppUrl);
    return () => subscription.remove();
  }, [setPasswordRecovery]);

  useEffect(() => {
    if (!isAuthenticated) {
      // Query keys are intentionally simple throughout the app. Clearing here
      // prevents cached goals/sessions/friends from flashing for another user.
      queryCache.clear();
      previousUserIdRef.current = null;
      return;
    }

    if (
      previousUserIdRef.current &&
      userId &&
      previousUserIdRef.current !== userId
    ) {
      queryCache.clear();
    }
    if (userId) previousUserIdRef.current = userId;
  }, [isAuthenticated, queryCache, userId]);

  // Background geofence events write directly to Supabase, outside React Query.
  // Refresh every user-facing aggregate after the app returns to the foreground
  // so Home, streaks, analytics and the Grove never wait for staleTime to expire.
  useEffect(() => {
    if (!isAuthenticated) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      void queryCache.invalidateQueries({ queryKey: ["sessions"] });
      void queryCache.invalidateQueries({ queryKey: ["weekly-progress"] });
      void queryCache.invalidateQueries({ queryKey: ["streak"] });
      void queryCache.invalidateQueries({ queryKey: ["garden", "sessions"] });
      void queryCache.invalidateQueries({ queryKey: ["study-spot-sync"] });
      void queryCache.invalidateQueries({ queryKey: ["friends-weekly"] });
      // Anything that could not be sent while the phone was offline goes out
      // now, before the aggregates above are read back.
      void flushSessionOutbox().then((sent) => {
        if (sent === 0) return;
        void queryCache.invalidateQueries({ queryKey: ["sessions"] });
        void queryCache.invalidateQueries({ queryKey: ["weekly-progress"] });
        void queryCache.invalidateQueries({ queryKey: ["streak"] });
        void queryCache.invalidateQueries({ queryKey: ["analytics"] });
      });
      void deliverOverduePendingGrows().finally(() => void openNextPendingGrow());
    });
    return () => subscription.remove();
  }, [isAuthenticated, queryCache]);

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      flushPendingNotificationDestination();
      void flushSessionOutbox();
      void deliverOverduePendingGrows().finally(() => void openNextPendingGrow());
    }
  }, [isAuthenticated, isLoading]);

  useEffect(() => {
    // Never carry a notification belonging to a signed-out account into the
    // next login. Keep it during auth bootstrap, when a valid persisted
    // session may still be loading.
    if (!isLoading && !isAuthenticated) {
      pendingNotificationDestination = null;
    }
  }, [isAuthenticated, isLoading]);

  useEffect(() => {
    if (!isAuthenticated) {
      setNotificationPermissionWarning(null);
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        const result = await setupNotifications();
        if (cancelled) return;
        setNotificationPermissionWarning(result.warningMessage);
      } catch {
        if (!cancelled) {
          setNotificationPermissionWarning(
            "Notification status could not be verified. Try again from Settings.",
          );
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, setNotificationPermissionWarning]);

  useEffect(() => {
    if (!isAuthenticated) {
      setAutoCheckInPermissionWarning(null);
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        const result = await registerGeofences(goals);
        if (cancelled) return;
        setAutoCheckInPermissionWarning(result.warningMessage);
      } catch {
        if (!cancelled) {
          setAutoCheckInPermissionWarning(
            "Auto Check-In status could not be verified. Try again from Settings.",
          );
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, goals, setAutoCheckInPermissionWarning]);

  useEffect(() => {
    const handleResponse = (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data as
        | NotificationDestination
        | undefined;

      if (data) {
        openNotificationDestination(data);
      }
    };

    const subscription =
      Notifications.addNotificationResponseReceivedListener(handleResponse);

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      handleResponse(response);
      return Notifications.clearLastNotificationResponseAsync();
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    void syncWeeklySummary(weeklySummaryEnabled);
  }, [
    isAuthenticated,
    notificationPermissionWarning,
    weeklySummaryEnabled,
  ]);

  if (bootstrapError) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: NEU.bg,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 32,
        }}
      >
        <Text
          style={{
            color: NEU.textPrimary,
            fontFamily: "Outfit_700Bold",
            fontSize: 25,
            textAlign: "center",
          }}
        >
          Account unavailable
        </Text>
        <Text
          style={{
            color: NEU.textSecondary,
            fontFamily: "Outfit_500Medium",
            fontSize: 16,
            lineHeight: 23,
            textAlign: "center",
            marginTop: 10,
          }}
        >
          {bootstrapError}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retry loading account"
          onPress={retryBootstrap}
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
              fontFamily: "Outfit_600SemiBold",
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
    <>
      <RootNavigator />
      <PendingRatingSheet />
    </>
  );
}

function GoalsApp() {
  const [fontsLoaded] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
  });
  const setAppVisible = useAppStore((s) => s.setAppVisible);

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      try {
        await SplashScreen.hideAsync();
      } catch (error) {
        console.warn("Could not hide the native splash screen:", error);
      } finally {
        setAppVisible(true);
      }
    }
  }, [fontsLoaded, setAppVisible]);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: NEU.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={NEU.accent} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView
      style={{ flex: 1, backgroundColor: NEU.bgSolid }}
      onLayout={onLayoutRootView}
    >
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <NavigationContainer
            ref={navigationRef}
            theme={navigationTheme}
            onReady={flushPendingNotificationDestination}
          >
            <StatusBar style="dark" />
            <AppContent />
          </NavigationContainer>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default function App() {
  return (
    <AppErrorBoundary>
      <GoalsApp />
    </AppErrorBoundary>
  );
}
