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
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import {
  PaperCard,
  PaperHeader,
  PaperLabel,
  PaperScreen,
} from "../components/paper/PaperUI";
import { FlatToggle } from "../components/ui/FlatToggle";
import { TextAction } from "../components/ui/TextAction";
import { FocusModeSwitch } from "../components/ui/FocusModeSwitch";
import { ChevronRightIcon } from "../components/TabIcons";
import { DisplayNameSheet } from "../components/DisplayNameSheet";
import { useAppStore } from "../store";
import { useAuth } from "../hooks/useAuth";
import { useDeactivateGoal } from "../hooks/useGoals";
import { hapticLight } from "../lib/haptics";
import { userFacingMessage } from "../lib/errors";
import { persistFocusStyle } from "../lib/focusStyle";
import { syncWeeklySummary } from "../lib/notifications";
import { persistUserPreferences } from "../lib/userPreferences";
import { AMBIENT_SOUNDS, type AmbientSoundKey, type FocusStyle, type Goal } from "../types";
import type { NotificationPrefs } from "../store/configSlice";
import type { RootStackParamList } from "../navigation/types";
import { NEU_FONTS } from "../theme/neumorphism";
import { PAPER } from "../theme/paper";

type SettingsNav = NativeStackNavigationProp<RootStackParamList>;

const BREAK_OPTIONS = [5, 10, 15, 20] as const;
const LENGTH_OPTIONS = [15, 25, 45, 60] as const;

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
      <ChevronRightIcon size={18} color={PAPER.inkFaint} strokeWidth={2} />
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
  const { signOut, deleteAccount, updateDisplayName } = useAuth();
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
  const deactivateGoal = useDeactivateGoal();

  /**
   * Switching a goal off is reversible and keeps every logged hour, so it asks
   * once and says exactly that — this is not the delete button.
   */
  const handleTurnOffGoal = useCallback(
    (goal: Goal) => {
      hapticLight();
      Alert.alert(
        `Turn off ${goal.name}?`,
        goal.type === "physical"
          ? "Visits stop being recorded and the location is no longer watched. Everything you have logged so far is kept, and you can set it up again any time."
          : "This goal disappears from Home. Everything you have logged so far is kept, and you can set it up again any time.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Turn off",
            style: "destructive",
            onPress: () => {
              void deactivateGoal.mutateAsync(goal).catch((error: unknown) => {
                Alert.alert(
                  "Couldn’t turn it off",
                  error instanceof Error
                    ? error.message
                    : "Check your connection and try again.",
                );
              });
            },
          },
        ],
      );
    },
    [deactivateGoal],
  );

  const [deletingAccount, setDeletingAccount] = useState(false);
  const [editingName, setEditingName] = useState(false);
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
              userFacingMessage(error, "Please try again."),
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
              const message = userFacingMessage(error, "Failed to delete account.");
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
    <PaperScreen edges={["top"]}>
      <PaperHeader
        title="Settings"
        onClose={() => {
          hapticLight();
          navigation.goBack();
        }}
      />
      <Animated.View entering={FadeIn.duration(220)} style={{ flex: 1 }}>
        <ScrollView
          bounces={false}
          alwaysBounceVertical={false}
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >

          {/* Goals */}
          <Animated.View entering={FadeInDown.delay(50).duration(400)}>
            <PaperLabel style={styles.firstLabel}>Goals</PaperLabel>
            <PaperCard style={styles.card} padding={0}>
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
              {focusGoal ? (
                <>
                  <Divider />
                  <TextAction
                    label="Turn off this focus goal"
                    onPress={() => handleTurnOffGoal(focusGoal)}
                    disabled={deactivateGoal.isPending}
                    containerStyle={styles.cardAction}
                    textStyle={styles.linkText}
                  />
                </>
              ) : null}
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
              {checkinGoal ? (
                <>
                  <Divider />
                  <TextAction
                    label="Turn off Auto Check-In"
                    onPress={() => handleTurnOffGoal(checkinGoal)}
                    disabled={deactivateGoal.isPending}
                    containerStyle={styles.cardAction}
                    textStyle={styles.linkText}
                  />
                </>
              ) : null}
            </PaperCard>
          </Animated.View>

          {/* Focus */}
          <Animated.View entering={FadeInDown.delay(100).duration(400)}>
            <PaperLabel>Focus sessions</PaperLabel>
            <PaperCard style={styles.card} padding={16}>
              <Text style={styles.fieldLabel}>Focus style</Text>
              <FocusModeSwitch
                value={focusStyle}
                onChange={handleFocusStyleChange}
              />

              <View style={styles.focusModeExplanation}>
                <Text style={styles.focusModeTitle}>
                  {focusStyle === "interval"
                    ? "Breaks start on their own"
                    : "You decide when to stop"}
                </Text>
                <Text style={styles.focusModeText}>
                  {focusStyle === "interval"
                    ? "Each block runs for the length below, then a short break begins."
                    : "The clock runs until you take a break. The longer you focused, the longer the break. The ring below is only a visual goal."}
                </Text>
              </View>

              <Text style={[styles.fieldLabel, { marginTop: 18 }]}>
                {focusStyle === "interval" ? "Focus block length" : "Ring goal"}
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
            </PaperCard>
          </Animated.View>

          {/* Friends */}
          <Animated.View entering={FadeInDown.delay(150).duration(400)}>
            <PaperLabel>Friends</PaperLabel>
            <PaperCard style={styles.card} padding={0}>
              <NavigationRow
                label="Connect with friends"
                subtitle="Share your code and see how their week is going"
                onPress={() => navigation.navigate("Friends")}
              />
            </PaperCard>
          </Animated.View>

          {/* Notifications */}
          <Animated.View entering={FadeInDown.delay(250).duration(400)}>
            <PaperLabel>Notifications</PaperLabel>
            <PaperCard style={styles.card} padding={0}>
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
              <Divider />
              <TextAction
                label="Send test notification"
                onPress={() => void handleTestNotification()}
                containerStyle={styles.cardAction}
                textStyle={styles.linkText}
              />
            </PaperCard>
          </Animated.View>

          {/* Permissions */}
          <Animated.View entering={FadeInDown.delay(300).duration(400)}>
            <PaperLabel>Permissions</PaperLabel>
            <PaperCard style={styles.card} padding={0}>
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
              <Divider />
              <TextAction
                label="Open system settings"
                onPress={() => void Linking.openSettings()}
                containerStyle={styles.cardAction}
                textStyle={styles.linkText}
              />
            </PaperCard>
          </Animated.View>

          {/* Account */}
          <Animated.View entering={FadeInDown.delay(350).duration(400)}>
            <PaperLabel>Account</PaperLabel>
            <PaperCard style={styles.card} padding={0}>
              <Pressable
                onPress={() => {
                  hapticLight();
                  setEditingName(true);
                }}
                disabled={!userConfig?.id}
                accessibilityRole="button"
                accessibilityLabel={`Display name, ${userConfig?.display_name ?? "User"}`}
                accessibilityHint="Opens a field to change your name"
                style={({ pressed }) => [
                  styles.accountRow,
                  styles.accountEditRow,
                  { opacity: pressed ? 0.55 : 1 },
                ]}
              >
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={styles.accountLabel}>Display name</Text>
                  <Text style={styles.accountValue} numberOfLines={1}>
                    {userConfig?.display_name ?? "User"}
                  </Text>
                </View>
                <Text style={styles.editText}>Edit</Text>
              </Pressable>
              <Divider />
              <View style={styles.accountRow}>
                <Text style={styles.accountLabel}>Status</Text>
                <Text style={styles.accountValue}>
                  {userConfig?.id ? "Signed in" : "Not signed in"}
                </Text>
              </View>
              <Divider />
              <TextAction
                label="Sign out"
                onPress={handleSignOut}
                containerStyle={styles.cardAction}
                textStyle={styles.linkText}
              />
              <Divider />
              <TextAction
                label={deletingAccount ? "Deleting account..." : "Delete account"}
                onPress={handleDeleteAccount}
                disabled={deletingAccount}
                containerStyle={styles.cardAction}
                textStyle={styles.dangerText}
              />
            </PaperCard>
          </Animated.View>
        </ScrollView>
      </Animated.View>
      <DisplayNameSheet
        visible={editingName}
        currentName={userConfig?.display_name ?? ""}
        onSave={updateDisplayName}
        onClose={() => setEditingName(false)}
      />
    </PaperScreen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 48,
  },
  firstLabel: {
    marginTop: 12,
  },
  card: {
    marginBottom: 4,
  },
  cardAction: {
    minHeight: 50,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  linkText: {
    color: PAPER.accentInk,
    fontSize: 15,
    textAlign: "left",
  },
  dangerText: {
    color: PAPER.danger,
    fontSize: 15,
    textAlign: "left",
  },

  divider: {
    height: 1,
    backgroundColor: PAPER.line,
  },
  fieldLabel: {
    color: PAPER.inkFaint,
    fontSize: 11,
    fontFamily: NEU_FONTS.label,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 10,
  },

  // A quiet left rule instead of a tinted callout box. A second filled panel
  // inside a card is the thing that makes settings pages look padded out.
  focusModeExplanation: {
    borderLeftWidth: 2,
    borderLeftColor: PAPER.accent,
    paddingLeft: 12,
    marginTop: 14,
  },
  focusModeTitle: {
    color: PAPER.ink,
    fontSize: 15,
    fontFamily: NEU_FONTS.label,
  },
  focusModeText: {
    color: PAPER.inkMuted,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: NEU_FONTS.body,
    marginTop: 3,
  },

  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: PAPER.hitTarget,
  },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 13,
    paddingHorizontal: 16,
    minHeight: PAPER.hitTarget,
  },
  permissionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: PAPER.hitTarget,
  },
  accountRow: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  accountEditRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: PAPER.hitTarget,
  },
  rowLabel: {
    color: PAPER.ink,
    fontSize: 16,
    fontFamily: NEU_FONTS.label,
  },
  rowSubtitle: {
    color: PAPER.inkMuted,
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
    minHeight: PAPER.hitTarget,
    justifyContent: "center",
  },
  segment: {
    minHeight: 38,
    borderRadius: PAPER.radiusSm,
    borderWidth: 1,
    borderColor: PAPER.line,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PAPER.surface,
  },
  segmentActive: {
    borderColor: PAPER.accent,
    backgroundColor: PAPER.accentWash,
  },
  segmentText: {
    color: PAPER.inkMuted,
    fontSize: 14,
    fontFamily: NEU_FONTS.label,
    fontVariant: ["tabular-nums"],
  },
  segmentTextActive: {
    color: PAPER.accentInk,
    fontFamily: NEU_FONTS.heading,
  },

  soundRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  soundPillTouch: {
    minHeight: PAPER.hitTarget,
    justifyContent: "center",
  },
  soundPill: {
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: PAPER.line,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PAPER.surface,
  },
  soundPillActive: {
    borderColor: PAPER.accent,
    backgroundColor: PAPER.accentWash,
  },
  soundPillText: {
    color: PAPER.inkMuted,
    fontSize: 13,
    fontFamily: NEU_FONTS.body,
  },
  soundPillTextActive: {
    color: PAPER.accentInk,
    fontFamily: NEU_FONTS.label,
  },

  accountLabel: {
    color: PAPER.inkFaint,
    fontSize: 11,
    fontFamily: NEU_FONTS.label,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 3,
  },
  accountValue: {
    color: PAPER.ink,
    fontSize: 16,
    fontFamily: NEU_FONTS.body,
  },
  editText: {
    color: PAPER.accentInk,
    fontSize: 15,
    fontFamily: NEU_FONTS.label,
  },
});
