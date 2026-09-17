/**
 * What happens to a focus session nobody came back to.
 *
 * Three places notice such a session — the foreground tick, a tap on the Live
 * Activity, and the store check after a restart — and until now each of them
 * did a slightly different thing. Two kept the reward, one did not; none of
 * them closed the row on the server, so the island grew from focus time that
 * the week view, the streak and the stats never saw.
 *
 * Now all three settle the session the same way: the reward is kept, and the
 * time that was really focused is written to the server through the outbox,
 * ending at the last moment the timer was known to be running. A counter that
 * has plainly run away is not focus time and closes nothing; its empty row is
 * removed instead.
 */

import { supabase } from "./supabase";
import { rememberSessionReward } from "./pendingGrows";
import { MAX_PLAUSIBLE_FOCUS_SECONDS } from "./pomodoro";
import {
  flushSessionOutbox,
  isLocalSessionId,
  queueSession,
  removeQueuedSession,
} from "./sessionOutbox";
import type { ActiveSession } from "../types";

export async function settleAbandonedSession(
  session: ActiveSession | null | undefined,
): Promise<void> {
  const pomodoro = session?.pomodoro;
  if (!session || !pomodoro) return;

  // The focus before the gap was real, so its reward is too (pendingGrows.ts
  // applies the same plausibility rule as the End button).
  await rememberSessionReward(session);

  const focusedSeconds = Math.max(0, Math.floor(pomodoro.focused_seconds ?? 0));
  const endedAtMs = pomodoro.last_tick_at_ms || Date.now();
  const plausible = focusedSeconds > 0 && focusedSeconds <= MAX_PLAUSIBLE_FOCUS_SECONDS;

  if (plausible) {
    await queueSession({
      id: session.session_id,
      serverId: isLocalSessionId(session.session_id) ? null : session.session_id,
      goalId: session.goal_id,
      trigger: session.trigger,
      startTime: session.start_time,
      endTime: new Date(endedAtMs).toISOString(),
      durationSeconds: focusedSeconds,
      pomodoroCycles: pomodoro.total_cycles,
      growthStage: Math.min(4, Math.floor(focusedSeconds / 1800)),
      ambientSound: session.ambient_sound ?? null,
      startLatitude: null,
      startLongitude: null,
      rating: null,
      notes: null,
      queuedAt: new Date().toISOString(),
    }).catch(() => undefined);
    void flushSessionOutbox();
    return;
  }

  // Nothing worth keeping: an empty or implausible session leaves no row behind.
  await removeQueuedSession(session.session_id).catch(() => undefined);
  if (!isLocalSessionId(session.session_id)) {
    try {
      const { error } = await supabase
        .from("sessions")
        .delete()
        .eq("id", session.session_id)
        .is("end_time", null);
      if (error) console.warn("Could not remove an abandoned session:", error.message);
    } catch {
      // Offline: the empty row stays open and is harmless — every reader
      // filters on end_time.
    }
  }
}
