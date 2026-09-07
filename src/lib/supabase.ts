import { AppState, Platform } from "react-native";
import { createClient, processLock } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AUTH_STORAGE_KEY } from "./storageKeys";

const configuredSupabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? "";
const configuredSupabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";

function isValidSupabaseUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname);
  } catch {
    return false;
  }
}

export const supabaseConfigurationError =
  !isValidSupabaseUrl(configuredSupabaseUrl) ||
  configuredSupabaseAnonKey.length < 20
    ? "This build is missing its server configuration. Install a corrected build or contact support."
    : null;

// Never let a missing build-time variable throw during module evaluation and
// terminate iOS before React can render a recovery screen.
const SUPABASE_URL = supabaseConfigurationError
  ? "https://unconfigured.invalid"
  : configuredSupabaseUrl;
const SUPABASE_ANON_KEY = supabaseConfigurationError
  ? "unconfigured-anon-key"
  : configuredSupabaseAnonKey;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    storageKey: AUTH_STORAGE_KEY,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    lock: processLock,
  },
});

// Supabase's supported React Native lifecycle: serialize concurrent auth
// refreshes and avoid running a foreground refresh timer while the app is
// suspended. Requests still refresh an expired session on demand.
if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
