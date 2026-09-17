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

/**
 * Who is signed in, from the session on the device.
 *
 * Queries used to ask `auth.getUser()`, which goes to the server to verify the
 * token. Without a connection that returns no user and no thrown error — and
 * every query then answered "nothing here" instead of failing: goals became
 * empty, the week showed zeros, and Auto Check-In concluded there was nothing
 * to watch and switched itself off. Row-level security checks the token on
 * every request anyway; scoping a query only needs the id.
 */
export async function currentUser(): Promise<{ id: string } | null> {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  return user ? { id: user.id } : null;
}
