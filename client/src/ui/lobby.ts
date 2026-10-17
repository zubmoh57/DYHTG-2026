// Lobby (Tejas). For now: nickname + a solo start button (offline mode).
// Next: room create/join, room code + QR, waiting list and host Start, using network/RoomApi.

import { el, onButton } from './dom';

const NICKNAME_KEY = 'duck-run-nickname';

export interface LobbyHandle {
  hide(): void;
  show(): void;
}

export function mountLobby(root: HTMLElement, onStartSolo: (nickname: string) => void): LobbyHandle {
  let saved = '';
  try {
    saved = localStorage.getItem(NICKNAME_KEY) ?? '';
  } catch {
    // storage blocked (private window): just start empty
  }

  const nickname = el('input');
  nickname.placeholder = 'Your nickname';
  nickname.maxLength = 16;
  nickname.value = saved;

  const start = el('button', { text: 'Start solo run' });
  const panel = el('div', { className: 'panel' }, [
    el('h1', { text: 'Duck Run' }),
    el('p', { text: 'Run, dive, chase the dollar, beat the pigeon.' }),
    nickname,
    start,
    el('p', { className: 'muted', text: 'Lanes: A / D  ·  Timing: SPACE' }),
  ]);
  root.appendChild(panel);

  onButton(start, () => {
    const name = nickname.value.trim() || 'Duck';
    try {
      localStorage.setItem(NICKNAME_KEY, name);
    } catch {
      // not important
    }
    nickname.blur();
    onStartSolo(name);
  });

  return {
    hide: () => panel.remove(),
    show: () => root.appendChild(panel),
  };
}
