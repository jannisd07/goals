/**
 * The Flowtime target scale: what one turn of the ring can set.
 *
 * Flowtime has no time to type in beforehand. You land on the timer, turn the
 * ring until the target reads right, and start. The same turn adjusts it later,
 * while the session runs.
 *
 * **Why the scale is split and not logarithmic.** A log scale spreads five
 * minutes to sixteen hours evenly, but every step lands on a number nobody
 * would choose — 37 minutes, 2 h 14. A split scale keeps round numbers and still
 * gives the short end the room it needs:
 *
 * | range | step | positions |
 * |---|---|---|
 * | 5 min – 1 h | 5 min | 11 |
 * | 1 h – 2 h | 10 min | 6 |
 * | 2 h – 4 h | 30 min | 4 |
 * | 4 h – 8 h | 1 h | 4 |
 * | 8 h – 16 h | 2 h | 4 |
 *
 * 29 steps in total, so one full turn is the whole range at about 12° a step —
 * coarse enough to feel each one, fine enough to land on a value. The first
 * third of the turn covers 5 to 60 minutes, which is where most sessions are,
 * and more than half of it is spent below two hours.
 *
 * Everything here is pure, so the domain suite covers the scale itself.
 */

interface Band {
  /** Exclusive lower end — the previous band's top is this band's first step. */
  from: number;
  to: number;
  step: number;
}

const BANDS: readonly Band[] = [
  { from: 5, to: 60, step: 5 },
  { from: 60, to: 120, step: 10 },
  { from: 120, to: 240, step: 30 },
  { from: 240, to: 480, step: 60 },
  { from: 480, to: 960, step: 120 },
];

/** Every target the ring can land on, from five minutes to sixteen hours. */
export const FLOW_TARGET_STEPS: readonly number[] = (() => {
  const steps = [BANDS[0].from];
  for (const band of BANDS) {
    for (let value = band.from + band.step; value <= band.to; value += band.step) {
      steps.push(value);
    }
  }
  return steps;
})();

export const FLOW_TARGET_MIN = FLOW_TARGET_STEPS[0];
export const FLOW_TARGET_MAX = FLOW_TARGET_STEPS[FLOW_TARGET_STEPS.length - 1];

/** What the dial starts on when nothing else is known: a full, plausible session. */
export const FLOW_TARGET_DEFAULT = 50;

/**
 * The marks that get a label on the dial. They are the band edges, which is
 * exactly where the step size changes — so the scale explains itself.
 */
export const FLOW_TARGET_LABELLED: readonly number[] = [15, 30, 60, 120, 240, 480, 960];

/**
 * Sixteen hours is one whole turn of the ring (Jannis, 2026-09-15).
 *
 * That puts the top mark at both ends of the scale at once. It is not labelled
 * with the minimum for that reason — the mark reads "16 h", and five minutes is
 * simply where the arc is still empty. The number under the dial always says
 * which of the two you are on, so the ring never has to carry that alone.
 */
export const FLOW_TARGET_SWEEP = 1;

/** The target at a position on the dial, clamped to the ends. */
export function flowTargetAt(index: number): number {
  const clamped = Math.max(0, Math.min(FLOW_TARGET_STEPS.length - 1, Math.round(index)));
  return FLOW_TARGET_STEPS[clamped];
}

/** Where a target sits on the dial; anything between two steps takes the nearer one. */
export function flowTargetIndex(minutes: number): number {
  if (!Number.isFinite(minutes)) return flowTargetIndex(FLOW_TARGET_DEFAULT);
  let best = 0;
  let bestGap = Number.POSITIVE_INFINITY;
  FLOW_TARGET_STEPS.forEach((value, index) => {
    const gap = Math.abs(value - minutes);
    if (gap < bestGap) {
      best = index;
      bestGap = gap;
    }
  });
  return best;
}

/** The nearest target the ring can actually show. */
export function snapFlowTarget(minutes: number): number {
  return flowTargetAt(flowTargetIndex(minutes));
}

/** How far around the ring a target sits: 0 at the top, a whole turn at 16 h. */
export function flowTargetTurn(minutes: number): number {
  return (flowTargetIndex(minutes) / (FLOW_TARGET_STEPS.length - 1)) * FLOW_TARGET_SWEEP;
}

/**
 * Short and readable: "45 min", "1 h 30", "16 h". Never "90 min" — past an hour
 * people read hours, and a three-digit minute count is hard to take in at a
 * glance while a session runs.
 */
export function formatFlowTarget(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest}`;
}

/** The same value spoken out, for VoiceOver. */
export function describeFlowTarget(minutes: number): string {
  if (minutes < 60) return `${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const hourWord = hours === 1 ? "hour" : "hours";
  return rest === 0 ? `${hours} ${hourWord}` : `${hours} ${hourWord} ${rest} minutes`;
}
