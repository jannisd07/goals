export function clampSliderRatio(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function sliderRatioFromPageX(
  pageX: number,
  trackLeft: number,
  trackWidth: number,
): number | null {
  if (
    !Number.isFinite(pageX) ||
    !Number.isFinite(trackLeft) ||
    !Number.isFinite(trackWidth) ||
    trackWidth <= 0
  ) {
    return null;
  }

  return clampSliderRatio((pageX - trackLeft) / trackWidth);
}

export function sliderThumbLeft(
  ratio: number,
  trackWidth: number,
  thumbWidth: number,
): number {
  if (trackWidth <= 0 || thumbWidth <= 0) return 0;
  const availableWidth = Math.max(0, trackWidth - thumbWidth);
  return Math.min(
    availableWidth,
    Math.max(0, clampSliderRatio(ratio) * trackWidth - thumbWidth / 2),
  );
}

/**
 * Maps a touch on a circular rail to a stepped value.
 * Twelve o'clock is the minimum and values increase clockwise.
 * Touches away from the rail are ignored so the dial's center stays usable.
 */
export function circularSliderValueFromPoint(
  x: number,
  y: number,
  size: number,
  min: number,
  max: number,
  step: number,
): number | null {
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(size) ||
    !Number.isFinite(min) ||
    !Number.isFinite(max) ||
    !Number.isFinite(step) ||
    size <= 0 ||
    step <= 0 ||
    max <= min
  ) {
    return null;
  }

  const clockwiseFromTop = circularSliderAngleFromPoint(x, y, size);
  if (clockwiseFromTop === null) return null;
  const fullTurn = Math.PI * 2;
  const ratio = clockwiseFromTop / fullTurn;
  const rawValue = min + ratio * (max - min);
  const steppedValue = min + Math.round((rawValue - min) / step) * step;

  return Math.min(max, Math.max(min, steppedValue));
}

/** Returns a clockwise angle from twelve o'clock only when the touch hits the rail. */
export function circularSliderAngleFromPoint(
  x: number,
  y: number,
  size: number,
): number | null {
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(size) ||
    size <= 0
  ) {
    return null;
  }

  const center = size / 2;
  const dx = x - center;
  const dy = y - center;
  const normalizedDistance = Math.hypot(dx, dy) / size;
  if (normalizedDistance < 0.34 || normalizedDistance > 0.58) {
    return null;
  }

  const fullTurn = Math.PI * 2;
  return (Math.atan2(dy, dx) + Math.PI / 2 + fullTurn) % fullTurn;
}
