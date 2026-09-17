import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { APP_STORE_STORAGE_KEY } from "../lib/storageKeys";
import { supabase } from "../lib/supabase";
import { sendStudySpotNudge } from "../lib/notifications";
import { MIN_GROW_SESSION_SECONDS } from "../lib/growRewards";
import { addPendingGrow } from "../lib/pendingGrows";
import { queueSession } from "../lib/sessionOutbox";
import { emitSessionsChanged } from "../lib/sessionEvents";
import { useAppStore } from "../store";
import {
  STUDY_SPOT_RADIUS_METERS,
  clearStudySpotState,
  getPersistedStudySpot,
  markNudged,
  shouldNudgeNow,
} from "../lib/studySpots";
import {
  MAX_GEOFENCE_SESSION_MS,
  classifyGeofenceSession,
} from "../lib/geofenceSessions";
import {
  DEFAULT_MIN_VISIT_MINUTES,
  normalizeMinVisitMinutes,
} from "../types";
import type { Goal } from "../types";

const GEOFENCE_TASK_NAME = "goals-geofence-task";
const ACTIVE_SESSIONS_KEY = "goals-active-geofence-sessions";
const STUDY_SPOT_IDENTIFIER = "goals-study-spot-region";
const STORE_KEY = APP_STORE_STORAGE_KEY;
let geofenceTaskQueue: Promise<void> = Promise.resolve();
let accountCleanupInProgress = false;

// Minimum gap between processing duplicate enter/exit events (ms)
const DEBOUNCE_MS = 30_000;

interface GeofenceEvent {
  eventType: Location.GeofencingEventType;
  region: Location.LocationRegion;
}

export interface PermissionResult {
  ok: boolean;
  warningMessage: string | null;
}

interface PersistedSession {
  /**
   * The row on the server, or null when the visit could only be recorded on the
   * phone — no connection at the moment of arrival. The visit is still real; it
   * is written in full when it ends, through the session outbox.
   */
  sessionId: string | null;
  goalId: string;
  enteredAt: number;
  lastEventAt: number;
  /**
   * Minimum stay of the goal, captured when the visit started. Storing it
   * keeps the exit decision working without network access, and a setting
   * changed mid-visit cannot retroactively discard a visit already underway.
   * Absent on visits persisted before this setting existed.
   */
  minVisitMinutes?: number;
}

/**
 * What the background task needs to know about a geofenced goal, stored next to
 * the regions themselves.
 *
 * The persisted Zustand store does not keep goals, so without this the task can
 * only learn a goal's name and minimum stay from the server — and a visit that
 * starts while the phone is offline would have neither. It is refreshed every
 * time the regions are registered, which is exactly when the goals are known.
 */
const GEOFENCE_GOAL_CACHE_KEY = "goals-geofence-goal-cache";

interface CachedGeofenceGoal {
  name: string;
  minVisitMinutes: number;
  targetSessionsPerWeek: number;
}

async function cacheGeofenceGoals(goals: Goal[]): Promise<void> {
  const cache: Record<string, CachedGeofenceGoal> = {};
  for (const goal of goals) {
    cache[goal.id] = {
      name: goal.name,
      minVisitMinutes: normalizeMinVisitMinutes(goal.min_visit_minutes ?? null),
      targetSessionsPerWeek: goal.target_sessions_per_week ?? 0,
    };
  }
  await AsyncStorage.setItem(GEOFENCE_GOAL_CACHE_KEY, JSON.stringify(cache)).catch(
    () => undefined,
  );
}

async function cachedGeofenceGoal(goalId: string): Promise<CachedGeofenceGoal | null> {
  try {
    const raw = await AsyncStorage.getItem(GEOFENCE_GOAL_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, CachedGeofenceGoal>;
    const entry = parsed[goalId];
    if (!entry || typeof entry.name !== "string") return null;
    return {
      name: entry.name,
      minVisitMinutes: normalizeMinVisitMinutes(entry.minVisitMinutes ?? null),
      targetSessionsPerWeek:
        typeof entry.targetSessionsPerWeek === "number" ? entry.targetSessionsPerWeek : 0,
    };
  } catch {
    return null;
  }
}

/** Reads the goal's minimum stay, falling back to the cache and the default. */
async function fetchMinVisitMinutes(goalId: string): Promise<number> {
  try {
    const { data, error } = await supabase
      .from("goals")
      .select("min_visit_minutes")
      .eq("id", goalId)
      .maybeSingle();
    if (error || !data) {
      return (await cachedGeofenceGoal(goalId))?.minVisitMinutes ?? DEFAULT_MIN_VISIT_MINUTES;
    }
    return normalizeMinVisitMinutes(
      (data as { min_visit_minutes: number | null }).min_visit_minutes,
    );
  } catch {
    return (await cachedGeofenceGoal(goalId))?.minVisitMinutes ?? DEFAULT_MIN_VISIT_MINUTES;
  }
}

// ---------- Persisted session state ----------

async function getPersistedSessions(): Promise<Record<string, PersistedSession>> {
  try {
    const raw = await AsyncStorage.getItem(ACTIVE_SESSIONS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function setPersistedSession(goalId: string, session: PersistedSession): Promise<void> {
  const sessions = await getPersistedSessions();
  sessions[goalId] = session;
  await AsyncStorage.setItem(ACTIVE_SESSIONS_KEY, JSON.stringify(sessions));
}

async function removePersistedSession(goalId: string): Promise<void> {
  const sessions = await getPersistedSessions();
  delete sessions[goalId];
  await AsyncStorage.setItem(ACTIVE_SESSIONS_KEY, JSON.stringify(sessions));
}

// ---------- Background task ----------

TaskManager.defineTask(GEOFENCE_TASK_NAME, async ({ data, error }) => {
  const operation = geofenceTaskQueue
    .catch(() => undefined)
    .then(async () => {
      if (error) {
        console.error("Geofence task error:", error);
        return;
      }
      if (accountCleanupInProgress) return;

      const event = data as GeofenceEvent;
      const { eventType, region } = event;
      const goalId = region.identifier ?? "";
      if (!goalId) return;

      if (goalId === STUDY_SPOT_IDENTIFIER) {
        if (eventType === Location.GeofencingEventType.Enter) {
          await handleStudySpotEnter();
        }
        return;
      }

      if (eventType === Location.GeofencingEventType.Enter) {
        await handleGeofenceEnter(goalId);
      } else if (eventType === Location.GeofencingEventType.Exit) {
        await handleGeofenceExit(goalId);
      }
    });

  geofenceTaskQueue = operation.catch((taskError) => {
    console.error("Geofence task processing error:", taskError);
  });

  try {
    await operation;
  } catch {
    // The queued catch above records the error and keeps later events alive.
  }
});

// ---------- Study-spot handler ----------

async function notificationPrefEnabled(
  key: "aiNudges" | "checkinAlerts",
): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(STORE_KEY);
    if (!raw) return true;
    const parsed = JSON.parse(raw) as {
      state?: { notificationPrefs?: { aiNudges?: boolean; checkinAlerts?: boolean } };
    };
    return parsed.state?.notificationPrefs?.[key] !== false;
  } catch {
    return true;
  }
}

/** Arriving at a recognized focus location → gentle "want to start a session?" nudge. */
async function handleStudySpotEnter(): Promise<void> {
  try {
    if (!(await notificationPrefEnabled("aiNudges"))) return;
    if (!(await shouldNudgeNow())) return;

    const spot = await getPersistedStudySpot();
    if (!spot) return;

    const sent = await sendStudySpotNudge(spot.goalName, spot.goalId);
    if (sent) await markNudged();
  } catch (err) {
    console.error("Study spot enter handler error:", err);
  }
}

// ---------- Enter handler ----------

async function handleGeofenceEnter(goalId: string): Promise<void> {
  try {
    // Debounce: ignore if we already have an active session for this goal
    const sessions = await getPersistedSessions();
    const existing = sessions[goalId];
    if (existing) {
      if (Date.now() - existing.enteredAt >= MAX_GEOFENCE_SESSION_MS) {
        // A second Enter after an implausibly long open visit means iOS most
        // likely missed the previous Exit. Discard the orphan before starting
        // a truthful new visit instead of logging multiple days as one session.
        if (existing.sessionId) {
          const { error } = await supabase
            .from("sessions")
            .delete()
            .eq("id", existing.sessionId)
            // Never delete a visit that was already finished properly.
            .is("end_time", null);
          if (error) {
            console.error("Failed to discard stale geofence session:", error);
            return;
          }
        }
        await removePersistedSession(goalId);
      } else {
        const elapsed = Date.now() - existing.lastEventAt;
        if (elapsed < DEBOUNCE_MS) return; // duplicate event, ignore
        // If we have an old session but got another enter, update the timestamp
        existing.lastEventAt = Date.now();
        await setPersistedSession(goalId, existing);
        return;
      }
    }

    // Arriving somewhere is a fact about the world, not about the network. If
    // anything below cannot reach the server, the visit is still recorded — on
    // the phone only — and written in full when it ends.
    const startVisitLocally = async (reason: string): Promise<void> => {
      const cached = await cachedGeofenceGoal(goalId);
      if (!cached) {
        // Nothing is known about this goal, so there is no way to tell a real
        // visit from a region that belongs to a goal that no longer exists.
        console.warn(`Ignoring an arrival for an unknown goal (${reason}).`);
        return;
      }
      const now = Date.now();
      await setPersistedSession(goalId, {
        sessionId: null,
        goalId,
        enteredAt: now,
        lastEventAt: now,
        minVisitMinutes: cached.minVisitMinutes,
      });
      console.warn(`Recording this visit on the phone only (${reason}).`);

      if (await notificationPrefEnabled("checkinAlerts")) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `Arrived at ${cached.name}`,
            body: "Logging your session automatically. Focus up!",
            data: { goalId },
          },
          trigger: null,
        });
      }
    };

    const { data: userData, error: userError } = await supabase.auth.getUser();
    const user = userData?.user ?? null;
    if (userError || !user) {
      // No connection, or the session could not be refreshed. Either way the
      // account is known from the last sign-in; only the write has to wait.
      await startVisitLocally("not signed in or offline");
      return;
    }

    // Foreground manual fallback and background geofencing share the same
    // physical goal. Never create a second open visit when either path already
    // owns one. Reconstruct local state only for a geofence-owned row.
    const { data: openSession, error: openSessionError } = await supabase
      .from("sessions")
      .select("id, start_time, trigger")
      .eq("user_id", user.id)
      .eq("goal_id", goalId)
      .is("end_time", null)
      .order("start_time", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (openSessionError) {
      console.error("Failed to check for an open check-in:", openSessionError);
      await startVisitLocally("could not check for an open visit");
      return;
    }
    if (openSession) {
      if ((openSession as { trigger: string }).trigger === "geofence") {
        const enteredAt = Date.parse(
          (openSession as { start_time: string }).start_time,
        );
        const now = Date.now();
        await setPersistedSession(goalId, {
          sessionId: (openSession as { id: string }).id,
          goalId,
          enteredAt: Number.isFinite(enteredAt) ? enteredAt : now,
          lastEventAt: now,
          minVisitMinutes: await fetchMinVisitMinutes(goalId),
        });
      }
      return;
    }

    const { data: goal, error: goalError } = await supabase
      .from("goals")
      .select("name, min_visit_minutes")
      .eq("id", goalId)
      .eq("type", "physical")
      .eq("is_active", true)
      .maybeSingle();
    if (goalError) {
      console.error("Failed to validate geofence goal:", goalError);
      await startVisitLocally("could not read the goal");
      return;
    }
    // An empty answer is a real one: this goal is gone or no longer active, so
    // there is nothing to log. Only an *error* means "ask again later".
    if (!goal) return;

    const goalName = (goal as { name: string }).name || "your goal";
    const minVisitMinutes = normalizeMinVisitMinutes(
      (goal as { min_visit_minutes: number | null }).min_visit_minutes,
    );

    const { data: session, error } = await supabase
      .from("sessions")
      .insert({
        user_id: user.id,
        goal_id: goalId,
        trigger: "geofence",
        start_time: new Date().toISOString(),
        duration_seconds: 0,
        pomodoro_cycles: 0,
        growth_stage: 0,
      })
      .select("id")
      .single();

    if (error || !session) {
      console.error("Failed to create geofence session:", error);
      await startVisitLocally("could not create the visit");
      return;
    }

    const sessionId = (session as { id: string }).id;
    const now = Date.now();

    await setPersistedSession(goalId, {
      sessionId,
      goalId,
      enteredAt: now,
      lastEventAt: now,
      minVisitMinutes,
    });
    emitSessionsChanged();

    if (await notificationPrefEnabled("checkinAlerts")) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `Arrived at ${goalName}`,
          body: "Logging your session automatically. Focus up!",
          data: { goalId, sessionId },
        },
        trigger: null,
      });
    }
  } catch (err) {
    console.error("Geofence enter handler error:", err);
  }
}

// ---------- Exit handler ----------

async function handleGeofenceExit(goalId: string): Promise<void> {
  try {
    const sessions = await getPersistedSessions();
    const activeSession = sessions[goalId];
    if (!activeSession) return;

    const durationMs = Date.now() - activeSession.enteredAt;
    const durationSeconds = Math.floor(durationMs / 1000);
    const minVisitMinutes =
      activeSession.minVisitMinutes ?? (await fetchMinVisitMinutes(goalId));
    const disposition = classifyGeofenceSession(durationMs, minVisitMinutes);

    // A visit that never reached the server has no row to remove.
    const discard = async (label: string): Promise<void> => {
      if (activeSession.sessionId) {
        const { error } = await supabase
          .from("sessions")
          .delete()
          .eq("id", activeSession.sessionId);
        if (error) {
          console.error(`Failed to discard ${label} geofence session:`, error);
          return;
        }
      }
      await removePersistedSession(goalId);
      emitSessionsChanged();
    };

    if (disposition === "discard_stale") {
      await discard("stale");
      return;
    }

    // Too short — delete immediately. Waiting for another Exit event leaves an
    // orphaned session because iOS is not required to deliver a duplicate event.
    if (disposition === "discard_short") {
      await discard("short");
      return;
    }

    const endedAt = new Date().toISOString();
    const growthStage = Math.min(4, Math.floor(durationSeconds / 1800));
    // A visit recorded on the phone alone still needs one stable id, so the
    // outbox entry, the kept reward and the notification all mean the same visit.
    const visitId =
      activeSession.sessionId ?? `visit-${activeSession.enteredAt}-${goalId}`;

    // Leaving is also a fact about the world. Whatever happens to the write, the
    // local record of this visit is cleared exactly once, and the visit itself
    // is kept in the outbox until it arrives.
    /** True once this visit is only on the phone, not yet on the server. */
    let visitOnlyOnPhone = false;
    const keepVisitForLater = async (): Promise<void> => {
      visitOnlyOnPhone = true;
      await queueSession({
        id: visitId,
        serverId: activeSession.sessionId,
        goalId,
        trigger: "geofence",
        startTime: new Date(activeSession.enteredAt).toISOString(),
        endTime: endedAt,
        durationSeconds,
        pomodoroCycles: 0,
        growthStage,
        ambientSound: null,
        startLatitude: null,
        startLongitude: null,
        rating: null,
        notes: null,
        queuedAt: new Date().toISOString(),
      });
    };

    if (activeSession.sessionId) {
      const { error } = await supabase
        .from("sessions")
        .update({
          end_time: endedAt,
          duration_seconds: durationSeconds,
          growth_stage: growthStage,
        })
        .eq("id", activeSession.sessionId)
        // Only ever close a visit that is still open: a leftover local entry
        // pointing at an already finished visit must not rewrite its duration.
        .is("end_time", null);

      if (error) {
        console.error("Failed to close geofence session:", error);
        await keepVisitForLater();
      }
    } else {
      await keepVisitForLater();
    }

    await removePersistedSession(goalId);
    // Home may be open right now: let it re-read the week and the waiting rewards.
    emitSessionsChanged();

    // Build exit notification with weekly progress
    const minutes = Math.floor(durationSeconds / 60);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const durationStr = hours > 0 ? `${hours}h ${mins}m` : `${mins} min`;

    const { data: goal } = await supabase
      .from("goals")
      .select("name, target_sessions_per_week")
      .eq("id", goalId)
      .single();

    const cached = goal ? null : await cachedGeofenceGoal(goalId);
    const goalName =
      (goal as { name: string } | null)?.name ?? cached?.name ?? "Goal";
    const weeklyTarget =
      (goal as { target_sessions_per_week: number } | null)?.target_sessions_per_week ??
      cached?.targetSessionsPerWeek ??
      0;

    // Count sessions this week for this goal
    const weekStart = getWeekStart();
    const { count, error: countError } = await supabase
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("goal_id", goalId)
      .not("end_time", "is", null)
      .gte("start_time", weekStart.toISOString());

    /**
     * How many visits this week — or nothing at all.
     *
     * The notification said "0/4" in the moment somebody had just finished a
     * visit, which is the worst possible lie: it reads as "that did not count".
     * Two ways it got there, and both are fixed here.
     *
     * `count ?? 0` turned *unknown* into *zero*. An error was already handled,
     * but a missing count without an error — no session in the background task,
     * an unexpected response — fell straight through to zero. Unknown now means
     * the sentence is left out; a visit with no number beside it is honest,
     * "0/4" is not.
     *
     * And a visit that only made it into the outbox is not on the server yet,
     * so the server cannot count it. It happened all the same.
     */
    const counted = countError ? null : (count ?? null);
    const sessionsThisWeek =
      counted === null ? null : counted + (visitOnlyOnPhone ? 1 : 0);
    const progressStr =
      sessionsThisWeek === null
        ? ""
        : weeklyTarget > 0
          ? ` ${sessionsThisWeek}/${weeklyTarget} this week.`
          : ` ${sessionsThisWeek} sessions this week.`;

    // Keep the grown object until it is added; the notification opens the reveal.
    const grew = durationSeconds >= MIN_GROW_SESSION_SECONDS;
    if (grew) {
      await addPendingGrow({
        sessionId: visitId,
        goalId,
        goalName,
        durationSeconds,
        endedAt: new Date().toISOString(),
        category: null,
        // Picked on the reveal screen after an Auto Check-In.
        objectKey: null,
      }).catch((growError) => {
        console.warn("Could not keep the grown object for later:", growError);
      });
      // The reward exists now; Home in the foreground should offer it.
      emitSessionsChanged();
    }

    if (await notificationPrefEnabled("checkinAlerts")) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `${goalName} — ${durationStr}`,
          body: grew
            ? `Session logged.${progressStr} Something grew. Tap to add it to your island.`
            : `Session logged.${progressStr} How was it?`,
          data: grew
            ? {
                goalId,
                goalName,
                durationSeconds,
                sessionId: visitId,
                type: "grow_reveal",
              }
            : { goalId, sessionId: visitId, type: "rate_session" },
        },
        trigger: null,
      });
    }
  } catch (err) {
    console.error("Geofence exit handler error:", err);
  }
}

function getWeekStart(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1; // Monday = start of week
  const start = new Date(now);
  start.setDate(now.getDate() - diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

// ---------- Permission helpers ----------

function geofencePermissionWarning(): string {
  return "Enable Location Always for Auto Check-In to work.";
}

function notificationPermissionWarning(): string {
  return "Enable notifications so session start and rating reminders can be delivered.";
}

export async function getGeofencePermissionWarning(goals: Goal[]): Promise<string | null> {
  const physicalGoals = goals.filter((g) => g.type === "physical" && g.location);
  if (physicalGoals.length === 0) return null;

  const { status: fgStatus } = await Location.getForegroundPermissionsAsync();
  if (fgStatus !== "granted") {
    return geofencePermissionWarning();
  }

  const { status: bgStatus } = await Location.getBackgroundPermissionsAsync();
  if (bgStatus !== "granted") {
    return geofencePermissionWarning();
  }

  return null;
}

export async function getNotificationPermissionWarning(): Promise<string | null> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") {
    return notificationPermissionWarning();
  }
  return null;
}

/** The regions handed to iOS last time, so an unchanged list is not re-sent. */
let lastRegisteredRegions: string | null = null;

function regionFingerprint(regions: Location.LocationRegion[]): string {
  return regions
    .map((r) => `${r.identifier}:${r.latitude}:${r.longitude}:${r.radius}`)
    .sort()
    .join("|");
}

export async function registerGeofences(goals: Goal[]): Promise<PermissionResult> {
  const physicalGoals = goals.filter((g) => g.type === "physical" && g.location);
  const studySpot = await getPersistedStudySpot();

  // Registering the regions is the one moment the background task's world can
  // be refreshed: from here on it may have to work without a connection.
  await cacheGeofenceGoals(physicalGoals);

  if (physicalGoals.length === 0 && !studySpot) {
    // An empty list is only a reason to switch off once the goals have actually
    // been loaded. On a cold start they are empty for a moment, and stopping
    // here used to unregister the task — on a launch without a connection it
    // stayed off, and iOS no longer woke the app for any region at all.
    if (!useAppStore.getState().goalsLoaded) {
      return { ok: true, warningMessage: null };
    }
    const isRegistered = await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK_NAME);
    if (isRegistered) {
      await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);
    }
    lastRegisteredRegions = null;
    return { ok: true, warningMessage: null };
  }

  // Permission prompts belong to onboarding/PermissionGate user actions.
  // Background registration must never show an OS prompt on app launch.
  const { status: fgStatus } = await Location.getForegroundPermissionsAsync();
  if (fgStatus !== "granted") {
    const warningMessage = geofencePermissionWarning();
    console.warn("Foreground location permission not granted");
    return { ok: false, warningMessage };
  }

  const { status: bgStatus } = await Location.getBackgroundPermissionsAsync();
  if (bgStatus !== "granted") {
    const warningMessage = geofencePermissionWarning();
    console.warn("Background location permission not granted");
    return { ok: false, warningMessage };
  }

  const regions: Location.LocationRegion[] = physicalGoals.map((goal) => ({
    identifier: goal.id,
    latitude: goal.location!.latitude,
    longitude: goal.location!.longitude,
    radius: goal.location!.radius_meters,
    notifyOnEnter: true,
    notifyOnExit: true,
  }));

  if (studySpot) {
    regions.push({
      identifier: STUDY_SPOT_IDENTIFIER,
      latitude: studySpot.latitude,
      longitude: studySpot.longitude,
      radius: STUDY_SPOT_RADIUS_METERS,
      notifyOnEnter: true,
      notifyOnExit: false,
    });
  }

  // Registering again is not free: it makes iOS re-evaluate every region from
  // scratch, which arrives as a fresh Enter for wherever the phone happens to
  // be. That looked like a second visit and logged it twice. Re-register only
  // when the regions really changed.
  const fingerprint = regionFingerprint(regions);
  if (
    fingerprint === lastRegisteredRegions &&
    (await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK_NAME))
  ) {
    return { ok: true, warningMessage: null };
  }

  try {
    await Location.startGeofencingAsync(GEOFENCE_TASK_NAME, regions);
    lastRegisteredRegions = fingerprint;
    return { ok: true, warningMessage: null };
  } catch (error) {
    lastRegisteredRegions = null;
    console.error("Failed to start geofencing:", error);
    return {
      ok: false,
      warningMessage: "Auto Check-In could not start. Please verify Location Always permission.",
    };
  }
}

export async function unregisterGeofences(): Promise<void> {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK_NAME);
  if (isRegistered) {
    await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);
  }
}

/** Clear foreground-ended visit state so a later OS exit cannot close it twice. */
export async function clearPersistedGeofenceVisit(goalId: string): Promise<void> {
  await removePersistedSession(goalId);
}

/**
 * Stops account-owned background work before sign-out. Any visit already long
 * enough is closed normally; a shorter visit is discarded. Local identifiers
 * are always cleared so they can never leak into the next account.
 */
export async function resetGeofencingForAccount(): Promise<void> {
  accountCleanupInProgress = true;
  try {
    await unregisterGeofences().catch((error) => {
      console.warn("Could not stop geofencing during account cleanup:", error);
    });

    // An OS event can already be queued when sign-out begins. Drain every
    // operation that was enqueued before or during unregistering before
    // reading the persisted visits, otherwise that event could recreate local
    // state after cleanup and leak it into the next account.
    let observedQueue: Promise<void>;
    do {
      observedQueue = geofenceTaskQueue;
      await observedQueue.catch((error) => {
        console.warn("Could not drain geofence events during account cleanup:", error);
      });
    } while (observedQueue !== geofenceTaskQueue);

    const sessions = await getPersistedSessions();
    await Promise.all(
      Object.values(sessions).map(async (session) => {
        const durationMs = Date.now() - session.enteredAt;
        const durationSeconds = Math.max(0, Math.floor(durationMs / 1000));
        const disposition = classifyGeofenceSession(
          durationMs,
          session.minVisitMinutes ?? DEFAULT_MIN_VISIT_MINUTES,
        );
        const operation =
          disposition === "complete"
            ? supabase
                .from("sessions")
                .update({
                  end_time: new Date().toISOString(),
                  duration_seconds: durationSeconds,
                  growth_stage: Math.min(4, Math.floor(durationSeconds / 1800)),
                })
                .eq("id", session.sessionId)
            : supabase.from("sessions").delete().eq("id", session.sessionId);

        const { error } = await operation;
        if (error) {
          console.warn("Could not close geofence session during account cleanup:", error);
        }
      }),
    );

    await Promise.all([
      AsyncStorage.removeItem(ACTIVE_SESSIONS_KEY),
      clearStudySpotState(),
    ]);
  } finally {
    accountCleanupInProgress = false;
  }
}

export async function setupNotifications(): Promise<PermissionResult> {
  // The foreground handler is safe before permission is granted and must be
  // available immediately if permission changes while the app stays open.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  // Prompting is handled only by explicit onboarding/Settings actions.
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") {
    const warningMessage = notificationPermissionWarning();
    console.warn("Notification permission not granted");
    return { ok: false, warningMessage };
  }

  return { ok: true, warningMessage: null };
}
