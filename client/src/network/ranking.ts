// Live scoreboard ranking (Mayank). Pure: players and attempts in, ordered rows out, so every rule
// is unit tested (tests/ranking.test.ts) and the UI just draws the result.
//
// Rules (TEAM_SPLIT):
//   1. Players with a completed run come first, fastest time on top; a higher score breaks a tie.
//   2. Everyone else is ranked by how far their latest attempt got: section first, then progress
//      through it. In the boss section, progress is the share of the boss's health removed.
//   3. A player is disconnected after 15 s without contact (heartbeat or attempt update).

import { CONFIG } from '../core/config';
import type { PhaseId } from '../core/types';

export const DISCONNECT_AFTER_MS = 15000;

/** Scoreboard sections in run order. */
export const SECTION_ORDER: readonly PhaseId[] = ['runner1', 'underwater', 'runner2', 'boss'];

export interface ScoreboardPlayer {
  userId: string;
  nickname: string;
  /** Server time of their last heartbeat. */
  lastSeenMs: number;
}

export interface ScoreboardAttempt {
  userId: string;
  status: 'running' | 'failed' | 'finished';
  phase: PhaseId;
  /** 0..1 through the current section. */
  phaseProgress: number;
  elapsedMs: number;
  score: number;
  bossHealth: number;
  /** Server times. createdMs orders a player's attempts; updatedMs counts as contact. */
  createdMs: number;
  updatedMs: number;
}

export type ScoreboardState = 'finished' | 'running' | 'failed' | 'waiting';

export interface ScoreboardEntry {
  rank: number;
  userId: string;
  nickname: string;
  /** finished = has a completed run (shown even while retrying); waiting = no attempt yet. */
  state: ScoreboardState;
  /** Best completed time, for finished players. */
  timeMs: number | null;
  score: number;
  /** The section of the attempt being shown (latest one, or the best completed one). */
  phase: PhaseId;
  /** 0..1 through that section. */
  progress: number;
  disconnected: boolean;
}

/** How far through its section an attempt is, 0..1. */
export function sectionProgress(attempt: Pick<ScoreboardAttempt, 'phase' | 'phaseProgress' | 'bossHealth'>): number {
  const raw =
    attempt.phase === 'boss' ? (CONFIG.boss.health - attempt.bossHealth) / CONFIG.boss.health : attempt.phaseProgress;
  return Math.min(1, Math.max(0, Number.isFinite(raw) ? raw : 0));
}

/** Fastest first; on equal times the higher score wins. */
const fasterRun = (a: ScoreboardAttempt, b: ScoreboardAttempt): number => a.elapsedMs - b.elapsedMs || b.score - a.score;

export function rankScoreboard(
  players: readonly ScoreboardPlayer[],
  attempts: readonly ScoreboardAttempt[],
  serverNowMs: number,
): ScoreboardEntry[] {
  const byUser = new Map<string, ScoreboardAttempt[]>();
  for (const a of attempts) {
    const list = byUser.get(a.userId);
    if (list) list.push(a);
    else byUser.set(a.userId, [a]);
  }

  const rows = players.map((player) => {
    const mine = byUser.get(player.userId) ?? [];
    const latest = mine.reduce<ScoreboardAttempt | null>((l, a) => (!l || a.createdMs > l.createdMs ? a : l), null);
    const best = mine
      .filter((a) => a.status === 'finished')
      .reduce<ScoreboardAttempt | null>((b, a) => (!b || fasterRun(a, b) < 0 ? a : b), null);
    const lastContact = Math.max(player.lastSeenMs, ...mine.map((a) => a.updatedMs));
    const shown = best ?? latest;
    const entry: ScoreboardEntry = {
      rank: 0,
      userId: player.userId,
      nickname: player.nickname,
      state: best ? 'finished' : latest ? latest.status : 'waiting',
      timeMs: best ? best.elapsedMs : null,
      score: shown?.score ?? 0,
      phase: shown?.phase ?? 'runner1',
      progress: shown ? sectionProgress(shown) : 0,
      disconnected: serverNowMs - lastContact > DISCONNECT_AFTER_MS,
    };
    return { entry, best, section: latest ? SECTION_ORDER.indexOf(latest.phase) : -1 };
  });

  rows.sort((a, b) => {
    if (a.best && b.best) return fasterRun(a.best, b.best) || a.entry.nickname.localeCompare(b.entry.nickname);
    if (a.best || b.best) return a.best ? -1 : 1;
    return (
      b.section - a.section ||
      b.entry.progress - a.entry.progress ||
      b.entry.score - a.entry.score ||
      a.entry.nickname.localeCompare(b.entry.nickname)
    );
  });

  return rows.map((r, i) => ({ ...r.entry, rank: i + 1 }));
}
