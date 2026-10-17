// Sound for the whole game (Vansh). Call mountAudio(root, game) once: it listens to GameEvents and
// frame info, and never needs to be called from gameplay code.
//
// Browsers only allow audio after a user gesture, so nothing plays until the first key or click.
// The mute button is a click target, not a key, so the game still uses only A/D/Space.

import type { Game } from '../core/Game';
import { onButton } from '../ui/dom';
import { Music } from './music';
import { countdownTicked, musicFor, soundsFor } from './soundMap';
import { SOUNDS } from './sounds';
import { Synth } from './synth';

const MUTE_KEY = 'duckrun.muted';

function loadMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

function saveMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    // private window or blocked storage: muting still works for this visit
  }
}

export function mountAudio(root: HTMLElement, game: Game): void {
  let synth: Synth | null = null;
  let music: Music | null = null;
  let muted = loadMuted();

  const applyMute = () => {
    if (!synth) return;
    synth.master.gain.setTargetAtTime(muted ? 0 : 0.8, synth.now, 0.02);
  };

  // Create the AudioContext on the first gesture, then start whatever music the stage wants.
  const unlock = () => {
    if (!synth) {
      try {
        synth = new Synth();
      } catch {
        return; // no Web Audio: the game simply stays silent
      }
      music = new Music(synth);
      applyMute();
      music.play(musicFor(game.stage));
    }
    if (synth.ctx.state === 'suspended') void synth.ctx.resume();
  };
  window.addEventListener('keydown', unlock, true);
  window.addEventListener('pointerdown', unlock, true);

  document.addEventListener('visibilitychange', () => {
    if (!synth) return;
    if (document.hidden) void synth.ctx.suspend();
    else void synth.ctx.resume();
  });

  game.onEvent((event) => {
    if (!synth) return;
    for (const name of soundsFor(event)) SOUNDS[name](synth);
    if (event.type === 'stageChanged') music?.play(musicFor(event.stage));
  });

  let lastCountdown = 0;
  game.onFrame(({ countdownSec }) => {
    if (synth && countdownTicked(lastCountdown, countdownSec)) SOUNDS.countdownTick(synth);
    lastCountdown = countdownSec;
  });

  const button = document.createElement('button');
  button.type = 'button';
  button.setAttribute('aria-label', 'Toggle sound');
  Object.assign(button.style, {
    position: 'fixed',
    top: '12px',
    right: '12px',
    zIndex: '50',
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    border: '0',
    background: 'rgba(0,0,0,0.35)',
    color: '#fff',
    fontSize: '20px',
    cursor: 'pointer',
    pointerEvents: 'auto',
  });
  const render = () => {
    button.textContent = muted ? '🔇' : '🔊';
    button.title = muted ? 'Sound off' : 'Sound on';
  };
  render();
  onButton(button, () => {
    unlock();
    muted = !muted;
    saveMuted(muted);
    applyMute();
    render();
  });
  root.appendChild(button);
}
