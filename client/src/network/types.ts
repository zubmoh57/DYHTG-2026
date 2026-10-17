// the final status of a game attempt
export type AttemptResultStatus = 'finished' | 'failed';

// the phases of the game
export type Phases = 'runner1' | 'underwater' | 'runner2' | 'boss'

// interface of the room session for multiplayer/singleplayer
export interface RoomSession {
  roomId: string;
  playerId: string;
  playerName: string;
  gameVersion: string;
  seed: number;
}

// interface for the attempt preogress data
export interface AttemptProgress {
  attemptId: string;
  phase: Phases;
  phaseProgress: number; // 0 - 1
  lives: number;
  oxygen: number;
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
