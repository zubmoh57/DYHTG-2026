// The story intro (Vansh): a short animated film before every first run, like the opening of a Mario
// game. Each shot has a moving camera and characters on a timeline (Web Animations, so it runs on the
// compositor and stays smooth), with comic subtitles and speech bubbles timed in. Shots hard-cut.
// Solo: SPACE or a click cuts to the next shot, "Skip" ends it. Rooms: it plays on a fixed clock and
// is seeked to match it, so everyone reaches the start line together.
// It only uses SPACE and clicks, so the game's two-control rule holds.

import type { AudioHandle } from '../audio';
import type { SoundName } from '../audio/soundMap';
import { el, onButton } from './dom';
import { POND_COINS, SCENES, type SceneName } from './introArt';

interface Line {
  /** Speaker name; narration has none and becomes a subtitle box. */
  who?: string;
  text: string;
  /** Seconds into the shot when it pops in. */
  t: number;
  /** Speech bubbles only: where the bubble sits over the art, in % of the frame. */
  at?: [number, number];
  /** Which side the bubble's tail points from. */
  tail?: 'left' | 'right';
}

/** One animated element in a shot: a CSS selector inside the shot, and its keyframes. */
interface Move {
  sel: string;
  frames: Keyframe[];
  /** Seconds; defaults to the whole shot. */
  start?: number;
  dur?: number;
  easing?: string;
  iterations?: number;
}

interface Shot {
  scene: SceneName | 'title';
  /** Seconds the shot lasts. */
  dur: number;
  /** Camera: the whole frame's transform at the start and end of the shot. */
  camera?: [string, string];
  moves?: Move[];
  lines: Line[];
  sound?: SoundName;
  /** A big comic sound effect, e.g. WOOF!, popped over the art at [x%, y%] at time t. */
  fx?: { text: string; at: [number, number]; t: number };
}

const OUT_BACK = 'cubic-bezier(0.2, 1.4, 0.4, 1)';
const SLAM = 'cubic-bezier(0.3, 1.8, 0.5, 1)';
const shake = (x = 6): Keyframe[] => [
  { transform: 'translate(0, 0)' },
  { transform: `translate(${-x}px, ${x / 2}px)` },
  { transform: `translate(${x}px, ${-x / 2}px)` },
  { transform: `translate(${-x / 2}px, ${x / 3}px)` },
  { transform: 'translate(0, 0)' },
];

const POND_SEC = 2.6;
/** Bill dives for the first quarter, then swims 250 units right; each coin vanishes as he reaches it. */
const coinPickups: Move[] = POND_COINS.map(([cx], i) => ({
  sel: `.a-coin-${i}`,
  start: POND_SEC * (0.25 + ((cx - 70) / 250) * 0.75),
  dur: 0.22,
  frames: [
    { transform: 'scale(1)', opacity: 1 },
    { transform: 'translateY(-14px) scale(1.6)', opacity: 0 },
  ],
}));

export const SHOTS: Shot[] = [
  {
    scene: 'bill',
    dur: 2.3,
    camera: ['scale(1.05)', 'scale(1.2) translate(-2%, 2%)'],
    moves: [
      { sel: '.a-bill', dur: 0.7, easing: 'ease-out', frames: [{ transform: 'translateX(-260px)' }, { transform: 'translateX(0)' }] },
      { sel: '.a-bill', start: 0.7, dur: 0.4, iterations: 4, frames: [{ transform: 'translateY(0)' }, { transform: 'translateY(-6px)' }, { transform: 'translateY(0)' }] },
      { sel: '.a-sun', frames: [{ transform: 'translateY(20px)' }, { transform: 'translateY(0)' }] },
      { sel: '.a-joke', start: 1.1, dur: 0.3, frames: [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }] },
    ],
    lines: [
      { text: 'This is Bill.', t: 0.3 },
      { text: 'Duck. Suit. No job.', t: 1.0 },
    ],
  },
  {
    scene: 'iou',
    dur: 2.6,
    sound: 'sting',
    camera: ['scale(1)', 'scale(1.12)'],
    moves: [
      { sel: '.a-iou', dur: 0.5, easing: OUT_BACK, frames: [{ transform: 'translateY(-280px) rotate(-12deg)' }, { transform: 'translateY(0) rotate(0)' }] },
      { sel: '.a-stamp', start: 1.0, dur: 0.25, easing: SLAM, frames: [{ transform: 'scale(3)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }] },
      { sel: '.a-iou', start: 1.2, dur: 0.25, frames: shake(5) },
    ],
    lines: [
      { text: 'Three weeks ago, Bill borrowed 1,000 breadcrumbs from the Don.', t: 0.3 },
      { text: 'Interest: 400% a week. Bill cannot read.', t: 1.3 },
    ],
  },
  {
    scene: 'don',
    dur: 2.8,
    camera: ['scale(1)', 'scale(1.25) translate(0, 8%)'],
    moves: [
      { sel: '.a-light', dur: 0.5, frames: [{ opacity: 0 }, { opacity: 1 }, { opacity: 0.3 }, { opacity: 1 }] },
      { sel: '.a-don', dur: 0.8, easing: 'ease-out', frames: [{ transform: 'translateX(90px)', opacity: 0 }, { transform: 'translateX(0)', opacity: 1 }] },
    ],
    lines: [
      { who: 'The Don', text: 'Bill, Bill, Bill...', t: 0.6, at: [18, 14], tail: 'right' },
      { who: 'The Don', text: 'WHERE. IS. MY. BREAD?', t: 1.5, at: [68, 30], tail: 'left' },
    ],
  },
  {
    scene: 'dog',
    dur: 2.2,
    sound: 'bark',
    camera: ['scale(1)', 'scale(1.08)'],
    fx: { text: 'WOOF!', at: [24, 22], t: 0.35 },
    moves: [
      { sel: '.a-dog', dur: 0.35, easing: OUT_BACK, frames: [{ transform: 'scale(0.4)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }] },
      { sel: '.a-dog', start: 0.35, dur: 0.12, iterations: 5, frames: shake(7) },
      { sel: '.a-don', start: 0.5, dur: 0.4, frames: [{ opacity: 0, transform: 'translateX(30px)' }, { opacity: 1, transform: 'translateX(0)' }] },
    ],
    lines: [
      { who: 'The Don', text: 'Biscuit. Fetch.', t: 0.7, at: [70, 16], tail: 'right' },
      { text: '(Translation: "You are dead, feathers.")', t: 1.2 },
    ],
  },
  {
    scene: 'pond',
    dur: POND_SEC,
    camera: ['scale(1.15) translate(6%, 4%)', 'scale(1) translate(0, 0)'],
    moves: [
      {
        sel: '.a-diver',
        easing: 'linear',
        frames: [
          { offset: 0, transform: 'translate(0, -230px) rotate(90deg)', easing: 'ease-in' },
          { offset: 0.25, transform: 'translate(0, -20px) rotate(10deg)', easing: 'ease-out' },
          { offset: 1, transform: 'translate(250px, -24px) rotate(0)' },
        ],
      },
      { sel: '.a-splash', start: 0.1, dur: 0.5, frames: [{ transform: 'scale(0.2)', opacity: 1 }, { transform: 'scale(2.4)', opacity: 0 }] },
      ...coinPickups,
    ],
    lines: [
      { text: 'The pond floor is full of lost coins.', t: 0.4 },
      { text: 'Enough to pay the Don. Maybe.', t: 1.3 },
    ],
  },
  {
    scene: 'hook',
    dur: 2.5,
    sound: 'sting',
    camera: ['scale(1)', 'scale(1.3) translate(-6%, 0)'],
    moves: [
      { sel: '.a-hook', dur: 0.8, easing: 'ease-out', frames: [{ transform: 'translateY(-170px)' }, { transform: 'translateY(0)' }] },
      { sel: '.a-hook', start: 0.8, dur: 0.85, iterations: 2, frames: [{ transform: 'rotate(0)' }, { transform: 'rotate(3deg)' }, { transform: 'rotate(-3deg)' }, { transform: 'rotate(0)' }] },
      { sel: '.a-bill', start: 0.9, dur: 1.6, easing: 'ease-in', frames: [{ transform: 'translate(0, 0)' }, { transform: 'translate(70px, -30px)' }] },
    ],
    lines: [
      { text: 'One problem.', t: 0.3 },
      { text: 'Bill has never once said no to a dollar.', t: 1.0 },
    ],
  },
  {
    scene: 'run',
    dur: 2.3,
    sound: 'quack',
    camera: ['scale(1.1)', 'scale(1.1) translate(-1%, 0)'],
    moves: [
      { sel: '.a-scroll', dur: 0.5, iterations: Infinity, easing: 'linear', frames: [{ transform: 'translateX(0)' }, { transform: 'translateX(-100px)' }] },
      { sel: '.a-runner', dur: 0.18, iterations: Infinity, frames: [{ transform: 'translateY(0)' }, { transform: 'translateY(-7px)' }, { transform: 'translateY(0)' }] },
      { sel: '.a-chaser', easing: 'ease-in', frames: [{ transform: 'translateX(-70px)' }, { transform: 'translateX(70px)' }] },
    ],
    lines: [
      { who: 'Bill', text: 'QUACK!', t: 0.3, at: [84, 6], tail: 'left' },
      { text: '(Translation: "RUN.")', t: 0.9 },
    ],
  },
  { scene: 'title', dur: 2.2, sound: 'titleHit', camera: ['scale(1.15)', 'scale(1)'], lines: [{ text: 'Pay the Don. Or become dinner.', t: 0.7 }] },
];

/** Kept for the tests and the room timing: the shots, and how long each lasts. */
export const PANELS = SHOTS;
export const PANEL_SEC = SHOTS.map((s) => s.dur);
/** The whole film. Rooms add this to the shared start so everyone watches it in sync. */
export const INTRO_SEC = PANEL_SEC.reduce((a, b) => a + b, 0);

export interface IntroOptions {
  /** performance.now() time to end exactly on. The film then follows the clock and can't be skipped. */
  endsAt?: number;
}

const ms = (sec: number) => sec * 1000;

/** Build one shot and start all of its animations. Returns them so they can be seeked. */
function playShot(shot: Shot, frame: HTMLElement): { node: HTMLElement; anims: Animation[] } {
  const node = el('div', { className: `shot scene-${shot.scene}` });
  const cam = el('div', { className: 'shot-cam' });
  cam.innerHTML =
    shot.scene === 'title' ? '<div class="intro-title"><span>DUCK</span><span>RUN</span></div>' : SCENES[shot.scene];
  node.appendChild(cam);

  const anims: Animation[] = [];
  // The first move on an element also holds its start pose before it begins; later moves on the same
  // element only hold their end pose, so they don't overwrite the earlier one before their turn.
  const moved = new Set<Element>();
  const opts = (start = 0, dur = shot.dur, easing = 'ease-in-out', iterations = 1, first = true): KeyframeAnimationOptions => ({
    delay: ms(start),
    duration: ms(dur),
    easing,
    iterations,
    fill: iterations === Infinity ? 'none' : first ? 'both' : 'forwards',
  });

  if (shot.camera) {
    anims.push(cam.animate([{ transform: shot.camera[0] }, { transform: shot.camera[1] }], opts(0, shot.dur, 'ease-in-out')));
  }
  for (const m of shot.moves ?? []) {
    cam.querySelectorAll<SVGElement>(m.sel).forEach((target) => {
      anims.push(target.animate(m.frames, opts(m.start, m.dur, m.easing, m.iterations, !moved.has(target))));
      moved.add(target);
    });
  }

  let captions = 0;
  for (const line of shot.lines) {
    let box: HTMLElement;
    if (line.who) {
      box = el('div', { className: `bubble tail-${line.tail ?? 'left'}` }, [
        el('span', { className: 'who', text: line.who }),
        el('span', { text: line.text }),
      ]);
      const [x, y] = line.at ?? [50, 15];
      box.style.left = `${x}%`;
      box.style.top = `${y}%`;
    } else {
      box = el('div', { className: `subtitle n${captions++}`, text: line.text });
    }
    node.appendChild(box);
    anims.push(box.animate([{ transform: 'scale(0.4)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], opts(line.t, 0.25, OUT_BACK)));
  }
  if (shot.fx) {
    const fx = el('div', { className: 'fx', text: shot.fx.text });
    fx.style.left = `${shot.fx.at[0]}%`;
    fx.style.top = `${shot.fx.at[1]}%`;
    node.appendChild(fx);
    anims.push(fx.animate([{ transform: 'scale(0.2)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], opts(shot.fx.t, 0.3, SLAM)));
  }

  frame.appendChild(node);
  return { node, anims };
}

/** Show the intro over `root`, then call onDone (after the last shot, a skip, or at endsAt). */
export function playIntro(root: HTMLElement, audio: AudioHandle, onDone: () => void, options: IntroOptions = {}): void {
  const timed = options.endsAt !== undefined;
  const startedAt = performance.now();
  // Stretch or squeeze every shot evenly so the last one ends right on endsAt.
  const stretch = timed ? Math.max(0.2, (options.endsAt! - startedAt) / 1000 / INTRO_SEC) : 1;

  const frame = el('div', { className: 'film' });
  const skip = el('button', { className: 'intro-skip', text: 'Skip ⏭' });
  const hint = el('div', { className: 'intro-hint', text: 'SPACE ▸' });
  const progress = el('div', { className: 'intro-progress' }, [el('span')]);
  const overlay = el('div', { className: 'intro' }, [frame, progress, hint, skip]);
  const bar = progress.firstElementChild as HTMLElement;
  const barAnim = bar.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], {
    duration: ms(INTRO_SEC * stretch),
    fill: 'both',
  });

  let index = -1;
  let current: { node: HTMLElement; anims: Animation[] } | null = null;
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

  /** Hard cut to shot i, starting `into` seconds in (rooms join the film where the clock says). */
  const cut = (i: number, into = 0) => {
    if (i >= SHOTS.length) return finish();
    index = i;
    shownAt = performance.now() - ms(into);
    const old = current;
    if (old) {
      old.anims.forEach((a) => a.cancel());
      old.node.remove();
    }
    current = playShot(SHOTS[i], frame);
    if (into > 0) current.anims.forEach((a) => (a.currentTime = ms(into)));
    if (stretch !== 1) current.anims.forEach((a) => (a.playbackRate = 1 / stretch));
    // A white flash on every cut sells the hard edit.
    frame.animate([{ opacity: 0.35 }, { opacity: 1 }], { duration: 120 });
    const sound = SHOTS[i].sound;
    if (sound) audio.playSound(sound);
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.code !== 'Space') return;
    e.preventDefault();
    e.stopPropagation(); // the run hasn't started; keep SPACE to ourselves
    if (!timed && !e.repeat) cut(index + 1);
  };

  const tick = (now: number) => {
    if (timed) {
      if (now >= options.endsAt!) return finish();
      let t = (now - startedAt) / 1000;
      let i = 0;
      while (i < SHOTS.length - 1 && t >= PANEL_SEC[i] * stretch) t -= PANEL_SEC[i++] * stretch;
      if (i !== index) cut(i, t / stretch);
    } else {
      if ((now - shownAt) / 1000 >= SHOTS[index].dur) cut(index + 1);
      if (!done) barAnim.currentTime = ms(PANEL_SEC.slice(0, index).reduce((a, b) => a + b, 0) + (now - shownAt) / 1000);
    }
    if (!done) raf = requestAnimationFrame(tick);
  };

  if (timed) {
    skip.remove();
    hint.remove();
  } else {
    barAnim.pause();
    onButton(skip, finish);
    overlay.addEventListener('click', (e) => {
      if (e.target !== skip) cut(index + 1);
    });
  }
  window.addEventListener('keydown', onKey, true);

  root.appendChild(overlay);
  audio.setMusicOverride('intro');
  cut(0);
  raf = requestAnimationFrame(tick);
}
