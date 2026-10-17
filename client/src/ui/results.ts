// TEMPORARY results screen so retry works from hour 2. Rayyan replaces this file
// (latest attempt, personal best, room leaderboard). Keep the same mountResults() signature.

import type { Game } from '../core/Game';
import { el, formatTime, onButton } from './dom';

export function mountResults(root: HTMLElement, game: Game, onRetry: () => void): void {
  let bestMs: number | null = null;
  let panel: HTMLElement | null = null;

  game.onEvent((e) => {
    if (e.type !== 'stageChanged') return;
    panel?.remove();
    panel = null;
    if (e.stage !== 'FINISHED' && e.stage !== 'FAILED') return;

    const run = game.run;
    const finished = e.stage === 'FINISHED';
    if (finished && (bestMs === null || run.elapsedMs < bestMs)) bestMs = run.elapsedMs;

    const retry = el('button', { text: finished ? 'Play again' : 'Retry' });
    onButton(retry, onRetry);
    panel = el('div', { className: 'panel' }, [
      el('h1', { text: finished ? 'Made it!' : 'Failed' }),
      el('p', {
        text: finished
          ? `Time ${formatTime(run.elapsedMs)} · ${run.score} pts`
          : `Out of lives in ${run.phase} · ${formatTime(run.elapsedMs)}`,
      }),
      el('p', { className: 'muted', text: bestMs === null ? 'No completed run yet' : `Best ${formatTime(bestMs)}` }),
      retry,
    ]);
    root.appendChild(panel);
  });
}
