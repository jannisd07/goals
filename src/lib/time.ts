import type { FixedCommitments } from "../types";
import { TOTAL_WEEKLY_HOURS } from "../types";

export function computeDisposableTime(commitments: FixedCommitments): number {
  const sleepTotal = commitments.sleep_hours_per_night * 7;
  const workTotal = commitments.work_hours_per_day * commitments.work_days_per_week;
  const overheadTotal = commitments.daily_overhead_hours * 7;
  const fixedTotal = sleepTotal + workTotal + overheadTotal;
  return Math.max(0, TOTAL_WEEKLY_HOURS - fixedTotal);
}

export function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) {
    return `${hrs}h ${mins}m`;
  }
  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
}

/**
 * The big timer face. Past an hour it rolls over to `1:15:23` instead of
 * counting minutes forever — a long Flowtime session read `75:23`, while the
 * Live Activity on the lock screen showed the hour.
 */
export function formatTimer(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const paddedSeconds = secs.toString().padStart(2, "0");
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, "0")}:${paddedSeconds}`;
  }
  return `${mins.toString().padStart(2, "0")}:${paddedSeconds}`;
}

/** IANA zone of the device ("Europe/Berlin"), or null when the runtime cannot tell. */
export function deviceTimeZone(): string | null {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return typeof zone === "string" && zone.length > 0 ? zone : null;
  } catch {
    return null;
  }
}

export function getWeekStart(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export function getWeekEnd(): Date {
  const start = getWeekStart();
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}
