import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Goal, Session } from "../types";

const STUDY_SPOT_KEY = "goals-study-spot";
const NUDGE_TS_KEY = "goals-study-spot-last-nudge";

export const STUDY_SPOT_RADIUS_METERS = 150;
const MIN_SESSIONS_FOR_SPOT = 3;
const MIN_NUDGE_GAP_MS = 3 * 60 * 60 * 1000;

export interface StudySpot {
  latitude: number;
  longitude: number;
  goalId: string;
  goalName: string;
  sessionCount: number;
}

function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * Finds the densest cluster of focus-session start locations. If the user keeps
 * focusing at the same place (>= 3 sessions within 150 m), that place becomes a
 * "study spot": arriving there later triggers a gentle session suggestion.
 * Places already covered by an Auto Check-In geofence are excluded.
 */
export function detectStudySpot(
  sessions: Pick<Session, "start_latitude" | "start_longitude">[],
  focusGoal: Pick<Goal, "id" | "name">,
  excludeLocations: Array<{ latitude: number; longitude: number }> = [],
): StudySpot | null {
  const points = sessions.filter(
    (s): s is { start_latitude: number; start_longitude: number } =>
      typeof s.start_latitude === "number" && typeof s.start_longitude === "number",
  );
  if (points.length < MIN_SESSIONS_FOR_SPOT) return null;

  let best: { lat: number; lng: number; count: number } | null = null;

  for (const center of points) {
    const members = points.filter(
      (p) =>
        distanceMeters(
          center.start_latitude,
          center.start_longitude,
          p.start_latitude,
          p.start_longitude,
        ) <= STUDY_SPOT_RADIUS_METERS,
    );
    if (members.length >= MIN_SESSIONS_FOR_SPOT && (!best || members.length > best.count)) {
      const lat = members.reduce((acc, p) => acc + p.start_latitude, 0) / members.length;
      const lng = members.reduce((acc, p) => acc + p.start_longitude, 0) / members.length;
      best = { lat, lng, count: members.length };
    }
  }

  if (!best) return null;

  for (const excluded of excludeLocations) {
    if (distanceMeters(best.lat, best.lng, excluded.latitude, excluded.longitude) <= 300) {
      return null;
    }
  }

  return {
    latitude: best.lat,
    longitude: best.lng,
    goalId: focusGoal.id,
    goalName: focusGoal.name,
    sessionCount: best.count,
  };
}

export async function persistStudySpot(spot: StudySpot | null): Promise<void> {
  if (spot) {
    await AsyncStorage.setItem(STUDY_SPOT_KEY, JSON.stringify(spot));
  } else {
    await AsyncStorage.removeItem(STUDY_SPOT_KEY);
  }
}

export async function getPersistedStudySpot(): Promise<StudySpot | null> {
  try {
    const raw = await AsyncStorage.getItem(STUDY_SPOT_KEY);
    return raw ? (JSON.parse(raw) as StudySpot) : null;
  } catch {
    return null;
  }
}

export async function shouldNudgeNow(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(NUDGE_TS_KEY);
    if (!raw) return true;
    return Date.now() - Number(raw) > MIN_NUDGE_GAP_MS;
  } catch {
    return true;
  }
}

export async function markNudged(): Promise<void> {
  await AsyncStorage.setItem(NUDGE_TS_KEY, String(Date.now()));
}

/** Removes device-local location learning when the current account ends. */
export async function clearStudySpotState(): Promise<void> {
  await AsyncStorage.multiRemove([STUDY_SPOT_KEY, NUDGE_TS_KEY]);
}
