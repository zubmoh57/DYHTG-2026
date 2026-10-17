// Which phase runs in which stage. To plug in your real phase, change ONLY your own line:
//   RUNNER_1 / RUNNER_2, UNDERWATER, BOSS, transitions → Tejas renders (ZUBAIR_BASE.md handoff)
//   Underwater and boss RULES live in Zubair's sim/ modules; the phases here only adapt and draw them.
// Placeholders keep the full run playable until the real phase exists.

import { CONFIG } from '../core/config';
import type { PhaseFactory, Stage } from '../core/types';
import { createBossPhase } from './boss/BossPhase';
import { placeholderTransition } from './placeholders';
import { createRunner } from './runner/RunnerPhase';
import { createUnderwaterPhase } from './underwater/UnderwaterPhase';

/** Dev only: `?short` cuts the runners to a fifth of their length so you reach your section fast. */
const SHORT = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('short');
const length = (full: number) => (SHORT ? Math.round(full / 5) : full);

export const PHASES: Partial<Record<Stage, PhaseFactory>> = {
  RUNNER_1: createRunner({ section: 'runner1', length: length(CONFIG.runner.runner1Distance), crumbs: false, heart: false }),
  SUB_ENTRY: placeholderTransition(1.5, 'fly'),
  UNDERWATER: createUnderwaterPhase(),
  SURFACE_RETURN: placeholderTransition(1.5, 'victory'),
  RUNNER_2: createRunner({ section: 'runner2', length: length(CONFIG.runner.runner2Distance), crumbs: true, heart: true }),
  BOSS: createBossPhase(),
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
