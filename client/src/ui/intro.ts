// The story intro (Vansh): a quick comic that plays before every first run, like the opening of a
// Mario game. Panels slide in with caption boxes, speech bubbles and sound-effect bursts.
// Solo: SPACE or a click moves on (showing the rest of the panel first), "Skip" ends it at once.
// Rooms: it plays on a fixed timeline instead, so everyone reaches the start line together.
// It only uses SPACE and clicks, so the game's two-control rule holds.

import type { AudioHandle } from '../audio';
import type { SoundName } from '../audio/soundMap';
import { el, onButton } from './dom';
import { SCENES, type SceneName } from './introArt';

interface Line {
  /** Speaker name; narration has none and goes in a caption box. */
  who?: string;
  text: string;
  /** Speech bubbles only: where the bubble sits over the art, in % of the panel. */
  at?: [number, number];
  /** Which side the bubble's tail points from. */
  tail?: 'left' | 'right';
  /** Caption boxes only: force the top-left or bottom-right corner. */
  place?: 'top' | 'bottom';
}

interface Panel {
  scene: SceneName | 'title';
  lines: Line[];
  sound?: SoundName;
  /** A big comic sound effect, e.g. WOOF!, popped over the art at [x%, y%]. */
  fx?: { text: string; at: [number, number] };
}

export const PANELS: Panel[] = [
  {
    scene: 'bill',
    lines: [{ text: 'This is Bill.' }, { text: 'Duck. Suit. No job.' }],
  },
  {
    scene: 'iou',
    sound: 'sting',
    lines: [
      { text: 'Three weeks ago, Bill borrowed 1,000 breadcrumbs from the Don.' },
      { text: 'Interest: 400% a week. Bill cannot read.' },
    ],
  },
  {
    scene: 'don',
    lines: [
      { who: 'The Don', text: 'Bill, Bill, Bill...', at: [18, 14], tail: 'right' },
      { who: 'The Don', text: 'WHERE. IS. MY. BREAD?', at: [68, 30], tail: 'left' },
    ],
  },
  {
    scene: 'dog',
    sound: 'bark',
    fx: { text: 'WOOF!', at: [22, 22] },
    lines: [
      { who: 'The Don', text: 'Biscuit. Fetch.', at: [70, 16], tail: 'right' },
      { text: '(Translation: "You are dead, feathers.")', place: 'bottom' },
    ],
  },
  {
    scene: 'pond',
    lines: [{ text: 'The pond floor is full of lost coins.' }, { text: 'Enough to pay the Don. Maybe.' }],
  },
  {
    scene: 'hook',
    sound: 'sting',
    fx: { text: '$_$', at: [24, 26] },
    lines: [{ text: 'One problem.' }, { text: 'Bill has never once said no to a dollar.' }],
  },
  {
    scene: 'run',
    sound: 'quack',
    lines: [
      { who: 'Bill', text: 'QUACK!', at: [66, 14], tail: 'left' },
      { text: '(Translation: "RUN.")' },
    ],
  },
  { scene: 'title', sound: 'titleHit', lines: [{ text: 'Pay the Don. Or become dinner.' }] },
];

/** When each line pops in, after its panel arrives. */
const LINE_DELAY_SEC = 0.25;
const LINE_GAP_SEC = 0.45;

/** Seconds each panel stays up when nobody presses anything: short, but long enough to read. */
export const PANEL_SEC = PANELS.map(
  (p) => 1.1 + p.lines.length * LINE_GAP_SEC + p.lines.reduce((n, l) => n + l.text.length, 0) * 0.02,
);
/** The whole intro, untouched. Rooms add this to the shared start so everyone watches it in sync. */
export const INTRO_SEC = PANEL_SEC.reduce((a, b) => a + b, 0);

export interface IntroOptions {
  /** performance.now() time to end exactly on. The intro then plays on a timeline and can't be skipped. */
  endsAt?: number;
}

/** A slight, fixed tilt per panel so the page looks hand-laid, not like slides. */
const TILT = [-1.2, 0.9, -0.6, 1.3, -1, 0.7, -1.4, 0];

function buildPanel(panel: Panel, i: number): HTMLElement {
  const node = el('div', { className: `comic-panel scene-${panel.scene}` });
  node.style.setProperty('--tilt', `${TILT[i % TILT.length]}deg`);
  node.innerHTML =
    panel.scene === 'title' ? '<div class="intro-title"><span>DUCK</span><span>RUN</span></div>' : SCENES[panel.scene];
  let captions = 0;
  panel.lines.forEach((line, n) => {
    const delay = `${LINE_DELAY_SEC + n * LINE_GAP_SEC}s`;
    if (line.who) {
      const bubble = el('div', { className: `bubble tail-${line.tail ?? 'left'}` }, [
        el('span', { className: 'who', text: line.who }),
        el('span', { text: line.text }),
      ]);
      const [x, y] = line.at ?? [50, 15];
      bubble.style.left = `${x}%`;
      bubble.style.top = `${y}%`;
      bubble.style.animationDelay = delay;
      node.appendChild(bubble);
    } else {
      // First caption box at the top-left, the next at the bottom-right, like a comic page.
      const place = panel.scene === 'title' ? 'tagline' : (line.place ?? (captions % 2 ? 'bottom' : 'top'));
      captions++;
      const box = el('div', { className: `caption ${place}`, text: line.text });
      box.style.animationDelay = delay;
      node.appendChild(box);
    }
  });
  if (panel.fx) {
    const fx = el('div', { className: 'fx', text: panel.fx.text });
    fx.style.left = `${panel.fx.at[0]}%`;
    fx.style.top = `${panel.fx.at[1]}%`;
    node.appendChild(fx);
  }
  return node;
}

/** Show the intro over `root`, then call onDone (after the last panel, a skip, or at endsAt). */
export function playIntro(root: HTMLElement, audio: AudioHandle, onDone: () => void, options: IntroOptions = {}): void {
  const timed = options.endsAt !== undefined;
  const startedAt = performance.now();
  // Stretch or squeeze every panel evenly so the last one ends right on endsAt.
  const stretch = timed ? Math.max(0.2, (options.endsAt! - startedAt) / 1000 / INTRO_SEC) : 1;

  const page = el('div', { className: 'comic-page' });
  const skip = el('button', { className: 'intro-skip', text: 'Skip ⏭' });
  const hint = el('div', { className: 'intro-hint', text: 'SPACE ▸' });
  const dots = el('div', { className: 'intro-dots' }, PANELS.map(() => el('span')));
  const overlay = el('div', { className: 'intro' }, [page, dots, hint, skip]);

  let index = -1;
  let current: HTMLElement | null = null;
  let shownAt = performance.now();
  let raf = 0;
  let done = false;

  const finish = () => {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', onKey, true);
    overlay.classList.add('closing');
    audio.setMusicOverride(null);
    setTimeout(() => overlay.remove(), 450);
    onDone();
  };

  const show = (i: number) => {
    if (i >= PANELS.length) return finish();
    index = i;
    shownAt = performance.now();
    const old = current;
    if (old) {
      old.classList.add('leave');
      setTimeout(() => old.remove(), 500);
    }
    current = buildPanel(PANELS[i], i);
    page.appendChild(current);
    [...dots.children].forEach((d, n) => d.classList.toggle('on', n <= i));
    const sound = PANELS[i].sound;
    if (sound) audio.playSound(sound);
  };

  /** Everything in the panel has popped in. */
  const panelReady = () =>
    (performance.now() - shownAt) / 1000 >= LINE_DELAY_SEC + (PANELS[index].lines.length - 1) * LINE_GAP_SEC + 0.3;

  /** SPACE or click: pop in the rest of the panel first, then go to the next one. */
  const advance = () => {
    if (current && !current.classList.contains('all') && !panelReady()) current.classList.add('all');
    else show(index + 1);
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.code !== 'Space') return;
    e.preventDefault();
    e.stopPropagation(); // the run hasn't started; keep SPACE to ourselves
    if (!timed && !e.repeat) advance();
  };

  const tick = (now: number) => {
    if (timed) {
      if (now >= options.endsAt!) return finish();
      let t = (now - startedAt) / 1000;
      let i = 0;
      while (i < PANELS.length - 1 && t >= PANEL_SEC[i] * stretch) t -= PANEL_SEC[i++] * stretch;
      if (i !== index) show(i);
    } else if ((now - shownAt) / 1000 >= PANEL_SEC[index]) {
      show(index + 1);
    }
    if (!done) {
      hint.classList.toggle('ready', !timed && panelReady());
      raf = requestAnimationFrame(tick);
    }
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
