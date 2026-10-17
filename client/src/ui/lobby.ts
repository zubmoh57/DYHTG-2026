// Lobby (Tejas): nickname, create or join a room, waiting list, host Start, or a solo run.
// Talks only to a RoomApi, so it works the same with local test rooms or Supabase.

import type { RoomApi, RoomInfo, RoomPlayer } from '../network/types';
import { el, onButton } from './dom';

const NICKNAME_KEY = 'duck-run-nickname';

export interface LobbyOptions {
  rooms: RoomApi;
  /** Practice run on your own (local seed, no room). */
  onSolo(nickname: string): void;
  /** The host pressed Start: everyone's countdown ends at `startAtEpochMs`. */
  onRoomStart(room: RoomInfo, startAtEpochMs: number): void;
  /** Pre-filled join code, e.g. from a ?room=QUAK link. */
  initialCode?: string;
  /** Extra controls under the home menu, e.g. the volume slider. */
  footer?: HTMLElement;
}

export interface LobbyHandle {
  hide(): void;
  show(): void;
}

function loadNickname(): string {
  try {
    return localStorage.getItem(NICKNAME_KEY) ?? '';
  } catch {
    return ''; // storage blocked (private window)
  }
}

function saveNickname(name: string): void {
  try {
    localStorage.setItem(NICKNAME_KEY, name);
  } catch {
    // not important
  }
}

export function mountLobby(root: HTMLElement, options: LobbyOptions): LobbyHandle {
  const { rooms } = options;
  const panel = el('div', { className: 'panel lobby' });
  let room: RoomInfo | null = null;
  let unsubscribe: (() => void)[] = [];
  let visible = false;

  const error = el('p', { className: 'error' });
  const showError = (e: unknown) => {
    error.textContent = e instanceof Error ? e.message : 'Something went wrong. Try again.';
  };

  /** Disable every button while a request is in flight, so nothing gets double-clicked. */
  const busy = async (work: () => Promise<void>) => {
    const buttons = [...panel.querySelectorAll('button')];
    buttons.forEach((b) => (b.disabled = true));
    error.textContent = '';
    try {
      await work();
    } catch (e) {
      showError(e);
    } finally {
      buttons.forEach((b) => (b.disabled = false));
    }
  };

  // --- Home: nickname, create, join, solo ----------------------------------------------------

  const renderHome = () => {
    const nickname = el('input');
    nickname.placeholder = 'Your nickname';
    nickname.maxLength = 16;
    nickname.value = loadNickname();

    const code = el('input', { className: 'code-input' });
    code.placeholder = 'CODE';
    code.maxLength = 4;
    code.value = options.initialCode ?? '';
    code.autocomplete = 'off';
    code.addEventListener('input', () => (code.value = code.value.toUpperCase()));

    const create = el('button', { text: 'Create room' });
    const join = el('button', { text: 'Join' });
    const solo = el('button', { className: 'secondary', text: 'Solo practice' });

    const name = () => {
      const value = nickname.value.trim();
      saveNickname(value);
      return value;
    };

    onButton(create, () =>
      busy(async () => {
        enterRoom(await rooms.createRoom(name()));
      }),
    );
    onButton(join, () =>
      busy(async () => {
        enterRoom(await rooms.joinRoom(code.value, name()));
      }),
    );
    code.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') join.click();
    });
    onButton(solo, () => {
      const value = name() || 'Duck';
      options.onSolo(value);
    });

    const children: Node[] = [
      el('h1', { text: 'Duck Run' }),
      el('p', { text: 'Run, dive, chase the dollar, beat the pigeon.' }),
      nickname,
      create,
      el('div', { className: 'row' }, [code, join]),
      error,
      solo,
      el('p', { className: 'muted', text: 'Lanes: A / D  ·  Timing: SPACE' }),
    ];
    if (options.footer) children.push(options.footer);
    if (rooms.mode === 'local') {
      children.push(
        el('p', {
          className: 'note',
          text: 'Test rooms: only other tabs in this browser can join until the online backend is connected.',
        }),
      );
    }
    panel.replaceChildren(...children);
  };

  // --- Room: code, link, players, Start ------------------------------------------------------

  const list = el('ul', { className: 'players' });
  const renderPlayers = (players: RoomPlayer[]) => {
    list.replaceChildren(
      ...players.map((p) =>
        el('li', {}, [
          `${p.isHost ? '👑 ' : '🦆 '}${p.nickname}`,
          ...(room && p.id === room.playerId ? [el('span', { className: 'muted', text: ' (you)' })] : []),
        ]),
      ),
    );
  };

  const enterRoom = (info: RoomInfo) => {
    room = info;
    error.textContent = '';
    const link = `${window.location.origin}${window.location.pathname}?room=${info.code}`;

    const copy = el('button', { className: 'secondary small', text: 'Copy invite link' });
    onButton(copy, () => {
      navigator.clipboard?.writeText(link).then(
        () => (copy.textContent = 'Copied!'),
        () => (copy.textContent = link),
      );
    });

    const leave = el('button', { className: 'secondary', text: 'Leave room' });
    onButton(leave, () =>
      busy(async () => {
        await leaveRoom();
        renderHome();
      }),
    );

    const action = info.isHost ? el('button', { text: 'Start race' }) : el('p', { text: 'Waiting for the host to start…' });
    if (info.isHost) onButton(action as HTMLButtonElement, () => busy(() => rooms.startRoom()));

    panel.replaceChildren(
      el('p', { className: 'muted', text: 'Room code' }),
      el('div', { className: 'room-code', text: info.code }),
      copy,
      el('p', { className: 'muted', text: 'Everyone in this room races the same course.' }),
      list,
      action,
      error,
      leave,
    );

    unsubscribe.forEach((u) => u());
    unsubscribe = [
      rooms.onPlayersChanged(renderPlayers),
      rooms.onStart((startAt) => {
        if (room) options.onRoomStart(room, startAt);
      }),
    ];
  };

  const leaveRoom = async () => {
    unsubscribe.forEach((u) => u());
    unsubscribe = [];
    room = null;
    await rooms.leaveRoom();
  };

  window.addEventListener('pagehide', () => {
    void rooms.leaveRoom();
  });

  renderHome();
  root.appendChild(panel);
  visible = true;

  return {
    hide: () => {
      visible = false;
      panel.remove();
    },
    show: () => {
      if (visible) return;
      visible = true;
      root.appendChild(panel);
    },
  };
}
