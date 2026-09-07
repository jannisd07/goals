import React, { useState, useEffect, useRef, useCallback } from "react";
import { Alert, AppState, View, Text, Linking, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { NeumorphicSurface } from "../components/NeumorphicSurface";
import { TextAction } from "../components/ui/TextAction";
import { LocationIcon, RefreshIcon } from "../components/TabIcons";
import { hapticLight, hapticSuccess } from "../lib/haptics";
import { NEU, NEU_FONTS } from "../theme/neumorphism";

type PermissionStatus = "granted" | "pending" | "denied";

function PermissionRow({
  icon,
  title,
  description,
  status,
  onRequest,
  last = false,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  status: PermissionStatus;
  onRequest: () => void;
  last?: boolean;
}) {
  return (
    <View style={[styles.row, !last && styles.rowDivider]}>
      <View style={styles.rowIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowDescription}>{description}</Text>
      </View>
      {status === "granted" ? (
        <Text style={styles.doneLabel}>Done</Text>
      ) : (
        <TextAction
          label={status === "denied" ? "Settings" : "Allow"}
          onPress={() => {
            hapticLight();
            onRequest();
          }}
          containerStyle={styles.rowAction}
        />
      )}
    </View>
  );
}

interface PermissionGateScreenProps {
  onComplete: () => void;
  requireLocation: boolean;
}

export function PermissionGateScreen({
  onComplete,
  requireLocation,
}: PermissionGateScreenProps) {
  const [locationStatus, setLocationStatus] = useState<PermissionStatus>("pending");
  const [bgStatus, setBgStatus] = useState<PermissionStatus>("pending");
  const completedRef = useRef(false);

  const refreshPermissionStatus = useCallback(async () => {
    const [fg, bg] = requireLocation
      ? await Promise.all([
          Location.getForegroundPermissionsAsync(),
          Location.getBackgroundPermissionsAsync(),
        ])
      : [null, null];
    setLocationStatus(
      !fg
        ? "granted"
        : fg.status === "granted"
          ? "granted"
          : fg.status === "denied"
            ? "denied"
            : "pending",
    );
    setBgStatus(
      !bg
        ? "granted"
        : bg.status === "granted"
          ? "granted"
          : bg.status === "denied"
            ? "denied"
            : "pending",
    );
  }, [requireLocation]);

  useEffect(() => {
    void refreshPermissionStatus();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refreshPermissionStatus();
    });
    return () => subscription.remove();
  }, [refreshPermissionStatus]);

  const requestLocation = async () => {
    try {
      const result = await Location.requestForegroundPermissionsAsync();
      if (result.status === "denied" && !result.canAskAgain) {
        void Linking.openSettings();
      }
      setLocationStatus(result.status === "granted" ? "granted" : result.status === "denied" ? "denied" : "pending");
      if (result.status === "granted") hapticSuccess();
    } catch {
      Alert.alert("Location unavailable", "Goals could not open the location permission prompt.");
    }
  };

  const requestBackground = async () => {
    try {
      let foreground = await Location.getForegroundPermissionsAsync();
      if (foreground.status !== "granted") {
        foreground = await Location.requestForegroundPermissionsAsync();
        setLocationStatus(
          foreground.status === "granted"
            ? "granted"
            : foreground.status === "denied"
              ? "denied"
              : "pending",
        );
      }
      if (foreground.status !== "granted") return;

      const result = await Location.requestBackgroundPermissionsAsync();
      if (result.status === "denied" && !result.canAskAgain) {
        void Linking.openSettings();
      }
      setBgStatus(result.status === "granted" ? "granted" : result.status === "denied" ? "denied" : "pending");
      if (result.status === "granted") hapticSuccess();
    } catch {
      Alert.alert(
        "Background location unavailable",
        "Open System Settings and choose Always to enable Auto Check-In.",
      );
    }
  };

  useEffect(() => {
    const allGranted = locationStatus === "granted" && bgStatus === "granted";
    if (allGranted && !completedRef.current) {
      completedRef.current = true;
      onComplete();
    }
  }, [locationStatus, bgStatus, onComplete]);

  const handleSkip = useCallback(() => {
    onComplete();
  }, [onComplete]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: NEU.bg }}>
      <View style={styles.content}>
        <View style={{ marginBottom: 28 }}>
          <Text style={styles.title}>Turn on Auto Check-In</Text>
          <Text style={styles.subtitle}>
            Location access is needed to count visits at your pinned place, even when Goals is closed.
          </Text>
        </View>

        <NeumorphicSurface>
          {requireLocation ? (
            <PermissionRow
              icon={<LocationIcon size={20} color={NEU.accent} strokeWidth={1.8} />}
              title="Location"
              description="Auto-track visits to your goal locations."
              status={locationStatus}
              onRequest={requestLocation}
            />
          ) : null}
          {requireLocation ? (
            <PermissionRow
              icon={<RefreshIcon size={20} color={NEU.accent} strokeWidth={1.8} />}
              title="Always Allow Location"
              description="Keep visit detection working when the app is closed."
              status={bgStatus}
              onRequest={requestBackground}
              last
            />
          ) : null}
        </NeumorphicSurface>

        <TextAction
          label="Skip for now"
          align="center"
          onPress={handleSkip}
          containerStyle={{ alignSelf: "center", marginTop: 20 }}
          textStyle={{ color: NEU.textSecondary }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  title: {
    fontFamily: NEU_FONTS.heading,
    fontSize: 28,
    color: NEU.textPrimary,
    textAlign: "center",
    marginBottom: 8,
    lineHeight: 34,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: NEU_FONTS.body,
    fontSize: 16,
    color: NEU.textSecondary,
    textAlign: "center",
    lineHeight: 23,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    gap: 12,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: NEU.track,
  },
  rowIcon: {
    width: 32,
    alignItems: "center",
  },
  rowTitle: {
    fontFamily: NEU_FONTS.label,
    fontSize: 16,
    color: NEU.textPrimary,
    marginBottom: 2,
  },
  rowDescription: {
    fontFamily: NEU_FONTS.body,
    fontSize: 13,
    color: NEU.textSecondary,
    lineHeight: 18,
  },
  rowAction: {
    minWidth: 64,
    alignItems: "flex-end",
  },
  doneLabel: {
    color: NEU.accent,
    fontSize: 16,
    fontFamily: NEU_FONTS.label,
    minWidth: 64,
    textAlign: "right",
  },
});
