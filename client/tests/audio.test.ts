import { describe, expect, it } from 'vitest';
import { CUE_SOUNDS, countdownTicked, musicFor, soundsFor } from '../src/audio/soundMap';
import { SOUNDS } from '../src/audio/sounds';

describe('audio sound map', () => {
  it('has a recipe for every sound a cue can play', () => {
    for (const sound of Object.values(CUE_SOUNDS)) expect(SOUNDS[sound]).toBeTypeOf('function');
  });

  it('plays each cue the phases emit', () => {
    const emitted = ['laneChange', 'hit', 'crumb', 'bark', 'bite', 'boost', 'pondPop', 'jump', 'splash',
      'swish', 'coin', 'zap', 'ouch', 'powerup', 'nopower', 'cash', 'grab', 'shot', 'shield', 'ricochet',
      'shieldDown', 'ready', 'aim', 'fire', 'laser', 'miss', 'bossDefeated'];
    for (const name of emitted) expect(soundsFor({ type: 'cue', name })).toHaveLength(1);
  });

  it('never plays a sound twice for cues that duplicate a core event', () => {
    expect(soundsFor({ type: 'cue', name: 'heart' })).toEqual([]);
    expect(soundsFor({ type: 'lifeGained', lives: 4 })).toEqual(['heart']);
  });

  it('stays silent for unknown cues', () => {
    expect(soundsFor({ type: 'cue', name: 'somethingNew' })).toEqual([]);
  });

  it('squawks only for real boss damage, not the 1-damage miss', () => {
    expect(soundsFor({ type: 'bossDamaged', damage: 1, health: 29999 })).toEqual([]);
    expect(soundsFor({ type: 'bossDamaged', damage: 6000, health: 24000 })).toEqual(['pigeonHurt']);
  });

  it('plays go only when the countdown ends', () => {
    expect(soundsFor({ type: 'stageChanged', stage: 'RUNNER_1', previous: 'COUNTDOWN' })).toEqual(['go']);
    expect(soundsFor({ type: 'stageChanged', stage: 'BOSS', previous: 'RUNNER_2' })).toEqual([]);
  });

  it('picks music per stage group', () => {
    expect(musicFor('RUNNER_1')).toBe('runner');
    expect(musicFor('RUNNER_2')).toBe('runner');
    expect(musicFor('DIVE')).toBe('underwater');
    expect(musicFor('UNDERWATER')).toBe('underwater');
    expect(musicFor('BOSS')).toBe('boss');
    expect(musicFor('LOBBY')).toBe('lobby');
    expect(musicFor('COUNTDOWN')).toBeNull();
    expect(musicFor('FINISHED')).toBeNull();
    expect(musicFor('FAILED')).toBeNull();
  });

  it('ticks once per countdown number', () => {
    let last = 0;
    let ticks = 0;
    for (let t = 3; t > 0; t -= 1 / 60) {
      if (countdownTicked(last, t)) ticks++;
      last = t;
    }
    if (countdownTicked(last, 0)) ticks++;
    expect(ticks).toBe(3);
  });
});
