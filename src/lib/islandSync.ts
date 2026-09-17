/**
 * The island on the account instead of on one phone.
 *
 * One row per player in `public.island_state`, holding the whole island as it is
 * stored locally. It is read once after signing in and written again whenever
 * something grows, so a new phone, a reinstall or a second device all end up
 * with the same island (`islandMerge.ts` decides how the two copies come
 * together).
 *
 * Every call is allowed to fail. Growing works offline, and the next successful
 * write carries everything that happened in between — nothing here is allowed to
 * stand between a player and their reward.
 */

import { supabase } from "./supabase";
import { islandGrowth } from "./islandScene";
import { EMPTY_ISLAND, type IslandSnapshot } from "./islandMerge";

const TABLE = "island_state";

/** The island stored for this account, or null when it could not be read. */
export async function fetchIsland(userId: string): Promise<IslandSnapshot | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("objects, spots, applied_sessions")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.warn("Could not read the island from the account:", error.message);
    return null;
  }
  if (!data) return EMPTY_ISLAND;
  return {
    objects: (data.objects ?? {}) as IslandSnapshot["objects"],
    spots: (data.spots ?? {}) as IslandSnapshot["spots"],
    appliedSessions: Array.isArray(data.applied_sessions) ? data.applied_sessions : [],
  };
}

/** Writes the whole island. Returns false when it did not arrive. */
export async function pushIsland(
  userId: string,
  snapshot: IslandSnapshot,
): Promise<boolean> {
  // Size and progress travel as their own two columns. Friends are shown an
  // island, and working it out of the objects JSON would mean the whole growth
  // model in SQL; these two numbers are all that ever leaves the account.
  const growth = islandGrowth(snapshot.objects);
  const { error } = await supabase.from(TABLE).upsert(
    {
      user_id: userId,
      objects: snapshot.objects,
      spots: snapshot.spots,
      applied_sessions: snapshot.appliedSessions,
      stage: growth.stage,
      levels: growth.levels,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) {
    console.warn("Could not save the island to the account:", error.message);
    return false;
  }
  return true;
}
