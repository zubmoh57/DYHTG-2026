// Timer, lives, oxygen, score, boss health and attempt reset (brief §4, §5, §6, §7).
// Pure functions on a plain object, so every rule can be unit tested without a browser.
// Only core/Game.ts calls these; phases go through PhaseContext.

import { CONFIG } from './config';
import type { FailReason, PhaseId, RunState, Stage } from './types';

export interface RunIdentity {
  roomId: string;
  playerId: string;
  seed: number;
}

/** Which scoreboard section each stage belongs to. Transitions count as the section they lead into. */
export const STAGE_PHASE: Record<Stage, PhaseId> = {
  LOBBY: 'runner1',
  COUNTDOWN: 'runner1',
  RUNNER_1: 'runner1',
  SUB_ENTRY: 'underwater',
  UNDERWATER: 'underwater',
  SURFACE_RETURN: 'runner2',
  RUNNER_2: 'runner2',
  BOSS: 'boss',
  FINISHED: 'boss',
  FAILED: 'runner1', // overwritten: a failed run keeps the phase it failed in
};

export function createRunState(id: RunIdentity): RunState {
  const state = {
    ...id,
    attemptId: '',
    stage: 'LOBBY',
    phase: 'runner1',
    status: 'waiting',
  } as RunState;
  resetForAttempt(state, '');
  state.stage = 'LOBBY';
  return state;
}

/** Everything back to a fresh attempt on the same course. The seed and identity never change. */
export function resetForAttempt(state: RunState, attemptId: string): void {
  state.attemptId = attemptId;
  state.stage = 'COUNTDOWN';
  state.phase = 'runner1';
  state.status = 'waiting';
  state.elapsedMs = 0;
  state.lives = CONFIG.lives.start;
  state.oxygen = CONFIG.oxygen.start;
  state.score = 0;
  state.phaseDistance = 0;
  state.phaseLength = 0;
  state.bossHealth = CONFIG.boss.health;
  state.runnerSpeed = CONFIG.runner.startSpeed;
  state.invulnerableUntilMs = 0;
  state.heartCollected = false;
  state.failReason = null;
}

export function isRunning(state: RunState): boolean {
  return state.status === 'running';
}

export type DamageResult = 'ignored' | 'hit' | 'dead';

/** One life per hit, then 1 s of invulnerability so overlapping hits can't stack (brief §4). */
export function applyDamage(state: RunState, nowMs: number): DamageResult {
  if (!isRunning(state) || nowMs < state.invulnerableUntilMs) return 'ignored';
  state.lives = Math.max(0, state.lives - 1);
  state.invulnerableUntilMs = nowMs + CONFIG.lives.invulnerableSec * 1000;
  if (state.lives === 0) {
    fail(state, 'lives');
    return 'dead';
  }
  return 'hit';
}

/** The heart: exactly one extra life, once per attempt. 3 lives can become 4 (brief §4). */
export function collectHeart(state: RunState): boolean {
  if (!isRunning(state) || state.heartCollected) return false;
  state.heartCollected = true;
  state.lives += 1;
  return true;
}

export type OxygenResult = 'ignored' | 'lost' | 'empty';

/** Oxygen is separate from lives. The third lost bubble fails the run (brief §5). */
export function applyOxygenLoss(state: RunState): OxygenResult {
  if (!isRunning(state)) return 'ignored';
  state.oxygen = Math.max(0, state.oxygen - 1);
  if (state.oxygen === 0) {
    fail(state, 'oxygen');
    return 'empty';
  }
  return 'lost';
}

export interface BossDamageResult {
  applied: number;
  /** True only for the single hit that took the boss to 0. */
  defeated: boolean;
}

/** Clamped at 0; victory happens once and stops the clock on that hit (brief §6, §7). */
export function applyBossDamage(state: RunState, amount: number): BossDamageResult {
  if (!isRunning(state) || state.bossHealth <= 0) return { applied: 0, defeated: false };
  const applied = Math.min(state.bossHealth, Math.max(0, Math.round(amount)));
  state.bossHealth -= applied;
  if (state.bossHealth === 0) {
    state.status = 'finished';
    return { applied, defeated: true };
  }
  return { applied, defeated: false };
}

/** Returns the points actually added. The score can never go above the confirmed 300,000 cap. */
export function addScore(state: RunState, points: number): number {
  if (!isRunning(state)) return 0;
  const next = Math.min(CONFIG.score.max, Math.max(0, state.score + Math.round(points)));
  const delta = next - state.score;
  state.score = next;
  return delta;
}

/** Monotonic clock: elapsed time is measured from the attempt's start, never summed from frames. */
export function updateElapsed(state: RunState, nowMs: number, startedAtMs: number): void {
  if (isRunning(state)) state.elapsedMs = Math.max(0, nowMs - startedAtMs);
}

export function fail(state: RunState, reason: FailReason): void {
  if (!isRunning(state)) return;
  state.status = 'failed';
  state.failReason = reason;
}
