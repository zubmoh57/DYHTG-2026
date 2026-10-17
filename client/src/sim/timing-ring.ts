export type TimingOutcome = 'strong-boost' | 'small-boost' | 'oxygen-loss';

export interface TimingResult {
  accuracy: number;
  outcome: TimingOutcome;
  reason: 'pressed' | 'expired';
}

export interface TimingWindow {
  durationMs: number;
  elapsedMs: number;
  result: TimingResult | null;
}

// Provisional tuning: alignment is halfway through a three-second window.
// The caller supplies elapsed time, so this module needs no browser or clock.
export function createTimingWindow(durationMs = 3000): TimingWindow {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    throw new RangeError('Timing window duration must be positive and finite.');
  }
  return { durationMs, elapsedMs: 0, result: null };
}

export function getTimingAccuracy(window: TimingWindow): number {
  if (window.result) return window.result.accuracy;
  const halfwayMs = window.durationMs / 2;
  const distanceFromPerfect = Math.abs(window.elapsedMs - halfwayMs);
  // Use the same whole percentage for feedback and reward thresholds.
  return Math.floor(Math.max(0, 100 * (1 - distanceFromPerfect / halfwayMs)));
}

export function advanceTimingWindow(window: TimingWindow, deltaMs: number): void {
  if (!Number.isFinite(deltaMs) || deltaMs < 0) {
    throw new RangeError('Elapsed time must be non-negative and finite.');
  }
  if (window.result) return;
  window.elapsedMs = Math.min(window.durationMs, window.elapsedMs + deltaMs);
  if (window.elapsedMs >= window.durationMs) {
    window.result = { accuracy: 0, outcome: 'oxygen-loss', reason: 'expired' };
  }
}

// A result locks the window, so subsequent presses cannot change it.
// Fresh-press/held-key detection belongs to the input adapter, not this model.
export function pressTimingWindow(window: TimingWindow): TimingResult | null {
  if (window.result) return null;
  const accuracy = getTimingAccuracy(window);
  const outcome: TimingOutcome = accuracy >= 90
    ? 'strong-boost'
    : accuracy >= 50 ? 'small-boost' : 'oxygen-loss';
  window.result = { accuracy, outcome, reason: 'pressed' };
  return window.result;
}
