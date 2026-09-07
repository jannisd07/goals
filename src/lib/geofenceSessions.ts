import {
  DEFAULT_MIN_VISIT_MINUTES,
  normalizeMinVisitMinutes,
} from "../types";

export const MAX_GEOFENCE_SESSION_MS = 18 * 60 * 60 * 1000;

export type GeofenceSessionDisposition =
  | "discard_short"
  | "complete"
  | "discard_stale";

/**
 * Applies the same duration rule to normal exits and account cleanup.
 *
 * `minVisitMinutes` comes from the goal so a user who walks past their gym
 * every day can require a real stay before a visit counts.
 */
export function classifyGeofenceSession(
  durationMs: number,
  minVisitMinutes: number = DEFAULT_MIN_VISIT_MINUTES,
): GeofenceSessionDisposition {
  if (durationMs >= MAX_GEOFENCE_SESSION_MS) return "discard_stale";
  const thresholdSeconds = normalizeMinVisitMinutes(minVisitMinutes) * 60;
  if (Math.floor(Math.max(0, durationMs) / 1000) < thresholdSeconds) {
    return "discard_short";
  }
  return "complete";
}
