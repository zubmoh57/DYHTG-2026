// Online rooms (Mayank): the real backend behind the same RoomApi as localRooms.ts, so the lobby
// doesn't change. Rooms, players and the shared start live in Supabase (supabase/migrations).
//
// How it stays in sync:
//   * create/join/start/leave go through the database functions, never direct table writes.
//   * Realtime tells us when room_players or rooms change; we then re-read both tables.
//   * A heartbeat every 5 s marks us as present, keeps the server clock offset fresh, and
//     re-reads the room too (Realtime can't filter delete events, so leaves are caught here).
//   * The start time comes from the server and is converted to this tab's Date.now() time.

import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { CONFIG } from '../core/config';
import { cleanNickname } from './localRooms';
import { createServerClock, type ServerClock } from './serverClock';
import { ensureSignedIn, getSupabase } from './supabase';
import type { RoomApi, RoomInfo, RoomPlayer } from './types';

const HEARTBEAT_MS = 5000;
/** Realtime often sends several changes at once (e.g. a host handover); re-read once for all of them. */
const REFRESH_DEBOUNCE_MS = 150;
const CODE_PATTERN = /^[A-HJ-NP-Z]{4}$/;

/** The error codes raised by the database functions, as messages the lobby can show as-is. */
const ERROR_MESSAGES: Record<string, string> = {
  not_signed_in: 'You are not signed in. Refresh the page and try again.',
  invalid_nickname: 'Nicknames can use letters, numbers, spaces and _ . - (1 to 16 characters).',
  nickname_taken: 'Someone in this room already has that nickname. Pick another one.',
  room_not_found: 'No room with that code. Check the code with your host.',
  room_already_started: 'That room has already started. Ask the host to start a new challenge.',
  room_full: 'That room is full (20 players).',
  not_host: 'Only the host can start.',
  rate_limited: 'Too many tries. Wait a minute and try again.',
  could_not_create_room: 'Could not make a room code. Try again.',
};

/** Turns a Supabase error into a readable Error. Unknown errors are logged and shown generically. */
export function readableError(error: unknown): Error {
  const message =
    typeof error === 'object' && error !== null && 'message' in error ? String(error.message) : String(error);
  for (const [code, text] of Object.entries(ERROR_MESSAGES)) {
    if (message.includes(code)) return new Error(text);
  }
  console.error('[rooms]', error);
  return new Error('Could not reach the game server. Check your connection and try again.');
}

/** What create_room, join_room and start_room return (private.room_json in the migration). */
interface RoomRow {
  room_id: string;
  code: string;
  seed: number;
  is_host: boolean;
  status: 'waiting' | 'started';
  start_at_ms: number | null;
  server_now_ms: number;
}

/** PostgREST timestamps have microseconds; keep milliseconds so every browser can parse them. */
export function parseTimestamp(value: string): number {
  return Date.parse(value.replace(/(\.\d{3})\d+/, '$1'));
}

export interface OnlineRoomApi extends RoomApi {
  readonly mode: 'online';
  /** The database id of the room we're in (attempts and the scoreboard use it), or null. */
  roomId(): string | null;
  /** Server time, for comparing against server timestamps such as last_seen_at. */
  readonly clock: ServerClock;
  readonly supabase: SupabaseClient;
}

interface CurrentRoom {
  roomId: string;
  info: RoomInfo;
}

export function createSupabaseRooms(supabase: SupabaseClient = getSupabase()): OnlineRoomApi {
  const clock = createServerClock();
  const playerListeners = new Set<(players: RoomPlayer[]) => void>();
  const startListeners = new Set<(startAt: number) => void>();

  let current: CurrentRoom | null = null;
  let channel: RealtimeChannel | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let refreshTimer: ReturnType<typeof setTimeout> | null = null;
  let players: RoomPlayer[] = [];
  let playersKey = '';
  /** The start time already handed to the lobby, in Date.now() time. Only one start per room. */
  let startAt: number | null = null;

  /** Calls a database function and records the server time it returns. */
  const call = async <T>(fn: string, args?: Record<string, unknown>): Promise<T> => {
    const sentAt = Date.now();
    const { data, error } = await supabase.rpc(fn, args);
    const receivedAt = Date.now();
    if (error) throw readableError(error);
    const serverNow = typeof data === 'number' ? data : (data as { server_now_ms?: unknown } | null)?.server_now_ms;
    if (typeof serverNow === 'number') clock.sample(sentAt, receivedAt, serverNow);
    return data as T;
  };

  const setPlayers = (list: RoomPlayer[]) => {
    const key = JSON.stringify(list);
    if (key === playersKey) return;
    players = list;
    playersKey = key;
    playerListeners.forEach((l) => l(list));
  };

  /**
   * Hand the shared start to the lobby, once. Rejoining a room that started a while ago (a page
   * refresh mid-race) gets a fresh countdown instead of a start time in the past.
   */
  const announceStart = (serverStartMs: number) => {
    if (startAt !== null) return;
    const local = clock.toLocal(serverStartMs);
    startAt = local > Date.now() ? local : Date.now() + CONFIG.flow.countdownSec * 1000;
    const at = startAt;
    startListeners.forEach((l) => l(at));
  };

  /** Re-read the player list, the host and the start time. Offline? Keep the last list and retry later. */
  const refresh = async () => {
    const room = current;
    if (!room) return;
    const [playerRows, roomRow] = await Promise.all([
      supabase
        .from('room_players')
        .select('user_id, nickname')
        .eq('room_id', room.roomId)
        .order('joined_at')
        .order('user_id'),
      supabase.from('rooms').select('host_id, status, start_at').eq('id', room.roomId).maybeSingle(),
    ]);
    if (room !== current || playerRows.error || roomRow.error || !roomRow.data) return;

    const hostId = roomRow.data.host_id as string;
    // A leaving host hands over to the next player; keep isHost honest for startRoom().
    room.info.isHost = hostId === room.info.playerId;
    setPlayers(
      (playerRows.data as { user_id: string; nickname: string }[]).map((p) => ({
        id: p.user_id,
        nickname: p.nickname,
        isHost: p.user_id === hostId,
      })),
    );
    if (roomRow.data.status === 'started' && roomRow.data.start_at) {
      announceStart(parseTimestamp(roomRow.data.start_at as string));
    }
  };

  const scheduleRefresh = () => {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      refreshTimer = null;
      void refresh();
    }, REFRESH_DEBOUNCE_MS);
  };

  const beat = async () => {
    const room = current;
    if (!room) return;
    try {
      await call<number>('heartbeat', { p_room_id: room.roomId });
    } catch {
      // Offline for a moment: the next beat tries again. Other players see us as disconnected after 15 s.
    }
    await refresh();
  };

  /** Stop listening to the current room. Doesn't tell the server (leaveRoom() does that). */
  const teardown = () => {
    if (heartbeat) clearInterval(heartbeat);
    if (refreshTimer) clearTimeout(refreshTimer);
    if (channel) void supabase.removeChannel(channel);
    heartbeat = null;
    refreshTimer = null;
    channel = null;
    current = null;
    startAt = null;
    setPlayers([]);
  };

  const enter = async (row: RoomRow, playerId: string): Promise<RoomInfo> => {
    teardown();
    const room: CurrentRoom = {
      roomId: row.room_id,
      info: { code: row.code, seed: row.seed, playerId, isHost: row.is_host },
    };
    current = room;

    channel = supabase
      .channel(`room:${room.roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_players', filter: `room_id=eq.${room.roomId}` }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${room.roomId}` }, scheduleRefresh)
      // Anything that changed between our first read and the subscription going live.
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') scheduleRefresh();
      });
    heartbeat = setInterval(() => void beat(), HEARTBEAT_MS);

    await refresh();
    if (row.status === 'started' && row.start_at_ms !== null) announceStart(row.start_at_ms);
    return room.info;
  };

  const api: OnlineRoomApi = {
    mode: 'online',
    clock,
    supabase,

    roomId: () => current?.roomId ?? null,

    async createRoom(nickname) {
      const name = cleanNickname(nickname);
      const playerId = await ensureSignedIn(supabase);
      const row = await call<RoomRow>('create_room', { p_nickname: name });
      return enter(row, playerId);
    },

    async joinRoom(rawCode, nickname) {
      const name = cleanNickname(nickname);
      const code = rawCode.trim().toUpperCase();
      const notFound = new Error(`No room called ${code || '(blank)'}. Check the code with your host.`);
      if (!CODE_PATTERN.test(code)) throw notFound;
      const playerId = await ensureSignedIn(supabase);
      const row = await call<RoomRow | { error: string }>('join_room', { p_code: code, p_nickname: name });
      // A wrong code is returned, not raised, so the server's rate limit still counts it.
      if ('error' in row) throw notFound;
      return enter(row, playerId);
    },

    onPlayersChanged(listener) {
      playerListeners.add(listener);
      listener(players);
      return () => playerListeners.delete(listener);
    },

    async startRoom() {
      const room = current;
      if (!room) throw new Error('You are not in a room.');
      if (!room.info.isHost) throw new Error('Only the host can start.');
      const row = await call<RoomRow | null>('start_room', {
        p_room_id: room.roomId,
        p_delay_ms: CONFIG.flow.countdownSec * 1000,
      });
      // Realtime announces it too, if this reply is lost.
      if (room === current && typeof row?.start_at_ms === 'number') announceStart(row.start_at_ms);
    },

    onStart(listener) {
      startListeners.add(listener);
      // Rejoining an already-started room announces the start before the lobby has subscribed.
      const at = startAt;
      if (at !== null) queueMicrotask(() => listener(at > Date.now() ? at : Date.now() + CONFIG.flow.countdownSec * 1000));
      return () => startListeners.delete(listener);
    },

    async leaveRoom() {
      const room = current;
      if (!room) return;
      teardown();
      try {
        // Before the start this removes us (and hands over host); after it, the server keeps us for results.
        await call<void>('leave_room', { p_room_id: room.roomId });
      } catch {
        // The page may be closing; the server treats a silent player as disconnected anyway.
      }
    },
  };

  return api;
}
