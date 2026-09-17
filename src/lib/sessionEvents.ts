/**
 * "A session just changed" — for the parts of the app that cannot see it.
 *
 * The Auto Check-In task writes its rows outside React Query and outside the
 * store. While the app is in the background that is fine: Home re-reads
 * everything on the next foreground. But a visit that ends while the player is
 * looking at Home changed nothing on screen — the weekly count stayed, and the
 * reward it earned was not offered until the app was put away and brought back.
 * This is the one signal that closes that gap. Nothing is delivered through it,
 * listeners re-read their own sources.
 */

type Listener = () => void;

const listeners = new Set<Listener>();

export function onSessionsChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitSessionsChanged(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch (error) {
      console.warn("A sessions-changed listener failed:", error);
    }
  }
}
