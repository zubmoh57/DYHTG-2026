// The story intro (Vansh): comic-book panels that play when you press Solo practice, like the opening
// of a Mario game. SPACE or a click moves on (finishing the line first), "Skip" ends it at once.
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

/** Show the intro over `root`, then call onDone (after the last panel or a skip). */
export function playIntro(root: HTMLElement, audio: AudioHandle, onDone: () => void): void {
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
    if (e.code !== 'Space' || e.repeat) return;
    e.preventDefault();
    e.stopPropagation(); // the game is still in the lobby; keep SPACE to ourselves
    advance();
  };

  const tick = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (typed < total) {
      typed = Math.min(total, typed + dt * CHARS_PER_SEC);
      render();
    } else if ((holdT += dt) >= HOLD_SEC) {
      show(index + 1);
    }
    hint.classList.toggle('ready', typed >= total);
    if (!done) raf = requestAnimationFrame(tick);
  };

  onButton(skip, finish);
  overlay.addEventListener('click', (e) => {
    if (e.target !== skip) advance();
  });
  window.addEventListener('keydown', onKey, true);

  root.appendChild(overlay);
  audio.setMusicOverride('intro');
  show(0);
  raf = requestAnimationFrame(tick);
}
