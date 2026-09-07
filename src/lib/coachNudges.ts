/**
 * Client side of the personal coach.
 *
 * The server returns notification copy plus when it applies; this module turns
 * that into local notifications. Nothing here calls the model, and the whole
 * feature degrades to silence when the user turns `aiNudges` off.
 */

import * as Notifications from "expo-notifications";
import {
  nudgeSchedule,
  selectNudges,
  type CoachNudge,
} from "./coachSchedule";

export const COACH_NUDGE_ID_PREFIX = "coach-nudge-";

export {
  MIN_NUDGE_CONFIDENCE,
  MAX_SCHEDULED_NUDGES,
  nudgeSchedule,
  parseCoachNudges,
  selectNudges,
  type CoachNudge,
  type CoachNudgeResponse,
  type NudgeSchedule,
} from "./coachSchedule";

async function hasPermission(): Promise<boolean> {
  try {
    const settings = await Notifications.getPermissionsAsync();
    return settings.granted || settings.status === "granted";
  } catch {
    return false;
  }
}

/** Removes every coach notification, whatever the current preference is. */
export async function clearCoachNudges(): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((item) => item.identifier.startsWith(COACH_NUDGE_ID_PREFIX))
        .map((item) =>
          Notifications.cancelScheduledNotificationAsync(item.identifier).catch(() => {}),
        ),
    );
  } catch {
    // Nothing scheduled, or notifications are unavailable on this platform.
  }
}

/**
 * Replaces the scheduled coach notifications with the current set.
 * Cancelling always runs first so revoking the preference takes effect even
 * when permission was withdrawn in the meantime.
 */
export async function syncCoachNudges(
  nudges: CoachNudge[],
  enabled: boolean,
): Promise<number> {
  await clearCoachNudges();
  if (!enabled || nudges.length === 0) return 0;
  if (!(await hasPermission())) return 0;

  const selected = selectNudges(nudges);
  let scheduled = 0;

  for (let index = 0; index < selected.length; index += 1) {
    const nudge = selected[index];
    const when = nudgeSchedule(nudge);
    const identifier = `${COACH_NUDGE_ID_PREFIX}${index}`;
    const content = { title: nudge.title, body: nudge.body, sound: false };

    try {
      if (when.weekday === null) {
        await Notifications.scheduleNotificationAsync({
          identifier,
          content,
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: when.hour,
            minute: when.minute,
          },
        });
      } else {
        await Notifications.scheduleNotificationAsync({
          identifier,
          content,
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
            // expo-notifications counts weekdays from 1 = Sunday, the coach from 0.
            weekday: when.weekday + 1,
            hour: when.hour,
            minute: when.minute,
          },
        });
      }
      scheduled += 1;
    } catch (error) {
      console.warn("Could not schedule a coach nudge:", error);
    }
  }
  return scheduled;
}
