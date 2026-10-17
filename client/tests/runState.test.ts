import { beforeEach, describe, expect, it } from 'vitest';
import { CONFIG } from '../src/core/config';
import {
  addScore,
  applyBossDamage,
  applyDamage,
  applyOxygenLoss,
  collectHeart,
  createRunState,
  resetForAttempt,
  updateElapsed,
} from '../src/core/RunState';
import type { RunState } from '../src/core/types';

let run: RunState;

beforeEach(() => {
  run = createRunState({ roomId: 'r', playerId: 'p', seed: 1 });
  resetForAttempt(run, 'a1');
  run.status = 'running';
});

describe('lives and invulnerability (brief §4)', () => {
  it('starts with three lives', () => {
    expect(run.lives).toBe(3);
  });

  it('removes one life per hit and ignores hits during the next second', () => {
    expect(applyDamage(run, 1000)).toBe('hit');
    expect(run.lives).toBe(2);
    expect(applyDamage(run, 1500)).toBe('ignored');
    expect(applyDamage(run, 1999)).toBe('ignored');
    expect(run.lives).toBe(2);
    expect(applyDamage(run, 2000)).toBe('hit');
    expect(run.lives).toBe(1);
  });

  it('fails the run at zero lives', () => {
    applyDamage(run, 0);
    applyDamage(run, 2000);
    expect(applyDamage(run, 4000)).toBe('dead');
    expect(run.status).toBe('failed');
    expect(run.failReason).toBe('lives');
    expect(applyDamage(run, 6000)).toBe('ignored');
  });
});

describe('the heart (brief §4)', () => {
  it('gives exactly one life once, so 3 can become 4', () => {
    expect(collectHeart(run)).toBe(true);
    expect(run.lives).toBe(4);
    expect(collectHeart(run)).toBe(false);
    expect(run.lives).toBe(4);
  });
});

describe('oxygen (brief §5)', () => {
  it('is separate from lives and fails the run on the third loss', () => {
    expect(applyOxygenLoss(run)).toBe('lost');
    expect(applyOxygenLoss(run)).toBe('lost');
    expect(run.lives).toBe(3);
    expect(applyOxygenLoss(run)).toBe('empty');
    expect(run.status).toBe('failed');
    expect(run.failReason).toBe('oxygen');
  });
});

describe('boss health (brief §6, addendum §1)', () => {
  it('starts at 30,000', () => {
    expect(run.bossHealth).toBe(30000);
  });

  it('is defeated exactly once, clamped at zero', () => {
    expect(applyBossDamage(run, 10000).defeated).toBe(false);
    expect(applyBossDamage(run, 10000).defeated).toBe(false);
    const last = applyBossDamage(run, 10000);
    expect(last.defeated).toBe(true);
    expect(run.bossHealth).toBe(0);
    expect(run.status).toBe('finished');
    expect(applyBossDamage(run, 999)).toEqual({ applied: 0, defeated: false });
  });

  it('never goes below zero on an overkill hit', () => {
    run.bossHealth = 50;
    const r = applyBossDamage(run, 10000);
    expect(r.applied).toBe(50);
    expect(run.bossHealth).toBe(0);
  });
});

describe('retry and clock (brief §7)', () => {
  it('resets everything except the seed and identity', () => {
    applyDamage(run, 0);
    applyOxygenLoss(run);
    collectHeart(run);
    addScore(run, 500);
    run.bossHealth = 10;
    run.runnerSpeed = 3;
    resetForAttempt(run, 'a2');
    expect(run).toMatchObject({
      attemptId: 'a2',
      seed: 1,
      lives: 3,
      oxygen: 3,
      score: 0,
      bossHealth: CONFIG.boss.health,
      runnerSpeed: CONFIG.runner.startSpeed,
      heartCollected: false,
      invulnerableUntilMs: 0,
      failReason: null,
      status: 'waiting',
    });
  });

  it('measures elapsed time from the start and stops when the run ends', () => {
    updateElapsed(run, 5000, 1000);
    expect(run.elapsedMs).toBe(4000);
    run.status = 'finished';
    updateElapsed(run, 9000, 1000);
    expect(run.elapsedMs).toBe(4000);
  });

  it('never lets the score go above the 300,000 cap (addendum §3)', () => {
    expect(addScore(run, 299900)).toBe(299900);
    expect(addScore(run, 500)).toBe(100);
    expect(run.score).toBe(300000);
    expect(addScore(run, 1)).toBe(0);
    expect(run.score).toBe(300000);
  });

  it('only scores while running', () => {
    addScore(run, 100);
    run.status = 'failed';
    addScore(run, 100);
    expect(run.score).toBe(100);
  });
});
