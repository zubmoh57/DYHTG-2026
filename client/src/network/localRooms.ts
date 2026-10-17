// TEMPORARY local test rooms (written by Tejas so the lobby isn't blocked; Rayyan owns network/).
// Rooms live in localStorage, so two tabs of the SAME browser can create, join and start together.
// It is not a real backend: other devices can't see these rooms, and the UI says so (brief §12).

import { CONFIG } from '../core/config';
import { newRoomSeed } from '../core/seededRandom';
import type { RoomApi, RoomInfo, RoomPlayer } from './types';

export interface StoredRoom {
  code: string;
  seed: number;
  hostId: string;
  players: { id: string; nickname: string }[];
  /** Date.now() time the shared countdown ends, once the host has started. */
  startAt: number | null;
}

/** Where rooms are kept. Swappable so tests can run without a browser. */
export interface RoomStore {
  read(code: string): StoredRoom | null;
  write(room: StoredRoom): void;
  remove(code: string): void;
  /** Called when ANOTHER tab changes a room. */
  subscribe(listener: (code: string) => void): () => void;
}

const KEY_PREFIX = 'duck-run-room:';
const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I or O, they look like 1 and 0
const MAX_PLAYERS = 8;

export function browserRoomStore(): RoomStore {
  return {
    read(code) {
      try {
        const raw = localStorage.getItem(KEY_PREFIX + code);
        return raw ? (JSON.parse(raw) as StoredRoom) : null;
      } catch {
        return null;
      }
    },
    write(room) {
      localStorage.setItem(KEY_PREFIX + room.code, JSON.stringify(room));
    },
    remove(code) {
      localStorage.removeItem(KEY_PREFIX + code);
    },
    subscribe(listener) {
      const onStorage = (e: StorageEvent) => {
        if (e.key?.startsWith(KEY_PREFIX)) listener(e.key.slice(KEY_PREFIX.length));
      };
      window.addEventListener('storage', onStorage);
      return () => window.removeEventListener('storage', onStorage);
    },
  };
}

/** An in-memory store. Several RoomApis sharing one store behave like several tabs. */
export function memoryRoomStore(): RoomStore {
  const rooms = new Map<string, string>();
  const listeners = new Set<(code: string) => void>();
  return {
    read: (code) => {
      const raw = rooms.get(code);
      return raw ? (JSON.parse(raw) as StoredRoom) : null;
    },
    write: (room) => {
      rooms.set(room.code, JSON.stringify(room));
      listeners.forEach((l) => l(room.code));
    },
    remove: (code) => {
      rooms.delete(code);
      listeners.forEach((l) => l(code));
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

const randomId = (): string => globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);

export function cleanNickname(nickname: string): string {
  const name = nickname.trim().replace(/\s+/g, ' ');
  if (name.length < 1 || name.length > 16) throw new Error('Pick a nickname of 1 to 16 characters.');
  return name;
}

export interface LocalRoomApi extends RoomApi {
  dispose(): Promise<void>;
}

export function createLocalRooms(store: RoomStore = browserRoomStore()): LocalRoomApi {
  let info: RoomInfo | null = null;
  let lastStartAt: number | null = null;
  const playerListeners = new Set<(players: RoomPlayer[]) => void>();
  const startListeners = new Set<(startAt: number) => void>();

  const players = (room: StoredRoom | null): RoomPlayer[] =>
    room ? room.players.map((p) => ({ id: p.id, nickname: p.nickname, isHost: p.id === room.hostId })) : [];

  /** Re-read my room and tell the lobby what changed. */
  const refresh = () => {
    if (!info) return;
    const room = store.read(info.code);
    const list = players(room);
    playerListeners.forEach((l) => l(list));
    if (room?.startAt && room.startAt !== lastStartAt) {
      lastStartAt = room.startAt;
      startListeners.forEach((l) => l(room.startAt!));
    }
  };

  const unsubscribeStore = store.subscribe((code) => {
    if (info && code === info.code) refresh();
  });

  const update = (change: (room: StoredRoom) => void) => {
    if (!info) throw new Error('You are not in a room.');
    const room = store.read(info.code);
    if (!room) throw new Error('This room no longer exists.');
    change(room);
    store.write(room);
    refresh();
  };

  const api: LocalRoomApi = {
    mode: 'local',

    async createRoom(nickname) {
      const name = cleanNickname(nickname);
      let code = '';
      do {
        code = Array.from({ length: 4 }, () => CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)]).join('');
      } while (store.read(code));
      const playerId = randomId();
      store.write({ code, seed: newRoomSeed(), hostId: playerId, players: [{ id: playerId, nickname: name }], startAt: null });
      info = { code, seed: store.read(code)!.seed, playerId, isHost: true };
      lastStartAt = null;
      refresh();
      return info;
    },

    async joinRoom(rawCode, nickname) {
      const name = cleanNickname(nickname);
      const code = rawCode.trim().toUpperCase();
      const room = store.read(code);
      if (!room) throw new Error(`No room called ${code || '(blank)'}. Check the code with your host.`);
      if (room.startAt && room.startAt < Date.now()) {
        throw new Error('That room has already started. Ask the host to start a new challenge.');
      }
      if (room.players.length >= MAX_PLAYERS) throw new Error('That room is full.');
      const playerId = randomId();
      room.players.push({ id: playerId, nickname: name });
      store.write(room);
      info = { code, seed: room.seed, playerId, isHost: false };
      lastStartAt = room.startAt;
      refresh();
      return info;
    },

    onPlayersChanged(listener) {
      playerListeners.add(listener);
      listener(info ? players(store.read(info.code)) : []);
      return () => playerListeners.delete(listener);
    },

    async startRoom() {
      if (!info?.isHost) throw new Error('Only the host can start.');
      update((room) => {
        room.startAt = Date.now() + CONFIG.flow.countdownSec * 1000;
      });
    },

    onStart(listener) {
      startListeners.add(listener);
      return () => startListeners.delete(listener);
    },

    async dispose() {
      unsubscribeStore();
      playerListeners.clear();
      startListeners.clear();
      await api.leaveRoom();
    },

    async leaveRoom() {
      if (!info) return;
      const room = store.read(info.code);
      if (room) {
        room.players = room.players.filter((p) => p.id !== info!.playerId);
        if (room.players.length === 0) store.remove(room.code);
        else store.write(room); // brief §12: the host leaving doesn't cancel anyone's run
      }
      info = null;
      lastStartAt = null;
    },
  };

  return api;
}
