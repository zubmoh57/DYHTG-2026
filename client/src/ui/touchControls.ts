// Phone controls (Tejas): ◀ ▶ while dodging, a scope button while firing. They press the same keys
// as the keyboard (A, D, SPACE) through the game's InputState, so the two-control rule and the input
// modes work exactly as on a laptop: only the buttons for the current mode are shown.
// Shown on touch screens, or anywhere with ?touch.

import type { Game } from '../core/Game';
import type { InputMode, Stage } from '../core/types';
import { el } from './dom';

const IN_RUN: ReadonlySet<Stage> = new Set(['RUNNER_1', 'DIVE', 'UNDERWATER', 'SURFACE_RETURN', 'RUNNER_2', 'BOSS']);

const SCOPE = `<svg viewBox="-50 -50 100 100" aria-hidden="true" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round">
  <circle r="34"/><circle r="10" fill="#fff" stroke="none"/>
  <line x1="0" y1="-46" x2="0" y2="-22"/><line x1="0" y1="22" x2="0" y2="46"/>
  <line x1="-46" y1="0" x2="-22" y2="0"/><line x1="22" y1="0" x2="46" y2="0"/></svg>`;

export function usesTouch(): boolean {
  if (new URLSearchParams(window.location.search).has('touch')) return true;
  return matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0 && matchMedia('(hover: none)').matches;
}

export function mountTouchControls(root: HTMLElement, game: Game): void {
  if (!usesTouch()) return;
  document.body.classList.add('touch');

  const button = (className: string, keyCode: string, label: string) => {
    const b = el('div', { className: `touch-btn ${className}` });
    b.innerHTML = label;
    b.setAttribute('role', 'button');
    let pointer: number | null = null;
    const release = () => {
      if (pointer === null) return;
      pointer = null;
      b.classList.remove('down');
      game.input.keyUp(keyCode);
    };
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (pointer !== null) return;
      pointer = e.pointerId;
      b.classList.add('down');
      game.input.keyDown(keyCode, false);
      navigator.vibrate?.(8);
      try {
        b.setPointerCapture(e.pointerId); // the press ends where the thumb lifts, even off the button
      } catch {
        // pointer already gone
      }
    });
    b.addEventListener('pointerup', release);
    b.addEventListener('pointercancel', release);
    b.addEventListener('lostpointercapture', release);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    return b;
  };

  const left = button('left', 'KeyA', '◀');
  const right = button('right', 'KeyD', '▶');
  const fire = button('fire', 'Space', SCOPE);
  const pad = el('div', { className: 'touch-controls' }, [left, right, fire]);

  let shownFor: string | null = null;
  game.onFrame(({ run, inputMode, waitingForInstructions }) => {
    const inRun = IN_RUN.has(run.stage);
    if (inRun !== pad.isConnected) {
      if (inRun) root.appendChild(pad);
      else pad.remove();
    }
    const key = `${inRun}:${inputMode}:${waitingForInstructions}`;
    if (key === shownFor) return;
    shownFor = key;
    const mode: InputMode = inRun ? inputMode : 'none';
    // Lanes buttons stay visible (dimmed) between lane sections so thumbs know where they are.
    left.classList.toggle('hidden', mode === 'timing' || waitingForInstructions);
    right.classList.toggle('hidden', mode === 'timing' || waitingForInstructions);
    // The same Space button acknowledges the instructions before gameplay starts.
    fire.innerHTML = waitingForInstructions ? 'Continue' : SCOPE;
    fire.classList.toggle('hidden', mode !== 'timing' && !waitingForInstructions);
  });
}
