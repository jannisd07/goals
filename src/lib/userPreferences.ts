import { supabase } from "./supabase";
import type { UserConfig } from "../types";

export type UserPreferencePatch = Partial<
  Pick<
    UserConfig,
    | "default_session_minutes"
    | "break_duration_minutes"
    | "preferred_ambient_sound"
    | "ambient_volume"
    | "notification_preferences"
  >
>;

/** Persists account-scoped preferences without coupling callers to profile rows. */
export async function persistUserPreferences(
  userId: string,
  patch: UserPreferencePatch,
): Promise<void> {
  const { error } = await supabase
    .from("users")
    .update(patch)
    .eq("id", userId);

  if (error) throw error;
}
