// Entry point (Tejas). Wires the game, the overlay screens, rooms and the dev shortcuts together.
//
// URLs:
//   /?room=QUAK         open the lobby with a room code filled in (invite links)
// Dev URLs:
//   /?phase=boss        jump straight into a stage (runner1, dive, swim, surface-return, runner2, boss)
//   /?short             runners and the swim at a fifth of their length
//   /?seed=42           solo practice on a specific course (rooms supply their own seed)

import './ui/ui.css';
import { Game } from './core/Game';
import { OfflineRoomService } from './network/offlineRoomService';
import { isSupabaseConfigured } from './network/supabase';
import { watchScoreboard } from './network/supabaseScoreboard';
import { createSupabaseRooms } from './network/supabaseRooms';
import type { RoomApi } from './network/types';
import { DEV_JUMPS, PHASES } from './phases/registry';
import { mountCountdown } from './ui/countdown';
import { mountHud } from './ui/hud';
import { mountLobby } from './ui/lobby';
import { mountResults } from './ui/results';
import { mountScoreboard } from './ui/scoreboard';

const params = new URLSearchParams(window.location.search);
const soloSeed = Number(params.get('seed')) || 20261017;

// Online rooms when client/.env.local has the Supabase keys; offline rooms without them, or with ?local.
const online = isSupabaseConfigured() && !params.has('local') ? createSupabaseRooms() : null;
const rooms: RoomApi = online ?? new OfflineRoomService();
let stopScoreboard: (() => void) | null = null;

const game = new Game({
  container: document.getElementById('game')!,
  identity: { roomId: 'solo', playerId: 'solo', seed: soloSeed },
  phases: PHASES,
});

const ui = document.getElementById('ui')!;
mountHud(ui, game);
mountCountdown(ui, game);
// Retry restarts only this player, on the same course, without waiting for the host (brief §7).
mountResults(ui, game, () => game.startAttempt());

const lobby = mountLobby(ui, {
  rooms,
  initialCode: params.get('room') ?? undefined,
  onSolo: () => {
    lobby.hide();
    game.setIdentity({ roomId: 'solo', playerId: 'solo', seed: soloSeed });
    game.startAttempt();
  },
  onRoomStart: (room, startAtEpochMs) => {
    lobby.hide();
    game.setIdentity({ roomId: room.code, playerId: room.playerId, seed: room.seed });
    // Convert the shared wall-clock start time into this tab's performance.now() clock.
    game.startAttempt({ countdownEndsAt: performance.now() + (startAtEpochMs - Date.now()) });

    if (online) {
      stopScoreboard?.();
      const board = mountScoreboard(ui, room.playerId);
      const stop = watchScoreboard(online, board.update);
      stopScoreboard = () => {
        stop();
        board.destroy();
      };
    }
  },
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
