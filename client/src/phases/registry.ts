// Which phase runs in which stage. To plug in your real phase, change ONLY your own line:
//   RUNNER_1 / RUNNER_2          → Tejas
//   SUB_ENTRY / SURFACE_RETURN    → Zubair (transitions)
//   UNDERWATER / BOSS             → Zubair
// Placeholders keep the full run playable until then.

import { CONFIG } from '../core/config';
import type { PhaseFactory, Stage } from '../core/types';
import { placeholderBoss, placeholderTransition, placeholderUnderwater } from './placeholders';
import { createRunner } from './runner/RunnerPhase';

/** Dev only: `?short` cuts the runners to a fifth of their length so you reach your section fast. */
const SHORT = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('short');
const length = (full: number) => (SHORT ? Math.round(full / 5) : full);

export const PHASES: Partial<Record<Stage, PhaseFactory>> = {
  RUNNER_1: createRunner({ section: 'runner1', length: length(CONFIG.runner.runner1Distance), crumbs: false, heart: false }),
  SUB_ENTRY: placeholderTransition(1.5, 'fly'),
  UNDERWATER: placeholderUnderwater(4),
  SURFACE_RETURN: placeholderTransition(1.5, 'victory'),
  RUNNER_2: createRunner({ section: 'runner2', length: length(CONFIG.runner.runner2Distance), crumbs: true, heart: true }),
  BOSS: placeholderBoss(),
};

/** `?phase=` values for jumping straight into a stage while developing. */
export const DEV_JUMPS: Record<string, Stage> = {
  runner1: 'RUNNER_1',
  'sub-entry': 'SUB_ENTRY',
  underwater: 'UNDERWATER',
  'surface-return': 'SURFACE_RETURN',
  runner2: 'RUNNER_2',
  boss: 'BOSS',
};
