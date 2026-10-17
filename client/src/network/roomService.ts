// an interface that describes the type of fucntion that is used to send a message to the server

import type { AttemptProgress, AttemptResult, RoomSession } from './types'

export interface RoomService {
  // fucntions to implement (like an interface in java)

  joinRoom(roomCode: string, playerName: string): Promise<RoomSession>

  // fucntion to start an attempt in the room
  startAttempt(): Promise<{ attemptId: string }>

  publishAttemptProgress(attemptProgress: AttemptProgress): Promise<void>

  publishAttemptResult(attemptResult: AttemptResult): Promise<void>

  dispose(): Promise<void>
}
