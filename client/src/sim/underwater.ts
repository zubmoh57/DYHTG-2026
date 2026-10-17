import {
  advanceTimingWindow,
  createTimingWindow,
  pressTimingWindow,
  type TimingResult,
  type TimingWindow,
} from './timing-ring';

export const UNDERWATER_TICK_MS = 1000 / 60;

export interface UnderwaterTuning {
  distance: number;
  baseSpeed: number;
  smallBoostSpeed: number;
  strongBoostSpeed: number;
  boostTicks: number;
  windowTicks: number;
  gapTicks: number;
}

// Development tuning, not additional confirmed design requirements.
export const DEFAULT_UNDERWATER_TUNING: Readonly<UnderwaterTuning> = {
  distance: 600,
  baseSpeed: 20,
  smallBoostSpeed: 28,
  strongBoostSpeed: 36,
  boostTicks: 120,
  windowTicks: 180,
  gapTicks: 60,
};

export interface UnderwaterState {
  phase: 'active' | 'complete' | 'failed';
  tuning: Readonly<UnderwaterTuning>;
  tick: number;
  distance: number;
  oxygen: number;
  speed: number;
  boostSpeed: number;
  boostUntilTick: number;
  windowNumber: number;
  windowStartedTick: number;
  nextWindowTick: number;
  timing: TimingWindow;
}

export type UnderwaterEvent =
  | { type: 'timing-result'; windowNumber: number; result: TimingResult }
  | { type: 'failed'; reason: 'oxygen' }
  | { type: 'complete' };

export function createUnderwater(
  tuning: Readonly<UnderwaterTuning> = DEFAULT_UNDERWATER_TUNING,
): UnderwaterState {
  const values = Object.values(tuning);
  if (values.some((value) => !Number.isFinite(value))
    || tuning.distance <= 0 || tuning.baseSpeed <= 0
    || tuning.smallBoostSpeed <= tuning.baseSpeed
    || tuning.strongBoostSpeed <= tuning.smallBoostSpeed
    || !Number.isInteger(tuning.boostTicks) || tuning.boostTicks <= 0
    || !Number.isInteger(tuning.windowTicks) || tuning.windowTicks <= 0
    || !Number.isInteger(tuning.gapTicks) || tuning.gapTicks < 0) {
    throw new RangeError('Invalid underwater tuning.');
  }
  return {
    phase: 'active', tuning: { ...tuning }, tick: 0, distance: 0, oxygen: 3,
    speed: tuning.baseSpeed, boostSpeed: tuning.baseSpeed, boostUntilTick: 0,
    windowNumber: 1, windowStartedTick: 0,
    nextWindowTick: tuning.windowTicks + tuning.gapTicks,
    timing: createTimingWindow(tuning.windowTicks * UNDERWATER_TICK_MS),
  };
}

// Call once per 60 Hz simulation tick, passing true for a fresh Space edge only.
// Shared runner/boss lives are deliberately not owned or reset by this module.
export function stepUnderwater(state: UnderwaterState, spacePressed = false): UnderwaterEvent[] {
  if (state.phase !== 'active') return [];
  const events: UnderwaterEvent[] = [];
  const tuning = state.tuning;
  state.tick += 1;

  // Expire the old window before opening another, including when gapTicks = 0.
  const alreadyResolved = state.timing.result !== null;
  const elapsedMs = (state.tick - state.windowStartedTick) * UNDERWATER_TICK_MS;
  advanceTimingWindow(state.timing, Math.max(0, elapsedMs - state.timing.elapsedMs));
  if (spacePressed) pressTimingWindow(state.timing);

  if (!alreadyResolved && state.timing.result) {
    const result = state.timing.result;
    events.push({ type: 'timing-result', windowNumber: state.windowNumber, result });
    if (result.outcome === 'oxygen-loss') {
      state.oxygen -= 1;
      // Failure never cancels or changes the expiry of an existing boost.
    } else {
      state.boostSpeed = result.outcome === 'strong-boost'
        ? tuning.strongBoostSpeed : tuning.smallBoostSpeed;
      state.boostUntilTick = state.tick + tuning.boostTicks;
    }
    if (state.oxygen === 0) {
      state.phase = 'failed';
      state.speed = 0;
      events.push({ type: 'failed', reason: 'oxygen' });
      return events;
    }
  }

  state.speed = state.tick < state.boostUntilTick ? state.boostSpeed : tuning.baseSpeed;
  state.distance = Math.min(tuning.distance, state.distance + state.speed / 60);
  if (state.distance >= tuning.distance) {
    state.phase = 'complete';
    state.speed = 0;
    events.push({ type: 'complete' });
    return events;
  }

  if (state.tick >= state.nextWindowTick) {
    state.windowNumber += 1;
    state.windowStartedTick = state.tick;
    state.nextWindowTick = state.tick + tuning.windowTicks + tuning.gapTicks;
    state.timing = createTimingWindow(tuning.windowTicks * UNDERWATER_TICK_MS);
  }
  return events;
}
