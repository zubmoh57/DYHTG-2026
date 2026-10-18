// Entry point (Tejas). Wires the game, the overlay screens, rooms and the dev shortcuts together.
//
// URLs:
//   /?room=QUAK         the join screen for room QUAK (what the lobby's QR code opens)
// Dev URLs (?phase and ?short only work in `npm run dev`, never in a production build):
//   /?phase=boss        jump straight into a stage (runner1, dive, swim, surface-return, runner2, boss)
//   /?short             runners and the swim at a fifth of their length
//   /?seed=42           solo practice on a specific course (rooms supply their own seed)
//   /?touch             show the phone controls on a laptop
//   /?local             force the offline test rooms even with Supabase keys

import './ui/ui.css';
import './ui/stageInstructions.css';
import { mountAudio } from './audio';
import { CONFIG } from './core/config';
import { Game } from './core/Game';
import { raceScore } from './core/RunState';
import type { RunState } from './core/types';
import { OfflineRoomService } from './network/offlineRoomService';
import { isSupabaseConfigured } from './network/supabase';
import { createSupabaseRooms } from './network/supabaseRooms';
import type { RoomApi, RoomInfo, RunUpdate } from './network/types';
import { DEV_JUMPS, PHASES, ROOM_PHASES } from './phases/registry';
import { mountCountdown } from './ui/countdown';
import { mountEndings } from './ui/endings';
import { mountHud } from './ui/hud';
import { INTRO_SEC, playIntro } from './ui/intro';
import { mountLobby } from './ui/lobby';
import { mountRaceResults } from './ui/raceResults';
import { mountResults } from './ui/results';
import { mountScoreboard } from './ui/scoreboard';
import { mountStadium } from './ui/stadium';
import { mountStageInstructions } from './ui/stageInstructions';
import { mountTouchControls } from './ui/touchControls';
import { lockZoom } from './ui/zoomLock';

const params = new URLSearchParams(window.location.search);
const soloSeed = Number(params.get('seed')) || 20261017;
/** How often a racing player's progress is sent to the room. */
const PUBLISH_EVERY_MS = 500;

// Online rooms when client/.env.local has the Supabase keys; offline rooms without them, or with ?local.
const online = isSupabaseConfigured() && !params.has('local') ? createSupabaseRooms() : null;
const rooms: RoomApi = online ?? new OfflineRoomService();

const game = new Game({
  container: document.getElementById('game')!,
  identity: { roomId: 'solo', playerId: 'solo', seed: soloSeed },
  phases: PHASES,
});

const ui = document.getElementById('ui')!;
mountHud(ui, game);
mountCountdown(ui, game);
mountStageInstructions(ui, game);
mountTouchControls(ui, game);
lockZoom(); // no double-tap or pinch zoom on phones
const audio = mountAudio(ui, game);
mountEndings(ui, game, audio);
// Retry restarts only this player, on the same course, without waiting for the host (brief §7).
// No 3-2-1 anywhere: the story intro is the build-up, and a retry drops you straight back in.
const runNow = () => game.startAttempt({ countdownEndsAt: performance.now() });

// --- Room races --------------------------------------------------------------------------------

/** The room race being played right now, or null (solo, or in the lobby). */
let race: RoomInfo | null = null;
let stopLiveBoard: (() => void) | null = null;

const runUpdate = (run: Readonly<RunState>): RunUpdate | null => {
  if (run.status === 'waiting') return null;
  return {
    attemptId: run.attemptId,
    status: run.status,
    phase: run.phase,
    phaseProgress: run.phaseLength > 0 ? run.phaseDistance / run.phaseLength : 0,
    lives: run.lives,
    score: raceScore(run),
    bossHealth: run.bossHealth,
    elapsedMs: run.elapsedMs,
  };
};

// Progress a couple of times a second while racing, and the final result the moment the run ends.
let lastPublish = 0;
game.onFrame(({ run }) => {
  if (!race || run.status !== 'running') return;
  const now = performance.now();
  if (now - lastPublish < PUBLISH_EVERY_MS) return;
  lastPublish = now;
  const update = runUpdate(run);
  if (update) rooms.publishRun(update);
});
game.onEvent((e) => {
  if (!race || e.type !== 'stageChanged' || (e.stage !== 'FINISHED' && e.stage !== 'FAILED')) return;
  const update = runUpdate(game.run);
  if (update) rooms.publishRun(update);
});

/** Race over for this player: back to the pond lobby. The host reopens the room for the next race. */
const backToPond = () => {
  race = null;
  stopLiveBoard?.();
  stopLiveBoard = null;
  stadium.hide();
  game.toLobby();
  lobby.show();
  if (lobby.room()?.isHost) {
    rooms.reopenRoom().catch((e) => console.warn('[rooms] could not reopen the room', e));
  }
};

mountResults(ui, game, {
  onRetry: runNow,
  onMenu: () => {
    game.toLobby();
    lobby.show();
  },
  inRace: () => race !== null,
});
mountRaceResults(ui, game, { rooms, race: () => race, onBack: backToPond });
// Big-screen mode: the projector laptop shows the race live and the podium (it doesn't play).
const stadium = mountStadium(ui, rooms, () => backToPond());

const lobby = mountLobby(ui, {
  rooms,
  initialCode: params.get('room') ?? undefined,
  footer: audio.volumeControl,
  onSolo: () => {
    lobby.hide();
    // The story first (Vansh), then Bill starts running. Skip, A or D gets you there sooner.
    game.setIdentity({ roomId: 'solo', playerId: 'solo', seed: soloSeed });
    game.setPhases(PHASES);
    playIntro(ui, audio, runNow);
  },
  onRoomStart: (room, startAtEpochMs) => {
    lobby.hide();
    // Every screen in the room watches the story together first (Vansh): it plays on a shared clock
    // that ends 3 s before the race, then everyone gets the same 3-2-1 and starts together.
    const storyStart = performance.now() + (startAtEpochMs - Date.now());
    const startsAt = storyStart + INTRO_SEC * 1000;
    playIntro(ui, audio, () => {}, { endsAt: startsAt - CONFIG.flow.countdownSec * 1000 });
    if (lobby.bigScreen()) {
      // This screen watches: the same shared start, shown as a 3-2-1 over the live track.
      if (game.stage !== 'LOBBY') game.toLobby();
      stadium.start(room, startsAt);
      return;
    }
    race = room;
    lastPublish = 0;
    if (game.run.status === 'running' || game.stage === 'COUNTDOWN') game.toLobby(); // a straggler from the last race
    game.setIdentity({ roomId: room.code, playerId: room.playerId, seed: room.seed });
    game.setPhases(ROOM_PHASES); // a sprint, the same for everyone in the room
    game.startAttempt({ countdownEndsAt: startsAt });

    // The live board in the corner while racing (both online and test rooms).
    stopLiveBoard?.();
    const board = mountScoreboard(ui, room.playerId);
    const stop = rooms.onStandings(board.update);
    stopLiveBoard = () => {
      stop();
      board.destroy();
    };
  },
});

game.start();

// Dev only: in a production build players can't skip stages from the URL.
const jump = import.meta.env.DEV ? params.get('phase') : null;
if (jump && DEV_JUMPS[jump]) {
  lobby.hide();
  game.startAttempt({ jumpTo: DEV_JUMPS[jump] });
}

if (import.meta.env.DEV) {
  // Poke at the game from the browser console: __game.run, __game.stage
  (window as unknown as { __game: Game }).__game = game;
}
