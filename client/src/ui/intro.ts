// The story intro (Vansh): comic-book panels that play before every first run, like the opening of a
// Mario game. Solo: SPACE or a click moves on (finishing the line first), "Skip" ends it at once.
// Rooms: it plays on a fixed timeline instead, so everyone reaches the start line together.
// It only uses SPACE and clicks, so the game's two-control rule holds.

import type { AudioHandle } from '../audio';
import type { SoundName } from '../audio/soundMap';
import { el, onButton } from './dom';
import { SCENES, type SceneName } from './introArt';

interface Line {
  /** Speaker name; narration has none. */
  who?: string;
  text: string;
}

interface Panel {
  scene: SceneName | 'title';
  lines: Line[];
  sound?: SoundName;
}

export const PANELS: Panel[] = [
  {
    scene: 'bill',
    lines: [{ text: 'This is Bill.' }, { text: 'Bill is a duck. Bill wears a suit. Bill does not have a job.' }],
  },
  {
    scene: 'iou',
    sound: 'sting',
    lines: [
      { text: 'Three weeks ago, Bill borrowed 1,000 breadcrumbs from the Don.' },
      { text: 'Interest: 400% a week. Bill did not read the small print. Bill cannot read.' },
    ],
  },
  {
    scene: 'don',
    lines: [
      { who: 'The Don', text: 'Bill. Bill, Bill, Bill.' },
      { who: 'The Don', text: 'Where is my bread?' },
    ],
  },
  {
    scene: 'dog',
    sound: 'bark',
    lines: [
      { who: 'The Don', text: 'Biscuit. Fetch.' },
      { who: 'Biscuit', text: 'WOOF.' },
      { text: '(Translation: "You are dead, feathers.")' },
    ],
  },
  {
    scene: 'pond',
    lines: [
      { text: 'Legend says the bottom of the pond is full of lost coins.' },
      { text: 'Enough to pay the Don. Maybe even enough for a shield.' },
    ],
  },
  {
    scene: 'hook',
    sound: 'sting',
    lines: [
      { text: 'But the Don knows one thing about Bill.' },
      { text: 'Bill has never once said no to a dollar.' },
    ],
  },
  {
    scene: 'run',
    sound: 'quack',
    lines: [
      { who: 'Bill', text: 'Quack.' },
      { text: '(Translation: "Run.")' },
    ],
  },
  { scene: 'title', sound: 'titleHit', lines: [{ text: 'Pay the Don. Or become dinner.' }] },
];

const CHARS_PER_SEC = 38;
/** How long a finished panel stays up before moving on by itself. */
const HOLD_SEC = 2.4;

const panelChars = (panel: Panel) =>
  panel.lines.reduce((n, l) => n + (l.who ? l.who.length + 2 : 0) + l.text.length, 0);

/** Seconds each panel lasts when nobody presses anything. */
export const PANEL_SEC = PANELS.map((p) => panelChars(p) / CHARS_PER_SEC + HOLD_SEC);
/** The whole intro, untouched. Rooms add this to the shared start so everyone watches it in sync. */
export const INTRO_SEC = PANEL_SEC.reduce((a, b) => a + b, 0);

export interface IntroOptions {
  /** performance.now() time to end exactly on. The intro then plays on a timeline and can't be skipped. */
  endsAt?: number;
}

/** Show the intro over `root`, then call onDone (after the last panel, a skip, or at endsAt). */
export function playIntro(root: HTMLElement, audio: AudioHandle, onDone: () => void, options: IntroOptions = {}): void {
  const timed = options.endsAt !== undefined;
  const startedAt = performance.now();
  // Stretch or squeeze every panel evenly so the last one ends right on endsAt.
  const stretch = timed ? Math.max(0.2, (options.endsAt! - startedAt) / 1000 / INTRO_SEC) : 1;
  const art = el('div', { className: 'intro-art' });
  const caption = el('div', { className: 'intro-caption' });
  const skip = el('button', { className: 'intro-skip', text: 'Skip ⏭' });
  const hint = el('div', { className: 'intro-hint', text: 'SPACE ▸' });
  const overlay = el('div', { className: 'intro' }, [
    el('div', { className: 'intro-bar top' }),
    art,
    caption,
    hint,
    skip,
    el('div', { className: 'intro-bar bottom' }),
  ]);

  let index = -1;
  let typed = 0; // characters shown so far in this panel
  let total = 0;
  let lineNodes: { node: HTMLElement; text: string }[] = [];
  let holdT = 0;
  let last = performance.now();
  let raf = 0;
  let done = false;

  const finish = () => {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', onKey, true);
    overlay.classList.add('closing');
    audio.setMusicOverride(null);
    setTimeout(() => overlay.remove(), 400);
    onDone();
  };

  const show = (i: number) => {
    index = i;
    if (index >= PANELS.length) return finish();
    const panel = PANELS[index];
    art.className = `intro-art scene-${panel.scene}`;
    art.innerHTML =
      panel.scene === 'title'
        ? '<div class="intro-title"><span>DUCK</span><span>RUN</span></div>'
        : SCENES[panel.scene];
    lineNodes = panel.lines.map((line) => {
      const node = el('p', { className: line.who ? 'speech' : 'narration' });
      return { node, text: line.who ? `${line.who.toUpperCase()}: ${line.text}` : line.text };
    });
    caption.replaceChildren(...lineNodes.map((l) => l.node));
    typed = 0;
    total = lineNodes.reduce((n, l) => n + l.text.length, 0);
    holdT = 0;
    if (panel.sound) audio.playSound(panel.sound);
  };

  const render = () => {
    let left = Math.floor(typed);
    for (const { node, text } of lineNodes) {
      const shown = text.slice(0, Math.max(0, left));
      if (node.textContent !== shown) node.textContent = shown;
      left -= text.length;
    }
  };

  /** SPACE or click: finish typing first, then go to the next panel. */
  const advance = () => {
    if (typed < total) {
      typed = total;
      render();
    } else show(index + 1);
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.code !== 'Space') return;
    e.preventDefault();
    e.stopPropagation(); // the run hasn't started; keep SPACE to ourselves
    if (!timed && !e.repeat) advance();
  };

  /** Timed mode: which panel the clock says we're on, and how far into it. */
  const timedTick = (now: number) => {
    if (now >= options.endsAt!) return finish();
    let t = (now - startedAt) / 1000;
    let i = 0;
    while (i < PANELS.length - 1 && t >= PANEL_SEC[i] * stretch) t -= PANEL_SEC[i++] * stretch;
    if (i !== index) show(i);
    const want = Math.min(total, (t / stretch) * CHARS_PER_SEC);
    if (want > typed) {
      typed = want;
      render();
    }
  };

  const tick = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (timed) timedTick(now);
    else if (typed < total) {
      typed = Math.min(total, typed + dt * CHARS_PER_SEC);
      render();
    } else if ((holdT += dt) >= HOLD_SEC) {
      show(index + 1);
    }
    hint.classList.toggle('ready', typed >= total);
    if (!done) raf = requestAnimationFrame(tick);
  };

  if (timed) {
    skip.remove();
    hint.remove();
  } else {
    onButton(skip, finish);
    overlay.addEventListener('click', (e) => {
      if (e.target !== skip) advance();
    });
  }
  window.addEventListener('keydown', onKey, true);

  root.appendChild(overlay);
  audio.setMusicOverride('intro');
  show(0);
  raf = requestAnimationFrame(tick);
}
