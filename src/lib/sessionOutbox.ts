/**
 * Finished sessions that have not reached the server yet.
 *
 * Before this existed, a focus session that ended while the phone had no
 * connection was simply gone: the update failed, the error was logged, and the
 * time the player had actually spent was never written anywhere. The same was
 * true for an Auto Check-In — the background task wrote straight to Supabase,
 * and a failed write left nothing behind to retry from.
 *
 * Now every finished session is written here first if it could not be sent, and
 * the queue is emptied whenever the app has a connection again. Two rules keep
 * it honest:
 *
 *   1. **Nothing is queued twice.** Entries are keyed by the session id the app
 *      already uses, and a queued session that is sent while a duplicate is
 *      still on the server is matched by goal and start time before inserting.
 *   2. **Nothing is dropped silently.** The cap is high enough that it cannot be
 *      reached by normal use, and hitting it is logged rather than swallowed.
 *
 * Kept under its own AsyncStorage key rather than in the Zustand store, for the
 * same reason as `pendingGrows.ts`: the Auto Check-In background task writes
 * here while the app may not be running.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";
import type { AmbientSoundKey, SessionTrigger } from "../types";

export const SESSION_OUTBOX_KEY = "goals-session-outbox";

/**
 * Far above anything real use produces — a player would have to finish 200
 * sessions without the phone ever reaching the server once. It exists so a
 * broken write loop cannot fill the device, not as a product limit.
 */
const MAX_QUEUED_SESSIONS = 200;

export interface QueuedSession {
  /** The id the app used for this session. Local ids start with `local-`. */
  id: string;
  /** Set when the row already exists on the server and only needs closing. */
  serverId: string | null;
  goalId: string;
  trigger: SessionTrigger;
  startTime: string;
  endTime: string;
  durationSeconds: number;
  pomodoroCycles: number;
  growthStage: number;
  ambientSound: AmbientSoundKey | null;
  startLatitude: number | null;
  startLongitude: number | null;
  /** A rating given before the session reached the server travels with it. */
  rating: number | null;
  notes: string | null;
  queuedAt: string;
}

const LOCAL_ID_PREFIX = "local-";

/** An id for a session that was started without a connection. */
export function localSessionId(): string {
  return `${LOCAL_ID_PREFIX}${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

/** Whether this session only exists on the phone so far. */
export function isLocalSessionId(id: string | null | undefined): boolean {
  return typeof id === "string" && id.startsWith(LOCAL_ID_PREFIX);
}

function toQueuedSession(value: unknown): QueuedSession | null {
  if (!value || typeof value !== "object") return null;
  const entry = value as Record<string, unknown>;
  if (
    typeof entry.id !== "string" ||
    typeof entry.goalId !== "string" ||
    typeof entry.startTime !== "string" ||
    typeof entry.endTime !== "string" ||
    typeof entry.durationSeconds !== "number" ||
    !Number.isFinite(entry.durationSeconds)
  ) {
    return null;
  }
  const number = (value: unknown, fallback: number): number =>
    typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return {
    id: entry.id,
    serverId: typeof entry.serverId === "string" ? entry.serverId : null,
    goalId: entry.goalId,
    trigger: (entry.trigger === "geofence" ||
    entry.trigger === "manual_checkin" ||
    entry.trigger === "manual_pomodoro"
      ? entry.trigger
      : "manual_pomodoro") as SessionTrigger,
    startTime: entry.startTime,
    endTime: entry.endTime,
    durationSeconds: number(entry.durationSeconds, 0),
    pomodoroCycles: number(entry.pomodoroCycles, 0),
    growthStage: number(entry.growthStage, 0),
    ambientSound: (typeof entry.ambientSound === "string"
      ? entry.ambientSound
      : null) as AmbientSoundKey | null,
    startLatitude: typeof entry.startLatitude === "number" ? entry.startLatitude : null,
    startLongitude: typeof entry.startLongitude === "number" ? entry.startLongitude : null,
    rating: typeof entry.rating === "number" ? entry.rating : null,
    notes: typeof entry.notes === "string" ? entry.notes : null,
    queuedAt: typeof entry.queuedAt === "string" ? entry.queuedAt : new Date().toISOString(),
  };
}

/** Oldest first. */
export async function readSessionOutbox(): Promise<QueuedSession[]> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_OUTBOX_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(toQueuedSession)
      .filter((entry): entry is QueuedSession => entry !== null);
  } catch {
    return [];
  }
}

async function writeSessionOutbox(entries: QueuedSession[]): Promise<void> {
  const kept = entries.slice(-MAX_QUEUED_SESSIONS);
  if (kept.length < entries.length) {
    console.warn(
      `Session outbox is full: ${entries.length - kept.length} of the oldest entries were dropped.`,
    );
  }
  await AsyncStorage.setItem(SESSION_OUTBOX_KEY, JSON.stringify(kept));
}

/**
 * Reading, changing and writing is three awaits, and the geofence background
 * task writes here while the app is running. One queue, same as pendingGrows.
 */
let queue: Promise<unknown> = Promise.resolve();

function change(
  edit: (entries: QueuedSession[]) => QueuedSession[] | null,
): Promise<void> {
  const next = queue.then(async () => {
    const current = await readSessionOutbox();
    const updated = edit(current);
    if (updated) await writeSessionOutbox(updated);
  });
  queue = next.catch(() => undefined);
  return next;
}

/** Keeps a finished session until it can be sent. Replaces an earlier entry. */
export async function queueSession(session: QueuedSession): Promise<void> {
  await change((current) => [
    ...current.filter((entry) => entry.id !== session.id),
    session,
  ]);
}

/** Attaches a rating to a session that is still waiting to be sent. */
export async function rateQueuedSession(
  sessionId: string,
  rating: number,
  notes: string | null,
): Promise<boolean> {
  let found = false;
  await change((current) => {
    const next = current.map((entry) => {
      if (entry.id !== sessionId && entry.serverId !== sessionId) return entry;
      found = true;
      return { ...entry, rating, notes };
    });
    return found ? next : null;
  });
  return found;
}

/** Drops a queued session, e.g. when the player deletes it. */
export async function removeQueuedSession(sessionId: string): Promise<void> {
  await change((current) =>
    current.some((entry) => entry.id === sessionId || entry.serverId === sessionId)
      ? current.filter((entry) => entry.id !== sessionId && entry.serverId !== sessionId)
      : null,
  );
}

export async function countQueuedSessions(): Promise<number> {
  return (await readSessionOutbox()).length;
}

/** Queued sessions belong to the signed-in account and never survive a sign-out. */
export async function clearSessionOutbox(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_OUTBOX_KEY);
}

/**
 * Sends one queued session. Returns true when it is safely on the server (or
 * was already there), false when it should stay queued for the next attempt.
 */
async function sendQueuedSession(
  entry: QueuedSession,
  userId: string,
): Promise<boolean> {
  if (entry.serverId) {
    const { data, error } = await supabase
      .from("sessions")
      .update({
        end_time: entry.endTime,
        duration_seconds: entry.durationSeconds,
        pomodoro_cycles: entry.pomodoroCycles,
        growth_stage: entry.growthStage,
        ambient_sound: entry.ambientSound,
        ...(entry.rating !== null ? { rating: entry.rating, notes: entry.notes } : {}),
      })
      .eq("id", entry.serverId)
      .select("id");
    if (error) return false;
    // No row came back: the session was deleted, or somebody else closed it.
    // Either way there is nothing left to send.
    if (!data || data.length === 0) {
      console.warn("A queued session no longer exists on the server; dropping it.");
    }
    return true;
  }

  // The row was never created. Guard against a duplicate from an attempt that
  // reached the server but whose confirmation never came back.
  const { data: existing, error: existingError } = await supabase
    .from("sessions")
    .select("id")
    .eq("user_id", userId)
    .eq("goal_id", entry.goalId)
    .eq("start_time", entry.startTime)
    .limit(1)
    .maybeSingle();
  if (existingError) return false;
  if (existing) return true;

  const { error } = await supabase.from("sessions").insert({
    user_id: userId,
    goal_id: entry.goalId,
    trigger: entry.trigger,
    start_time: entry.startTime,
    end_time: entry.endTime,
    duration_seconds: entry.durationSeconds,
    pomodoro_cycles: entry.pomodoroCycles,
    growth_stage: entry.growthStage,
    ambient_sound: entry.ambientSound,
    start_latitude: entry.startLatitude,
    start_longitude: entry.startLongitude,
    rating: entry.rating,
    notes: entry.notes,
  });
  if (error) {
    // A goal that no longer exists can never be sent. Keeping it would block
    // the queue forever, so it is dropped with a reason in the log.
    if (error.code === "23503") {
      console.warn("A queued session points at a deleted goal; dropping it.");
      return true;
    }
    return false;
  }
  return true;
}

let flushInFlight: Promise<number> | null = null;

/**
 * Tries to send everything that is waiting. Returns how many sessions arrived.
 * Safe to call often: it does nothing when the queue is empty, and only one
 * flush runs at a time.
 */
export function flushSessionOutbox(): Promise<number> {
  if (flushInFlight) return flushInFlight;

  const run = (async () => {
    const entries = await readSessionOutbox();
    if (entries.length === 0) return 0;

    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return 0; // no connection or no session: try later

    const userId = data.user.id;
    const sent: string[] = [];
    for (const entry of entries) {
      let ok = false;
      try {
        ok = await sendQueuedSession(entry, userId);
      } catch {
        ok = false;
      }
      if (!ok) break; // the connection is gone again; keep the rest in order
      sent.push(entry.id);
    }

    if (sent.length > 0) {
      await change((current) => current.filter((entry) => !sent.includes(entry.id)));
    }
    return sent.length;
  })();

  flushInFlight = run.finally(() => {
    flushInFlight = null;
  });
  return flushInFlight;
}
