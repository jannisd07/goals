/**
 * Client side of the personal coach.
 *
 * The server returns notification copy plus when it applies; this module turns
 * that into local notifications. Nothing here calls the model, and the whole
 * feature degrades to silence when the user turns `aiNudges` off.
 */

import * as Notifications from "expo-notifications";
import {
  planCoachNotifications,
  type CoachNudge,
  type NudgeDeliveryLog,
} from "./coachSchedule";

export const COACH_NUDGE_ID_PREFIX = "coach-nudge-";

export {
  MIN_NUDGE_CONFIDENCE,
  MAX_SCHEDULED_NUDGES,
  nudgeSchedule,
  parseCoachNudges,
  planCoachNotifications,
  selectNudges,
  type CoachNudge,
  type CoachNudgeResponse,
  type NudgeDeliveryLog,
  type NudgeSchedule,
} from "./coachSchedule";

export interface CoachNudgeSyncResult {
  scheduled: number;
  /** Updated one-time delivery log; persist it for the next sync. */
  log: NudgeDeliveryLog;
}

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
  log: NudgeDeliveryLog = {},
  now: Date = new Date(),
): Promise<CoachNudgeSyncResult> {
  await clearCoachNudges();
  if (!enabled || nudges.length === 0) return { scheduled: 0, log };
  if (!(await hasPermission())) return { scheduled: 0, log };

  const plan = planCoachNotifications(nudges, now, log);
  const nextLog: NudgeDeliveryLog = { ...plan.log };
  let scheduled = 0;

  for (let index = 0; index < plan.planned.length; index += 1) {
    const { key, nudge, trigger } = plan.planned[index];
    const identifier = `${COACH_NUDGE_ID_PREFIX}${index}`;
    const content = { title: nudge.title, body: nudge.body, sound: false };

    try {
      if (trigger.type === "weekly") {
        await Notifications.scheduleNotificationAsync({
          identifier,
          content,
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
            // expo-notifications counts weekdays from 1 = Sunday, the coach from 0.
            weekday: trigger.weekday + 1,
            hour: trigger.hour,
            minute: trigger.minute,
          },
        });
      } else {
        await Notifications.scheduleNotificationAsync({
          identifier,
          content,
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: trigger.date,
          },
        });
      }
      scheduled += 1;
    } catch (error) {
      console.warn("Could not schedule a coach nudge:", error);
      // Nothing was scheduled, so no cooldown may start from it.
      if (trigger.type === "date") {
        if (log[key] === undefined) delete nextLog[key];
        else nextLog[key] = log[key];
      }
    }
  }
  return { scheduled, log: nextLog };
}
