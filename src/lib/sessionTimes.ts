/**
 * The end a session row is allowed to have: never before its start.
 *
 * The phone's clock is not the server's, and it can be corrected between the
 * start and the end of a session. A session that ends "before" it started is
 * rejected by the database for good (`sessions_end_time_valid`), and a rejected
 * write used to sit in the offline queue for ever. The end is therefore moved to
 * start + duration — the duration is what was actually measured and stays
 * untouched. Pure, so the domain suite covers it.
 */
export function consistentEndTime(
  startTime: string,
  endTime: string,
  durationSeconds: number,
): string {
  const start = Date.parse(startTime);
  const end = Date.parse(endTime);
  if (!Number.isFinite(start)) return endTime;
  const earliest = start + Math.max(0, Math.floor(durationSeconds)) * 1000;
  return !Number.isFinite(end) || end < earliest ? new Date(earliest).toISOString() : endTime;
}
