import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import * as Notifications from "expo-notifications";
import { supabase } from "../lib/supabase";
import { MIN_GEOFENCE_DURATION_SECONDS } from "../types";
import type { Goal } from "../types";

const GEOFENCE_TASK_NAME = "vibetime-geofence-task";

interface GeofenceEvent {
  eventType: Location.GeofencingEventType;
  region: Location.LocationRegion;
}

const activeGeofenceSessions: Map<string, { sessionId: string; enteredAt: number }> = new Map();

TaskManager.defineTask(GEOFENCE_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error("Geofence task error:", error);
    return;
  }

  const event = data as GeofenceEvent;
  const { eventType, region } = event;
  const goalId = region.identifier ?? "";
  if (!goalId) return;

  if (eventType === Location.GeofencingEventType.Enter) {
    await handleGeofenceEnter(goalId);
  } else if (eventType === Location.GeofencingEventType.Exit) {
    await handleGeofenceExit(goalId);
  }
});

async function handleGeofenceEnter(goalId: string): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: goal } = await supabase
      .from("goals")
      .select("name")
      .eq("id", goalId)
      .single();

    const goalName = (goal as { name: string } | null)?.name ?? "your goal";

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
      return;
    }

    activeGeofenceSessions.set(goalId, {
      sessionId: (session as { id: string }).id,
      enteredAt: Date.now(),
    });

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Session Started",
        body: `You're at ${goalName}. Logging your session automatically.`,
        data: { goalId, sessionId: (session as { id: string }).id },
      },
      trigger: null,
    });
  } catch (err) {
    console.error("Geofence enter handler error:", err);
  }
}

async function handleGeofenceExit(goalId: string): Promise<void> {
  try {
    const activeSession = activeGeofenceSessions.get(goalId);
    if (!activeSession) return;

    const durationMs = Date.now() - activeSession.enteredAt;
    const durationSeconds = Math.floor(durationMs / 1000);

    if (durationSeconds < MIN_GEOFENCE_DURATION_SECONDS) {
      await supabase.from("sessions").delete().eq("id", activeSession.sessionId);
      activeGeofenceSessions.delete(goalId);
      return;
    }

    const { error } = await supabase
      .from("sessions")
      .update({
        end_time: new Date().toISOString(),
        duration_seconds: durationSeconds,
        growth_stage: Math.min(4, Math.floor(durationSeconds / 1800)),
      })
      .eq("id", activeSession.sessionId);

    if (error) {
      console.error("Failed to close geofence session:", error);
      return;
    }

    const minutes = Math.floor(durationSeconds / 60);

    const { data: goal } = await supabase
      .from("goals")
      .select("name")
      .eq("id", goalId)
      .single();

    const goalName = (goal as { name: string } | null)?.name ?? "Goal";

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Session Logged",
        body: `${goalName} session logged — ${minutes} mins. How was it?`,
        data: { goalId, sessionId: activeSession.sessionId, type: "rate_session" },
      },
      trigger: null,
    });

    activeGeofenceSessions.delete(goalId);
  } catch (err) {
    console.error("Geofence exit handler error:", err);
  }
}

export async function registerGeofences(goals: Goal[]): Promise<void> {
  const physicalGoals = goals.filter((g) => g.type === "physical" && g.location);

  if (physicalGoals.length === 0) {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK_NAME);
    if (isRegistered) {
      await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);
    }
    return;
  }

  const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
  if (fgStatus !== "granted") {
    console.warn("Foreground location permission not granted");
    return;
  }

  const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
  if (bgStatus !== "granted") {
    console.warn("Background location permission not granted");
    return;
  }

  const regions: Location.LocationRegion[] = physicalGoals.map((goal) => ({
    identifier: goal.id,
    latitude: goal.location!.latitude,
    longitude: goal.location!.longitude,
    radius: goal.location!.radius_meters,
    notifyOnEnter: true,
    notifyOnExit: true,
  }));

  await Location.startGeofencingAsync(GEOFENCE_TASK_NAME, regions);
}

export async function unregisterGeofences(): Promise<void> {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK_NAME);
  if (isRegistered) {
    await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);
  }
}

export async function setupNotifications(): Promise<void> {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== "granted") {
    console.warn("Notification permission not granted");
    return;
  }

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}
