// Looping background music, sequenced on the Web Audio clock (Vansh). One funk track per stage group,
// plus a laid-back groove for the lobby.

import type { MusicMood, MusicTrack } from './soundMap';
import { midiToFreq, type Synth } from './synth';

/** One drum lane per voice; 'x' plays on that 16th, anything else rests. Lanes loop on their own length. */
export interface Drums {
  kick?: string;
  snare?: string;
  /** Quiet snare between the backbeats: the funk "ghost note". */
  ghost?: string;
  hat?: string;
  openHat?: string;
}

export interface Track {
  bpm: number;
  /** 0 = straight 16ths, ~0.15-0.25 = funky swing on the off 16ths. */
  swing: number;
  /** 16th-note steps. Each array loops on its own length; null = rest. */
  bass: (number | null)[];
  /** Short staccato bass, filtered like a slap/synth bass. */
  bassCutoff: number;
  lead: (number | null)[];
  leadType: OscillatorType;
  /** Chord stabs (clavinet/horn style): MIDI notes played together on that step. */
  chords: (number[] | null)[];
  /** Stab length in steps: short for clav chops, long for electric piano pads. */
  chordLen: number;
  drums: Drums;
  /** Extra drums that join once the section gets tense (past halfway, or on your last life). */
  tense?: Drums;
  /** Lowpass on the whole track: underwater sounds muffled. */
  cutoff: number;
}

const _ = null;

// Chord voicings (MIDI), named for readability in the patterns below.
const Em9 = [62, 66, 67, 71];
const A13 = [61, 66, 67, 69];
const G9 = [59, 62, 65, 69];
const C9 = [58, 62, 64, 67];
const Am9 = [60, 64, 67, 71];
const D9 = [60, 64, 66, 69];
const Dm9 = [60, 64, 65, 69];
const Bb9 = [60, 62, 65, 68];
const A7s9 = [61, 67, 72];

export const TRACKS: Record<MusicTrack, Track> = {
  // Lobby: a lazy E dorian vamp to bob your head to while everyone joins.
  lobby: {
    bpm: 100,
    swing: 0.22,
    bass: [
      40, _, _, 40, 52, _, 40, _, _, 40, 43, _, 45, _, 47, _,
      40, _, _, 40, 52, _, 40, _, _, 52, 50, _, 47, _, 45, 43,
    ],
    bassCutoff: 900,
    lead: [
      _, _, _, _, _, _, _, _, 71, _, 74, _, 76, _, 74, 71,
      _, _, _, _, _, _, _, _, 79, _, 76, _, 74, _, 71, _,
      _, _, _, _, _, _, _, _, 71, _, 74, _, 76, _, 79, _,
      81, _, 79, _, 76, _, 74, _, 76, _, _, _, _, _, _, _,
    ],
    leadType: 'triangle',
    chords: [
      _, _, Em9, _, _, _, Em9, _, _, _, Em9, _, _, _, _, _,
      _, _, A13, _, _, _, A13, _, _, _, A13, _, _, _, A13, _,
    ],
    chordLen: 0.9,
    drums: {
      kick: 'x-----x---x-----',
      snare: '----x-------x---',
      ghost: '-------x-x----x-',
      hat: 'x-x-x-x-x-x-x---',
      openHat: '--------------x-',
    },
    cutoff: 5000,
  },
  // Runner: disco-funk, four on the floor with octave-popping bass and clav chops.
  runner: {
    bpm: 124,
    swing: 0.12,
    bass: [
      43, 55, _, 43, _, 55, 43, _, 46, _, 58, _, 48, _, 50, 53,
      41, 53, _, 41, _, 53, 41, _, 43, _, 55, _, 46, _, 48, 50,
    ],
    bassCutoff: 1200,
    lead: [
      _, _, 74, _, 77, _, 74, 72, _, 70, _, 67, _, _, _, _,
      _, _, 74, _, 77, _, 79, _, 77, _, 74, 72, 70, _, 72, _,
    ],
    leadType: 'square',
    chords: [
      _, _, _, G9, _, _, G9, _, _, _, _, G9, _, _, G9, _,
      _, _, _, C9, _, _, C9, _, _, _, _, C9, _, _, C9, _,
    ],
    chordLen: 0.6,
    drums: {
      kick: 'x---x---x---x---',
      snare: '----x-------x---',
      ghost: '-------x------x-',
      hat: 'xx-xxx-xxx-xxx-x',
      openHat: '--x---x---x---x-',
    },
    cutoff: 7000,
  },
  // Underwater: a slow, swung A dorian jam with soft electric-piano pads behind the porthole.
  underwater: {
    bpm: 88,
    swing: 0.25,
    bass: [
      45, _, _, 45, _, _, 57, _, _, 45, _, 48, _, 50, _, 52,
      50, _, _, 50, _, _, 62, _, _, 50, _, 53, _, 54, _, 57,
    ],
    bassCutoff: 600,
    lead: [
      _, _, _, _, _, _, _, _, _, _, _, _, 76, _, 79, _,
      81, _, _, _, 79, _, 76, _, _, _, _, _, _, _, _, _,
      _, _, _, _, _, _, _, _, _, _, _, _, 72, _, 74, _,
      76, _, _, _, 74, _, 72, _, 69, _, _, _, _, _, _, _,
    ],
    leadType: 'sine',
    chords: [
      Am9, _, _, _, _, _, _, _, _, _, Am9, _, _, _, _, _,
      D9, _, _, _, _, _, _, _, _, _, D9, _, _, _, _, _,
    ],
    chordLen: 5,
    drums: {
      kick: 'x-------x-x-----',
      ghost: '----x-------x---',
      hat: '--x---x---x---x-',
    },
    cutoff: 1500,
  },
  // Boss: fast, tense D minor funk: slap bass, sharp-nine stabs, busy hats for Don Crumb.
  boss: {
    bpm: 132,
    swing: 0.08,
    bass: [
      38, _, 50, 38, _, 38, 50, _, 41, _, 53, 41, 40, _, 39, _,
      38, _, 50, 38, _, 38, 50, _, 34, _, 46, 34, 33, _, 45, _,
    ],
    bassCutoff: 1500,
    lead: [
      _, _, _, _, 74, _, 77, _, 79, _, 80, 79, 77, _, 74, _,
      _, _, _, _, 74, _, 77, _, 81, _, 80, 77, 76, _, 73, _,
    ],
    leadType: 'sawtooth',
    chords: [
      _, _, _, Dm9, _, _, Dm9, _, _, _, _, Dm9, _, _, Dm9, _,
      _, _, _, Bb9, _, _, Bb9, _, _, _, _, A7s9, _, _, A7s9, _,
    ],
    chordLen: 0.5,
    drums: {
      kick: 'x--x--x---x--x--',
      snare: '----x-------x---',
      ghost: '-------x-x----x-',
      hat: 'xxxxxxxxxxxxxx-x',
      openHat: '--------------x-',
    },
    cutoff: 6000,
  },
};

const LOOKAHEAD_SEC = 0.12;

const hits = (lane: string | undefined, i: number): boolean => !!lane && lane[i % lane.length] === 'x';

export class Music {
  private track: MusicTrack | null = null;
  private bus: GainNode | null = null;
  private step = 0;
  private nextStepAt = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private filter: BiquadFilterNode | null = null;
  private mood: MusicMood = { tempo: 1, tension: 0, danger: false };
  /** Eased towards mood.tempo so speed-ups glide instead of jumping. */
  private tempo = 1;

  constructor(private readonly synth: Synth) {}

  get current(): MusicTrack | null {
    return this.track;
  }

  /** Follow the run: tempo, tension and danger come from musicMood(). */
  setMood(mood: MusicMood): void {
    const opened = mood.tension !== this.mood.tension;
    this.mood = mood;
    if (opened && this.filter && this.track) {
      const cutoff = TRACKS[this.track].cutoff * (0.6 + 0.6 * mood.tension);
      this.filter.frequency.setTargetAtTime(cutoff, this.synth.now, 0.3);
    }
  }

  /** Crossfade to a track (or to silence with null). Asking for the playing track does nothing. */
  play(track: MusicTrack | null): void {
    if (track === this.track) return;
    this.fadeOut();
    this.track = track;
    if (!track) return;

    const ctx = this.synth.ctx;
    const def = TRACKS[track];
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0.0001, ctx.currentTime);
    bus.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 0.6);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = def.cutoff * (0.6 + 0.6 * this.mood.tension);
    bus.connect(filter).connect(this.synth.music);
    this.bus = bus;
    this.filter = filter;
    this.tempo = this.mood.tempo;
    this.step = 0;
    this.nextStepAt = ctx.currentTime + 0.05;
    this.timer = setInterval(() => this.schedule(def, bus), 25);
  }

  private fadeOut(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    const bus = this.bus;
    if (!bus) return;
    const t = this.synth.ctx.currentTime;
    bus.gain.cancelScheduledValues(t);
    bus.gain.setValueAtTime(Math.max(0.0001, bus.gain.value), t);
    bus.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    setTimeout(() => bus.disconnect(), 700);
    this.bus = null;
    this.filter = null;
  }

  private schedule(def: Track, bus: GainNode): void {
    const s = this.synth;
    // After a long tab switch, skip ahead rather than playing a burst of missed notes.
    if (this.nextStepAt < s.now) this.nextStepAt = s.now + 0.02;
    while (this.nextStepAt < s.now + LOOKAHEAD_SEC) {
      const i = this.step;
      this.tempo += (this.mood.tempo - this.tempo) * 0.05;
      const stepSec = 60 / (def.bpm * this.tempo) / 4;
      // Swing: push every off 16th late, which is what makes it groove instead of march.
      const at = this.nextStepAt - s.now + (i % 2 === 1 ? def.swing * stepSec : 0);
      this.playStep(def, bus, i, at, stepSec);
      this.step++;
      this.nextStepAt += stepSec;
    }
  }

  private playStep(def: Track, dest: GainNode, i: number, at: number, stepSec: number): void {
    const s = this.synth;

    const bass = def.bass[i % def.bass.length];
    if (bass !== null) {
      // Plucky, resonant and short: rests between notes are half the funk.
      s.tone({ freq: midiToFreq(bass), type: 'sawtooth', at, dur: stepSec * 1.1, gain: 0.32,
        filter: { type: 'lowpass', freq: def.bassCutoff, q: 6 }, dest });
      s.tone({ freq: midiToFreq(bass), type: 'sine', at, dur: stepSec * 1.3, gain: 0.28, dest });
    }

    const chord = def.chords[i % def.chords.length];
    if (chord) {
      const long = def.chordLen > 1;
      for (const note of chord) {
        for (const detune of [-7, 7]) {
          s.tone({ freq: midiToFreq(note), type: long ? 'triangle' : 'square', at, detune,
            dur: stepSec * def.chordLen, gain: long ? 0.035 : 0.025, attack: long ? 0.04 : 0.003,
            filter: { type: 'lowpass', freq: long ? 1800 : 2600, q: long ? 1 : 5 }, dest });
        }
      }
    }

    const lead = def.lead[i % def.lead.length];
    if (lead !== null) {
      s.tone({ freq: midiToFreq(lead), type: def.leadType, at, dur: stepSec * 1.7, gain: 0.08, dest });
      s.tone({ freq: midiToFreq(lead), type: def.leadType, at, dur: stepSec * 1.7, gain: 0.05, detune: 9, dest });
    }

    this.playDrums(def.drums, dest, i, at);
    if (def.tense && (this.mood.tension >= 0.5 || this.mood.danger)) this.playDrums(def.tense, dest, i, at);
    // Last life: a heartbeat on every beat, lub-dub.
    if (this.mood.danger && i % 4 === 0) {
      s.tone({ freq: 70, to: 40, at, dur: 0.12, gain: 0.55, dest });
      s.tone({ freq: 60, to: 35, at: at + 0.14, dur: 0.1, gain: 0.4, dest });
    }
  }

  private playDrums(d: Drums, dest: GainNode, i: number, at: number): void {
    const s = this.synth;
    if (hits(d.kick, i)) s.tone({ freq: 160, to: 42, at, dur: 0.16, gain: 0.7, dest });
    if (hits(d.snare, i)) {
      s.noise({ at, dur: 0.14, gain: 0.28, filter: { type: 'highpass', freq: 1400 }, dest });
      s.tone({ freq: 190, to: 130, at, dur: 0.08, gain: 0.2, dest });
    }
    if (hits(d.ghost, i)) s.noise({ at, dur: 0.05, gain: 0.07, filter: { type: 'highpass', freq: 1800 }, dest });
    if (hits(d.hat, i)) s.noise({ at, dur: 0.03, gain: 0.08, filter: { type: 'highpass', freq: 7500 }, dest });
    if (hits(d.openHat, i)) s.noise({ at, dur: 0.2, gain: 0.08, filter: { type: 'highpass', freq: 6500 }, dest });
  }
}
