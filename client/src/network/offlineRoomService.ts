// offline mode game room service
import type { AttemptProgress, AttemptResult, RoomSession } from './types'
import type {RoomService} from './roomService';

const OFFLINE_PLAYER_ID = 'offline-player';

export class OfflineRoomService implements RoomService {
  private session: RoomSession | null = null;
  private currentAttemptId: string | null = null;
  private latestProgress: AttemptProgress | null = null;
  private finalResult: AttemptResult | null = null;

  async joinRoom(roomCode: string, playerName: string): Promise<RoomSession> {
    // create the local session for offline mode 
    this.session = {
      roomId: roomCode,
      playerId: OFFLINE_PLAYER_ID,
      playerName: playerName,
      gameVersion: '1.0.0',
      seed: Math.floor(Math.random() * 1000000),
    }
    this.currentAttemptId = null;
    this.latestProgress = null;
    this.finalResult = null;
    
    return this.session;
  }


  async startAttempt(): Promise<{ attemptId: string }> {
    if (this.session === null) {
      throw new Error("No Session has been created. Please join a room first.");
    }
    // set the fields with nessessary values for the current attempt
    this.currentAttemptId = 'offline-' + crypto.randomUUID();
    this.latestProgress = null;
    this.finalResult = null; 

    return { attemptId: this.currentAttemptId };
  }

  async publishAttemptProgress(attemptProgress: AttemptProgress): Promise<void> {
    // Ignore stale updates and updates after this attempt has ended.
    if (this.currentAttemptId !== attemptProgress.attemptId || this.finalResult !== null) {
      return;
    }

    this.latestProgress = { ...attemptProgress };
  }

  async publishAttemptResult(attemptResult: AttemptResult): Promise<void> {
    // Ignore stale results and keep the first final result for this attempt.
    if (this.currentAttemptId !== attemptResult.attemptId || this.finalResult !== null) {
      return;
    }

    // Store a copy of the final result.
    this.finalResult = { ...attemptResult };
  }

  async dispose(): Promise<void> {
    this.session = null;
    this.currentAttemptId = null;
    this.latestProgress = null;
    this.finalResult = null;
  }
}
