import * as Notifications from "expo-notifications";
import type { PomodoroState } from "../types";
import { clearCoachNudges } from "./coachNudges";

const STREAK_REMINDER_ID = "streak-reminder";
const WEEKLY_SUMMARY_ID = "weekly-summary";
const FOCUS_PHASE_BOUNDARY_ID = "focus-phase-boundary";
const STUDY_SPOT_CATEGORY = "study-spot-nudge";

async function hasPermission(): Promise<boolean> {
  try {
    const settings = await Notifications.getPermissionsAsync();
    return settings.granted || settings.status === "granted";
  } catch {
    return false;
  }
}

/**
 * Daily evening reminder that only matters when the streak is at risk.
 * We re-schedule (or cancel) whenever streak state changes, so the copy stays truthful.
 */
export async function syncStreakReminder(streakDays: number, atRiskToday: boolean): Promise<void> {
  // Cancellation must not depend on the current permission state. Otherwise a
  // reminder scheduled before permission was revoked can survive and become
  // active again after a later re-grant even though the preference/state
  // changed in the meantime.
  await Notifications.cancelScheduledNotificationAsync(STREAK_REMINDER_ID).catch(() => {});

  if (!atRiskToday || streakDays === 0 || !(await hasPermission())) return;

  await Notifications.scheduleNotificationAsync({
    identifier: STREAK_REMINDER_ID,
    content: {
      title: "Keep your streak alive",
      body:
        streakDays === 1
          ? "One short session today keeps it going."
          : `${streakDays} days in a row — a short session today keeps it going.`,
      sound: false,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 19,
      minute: 30,
    },
  }).catch((error) => {
    console.warn("Could not schedule streak reminder:", error);
  });
}

/** Keeps one calm Sunday reminder in sync with the user's local preference. */
export async function syncWeeklySummary(enabled: boolean): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(WEEKLY_SUMMARY_ID).catch(() => {});
  if (!enabled || !(await hasPermission())) return;

  await Notifications.scheduleNotificationAsync({
    identifier: WEEKLY_SUMMARY_ID,
    content: {
      title: "Your week in Goals",
      body: "See your focus time, visits, and progress for the week.",
      sound: false,
      data: { type: "weekly_summary" },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: 1,
      hour: 18,
      minute: 0,
    },
  }).catch((error) => {
    console.warn("Could not schedule weekly summary:", error);
  });
}

/** Immediate local nudge when the user arrives at a recognized study spot. */
export async function sendStudySpotNudge(goalName: string, goalId: string): Promise<boolean> {
  if (!(await hasPermission())) return false;

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Good spot for a session?",
        body: `You usually focus on ${goalName} here. Start a session when you're ready.`,
        categoryIdentifier: STUDY_SPOT_CATEGORY,
        data: { type: "study_spot", goalId },
        sound: false,
      },
      trigger: null,
    });
    return true;
  } catch (error) {
    console.warn("Could not send study-spot suggestion:", error);
    return false;
  }
}

/**
 * Tells the player that a landmark now stands on their island.
 *
 * Sent the moment the hours are reached, so the milestone is an event and not
 * something to be discovered later. It is a statement, not a nudge: the object
 * is already there, whether or not the notification is ever tapped.
 */
export async function sendMilestoneReached(
  title: string,
  description: string,
  hours: number,
): Promise<boolean> {
  if (!(await hasPermission())) return false;

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${hours} hours · ${title}`,
        body: description,
        data: { type: "milestone" },
        sound: true,
      },
      trigger: null,
    });
    return true;
  } catch (error) {
    console.warn("Could not send the milestone notification:", error);
    return false;
  }
}

/**
 * Schedules one truthful boundary notification while iOS may suspend JS.
 * Flowtime has no predetermined end, and paused timers schedule nothing.
 */
export async function syncFocusPhaseBoundary(
  pomodoro: PomodoroState | null | undefined,
): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(FOCUS_PHASE_BOUNDARY_ID).catch(() => {});
  if (!pomodoro?.is_running || !(await hasPermission())) return;

  const onBreak = pomodoro.is_break || pomodoro.is_long_break;
  if (pomodoro.mode === "flowtime") return;

  const phaseDuration = onBreak
    ? pomodoro.break_duration_seconds
    : pomodoro.duration_seconds;
  const remainingSeconds = Math.max(1, phaseDuration - pomodoro.elapsed_seconds);

  await Notifications.scheduleNotificationAsync({
    identifier: FOCUS_PHASE_BOUNDARY_ID,
    content: {
      title: onBreak ? "Break complete" : "Focus block complete",
      body: onBreak
        ? "Your next focus block is ready."
        : "Take a breath, then return when you are ready.",
      sound: false,
      data: { type: "focus_phase_boundary" },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: remainingSeconds,
      repeats: false,
    },
  }).catch((error) => {
    console.warn("Could not schedule focus phase notification:", error);
  });
}

/** Prevent reminders created for one account from surviving a sign-out. */
export async function clearAccountNotifications(): Promise<void> {
  await Promise.all([
    Notifications.cancelScheduledNotificationAsync(STREAK_REMINDER_ID).catch(() => {}),
    Notifications.cancelScheduledNotificationAsync(WEEKLY_SUMMARY_ID).catch(() => {}),
    Notifications.cancelScheduledNotificationAsync(FOCUS_PHASE_BOUNDARY_ID).catch(() => {}),
    clearCoachNudges().catch(() => {}),
    Notifications.dismissAllNotificationsAsync().catch(() => {}),
  ]);
}
