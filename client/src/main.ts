// Entry point (Tejas). Wires the game, the overlay screens and the dev shortcuts together.
//
// Dev URLs:
//   /?phase=boss        jump straight into a stage (runner1, sub-entry, underwater, surface-return, runner2, boss)
//   /?seed=42           play a specific course (rooms will supply the seed later)

import './ui/ui.css';
import { Game } from './core/Game';
import { DEV_JUMPS, PHASES } from './phases/registry';
import { mountCountdown } from './ui/countdown';
import { mountHud } from './ui/hud';
import { mountLobby } from './ui/lobby';
import { mountResults } from './ui/results';

const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed')) || 20261017;

const game = new Game({
  container: document.getElementById('game')!,
  identity: { roomId: 'local', playerId: 'local', seed },
  phases: PHASES,
});

const ui = document.getElementById('ui')!;
mountHud(ui, game);
mountCountdown(ui, game);
mountResults(ui, game, () => game.startAttempt());
const lobby = mountLobby(ui, () => {
  lobby.hide();
  game.startAttempt();
});

game.start();

const jump = params.get('phase');
if (jump && DEV_JUMPS[jump]) {
  lobby.hide();
  game.startAttempt({ jumpTo: DEV_JUMPS[jump] });
}

if (import.meta.env.DEV) {
  // Poke at the game from the browser console: __game.run, __game.stage
  (window as unknown as { __game: Game }).__game = game;
}
