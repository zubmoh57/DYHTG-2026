// Which phase runs in which stage. Tejas renders every stage (ZUBAIR_BASE.md handoff); the
// underwater and boss RULES live in Zubair's sim/ modules, and those phases only adapt and draw them.
// To swap in a new phase, change only that stage's line.

import { CONFIG } from '../core/config';
import type { PhaseFactory, Stage } from '../core/types';
import { createBossPhase } from './boss/BossPhase';
import { createRunner } from './runner/RunnerPhase';
import { createSubEntry } from './transitions/SubEntryPhase';
import { createSurfaceReturn } from './transitions/SurfaceReturnPhase';
import { createUnderwaterPhase } from './underwater/UnderwaterPhase';

/** Dev only: `?short` cuts the runners to a fifth of their length so you reach your section fast. */
const SHORT = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('short');
const length = (full: number) => (SHORT ? Math.round(full / 5) : full);

export const PHASES: Partial<Record<Stage, PhaseFactory>> = {
  RUNNER_1: createRunner({ section: 'runner1', length: length(CONFIG.runner.runner1Distance), crumbs: false, heart: false }),
  SUB_ENTRY: createSubEntry(),
  UNDERWATER: createUnderwaterPhase(),
  SURFACE_RETURN: createSurfaceReturn(),
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
