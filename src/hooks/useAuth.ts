import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase, supabaseConfigurationError } from "../lib/supabase";
import { clearAccountNotifications, syncWeeklySummary } from "../lib/notifications";
import { advancePomodoro } from "../lib/pomodoro";
import { resetGeofencingForAccount } from "../services/geofencing";
import { useAppStore } from "../store";
import { DEFAULT_NOTIFICATION_PREFS } from "../store/configSlice";
import type { UserConfig } from "../types";

function toReadableAuthError(error: unknown): Error {
  const fallback = "We could not complete this request. Please try again.";
  const raw = error instanceof Error ? error.message : fallback;
  const lower = raw.toLowerCase();

  if (lower.includes("invalid login credentials")) {
    return new Error("Incorrect email or password.");
  }
  if (lower.includes("email not confirmed")) {
    return new Error("Please confirm your email address before signing in.");
  }
  if (
    lower.includes("user already registered") ||
    lower.includes("already registered") ||
    lower.includes("already exists")
  ) {
    return new Error("An account with this email already exists. Please sign in or reset your password.");
  }
  if (lower.includes("password should be at least")) {
    return new Error("Password is too short.");
  }
  if (lower.includes("network") || lower.includes("fetch")) {
    return new Error("Network error. Please check your connection and try again.");
  }

  return new Error(raw || fallback);
}

function requiresVerifiedEmail(user: User): boolean {
  const primaryProvider = user.app_metadata?.provider;
  const providers = Array.isArray(user.app_metadata?.providers)
    ? user.app_metadata.providers
    : [];
  return primaryProvider === "email" || providers.includes("email");
}

function hasRequiredEmailVerification(user: User): boolean {
  return !requiresVerifiedEmail(user) || Boolean(user.email_confirmed_at);
}

const DEFAULT_COMMITMENTS = {
  sleep_hours_per_night: 8,
  work_hours_per_day: 8,
  work_days_per_week: 5,
  daily_overhead_hours: 2,
};

// `users` grants UPDATE only on profile columns, never on `id`, so a PostgREST
// upsert (ON CONFLICT DO UPDATE) is always rejected with 42501, and
// ON CONFLICT DO NOTHING trips the display-name CHECK on a placeholder row
// (23514). Rows are therefore created with a plain insert, where losing a race
// is a unique violation, and names change through a plain update.
const UNIQUE_VIOLATION = "23505";

// Mirrors the users_display_name_valid CHECK: 1–80 characters after trimming.
function toValidDisplayName(raw: unknown): string {
  return String(raw ?? "").trim().slice(0, 80).trim();
}

async function selectUserConfig(userId: string): Promise<UserConfig | null> {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as UserConfig | null;
}

async function loadOrCreateUserConfig(user: User): Promise<UserConfig> {
  const existing = await selectUserConfig(user.id);
  if (existing) return existing;

  const metadata = user.user_metadata ?? {};
  const fallbackName =
    metadata.display_name ??
    metadata.full_name ??
    metadata.name ??
    user.email?.split("@")[0] ??
    "there";

  const { data: created, error: createError } = await supabase
    .from("users")
    .insert({
      id: user.id,
      display_name: toValidDisplayName(fallbackName) || "there",
      fixed_commitments: DEFAULT_COMMITMENTS,
      onboarding_complete: false,
    })
    .select("*")
    .single();

  if (!createError) return created as UserConfig;
  // A concurrent profile load (an auth event racing the bootstrap) created the
  // row between the select and the insert.
  if (createError.code !== UNIQUE_VIOLATION) throw createError;
  const concurrent = await selectUserConfig(user.id);
  if (!concurrent) throw createError;
  return concurrent;
}

/**
 * Saves a display name on the signed-in user's profile and returns the stored
 * value. An update on a row that does not exist yet matches nothing, so the row
 * is created first and the update retried once.
 */
export async function saveUserDisplayName(
  user: User,
  displayName: string,
): Promise<string> {
  const name = toValidDisplayName(displayName);
  if (!name) throw new Error("The display name is empty.");

  const updateName = () =>
    supabase
      .from("users")
      .update({ display_name: name, updated_at: new Date().toISOString() })
      .eq("id", user.id)
      .select("id");

  const first = await updateName();
  if (first.error) throw first.error;
  if (first.data.length > 0) return name;

  await loadOrCreateUserConfig(user);
  const retry = await updateName();
  if (retry.error) throw retry.error;
  if (retry.data.length === 0) {
    throw new Error("Your account profile is missing. Sign out and sign in again.");
  }
  return name;
}

function applyUserConfig(config: UserConfig): void {
  const state = useAppStore.getState();
  state.setUserConfig(config);
  state.setFixedCommitments(config.fixed_commitments ?? DEFAULT_COMMITMENTS);
  state.setFocusStyle(config.focus_style ?? "interval");
  state.setLastSessionMinutes(config.default_session_minutes ?? 25);
  state.setBreakDuration(config.break_duration_minutes ?? 5);
  state.setPreferredAmbientSound(config.preferred_ambient_sound ?? null);
  state.setAmbientVolume(config.ambient_volume ?? 0.5);
  state.setNotificationPrefs({
    ...DEFAULT_NOTIFICATION_PREFS,
    ...(config.notification_preferences ?? {}),
  });
  void syncWeeklySummary(
    config.notification_preferences?.weeklySummary ??
      DEFAULT_NOTIFICATION_PREFS.weeklySummary,
  );
  if (config.onboarding_complete) {
    state.setPendingOnboarding(null);
  }
}

function clearUserScopedState(clearPendingOnboarding = false): void {
  const state = useAppStore.getState();
  state.setUserConfig(null);
  state.setGoals([]);
  state.setWeeklyProgress({});
  state.setUsedTimeThisWeek(0);
  state.endSession();
  state.setLastCompletedSessionId(null);
  state.setPermissionGateDismissed(false);
  state.setFixedCommitments(DEFAULT_COMMITMENTS);
  state.setFocusStyle("interval");
  state.setLastSessionMinutes(25);
  state.setBreakDuration(5);
  state.setPreferredAmbientSound(null);
  state.setAmbientVolume(0.5);
  state.setNotificationPrefs(DEFAULT_NOTIFICATION_PREFS);
  if (clearPendingOnboarding) {
    state.setPendingOnboarding(null);
  }
}

async function closePersistedManualSession(): Promise<void> {
  const activeSession = useAppStore.getState().activeSession;
  const pomodoro = activeSession?.pomodoro;
  if (!activeSession || !pomodoro) return;

  const elapsedSinceTick =
    pomodoro.is_running && pomodoro.last_tick_at_ms
      ? Math.max(0, Math.floor((Date.now() - pomodoro.last_tick_at_ms) / 1000))
      : 0;
  const advanced = advancePomodoro(
    pomodoro,
    elapsedSinceTick,
    useAppStore.getState().breakDuration,
  ).pomodoro;

  const operation =
    advanced.focused_seconds > 0
      ? supabase
          .from("sessions")
          .update({
            end_time: new Date().toISOString(),
            duration_seconds: advanced.focused_seconds,
            pomodoro_cycles: advanced.total_cycles,
            growth_stage: Math.min(4, Math.floor(advanced.focused_seconds / 1800)),
            ambient_sound: activeSession.ambient_sound,
          })
          .eq("id", activeSession.session_id)
      : supabase.from("sessions").delete().eq("id", activeSession.session_id);

  const { error } = await operation;
  if (error) throw error;
}

async function clearAccountDeviceState(closeManualSession = true): Promise<void> {
  if (closeManualSession) {
    await closePersistedManualSession().catch((error) => {
      console.warn("Could not close the active focus session during sign-out:", error);
    });
  }
  await Promise.all([
    resetGeofencingForAccount(),
    clearAccountNotifications(),
  ]);
}

/**
 * Owns the single global Supabase auth subscription.
 * Mount exactly once at the app root; screens use useAuth() only for actions.
 */
export function useAuthBootstrap() {
  const setAuthenticated = useAppStore((s) => s.setAuthenticated);
  const setLoading = useAppStore((s) => s.setLoading);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [bootstrapAttempt, setBootstrapAttempt] = useState(0);
  const authLoadGenerationRef = useRef(0);

  const retryBootstrap = useCallback(() => {
    setLoading(true);
    setBootstrapError(null);
    setBootstrapAttempt((attempt) => attempt + 1);
  }, [setLoading]);

  useEffect(() => {
    if (supabaseConfigurationError) {
      authLoadGenerationRef.current += 1;
      setAuthenticated(false);
      setBootstrapError(supabaseConfigurationError);
      setLoading(false);
      return;
    }

    const checkSession = async () => {
      const generation = authLoadGenerationRef.current + 1;
      authLoadGenerationRef.current = generation;
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && hasRequiredEmailVerification(session.user)) {
          const previousUserId = useAppStore.getState().userConfig?.id;
          if (previousUserId && previousUserId !== session.user.id) {
            clearUserScopedState(true);
          }
          const config = await loadOrCreateUserConfig(session.user);
          if (authLoadGenerationRef.current !== generation) return;
          applyUserConfig(config);
          setAuthenticated(true);
          setBootstrapError(null);
        } else {
          if (session?.user) {
            await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
          }
          if (authLoadGenerationRef.current !== generation) return;
          const hadAuthenticatedProfile = Boolean(
            useAppStore.getState().userConfig?.id,
          );
          void clearAccountDeviceState(false).catch((error) => {
            console.warn("Signed-out device cleanup was incomplete:", error);
          });
          setAuthenticated(false);
          setBootstrapError(null);
          // Preserve setup collected before a first signup, but never keep
          // setup data that belonged to a previously authenticated account.
          clearUserScopedState(hadAuthenticatedProfile);
        }
      } catch (error) {
        if (authLoadGenerationRef.current !== generation) return;
        console.error("Failed to restore auth session:", error);
        setAuthenticated(false);
        setBootstrapError(
          "Your account could not be loaded. Check your connection and try again.",
        );
      } finally {
        if (authLoadGenerationRef.current === generation) {
          setLoading(false);
        }
      }
    };

    void checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Initial restoration is owned by getSession above. Refreshing a token
        // keeps the same account and must not flash a full-screen loader.
        if (event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") return;

        const generation = authLoadGenerationRef.current + 1;
        authLoadGenerationRef.current = generation;

        if (session?.user && hasRequiredEmailVerification(session.user)) {
          setLoading(true);
          try {
            const previousUserId = useAppStore.getState().userConfig?.id;
            if (previousUserId && previousUserId !== session.user.id) {
              clearUserScopedState(true);
            }
            const config = await loadOrCreateUserConfig(session.user);
            if (authLoadGenerationRef.current !== generation) return;
            applyUserConfig(config);
            setAuthenticated(true);
            setBootstrapError(null);
          } catch (error) {
            if (authLoadGenerationRef.current !== generation) return;
            console.error("Failed to load account profile:", error);
            setAuthenticated(false);
            setBootstrapError(
              "Your account could not be loaded. Check your connection and try again.",
            );
          } finally {
            if (authLoadGenerationRef.current === generation) {
              setLoading(false);
            }
          }
        } else {
          if (session?.user) {
            void supabase.auth.signOut({ scope: "local" });
          }
          // This also covers externally expired/revoked sessions. Remote writes
          // may be unauthorized, but local account-specific background state
          // must never survive into another user.
          const hadAuthenticatedProfile = Boolean(
            useAppStore.getState().userConfig?.id,
          );
          void clearAccountDeviceState(false).catch((error) => {
            console.warn("Signed-out device cleanup was incomplete:", error);
          });
          setAuthenticated(false);
          setBootstrapError(null);
          clearUserScopedState(hadAuthenticatedProfile);
          setLoading(false);
        }
      }
    );

    return () => {
      authLoadGenerationRef.current += 1;
      subscription.unsubscribe();
    };
  }, [bootstrapAttempt, setAuthenticated, setLoading]);

  return { bootstrapError, retryBootstrap };
}

export function useAuth() {
  const setAuthenticated = useAppStore((s) => s.setAuthenticated);

  const signInWithEmail = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) throw toReadableAuthError(error);
    if (!data.user?.email_confirmed_at) {
      await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
      throw new Error("Please confirm your email address before signing in.");
    }
  };

  const signUpWithEmail = async (email: string, password: string, displayName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        emailRedirectTo: "com.goals.app://auth-confirmed",
        data: {
          display_name: displayName.trim(),
        },
      },
    });
    if (error) throw toReadableAuthError(error);

    const requiresEmailConfirmation = !data.user?.email_confirmed_at;
    if (requiresEmailConfirmation && data.session) {
      await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    }

    // Profile creation is owned by the single global auth bootstrap. Keeping it
    // out of the form action avoids two concurrent profile writes and prevents an
    // auxiliary profile request from making a successful signup look failed.

    return {
      requiresEmailConfirmation,
    };
  };

  const requestPasswordReset = async (email: string) => {
    const normalized = email.trim().toLowerCase();
    const { error } = await supabase.auth.resetPasswordForEmail(normalized, {
      redirectTo: "com.goals.app://reset-password",
    });
    if (error) throw toReadableAuthError(error);
  };

  const resendSignupConfirmation = async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: "com.goals.app://auth-confirmed",
      },
    });
    if (error) throw toReadableAuthError(error);
  };

  const signOut = async () => {
    await clearAccountDeviceState().catch((error) => {
      console.warn("Account device cleanup was incomplete:", error);
    });
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) throw toReadableAuthError(error);
    setAuthenticated(false);
    clearUserScopedState(true);
  };

  const deleteAccount = async () => {
    const { error } = await supabase.functions.invoke("delete-account", {
      body: {},
    });
    if (error) throw toReadableAuthError(error);

    // Ensure local auth state clears even if token is already invalidated.
    await clearAccountDeviceState(false).catch((cleanupError) => {
      console.warn("Account device cleanup was incomplete:", cleanupError);
    });
    await supabase.auth.signOut({ scope: "local" });
    setAuthenticated(false);
    clearUserScopedState(true);
  };

  return {
    signInWithEmail,
    signUpWithEmail,
    resendSignupConfirmation,
    requestPasswordReset,
    signOut,
    deleteAccount,
  };
}
