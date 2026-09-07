import type { StateCreator } from "zustand";
import type { PendingOnboarding, UserConfig } from "../types";

export interface NotificationPrefs {
  streakReminder: boolean;
  checkinAlerts: boolean;
  aiNudges: boolean;
  weeklySummary: boolean;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  streakReminder: true,
  checkinAlerts: true,
  aiNudges: true,
  weeklySummary: false,
};

export interface ConfigSlice {
  userConfig: UserConfig | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** Runtime-only: true after the native splash screen has actually been hidden. */
  isAppVisible: boolean;
  /** Device-local acknowledgement of the optional returning-user permission prompt. */
  permissionGateDismissed: boolean;
  /** Runtime-only recovery link state; prevents the auth guard from hiding reset UI. */
  isPasswordRecovery: boolean;
  autoCheckInPermissionWarning: string | null;
  notificationPermissionWarning: string | null;
  /** Setup data collected during pre-auth onboarding; flushed to Supabase right after signup. */
  pendingOnboarding: PendingOnboarding | null;
  notificationPrefs: NotificationPrefs;
  setUserConfig: (config: UserConfig | null) => void;
  setAuthenticated: (value: boolean) => void;
  setLoading: (value: boolean) => void;
  setAppVisible: (value: boolean) => void;
  setPermissionGateDismissed: (value: boolean) => void;
  setPasswordRecovery: (value: boolean) => void;
  setAutoCheckInPermissionWarning: (value: string | null) => void;
  setNotificationPermissionWarning: (value: string | null) => void;
  setPendingOnboarding: (value: PendingOnboarding | null) => void;
  setNotificationPref: (key: keyof NotificationPrefs, value: boolean) => void;
  setNotificationPrefs: (value: NotificationPrefs) => void;
}

export const createConfigSlice: StateCreator<ConfigSlice, [], [], ConfigSlice> = (set) => ({
  userConfig: null,
  isAuthenticated: false,
  isLoading: true,
  isAppVisible: false,
  permissionGateDismissed: false,
  isPasswordRecovery: false,
  autoCheckInPermissionWarning: null,
  notificationPermissionWarning: null,
  pendingOnboarding: null,
  notificationPrefs: DEFAULT_NOTIFICATION_PREFS,

  setUserConfig: (config) => set({ userConfig: config }),
  setAuthenticated: (value) => set({ isAuthenticated: value }),
  setLoading: (value) => set({ isLoading: value }),
  setAppVisible: (value) => set({ isAppVisible: value }),
  setPermissionGateDismissed: (value) => set({ permissionGateDismissed: value }),
  setPasswordRecovery: (value) => set({ isPasswordRecovery: value }),
  setAutoCheckInPermissionWarning: (value) => set({ autoCheckInPermissionWarning: value }),
  setNotificationPermissionWarning: (value) => set({ notificationPermissionWarning: value }),
  setPendingOnboarding: (value) => set({ pendingOnboarding: value }),
  setNotificationPref: (key, value) =>
    set((state) => ({
      notificationPrefs: { ...state.notificationPrefs, [key]: value },
    })),
  setNotificationPrefs: (value) => set({ notificationPrefs: value }),
});
