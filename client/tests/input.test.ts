import { describe, expect, it } from 'vitest';
import { InputState } from '../src/core/Input';

describe('InputState (brief §3)', () => {
  it('reports A/D only in lanes mode and Space only in timing mode', () => {
    const input = new InputState();
    input.setMode('lanes');
    input.keyDown('KeyA', false);
    input.keyDown('Space', false);
    let s = input.beginFrame();
    expect(s.leftPressed).toBe(true);
    expect(s.spacePressed).toBe(false);

    input.setMode('timing');
    input.keyUp('Space');
    input.keyDown('Space', false);
    input.keyDown('KeyD', false);
    s = input.beginFrame();
    expect(s.spacePressed).toBe(true);
    expect(s.rightPressed).toBe(false);
  });

  it('never reports anything in none mode', () => {
    const input = new InputState();
    input.keyDown('KeyA', false);
    input.keyDown('KeyD', false);
    input.keyDown('Space', false);
    const s = input.beginFrame();
    expect(s.leftPressed || s.rightPressed || s.spacePressed).toBe(false);
  });

  it('consumes a press once and ignores key repeat', () => {
    const input = new InputState();
    input.setMode('lanes');
    input.keyDown('KeyA', false);
    expect(input.beginFrame().leftPressed).toBe(true);
    input.keyDown('KeyA', true); // auto-repeat while held
    expect(input.beginFrame().leftPressed).toBe(false);
    input.keyUp('KeyA');
    input.keyDown('KeyA', false);
    expect(input.beginFrame().leftPressed).toBe(true);
  });

  it('drops unconsumed presses when the mode changes', () => {
    const input = new InputState();
    input.setMode('timing');
    input.keyDown('Space', false);
    input.setMode('lanes');
    input.setMode('timing');
    expect(input.beginFrame().spacePressed).toBe(false);
  });

  it('tracks Space held across modes, for the boss "held at entry" rule', () => {
    const input = new InputState();
    input.setMode('lanes');
    input.keyDown('Space', false);
    input.beginFrame();
    input.setMode('timing');
    const s = input.beginFrame();
    expect(s.spaceHeld).toBe(true);
    expect(s.spacePressed).toBe(false); // holding is not a fresh press
  });

  it('forgets everything when the window loses focus', () => {
    const input = new InputState();
    input.setMode('timing');
    input.keyDown('Space', false);
    input.clear();
    const s = input.beginFrame();
    expect(s.spaceHeld).toBe(false);
    expect(s.spacePressed).toBe(false);
  });

  it('ignores keys that are not A, D or Space', () => {
    const input = new InputState();
    expect(input.keyDown('KeyW', false)).toBe(false);
    expect(input.keyDown('KeyA', false)).toBe(true);
  });
});
