import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  Alert,
  AppState,
  Linking,
  Pressable,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { NeumorphicSurface } from "../components/NeumorphicSurface";
import { FlatToggle } from "../components/ui/FlatToggle";
import { TextAction } from "../components/ui/TextAction";
import { FocusModeSwitch } from "../components/ui/FocusModeSwitch";
import { ChevronRightIcon } from "../components/TabIcons";
import { useAppStore } from "../store";
import { useAuth } from "../hooks/useAuth";
import { hapticLight } from "../lib/haptics";
import { persistFocusStyle } from "../lib/focusStyle";
import { syncWeeklySummary } from "../lib/notifications";
import { persistUserPreferences } from "../lib/userPreferences";
import { AMBIENT_SOUNDS, type AmbientSoundKey, type FocusStyle } from "../types";
import type { NotificationPrefs } from "../store/configSlice";
import type { RootStackParamList } from "../navigation/types";
import { NEU, NEU_FONTS } from "../theme/neumorphism";

type SettingsNav = NativeStackNavigationProp<RootStackParamList>;

const BREAK_OPTIONS = [5, 10, 15, 20] as const;
const LENGTH_OPTIONS = [15, 25, 45, 60] as const;

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

function Divider() {
  return <View style={styles.divider} />;
}

function ToggleRow({
  label,
  value,
  onChange,
  subtitle,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  subtitle?: string;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1, marginRight: 10 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {subtitle && <Text style={styles.rowSubtitle}>{subtitle}</Text>}
      </View>
      <FlatToggle value={value} onValueChange={onChange} accessibilityLabel={label} />
    </View>
  );
}

function NavigationRow({
  label,
  subtitle,
  onPress,
}: {
  label: string;
  subtitle?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.navRow, { opacity: pressed ? 0.55 : 1 }]}
    >
      <View style={{ flex: 1, marginRight: 10 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      <ChevronRightIcon size={18} color={NEU.accent} strokeWidth={2} />
    </Pressable>
  );
}

function SegmentRow<T extends number | string>({
  options,
  selected,
  onChange,
  format,
}: {
  options: readonly T[];
  selected: T;
  onChange: (v: T) => void;
  format: (v: T) => string;
}) {
  return (
    <View style={styles.segmentedRow}>
      {options.map((opt) => {
        const active = opt === selected;
        return (
          <Pressable
            key={String(opt)}
            onPress={() => {
              onChange(opt);
              hapticLight();
            }}
            accessibilityRole="button"
            accessibilityLabel={format(opt)}
            accessibilityState={{ selected: active }}
            style={styles.segmentTouch}
          >
            <View style={[styles.segment, active && styles.segmentActive]}>
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                {format(opt)}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SettingsScreen() {
  const navigation = useNavigation<SettingsNav>();
  const focusStyleRequestRef = useRef(0);
  const preferenceRequestRef = useRef({
    sessionMinutes: 0,
    breakMinutes: 0,
    ambientSound: 0,
    notifications: 0,
  });
  const { signOut, deleteAccount } = useAuth();
  const userConfig = useAppStore((s) => s.userConfig);
  const goals = useAppStore((s) => s.goals);
  const breakDuration = useAppStore((s) => s.breakDuration);
  const setBreakDuration = useAppStore((s) => s.setBreakDuration);
  const focusStyle = useAppStore((s) => s.focusStyle);
  const setFocusStyle = useAppStore((s) => s.setFocusStyle);
  const lastSessionMinutes = useAppStore((s) => s.lastSessionMinutes);
  const setLastSessionMinutes = useAppStore((s) => s.setLastSessionMinutes);
  const preferredAmbientSound = useAppStore((s) => s.preferredAmbientSound);
  const setPreferredAmbientSound = useAppStore((s) => s.setPreferredAmbientSound);
  const notificationPrefs = useAppStore((s) => s.notificationPrefs);
  const setNotificationPref = useAppStore((s) => s.setNotificationPref);

  const focusGoal = goals.find((g) => g.type === "focus") ?? null;
  const checkinGoal = goals.find((g) => g.type === "physical") ?? null;

  const [deletingAccount, setDeletingAccount] = useState(false);
  const [locationGranted, setLocationGranted] = useState<boolean | null>(null);
  const [notifGranted, setNotifGranted] = useState<boolean | null>(null);

  const checkPermissions = useCallback(async () => {
      const bg = await Location.getBackgroundPermissionsAsync().catch(() => null);
      const notif = await Notifications.getPermissionsAsync().catch(() => null);
      setLocationGranted(bg?.status === "granted");
      setNotifGranted(Boolean(notif?.granted || notif?.status === "granted"));
  }, []);

  useEffect(() => {
    void checkPermissions();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void checkPermissions();
      }
    });
    return () => subscription.remove();
  }, [checkPermissions]);

  const handleFocusStyleChange = useCallback(
    (style: FocusStyle) => {
      const previousStyle = focusStyle;
      const requestId = focusStyleRequestRef.current + 1;
      focusStyleRequestRef.current = requestId;
      setFocusStyle(style);
      if (userConfig?.id) {
        const requestUserId = userConfig.id;
        void persistFocusStyle(requestUserId, style)
          .then(() => undefined)
          .catch(() => {
            if (
              focusStyleRequestRef.current !== requestId ||
              useAppStore.getState().userConfig?.id !== requestUserId
            ) {
              return;
            }
            setFocusStyle(previousStyle);
            Alert.alert("Could not save focus style", "Check your connection and try again.");
          });
      }
    },
    [focusStyle, setFocusStyle, userConfig],
  );

  const handleDefaultSessionMinutesChange = useCallback(
    (minutes: number) => {
      const previous = useAppStore.getState().lastSessionMinutes;
      const requestId = preferenceRequestRef.current.sessionMinutes + 1;
      preferenceRequestRef.current.sessionMinutes = requestId;
      setLastSessionMinutes(minutes);
      if (!userConfig?.id) return;

      const userId = userConfig.id;
      void persistUserPreferences(userId, { default_session_minutes: minutes }).catch(() => {
        if (
          preferenceRequestRef.current.sessionMinutes !== requestId ||
          useAppStore.getState().userConfig?.id !== userId ||
          useAppStore.getState().lastSessionMinutes !== minutes
        ) {
          return;
        }
        setLastSessionMinutes(previous);
        Alert.alert("Could not save session length", "Check your connection and try again.");
      });
    },
    [setLastSessionMinutes, userConfig?.id],
  );

  const handleBreakDurationChange = useCallback(
    (minutes: number) => {
      const previous = useAppStore.getState().breakDuration;
      const requestId = preferenceRequestRef.current.breakMinutes + 1;
      preferenceRequestRef.current.breakMinutes = requestId;
      setBreakDuration(minutes);
      if (!userConfig?.id) return;

      const userId = userConfig.id;
      void persistUserPreferences(userId, { break_duration_minutes: minutes }).catch(() => {
        if (
          preferenceRequestRef.current.breakMinutes !== requestId ||
          useAppStore.getState().userConfig?.id !== userId ||
          useAppStore.getState().breakDuration !== minutes
        ) {
          return;
        }
        setBreakDuration(previous);
        Alert.alert("Could not save break length", "Check your connection and try again.");
      });
    },
    [setBreakDuration, userConfig?.id],
  );

  const handlePreferredAmbientSoundChange = useCallback(
    (sound: AmbientSoundKey | null) => {
      const previous = useAppStore.getState().preferredAmbientSound;
      const requestId = preferenceRequestRef.current.ambientSound + 1;
      preferenceRequestRef.current.ambientSound = requestId;
      setPreferredAmbientSound(sound);
      hapticLight();
      if (!userConfig?.id) return;

      const userId = userConfig.id;
      void persistUserPreferences(userId, { preferred_ambient_sound: sound }).catch(() => {
        if (
          preferenceRequestRef.current.ambientSound !== requestId ||
          useAppStore.getState().userConfig?.id !== userId ||
          useAppStore.getState().preferredAmbientSound !== sound
        ) {
          return;
        }
        setPreferredAmbientSound(previous);
        Alert.alert("Could not save focus music", "Check your connection and try again.");
      });
    },
    [setPreferredAmbientSound, userConfig?.id],
  );

  const handleSignOut = useCallback(() => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: () => {
          void signOut().catch((error) => {
            Alert.alert(
              "Could not sign out",
              error instanceof Error ? error.message : "Please try again.",
            );
          });
        },
      },
    ]);
  }, [signOut]);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      "Delete Account",
      "This will permanently delete your account and all data. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Account",
          style: "destructive",
          onPress: async () => {
            try {
              setDeletingAccount(true);
              await deleteAccount();
              Alert.alert("Account deleted", "Your account and data have been permanently removed.");
            } catch (error) {
              const message = error instanceof Error ? error.message : "Failed to delete account.";
              Alert.alert("Delete failed", message);
            } finally {
              setDeletingAccount(false);
            }
          },
        },
      ],
    );
  }, [deleteAccount]);

  const toggleNotificationPref = useCallback(
    (key: keyof NotificationPrefs) => (value: boolean) => {
      const previous = useAppStore.getState().notificationPrefs[key];
      const nextPreferences = {
        ...useAppStore.getState().notificationPrefs,
        [key]: value,
      };
      const requestId = preferenceRequestRef.current.notifications + 1;
      preferenceRequestRef.current.notifications = requestId;
      setNotificationPref(key, value);
      if (key === "weeklySummary") {
        void syncWeeklySummary(value);
      }
      hapticLight();

      if (!userConfig?.id) return;
      const userId = userConfig.id;
      void persistUserPreferences(userId, {
        notification_preferences: nextPreferences,
      }).catch(() => {
        if (
          preferenceRequestRef.current.notifications !== requestId ||
          useAppStore.getState().userConfig?.id !== userId ||
          useAppStore.getState().notificationPrefs[key] !== value
        ) {
          return;
        }
        setNotificationPref(key, previous);
        if (key === "weeklySummary") {
          void syncWeeklySummary(previous);
        }
        Alert.alert("Could not save notification setting", "Check your connection and try again.");
      });
    },
    [setNotificationPref, userConfig?.id],
  );

  const handleTestNotification = useCallback(async () => {
    const permission = await Notifications.getPermissionsAsync();
    if (permission.status !== "granted") {
      Alert.alert(
        "Notifications are off",
        "Allow notifications in iOS Settings, then try again.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Open Settings", onPress: () => void Linking.openSettings() },
        ],
      );
      return;
    }

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Notifications work",
          body: "Goals can deliver timer, streak, and check-in reminders on this device.",
          sound: false,
          data: { type: "notification_test" },
        },
        trigger: null,
      });
    } catch {
      Alert.alert(
        "Test notification failed",
        "Goals could not schedule a local notification on this device. Try restarting the app or check iOS Settings.",
      );
    }
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: NEU.bg }} edges={["top"]}>
      <Animated.View entering={FadeIn.duration(400)} style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={{ width: 72 }} />
            <Text style={styles.headerTitle}>Settings</Text>
            <TextAction label="Close" align="right" onPress={() => navigation.goBack()} />
          </View>

          {/* Goals */}
          <Animated.View entering={FadeInDown.delay(50).duration(400)}>
            <NeumorphicSurface style={styles.card} lightShadowOpacity={0}>
              <SectionHeader title="Goals" />
              <NavigationRow
                label={focusGoal ? focusGoal.name : "Deep Work"}
                subtitle={
                  focusGoal
                    ? `${focusGoal.target_hours_per_week}h per week`
                    : "Not set up yet"
                }
                onPress={() => navigation.navigate("SetupStudying")}
              />
              <Divider />
              <NavigationRow
                label={checkinGoal ? checkinGoal.name : "Auto Check-In"}
                subtitle={
                  checkinGoal
                    ? `${checkinGoal.target_sessions_per_week} visits per week`
                    : "Not set up yet"
                }
                onPress={() => navigation.navigate("SetupGeofence")}
              />
            </NeumorphicSurface>
          </Animated.View>

          {/* Focus */}
          <Animated.View entering={FadeInDown.delay(100).duration(400)}>
            <NeumorphicSurface style={styles.card}>
              <SectionHeader title="Focus Sessions" />

              <Text style={styles.fieldLabel}>Focus style</Text>
              <FocusModeSwitch
                value={focusStyle}
                onChange={handleFocusStyleChange}
              />

              <View style={styles.focusModeExplanation}>
                <Text style={styles.focusModeTitle}>
                  {focusStyle === "interval"
                    ? "Structured countdown"
                    : "Open-ended count up"}
                </Text>
                <Text style={styles.focusModeText}>
                  {focusStyle === "interval"
                    ? "A break begins automatically when each focus block ends."
                    : "The timer runs until you choose Break. Recovery is calculated from the time you just focused, so there is no fixed break-length setting."}
                </Text>
              </View>

              <Text style={[styles.fieldLabel, { marginTop: 18 }]}>
                {focusStyle === "interval" ? "Focus block length" : "Starting ring target"}
              </Text>
              <SegmentRow
                options={LENGTH_OPTIONS}
                selected={
                  (LENGTH_OPTIONS as readonly number[]).includes(lastSessionMinutes)
                    ? lastSessionMinutes
                    : 25
                }
                onChange={handleDefaultSessionMinutesChange}
                format={(v) => `${v}m`}
              />

              {focusStyle === "interval" ? (
                <>
                  <Text style={[styles.fieldLabel, { marginTop: 18 }]}>Base break length</Text>
                  <SegmentRow
                    options={BREAK_OPTIONS}
                    selected={breakDuration}
                    onChange={handleBreakDurationChange}
                    format={(v) => `${v}m`}
                  />
                </>
              ) : null}

              <Text style={[styles.fieldLabel, { marginTop: 18 }]}>Default focus music</Text>
              <View style={styles.soundRow}>
                {[null, ...AMBIENT_SOUNDS.map((s) => s.key)].map((key) => {
                  const active = preferredAmbientSound === key;
                  const label =
                    key === null
                      ? "Off"
                      : AMBIENT_SOUNDS.find((s) => s.key === key)?.label ?? key;
                  return (
                    <Pressable
                      key={key ?? "off"}
                      onPress={() => {
                        handlePreferredAmbientSoundChange(key as AmbientSoundKey | null);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Music ${label}`}
                      accessibilityState={{ selected: active }}
                      style={styles.soundPillTouch}
                    >
                      <View style={[styles.soundPill, active && styles.soundPillActive]}>
                        <Text style={[styles.soundPillText, active && styles.soundPillTextActive]}>
                          {label}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </NeumorphicSurface>
          </Animated.View>

          {/* Friends */}
          <Animated.View entering={FadeInDown.delay(150).duration(400)}>
            <NeumorphicSurface style={styles.card}>
              <SectionHeader title="Friends" />
              <NavigationRow
                label="Connect with friends"
                subtitle="Share your code and see how their week is going"
                onPress={() => navigation.navigate("Friends")}
              />
            </NeumorphicSurface>
          </Animated.View>

          {/* Notifications */}
          <Animated.View entering={FadeInDown.delay(250).duration(400)}>
            <NeumorphicSurface style={styles.card}>
              <SectionHeader title="Notifications" />
              <ToggleRow
                label="Streak reminders"
                subtitle="An evening nudge when your streak is at risk"
                value={notificationPrefs.streakReminder}
                onChange={toggleNotificationPref("streakReminder")}
              />
              <Divider />
              <ToggleRow
                label="Check-in alerts"
                subtitle="Notify when a visit is logged automatically"
                value={notificationPrefs.checkinAlerts}
                onChange={toggleNotificationPref("checkinAlerts")}
              />
              <Divider />
              <ToggleRow
                label="Smart suggestions"
                subtitle="Occasional nudges based on when you work best"
                value={notificationPrefs.aiNudges}
                onChange={toggleNotificationPref("aiNudges")}
              />
              <Divider />
              <ToggleRow
                label="Weekly summary"
                subtitle="Your week in review, every Sunday"
                value={notificationPrefs.weeklySummary}
                onChange={toggleNotificationPref("weeklySummary")}
              />
              <TextAction
                label="Send Test Notification"
                onPress={() => void handleTestNotification()}
                containerStyle={{ marginTop: 6 }}
              />
            </NeumorphicSurface>
          </Animated.View>

          {/* Permissions */}
          <Animated.View entering={FadeInDown.delay(300).duration(400)}>
            <NeumorphicSurface style={styles.card}>
              <SectionHeader title="Permissions" />
              <View style={styles.permissionRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>Location (background)</Text>
                  <Text style={styles.rowSubtitle}>
                    {locationGranted === null
                      ? "Checking..."
                      : !checkinGoal
                        ? "Not needed until Auto Check-In is set up"
                      : locationGranted
                        ? "Granted"
                        : "Not granted — Auto Check-In is off"}
                  </Text>
                </View>
              </View>
              <Divider />
              <View style={styles.permissionRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>Notifications</Text>
                  <Text style={styles.rowSubtitle}>
                    {notifGranted === null
                      ? "Checking..."
                      : notifGranted
                        ? "Granted"
                        : "Not granted — reminders are off"}
                  </Text>
                </View>
              </View>
              <TextAction
                label="Open System Settings"
                onPress={() => void Linking.openSettings()}
                containerStyle={{ marginTop: 6 }}
              />
            </NeumorphicSurface>
          </Animated.View>

          {/* Account */}
          <Animated.View entering={FadeInDown.delay(350).duration(400)}>
            <NeumorphicSurface style={styles.card}>
              <SectionHeader title="Account" />

              <View style={{ marginBottom: 16 }}>
                <Text style={styles.accountLabel}>Display Name</Text>
                <Text style={styles.accountValue}>{userConfig?.display_name ?? "User"}</Text>
              </View>

              <View style={{ marginBottom: 12 }}>
                <Text style={styles.accountLabel}>Status</Text>
                <Text style={styles.accountValue}>
                  {userConfig?.id ? "Signed in" : "Not signed in"}
                </Text>
              </View>

              <TextAction label="Sign Out" onPress={handleSignOut} />
              <TextAction
                label={deletingAccount ? "Deleting account..." : "Delete Account"}
                onPress={handleDeleteAccount}
                disabled={deletingAccount}
                textStyle={{ color: NEU.textSecondary }}
              />
            </NeumorphicSurface>
          </Animated.View>
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 24,
  },
  headerTitle: {
    color: NEU.textPrimary,
    fontSize: 18,
    fontFamily: NEU_FONTS.heading,
  },
  card: {
    marginHorizontal: 24,
    marginBottom: 16,
  },
  sectionHeader: {
    color: NEU.textPrimary,
    fontSize: 16,
    fontFamily: NEU_FONTS.label,
    marginBottom: 14,
  },
  divider: {
    height: 1,
    backgroundColor: NEU.track,
    opacity: 0.6,
  },
  fieldLabel: {
    color: NEU.textSecondary,
    fontSize: 13,
    fontFamily: NEU_FONTS.label,
    letterSpacing: 1.0,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  focusModeExplanation: {
    borderLeftWidth: 2,
    borderLeftColor: NEU.accent,
    paddingLeft: 12,
    marginTop: 14,
  },
  focusModeTitle: {
    color: NEU.textPrimary,
    fontSize: 15,
    fontFamily: NEU_FONTS.label,
  },
  focusModeText: {
    color: NEU.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: NEU_FONTS.body,
    marginTop: 3,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    minHeight: NEU.hitTarget,
  },
  permissionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  rowLabel: {
    color: NEU.textPrimary,
    fontSize: 16,
    fontFamily: NEU_FONTS.label,
  },
  rowSubtitle: {
    color: NEU.textSecondary,
    fontSize: 13,
    fontFamily: NEU_FONTS.body,
    marginTop: 2,
    lineHeight: 18,
  },

  segmentedRow: {
    flexDirection: "row",
    gap: 8,
  },
  segmentTouch: {
    flex: 1,
    minHeight: NEU.hitTarget,
    justifyContent: "center",
  },
  segment: {
    minHeight: 38,
    borderRadius: NEU.radiusSmall,
    borderWidth: 1,
    borderColor: NEU.track,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: NEU.card,
  },
  segmentActive: {
    borderColor: NEU.accent,
    backgroundColor: NEU.accent,
  },
  segmentText: {
    color: NEU.textPrimary,
    fontSize: 14,
    fontFamily: NEU_FONTS.label,
  },
  segmentTextActive: {
    color: "#FFFFFF",
  },

  soundRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  soundPillTouch: {
    minHeight: NEU.hitTarget,
    justifyContent: "center",
  },
  soundPill: {
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: NEU.track,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: NEU.card,
  },
  soundPillActive: {
    borderColor: NEU.accent,
    backgroundColor: NEU.accent,
  },
  soundPillText: {
    color: NEU.textPrimary,
    fontSize: 13,
    fontFamily: NEU_FONTS.body,
  },
  soundPillTextActive: {
    color: "#FFFFFF",
  },

  accountLabel: {
    color: NEU.textSecondary,
    fontSize: 12,
    fontFamily: NEU_FONTS.label,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  accountValue: {
    color: NEU.textPrimary,
    fontSize: 16,
    fontFamily: NEU_FONTS.body,
  },
});
