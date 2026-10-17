// The underwater timing ring (Tejas renders, Zubair's sim/timing-ring.ts decides): a fixed target
// circle, a bigger circle closing in, and the live accuracy, frozen with the result when pressed.

import type { TimingResult } from '../sim/timing-ring';

const NS = 'http://www.w3.org/2000/svg';
const TARGET_R = 34;

const svg = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>) => {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
};

export interface RingFrame {
  /** 0 when the window opens, 1 when it expires. Alignment (100%) is at 0.5. */
  progress: number;
  accuracy: number;
  result: TimingResult | null;
}

export class TimingRingView {
  readonly element: HTMLElement;
  private readonly closing: SVGCircleElement;
  private readonly target: SVGCircleElement;
  private readonly percent: HTMLElement;
  private readonly label: HTMLElement;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'timing-ring';
    const root = svg('svg', { viewBox: '0 0 200 200', width: 200, height: 200 });
    this.target = svg('circle', { cx: 100, cy: 100, r: TARGET_R, class: 'ring-target' });
    this.closing = svg('circle', { cx: 100, cy: 100, r: TARGET_R * 3, class: 'ring-closing' });
    root.append(this.target, this.closing);
    this.percent = document.createElement('div');
    this.percent.className = 'ring-percent';
    this.label = document.createElement('div');
    this.label.className = 'ring-label';
    this.element.append(root, this.percent, this.label);
  }

  show(frame: RingFrame): void {
    this.element.classList.remove('hidden');
    // Closes fast onto the target, then keeps shrinking more slowly once it has passed it.
    const p = frame.progress;
    const r = p <= 0.5 ? TARGET_R * (3 - 4 * p) : TARGET_R * (1 - 1.6 * (p - 0.5));
    this.closing.setAttribute('r', Math.max(2, r).toFixed(1));

    const tier = frame.accuracy >= 90 ? 'great' : frame.accuracy >= 50 ? 'ok' : 'bad';
    this.element.dataset.tier = tier;
    this.percent.textContent = `${frame.accuracy}%`;

    const r2 = frame.result;
    this.element.classList.toggle('locked', !!r2);
    if (!r2) this.label.textContent = 'SPACE on the ring';
    else if (r2.outcome === 'strong-boost') this.label.textContent = 'STRONG BOOST!';
    else if (r2.outcome === 'small-boost') this.label.textContent = 'Boost';
    else this.label.textContent = r2.reason === 'expired' ? 'Too late: oxygen −1' : 'Missed: oxygen −1';
  }

  hide(): void {
    this.element.classList.add('hidden');
  }
}
