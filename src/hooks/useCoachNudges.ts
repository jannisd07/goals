/**
 * Fetches coaching nudges and keeps the local notifications in sync.
 *
 * Call budget on this side: at most one request per device per day, skipped
 * entirely when the user turned coaching off. The server adds its own pattern
 * cache and per-user model budget on top.
 */

import { useCallback, useEffect, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/supabase";
import { useAppStore } from "../store";
import {
  clearCoachNudges,
  parseCoachNudges,
  syncCoachNudges,
  type CoachNudge,
  type CoachNudgeResponse,
} from "../lib/coachNudges";

const LAST_FETCH_KEY = "goals-coach-nudges-last-fetch";
const CACHED_NUDGES_KEY = "goals-coach-nudges-cache";
/** One server round trip per device per day is plenty for advice this stable. */
const FETCH_INTERVAL_MS = 24 * 60 * 60 * 1000;

interface StoredState {
  fetchedAt: number;
  nudges: CoachNudge[];
}

async function readStored(): Promise<StoredState | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHED_NUDGES_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredState;
    if (!Array.isArray(parsed?.nudges)) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeStored(state: StoredState): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHED_NUDGES_KEY, JSON.stringify(state));
    await AsyncStorage.setItem(LAST_FETCH_KEY, String(state.fetchedAt));
  } catch {
    // A failed cache write only costs one extra request tomorrow.
  }
}

async function shouldFetch(force: boolean): Promise<boolean> {
  if (force) return true;
  try {
    const raw = await AsyncStorage.getItem(LAST_FETCH_KEY);
    if (!raw) return true;
    const last = Number(raw);
    if (!Number.isFinite(last)) return true;
    return Date.now() - last >= FETCH_INTERVAL_MS;
  } catch {
    return true;
  }
}

/** Single round trip. The device offset makes weekday and hour local. */
export async function requestCoachNudges(): Promise<CoachNudgeResponse> {
  const { data, error } = await supabase.functions.invoke("coach-nudges", {
    // getTimezoneOffset counts minutes *behind* UTC, the server expects ahead.
    body: { utc_offset_minutes: -new Date().getTimezoneOffset() },
  });
  if (error) throw error;
  return parseCoachNudges(data);
}

/**
 * Refreshes nudges when due and reschedules the local notifications.
 * Safe to call on every foreground; the interval check makes it cheap.
 */
export async function refreshCoachNudges(options?: {
  force?: boolean;
  enabled?: boolean;
}): Promise<number> {
  const enabled = options?.enabled ?? true;
  if (!enabled) {
    await clearCoachNudges();
    return 0;
  }

  if (!(await shouldFetch(options?.force === true))) {
    // Reschedule from the local cache so notifications survive a reinstall of
    // the schedule (for example after the user re-granted permission).
    const stored = await readStored();
    if (stored) return syncCoachNudges(stored.nudges, true);
    return 0;
  }

  try {
    const response = await requestCoachNudges();
    await writeStored({ fetchedAt: Date.now(), nudges: response.nudges });
    return await syncCoachNudges(response.nudges, true);
  } catch (error) {
    console.warn("Could not refresh coaching nudges:", error);
    const stored = await readStored();
    if (stored) return syncCoachNudges(stored.nudges, true);
    return 0;
  }
}

/** Mounted once at the app root, next to the other foreground sync effects. */
export function useCoachNudges(): { refresh: (force?: boolean) => void } {
  const isAuthenticated = useAppStore((state) => state.isAuthenticated);
  const isAppVisible = useAppStore((state) => state.isAppVisible);
  const aiNudges = useAppStore((state) => state.notificationPrefs.aiNudges);
  const running = useRef(false);

  const run = useCallback(
    (force = false) => {
      if (running.current) return;
      running.current = true;
      void refreshCoachNudges({ force, enabled: aiNudges })
        .catch(() => undefined)
        .finally(() => {
          running.current = false;
        });
    },
    [aiNudges],
  );

  useEffect(() => {
    if (!isAuthenticated) {
      void clearCoachNudges();
      return;
    }
    if (!isAppVisible) return;
    run();
  }, [isAuthenticated, isAppVisible, aiNudges, run]);

  return { refresh: run };
}
