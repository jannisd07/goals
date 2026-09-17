/**
 * The rewards waiting to be placed, re-read whenever Home comes back into view.
 *
 * They live in AsyncStorage rather than the store, because the Auto Check-In
 * background task writes them while the app may not be running
 * (src/lib/pendingGrows.ts). Home therefore has to ask, and `refreshKey` from
 * `usePageRefreshAnimation` is exactly the "screen is in front again" signal.
 */

import { useEffect, useState } from "react";
import { readPendingGrows, type PendingGrow } from "../lib/pendingGrows";
import { onSessionsChanged } from "../lib/sessionEvents";

/** Stable, so an empty result never restarts an effect that depends on it. */
const NONE: PendingGrow[] = [];

export function usePendingGrows(refreshKey: number): PendingGrow[] {
  const [grows, setGrows] = useState<PendingGrow[]>(NONE);

  useEffect(() => {
    let cancelled = false;
    const read = () => {
      void readPendingGrows()
        .then((list) => {
          if (!cancelled) setGrows(list.length > 0 ? list : NONE);
        })
        .catch(() => undefined);
    };
    read();
    // A visit that ends while Home is open earns its reward right now.
    const stop = onSessionsChanged(read);
    return () => {
      cancelled = true;
      stop();
    };
  }, [refreshKey]);

  return grows;
}
