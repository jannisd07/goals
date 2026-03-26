import "./global.css";
import React, { useEffect, useCallback } from "react";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer, createNavigationContainerRef } from "@react-navigation/native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
import { useAuth } from "./src/hooks/useAuth";
import { useAppStore } from "./src/store";
import { registerGeofences, setupNotifications } from "./src/services/geofencing";
import type { RootStackParamList } from "./src/navigation/types";

SplashScreen.preventAutoHideAsync();

const navigationRef = createNavigationContainerRef<RootStackParamList>();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 2,
    },
  },
});

const navigationTheme = {
  dark: true,
  colors: {
    primary: "rgba(255,255,255,0.9)",
    background: "#0A0A0F",
    card: "#0A0A0F",
    text: "#FFFFFF",
    border: "rgba(255,255,255,0.06)",
    notification: "#4A9EFF",
  },
  fonts: {
    regular: { fontFamily: "Outfit_400Regular", fontWeight: "400" as const },
    medium: { fontFamily: "Outfit_500Medium", fontWeight: "500" as const },
    bold: { fontFamily: "Outfit_700Bold", fontWeight: "700" as const },
    heavy: { fontFamily: "Outfit_700Bold", fontWeight: "800" as const },
  },
};

function AppContent() {
  useAuth();
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const goals = useAppStore((s) => s.goals);
  const setLastCompletedSessionId = useAppStore((s) => s.setLastCompletedSessionId);

  useEffect(() => {
    if (isAuthenticated) {
      setupNotifications();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated && goals.length > 0) {
      registerGeofences(goals);
    }
  }, [isAuthenticated, goals]);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as
          | { type?: string; sessionId?: string; goalId?: string }
          | undefined;

        if (data?.type === "rate_session" && data.sessionId) {
          setLastCompletedSessionId(data.sessionId);
        }
      }
    );
    return () => subscription.remove();
  }, [setLastCompletedSessionId]);

  return <RootNavigator />;
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: "#0A0A0F", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color="rgba(255,255,255,0.5)" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <NavigationContainer ref={navigationRef} theme={navigationTheme}>
            <StatusBar style="light" />
            <AppContent />
          </NavigationContainer>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
