// Which phase runs in which stage. To plug in your real phase, change ONLY your own line:
//   RUNNER_1 / RUNNER_2          → Tejas
//   SUB_ENTRY / SURFACE_RETURN    → Zubair (transitions)
//   UNDERWATER / BOSS             → Zubair
// Placeholders keep the full run playable until then.

import type { PhaseFactory, Stage } from '../core/types';
import {
  placeholderBoss,
  placeholderRunner,
  placeholderTransition,
  placeholderUnderwater,
} from './placeholders';

export const PHASES: Partial<Record<Stage, PhaseFactory>> = {
  RUNNER_1: placeholderRunner('runner1', 300, false),
  SUB_ENTRY: placeholderTransition(1.5, 'fly'),
  UNDERWATER: placeholderUnderwater(4),
  SURFACE_RETURN: placeholderTransition(1.5, 'victory'),
  RUNNER_2: placeholderRunner('runner2', 250, true),
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
