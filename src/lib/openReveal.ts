/**
 * Which reward the player is looking at right now.
 *
 * The app places rewards nobody came back for (`useGrowDelivery`). That must not
 * happen to the one reward a player has open in front of them: they tap the
 * waiting pill, the screen asks what it should become, and while they are
 * choosing the app answers for them. The reveal then says "Already on your
 * island" — correct, and a small insult.
 *
 * Deliberately a module-level value rather than store state: it is not worth a
 * re-render, it must be readable from outside React, and it is meaningless
 * across app runs.
 */

let openFor: string | null = null;

export function markRevealOpen(sessionId: string): void {
  openFor = sessionId;
}

export function markRevealClosed(sessionId: string): void {
  if (openFor === sessionId) openFor = null;
}

/** True while this reward's reveal screen is on screen. */
export function revealIsOpenFor(sessionId: string): boolean {
  return openFor === sessionId;
}
