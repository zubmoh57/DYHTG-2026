// In-run HUD (Tejas): lives, oxygen, score, timer, boss health and which keys work right now.
// Functional first; Vansh restyles it later through ui.css.

import type { Game } from '../core/Game';
import { CONFIG } from '../core/config';
import type { InputMode, Stage } from '../core/types';
import { el, formatTime } from './dom';

const IN_RUN: ReadonlySet<Stage> = new Set([
  'RUNNER_1',
  'SUB_ENTRY',
  'UNDERWATER',
  'SURFACE_RETURN',
  'RUNNER_2',
  'BOSS',
]);

const KEY_HINT: Record<InputMode, string> = {
  none: '',
  lanes: 'A ◀   ▶ D',
  timing: 'SPACE',
};

export function mountHud(root: HTMLElement, game: Game): void {
  const lives = el('div');
  const oxygen = el('div');
  const stage = el('div', { className: 'stage' });
  const time = el('div');
  const score = el('div');
  const bossFill = el('div', { className: 'boss-fill' });
  const boss = el('div', { className: 'boss' }, [el('div', { className: 'boss-bar' }, [bossFill])]);
  const hud = el('div', { className: 'hud' }, [
    el('div', {}, [lives, oxygen, stage]),
    el('div', {}, [time, score]),
    boss,
  ]);
  const keys = el('div', { className: 'keys' });

  // Only touch the DOM when a value actually changes.
  const set = (node: HTMLElement, text: string) => {
    if (node.textContent !== text) node.textContent = text;
  };

  game.onFrame(({ run, inputMode }) => {
    const visible = IN_RUN.has(run.stage);
    if (visible !== hud.isConnected) {
      if (visible) root.append(hud, keys);
      else {
        hud.remove();
        keys.remove();
      }
    }
    if (!visible) return;

    set(lives, '❤️'.repeat(run.lives));
    set(oxygen, run.stage === 'UNDERWATER' ? '🫧'.repeat(run.oxygen) : '');
    set(stage, run.stage);
    set(time, formatTime(run.elapsedMs));
    set(score, `${run.score} pts`);
    set(keys, KEY_HINT[inputMode]);
    boss.style.display = run.stage === 'BOSS' ? '' : 'none';
    bossFill.style.width = `${(100 * run.bossHealth) / CONFIG.boss.health}%`;
  });
}
