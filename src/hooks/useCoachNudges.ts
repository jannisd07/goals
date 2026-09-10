/**
 * Fetches coaching nudges and keeps the local notifications in sync.
 *
 * Call budget on this side: one request per device per day, plus one when this
 * week's progress changed (so "2 of 4 visits" never fires after the fourth),
 * skipped entirely when the user turned coaching off. The server adds its own
 * pattern cache and per-user model budget on top.
 */

import { useCallback, useEffect, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/supabase";
import { deviceTimeZone } from "../lib/time";
import { useAppStore } from "../store";
import {
  clearCoachNudges,
  parseCoachNudges,
  syncCoachNudges,
  type CoachNudge,
  type CoachNudgeResponse,
  type NudgeDeliveryLog,
} from "../lib/coachNudges";
import type { WeeklyProgress } from "../types";

const LAST_FETCH_KEY = "goals-coach-nudges-last-fetch";
const CACHED_NUDGES_KEY = "goals-coach-nudges-cache";
const DELIVERY_LOG_KEY = "goals-coach-nudges-delivery";
/** One server round trip per device per day is plenty for advice this stable. */
const FETCH_INTERVAL_MS = 24 * 60 * 60 * 1000;

interface StoredState {
  fetchedAt: number;
  nudges: CoachNudge[];
  /** Weekly progress the nudges were computed from. */
  progressSignature?: string;
}

/** Compact, order-independent summary of this week's progress. */
export function progressSignature(progress: Record<string, WeeklyProgress>): string {
  return Object.values(progress)
    .map((p) => `${p.goal_id}:${p.sessions_completed}:${Math.round(p.total_hours * 10)}`)
    .sort()
    .join("|");
}

async function readStored(): Promise<StoredState | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHED_NUDGES_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredState> | null;
    if (!parsed || !Array.isArray(parsed.nudges)) return null;
    return {
      fetchedAt: Number(parsed.fetchedAt) || 0,
      // Normalizes entries cached by older app versions, which had no timing.
      nudges: parseCoachNudges({ status: "ready", nudges: parsed.nudges }).nudges,
      progressSignature:
        typeof parsed.progressSignature === "string" ? parsed.progressSignature : undefined,
    };
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

async function readDeliveryLog(): Promise<NudgeDeliveryLog> {
  try {
    const raw = await AsyncStorage.getItem(DELIVERY_LOG_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const log: NudgeDeliveryLog = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === "number" && Number.isFinite(value)) log[key] = value;
    }
    return log;
  } catch {
    return {};
  }
}

async function scheduleWithLog(nudges: CoachNudge[]): Promise<number> {
  const result = await syncCoachNudges(nudges, true, await readDeliveryLog());
  try {
    await AsyncStorage.setItem(DELIVERY_LOG_KEY, JSON.stringify(result.log));
  } catch {
    // Losing the log at worst repeats a one-time nudge once.
  }
  return result.scheduled;
}

async function shouldFetch(
  force: boolean,
  stored: StoredState | null,
  signature: string | undefined,
): Promise<boolean> {
  if (force || !stored) return true;
  try {
    const raw = await AsyncStorage.getItem(LAST_FETCH_KEY);
    const last = raw ? Number(raw) : Number.NaN;
    if (!Number.isFinite(last) || Date.now() - last >= FETCH_INTERVAL_MS) return true;
  } catch {
    return true;
  }
  // An empty signature means progress has not loaded yet; do not refetch on it.
  return Boolean(signature) && signature !== stored.progressSignature;
}

/** Single round trip. The zone name and offset make weekday and hour local. */
export async function requestCoachNudges(): Promise<CoachNudgeResponse> {
  const { data, error } = await supabase.functions.invoke("coach-nudges", {
    body: {
      // getTimezoneOffset counts minutes *behind* UTC, the server expects ahead.
      utc_offset_minutes: -new Date().getTimezoneOffset(),
      // Lets the server place older sessions correctly across daylight saving.
      time_zone: deviceTimeZone(),
    },
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
  progressSignature?: string;
}): Promise<number> {
  const enabled = options?.enabled ?? true;
  if (!enabled) {
    await clearCoachNudges();
    return 0;
  }

  const stored = await readStored();
  const signature = options?.progressSignature;
  if (!(await shouldFetch(options?.force === true, stored, signature))) {
    // Reschedule from the local cache so notifications survive a reinstall of
    // the schedule (for example after the user re-granted permission).
    return stored ? scheduleWithLog(stored.nudges) : 0;
  }

  try {
    const response = await requestCoachNudges();
    await writeStored({
      fetchedAt: Date.now(),
      nudges: response.nudges,
      progressSignature: signature || stored?.progressSignature,
    });
    return await scheduleWithLog(response.nudges);
  } catch (error) {
    console.warn("Could not refresh coaching nudges:", error);
    return stored ? scheduleWithLog(stored.nudges) : 0;
  }
}

/** Mounted once at the app root, next to the other foreground sync effects. */
export function useCoachNudges(): { refresh: (force?: boolean) => void } {
  const isAuthenticated = useAppStore((state) => state.isAuthenticated);
  const isAppVisible = useAppStore((state) => state.isAppVisible);
  const aiNudges = useAppStore((state) => state.notificationPrefs.aiNudges);
  const signature = useAppStore((state) => progressSignature(state.weeklyProgress));
  const latest = useRef({ enabled: aiNudges, signature });
  latest.current = { enabled: aiNudges, signature };
  const running = useRef(false);
  const queued = useRef<{ force: boolean } | null>(null);

  const run = useCallback((force = false) => {
    if (running.current) {
      // A setting or this week's progress changed mid-request: run once more
      // afterwards with the latest values instead of dropping the change.
      queued.current = { force: force || queued.current?.force === true };
      return;
    }
    running.current = true;
    const current = latest.current;
    void refreshCoachNudges({
      force,
      enabled: current.enabled,
      progressSignature: current.signature,
    })
      .catch(() => undefined)
      .finally(() => {
        running.current = false;
        const next = queued.current;
        queued.current = null;
        if (next) run(next.force);
      });
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      void clearCoachNudges();
      return;
    }
    if (!isAppVisible) return;
    run();
  }, [isAuthenticated, isAppVisible, aiNudges, signature, run]);

  return { refresh: run };
}
