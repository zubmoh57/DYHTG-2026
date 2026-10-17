import type { PhaseId } from '../core/types';

// the final status of a game attempt
export type AttemptResultStatus = 'finished' | 'failed';

// interface for the attempt preogress data
export interface AttemptProgress {
  attemptId: string;
  phase: PhaseId;
  phaseProgress: number; // 0 - 1
  lives: number;
  coins: number;
  score: number;
  bossHealth: number;
  elapsedMs: number;
}

// interface for the attempt result data
export interface AttemptResult {
  attemptId: string;
  status: AttemptResultStatus;
  score: number;
  elapsedMs: number;
}

// DRAFT room contract (Mayank + Rayyan own network/; Tejas's lobby UI calls this).
// Agree changes together. The lobby only ever talks to a RoomApi, so swapping the local test
// version for the Supabase one is a one-line change in main.ts.

export interface RoomPlayer {
  id: string;
  nickname: string;
  isHost: boolean;
}

export interface RoomInfo {
  /** Short code people type to join, e.g. "QUAK". */
  code: string;
  /** Everyone in the room plays the same course from this seed (brief §9). */
  seed: number;
  playerId: string;
  isHost: boolean;
}

export interface RoomApi {
  /** 'local' = test rooms shared between tabs of one browser. 'online' = the real backend. */
  readonly mode: 'local' | 'online';
  /** Rejects with a readable Error message the lobby can show as-is. */
  createRoom(nickname: string): Promise<RoomInfo>;
  joinRoom(code: string, nickname: string): Promise<RoomInfo>;
  /** Called at once with the current list, then on every change. Returns an unsubscribe function. */
  onPlayersChanged(listener: (players: RoomPlayer[]) => void): () => void;
  /** Host only: schedules the shared start a few seconds ahead. */
  startRoom(): Promise<void>;
  /** Fires when the host starts. `startAtEpochMs` is when everyone's countdown ends (Date.now() time). */
  onStart(listener: (startAtEpochMs: number) => void): () => void;
  leaveRoom(): Promise<void>;
}
