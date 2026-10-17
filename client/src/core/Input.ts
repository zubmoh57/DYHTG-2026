// Central input routing (brief §3). The only place that listens to the keyboard.
// Phases never add their own key listeners: they read ctx.input, which is already filtered by mode.

import type { InputMode, InputSnapshot } from './types';

type GameKey = 'left' | 'right' | 'space';

const KEY_CODES: Record<string, GameKey> = {
  KeyA: 'left',
  KeyD: 'right',
  Space: 'space',
};

const EMPTY: InputSnapshot = Object.freeze({
  leftPressed: false,
  rightPressed: false,
  spacePressed: false,
  spaceHeld: false,
});

/** Keyboard state with no DOM in it, so it can be unit tested. */
export class InputState {
  private mode: InputMode = 'none';
  private held = new Set<GameKey>();
  private pressed = new Set<GameKey>();
  private current: InputSnapshot = EMPTY;

  getMode(): InputMode {
    return this.mode;
  }

  /** Menu-only Space edge: consume before beginFrame(), without enabling gameplay inputs. */
  consumeContinuePress(): boolean {
    return this.mode === 'none' && this.pressed.delete('space');
  }

  /** Changing mode drops any press not yet consumed, so it can't leak into the next phase. */
  setMode(mode: InputMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.pressed.clear();
    this.current = { ...EMPTY, spaceHeld: this.held.has('space') };
  }

  /** Returns true if the key is one of ours, so the caller can stop the browser default. */
  keyDown(code: string, repeat: boolean): boolean {
    const key = KEY_CODES[code];
    if (!key) return false;
    if (!repeat && !this.held.has(key)) this.pressed.add(key);
    this.held.add(key);
    return true;
  }

  keyUp(code: string): boolean {
    const key = KEY_CODES[code];
    if (!key) return false;
    this.held.delete(key);
    return true;
  }

  /** Window lost focus: forget everything, so no key is stuck down when the player comes back. */
  clear(): void {
    this.held.clear();
    this.pressed.clear();
    this.current = EMPTY;
  }

  /** Called once per frame by the game loop. Presses are consumed here. */
  beginFrame(): InputSnapshot {
    const lanes = this.mode === 'lanes';
    const timing = this.mode === 'timing';
    this.current = {
      leftPressed: lanes && this.pressed.has('left'),
      rightPressed: lanes && this.pressed.has('right'),
      spacePressed: timing && this.pressed.has('space'),
      spaceHeld: this.held.has('space'),
    };
    this.pressed.clear();
    return this.current;
  }

  get snapshot(): InputSnapshot {
    return this.current;
  }
}

/** Wires the real keyboard to an InputState. Returns a function that removes the listeners. */
export function attachKeyboard(input: InputState, target: Window = window): () => void {
  const typingInField = (e: KeyboardEvent): boolean => {
    const el = e.target as HTMLElement | null;
    return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
  };

  const onDown = (e: KeyboardEvent): void => {
    if (typingInField(e)) return; // let people type nicknames with A, D and spaces
    // Ignore Ctrl+R, Cmd+D etc. so browser shortcuts still work and don't count as moves.
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (input.keyDown(e.code, e.repeat) && e.code === 'Space') e.preventDefault(); // no page scroll
  };
  const onUp = (e: KeyboardEvent): void => {
    input.keyUp(e.code);
  };
  const onBlur = (): void => input.clear();

  target.addEventListener('keydown', onDown);
  target.addEventListener('keyup', onUp);
  target.addEventListener('blur', onBlur);
  return () => {
    target.removeEventListener('keydown', onDown);
    target.removeEventListener('keyup', onUp);
    target.removeEventListener('blur', onBlur);
  };
}
