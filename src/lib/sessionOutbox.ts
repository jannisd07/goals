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
 * the queue is emptied whenever the app has a connection again. Three rules keep
 * it honest:
 *
 *   1. **Nothing is queued twice.** Entries are keyed by the session id the app
 *      already uses, and a queued session that is sent while a duplicate is
 *      still on the server is matched by goal and start time before inserting.
 *   2. **Nothing is dropped silently.** The cap is high enough that it cannot be
 *      reached by normal use, and hitting it is logged rather than swallowed.
 *   3. **One bad entry never blocks the rest.** An entry the server rejects for
 *      good (a constraint, a deleted goal) is skipped, retried a few times on
 *      later flushes, and finally dropped with a note — found on 2026-09-17,
 *      when a single rejected row kept every later session on the phone.
 *
 * Kept under its own AsyncStorage key rather than in the Zustand store, for the
 * same reason as `pendingGrows.ts`: the Auto Check-In background task writes
 * here while the app may not be running.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { currentUser, supabase } from "./supabase";
import { consistentEndTime } from "./sessionTimes";
import type { AmbientSoundKey, SessionTrigger } from "../types";

export const SESSION_OUTBOX_KEY = "goals-session-outbox";

/**
 * Far above anything real use produces — a player would have to finish 200
 * sessions without the phone ever reaching the server once. It exists so a
 * broken write loop cannot fill the device, not as a product limit.
 */
const MAX_QUEUED_SESSIONS = 200;

/**
 * How often the server may reject an entry outright before it is given up.
 * Rejections are counted per flush, so this is many app starts, not seconds.
 */
const MAX_REJECTIONS = 8;

/** Open focus rows older than this can never be finished by anybody. */
const ORPHAN_AGE_MS = 24 * 60 * 60 * 1000;

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
  /** How often the server has rejected this entry so far (not: how often it was offline). */
  rejections?: number;
  /**
   * The session is to be removed, not closed: cancelled with no focus, or a
   * visit ended below the minimum stay. Only meaningful with a `serverId`; a
   * local session that never reached the server simply leaves nothing behind.
   */
  discard?: boolean;
}

const LOCAL_ID_PREFIX = "local-";

/**
 * Which server row a session that was started offline became.
 *
 * The app keeps using the local id — the reveal, the applied-rewards list and
 * the rating sheet all hold it — while the server knows the row by its own id.
 * Once the row is inserted the two are remembered together, so a rating given
 * after the flush still reaches the right row. Bounded and oldest-first.
 */
const SESSION_ID_MAP_KEY = "goals-session-id-map";
const MAX_MAPPED_IDS = 100;
let idMapCache: Record<string, string> | null = null;

async function readIdMap(): Promise<Record<string, string>> {
  if (idMapCache) return idMapCache;
  try {
    const raw = await AsyncStorage.getItem(SESSION_ID_MAP_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    idMapCache =
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, string>)
        : {};
  } catch {
    idMapCache = {};
  }
  return idMapCache;
}

async function rememberServerId(localId: string, serverId: string): Promise<void> {
  const map = await readIdMap();
  const entries = Object.entries(map).filter(([key]) => key !== localId);
  entries.push([localId, serverId]);
  idMapCache = Object.fromEntries(entries.slice(-MAX_MAPPED_IDS));
  await AsyncStorage.setItem(SESSION_ID_MAP_KEY, JSON.stringify(idMapCache)).catch(() => undefined);
}

/** The id the server knows this session by — the same id when it was never local. */
export async function resolveSessionId(id: string): Promise<string> {
  if (!isLocalSessionId(id)) return id;
  return (await readIdMap())[id] ?? id;
}

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
    rejections: number(entry.rejections, 0),
    discard: entry.discard === true,
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
    {
      ...session,
      endTime: consistentEndTime(session.startTime, session.endTime, session.durationSeconds),
    },
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

/** Queued sessions belong to the signed-in account and never survive a sign-out. */
export async function clearSessionOutbox(): Promise<void> {
  idMapCache = null;
  await Promise.all([
    AsyncStorage.removeItem(SESSION_OUTBOX_KEY),
    AsyncStorage.removeItem(SESSION_ID_MAP_KEY),
  ]);
}

type SendOutcome = "sent" | "offline" | "rejected";

function isConnectionProblem(error: unknown): boolean {
  // PostgREST answers carry a code; a request that never got an answer does not.
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code !== "string" || code.length === 0;
}

/**
 * Sends one queued session.
 *
 * "sent" also covers a row that turned out to be finished or gone already —
 * there is nothing left to do for it either way. "offline" means the request
 * did not get through and the whole flush should stop; "rejected" means the
 * server answered no, and the next entry may still get through.
 */
async function sendQueuedSession(
  entry: QueuedSession,
  userId: string,
): Promise<SendOutcome> {
  const endTime = consistentEndTime(entry.startTime, entry.endTime, entry.durationSeconds);
  const closing = {
    end_time: endTime,
    duration_seconds: entry.durationSeconds,
    pomodoro_cycles: entry.pomodoroCycles,
    growth_stage: entry.growthStage,
    ambient_sound: entry.ambientSound,
    ...(entry.rating !== null ? { rating: entry.rating, notes: entry.notes } : {}),
  };

  if (entry.discard) {
    if (!entry.serverId) return "sent";
    const { error } = await supabase
      .from("sessions")
      .delete()
      .eq("id", entry.serverId)
      // A row somebody else finished in the meantime is theirs to keep.
      .is("end_time", null);
    if (error) return isConnectionProblem(error) ? "offline" : "rejected";
    return "sent";
  }

  if (entry.serverId) {
    const close = (end: string) =>
      supabase
        .from("sessions")
        .update({ ...closing, end_time: end })
        .eq("id", entry.serverId as string)
        // Only ever close a session that is still open. A row that was finished
        // by another path in the meantime keeps its own duration.
        .is("end_time", null)
        .select("id");

    let { data, error } = await close(endTime);
    if (error && error.code === "23514") {
      // The server's own start for this row may lie after the phone's; move the
      // end behind it so the measured duration can still be written.
      const { data: row } = await supabase
        .from("sessions")
        .select("start_time")
        .eq("id", entry.serverId)
        .maybeSingle();
      const serverStart = (row as { start_time?: string } | null)?.start_time;
      if (serverStart) {
        ({ data, error } = await close(
          consistentEndTime(serverStart, endTime, entry.durationSeconds),
        ));
      }
    }
    if (error) return isConnectionProblem(error) ? "offline" : "rejected";
    if (!data || data.length === 0) {
      console.warn("A queued session was already closed or removed; nothing to send.");
    }
    return "sent";
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
  if (existingError) return isConnectionProblem(existingError) ? "offline" : "rejected";
  if (existing) {
    await rememberServerId(entry.id, (existing as { id: string }).id);
    return "sent";
  }

  const { data: inserted, error } = await supabase
    .from("sessions")
    .insert({
      user_id: userId,
      goal_id: entry.goalId,
      trigger: entry.trigger,
      start_time: entry.startTime,
      start_latitude: entry.startLatitude,
      start_longitude: entry.startLongitude,
      ...closing,
    })
    .select("id")
    .maybeSingle();
  if (!error) {
    const serverId = (inserted as { id?: string } | null)?.id;
    if (serverId) await rememberServerId(entry.id, serverId);
    return "sent";
  }
  if (isConnectionProblem(error)) return "offline";
  // A goal that no longer exists can never be sent; keeping the entry would
  // only make it fail again on every flush.
  if (error.code === "23503") {
    console.warn("A queued session points at a deleted goal; dropping it.");
    return "sent";
  }
  return "rejected";
}

/**
 * Removes open focus rows that nobody can finish any more.
 *
 * Every path that drops a session now closes or removes its row, but rows from
 * before that, and rows left by a crash between "created" and "persisted", stay
 * open for ever with a duration of zero. They hold no information — every
 * reader filters on end_time — and only clutter the account. The active
 * session is never touched, however old it looks.
 */
async function sweepOrphanedFocusRows(userId: string, keepSessionId: string | null): Promise<void> {
  const before = new Date(Date.now() - ORPHAN_AGE_MS).toISOString();
  let query = supabase
    .from("sessions")
    .delete()
    .eq("user_id", userId)
    .eq("trigger", "manual_pomodoro")
    .is("end_time", null)
    .eq("duration_seconds", 0)
    .lt("start_time", before);
  if (keepSessionId && !isLocalSessionId(keepSessionId)) {
    query = query.neq("id", keepSessionId);
  }
  const { error } = await query;
  if (error) console.warn("Could not remove orphaned focus sessions:", error.message);
}

let flushInFlight: Promise<number> | null = null;
/** A flush was asked for while one was running; run once more when it ends. */
let flushRequestedAgain = false;
let sweptForUser: string | null = null;

/**
 * Tries to send everything that is waiting. Returns how many sessions arrived.
 * Safe to call often: it does nothing when the queue is empty, and only one
 * flush runs at a time — a request that arrives mid-flush is not merged into
 * the running one (which may already have read an empty queue) but repeated
 * after it.
 */
export function flushSessionOutbox(activeSessionId: string | null = null): Promise<number> {
  if (flushInFlight) {
    flushRequestedAgain = true;
    return flushInFlight;
  }

  const run = (async () => {
    const entries = await readSessionOutbox();
    const user = await currentUser();
    if (!user) return 0; // nobody signed in: nothing can be sent
    const userId = user.id;

    if (sweptForUser !== userId) {
      sweptForUser = userId;
      await sweepOrphanedFocusRows(userId, activeSessionId).catch(() => undefined);
    }
    if (entries.length === 0) return 0;

    const sent: string[] = [];
    const rejected: string[] = [];
    for (const entry of entries) {
      let outcome: SendOutcome;
      try {
        outcome = await sendQueuedSession(entry, userId);
      } catch {
        outcome = "offline";
      }
      if (outcome === "offline") break; // the connection is gone again; keep the rest in order
      if (outcome === "rejected") {
        rejected.push(entry.id);
        continue;
      }
      sent.push(entry.id);
    }

    if (sent.length > 0 || rejected.length > 0) {
      await change((current) =>
        current
          .filter((entry) => !sent.includes(entry.id))
          .map((entry) =>
            rejected.includes(entry.id)
              ? { ...entry, rejections: (entry.rejections ?? 0) + 1 }
              : entry,
          )
          .filter((entry) => {
            if ((entry.rejections ?? 0) < MAX_REJECTIONS) return true;
            console.warn(
              `Giving up on a queued session the server kept rejecting (${entry.id}).`,
            );
            return false;
          }),
      );
    }
    return sent.length;
  })();

  flushInFlight = run.finally(() => {
    flushInFlight = null;
    if (flushRequestedAgain) {
      flushRequestedAgain = false;
      void flushSessionOutbox(activeSessionId);
    }
  });
  return flushInFlight;
}
