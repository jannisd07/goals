import type { FixedCommitments } from "../types";
import { TOTAL_WEEKLY_HOURS } from "../types";

export function computeDisposableTime(commitments: FixedCommitments): number {
  const sleepTotal = commitments.sleep_hours_per_night * 7;
  const workTotal = commitments.work_hours_per_day * commitments.work_days_per_week;
  const overheadTotal = commitments.daily_overhead_hours * 7;
  const fixedTotal = sleepTotal + workTotal + overheadTotal;
  return Math.max(0, TOTAL_WEEKLY_HOURS - fixedTotal);
}

export function formatHours(hours: number): string {
  if (hours >= 10) {
    return `${Math.floor(hours)}`;
  }
  return hours.toFixed(1);
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

export function formatTimer(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
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

export function formatDate(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}
