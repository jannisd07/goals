import type { Session } from "../types";

export interface StreakInfo {
  /** Consecutive days ending today or yesterday with at least one completed session. */
  current: number;
  longest: number;
  /** True when there is no session today yet but the streak survives if one happens today. */
  atRiskToday: boolean;
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function computeStreak(sessions: Pick<Session, "start_time" | "end_time">[], now = new Date()): StreakInfo {
  const days = new Set<string>();
  for (const session of sessions) {
    if (!session.end_time) continue;
    days.add(dayKey(new Date(session.start_time)));
  }

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const hasToday = days.has(dayKey(today));

  let current = 0;
  const cursor = new Date(today);
  if (!hasToday) cursor.setDate(cursor.getDate() - 1);
  while (days.has(dayKey(cursor))) {
    current += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  let longest = 0;
  const sorted = [...days]
    .map((key) => {
      const [y, m, d] = key.split("-").map(Number);
      // UTC day ordinals avoid 23/25-hour local days around DST changes.
      return Math.floor(Date.UTC(y, m, d) / (24 * 60 * 60 * 1000));
    })
    .sort((a, b) => a - b);
  let run = 0;
  let prev: number | null = null;
  for (const t of sorted) {
    run = prev !== null && t - prev === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = t;
  }

  return {
    current,
    longest: Math.max(longest, current),
    atRiskToday: current > 0 && !hasToday,
  };
}
