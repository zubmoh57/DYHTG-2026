// The swim's course (Tejas): coin trails to collect and sea creatures to dodge, built from hand-made
// chunks shuffled by the room seed, so everyone in a room gets the same swim (brief §9).

import type { SeededRandom } from '../../core/seededRandom';
import type { Lane } from '../../course/types';

export type SwimItemKind = 'coin' | 'jelly' | 'puffer';

export interface SwimItem {
  distance: number;
  lane: Lane;
  kind: SwimItemKind;
}

export interface SwimCourse {
  length: number;
  items: SwimItem[];
}

interface SwimChunk {
  name: string;
  length: number;
  items: { at: number; lane: Lane; kind: SwimItemKind }[];
}

const line = (lane: Lane, from: number, count: number, gap = 2.6) =>
  Array.from({ length: count }, (_, i) => ({ at: from + i * gap, lane, kind: 'coin' as const }));

/** Obstacle rows never cover all three lanes, and rows are at least 16 units apart. */
export const SWIM_CHUNKS: readonly SwimChunk[] = [
  { name: 'warm-up', length: 30, items: line(1, 6, 7) },
  {
    name: 'jelly-gate',
    length: 40,
    items: [
      { at: 18, lane: 0, kind: 'jelly' },
      { at: 18, lane: 2, kind: 'jelly' },
      ...line(1, 8, 8),
    ],
  },
  {
    name: 'puffer-slalom',
    length: 50,
    items: [
      { at: 12, lane: 1, kind: 'puffer' },
      { at: 32, lane: 0, kind: 'puffer' },
      ...line(0, 8, 3),
      ...line(2, 22, 4),
    ],
  },
  {
    name: 'zigzag-coins',
    length: 46,
    items: [...line(0, 6, 4), ...line(1, 17, 4), ...line(2, 28, 4), { at: 40, lane: 0, kind: 'jelly' }],
  },
  {
    name: 'risky-middle',
    length: 44,
    items: [
      { at: 14, lane: 0, kind: 'jelly' },
      { at: 14, lane: 2, kind: 'puffer' },
      { at: 32, lane: 1, kind: 'jelly' },
      ...line(1, 6, 4),
      ...line(0, 26, 5),
    ],
  },
  {
    name: 'side-stash',
    length: 40,
    items: [{ at: 12, lane: 1, kind: 'puffer' }, ...line(2, 6, 9, 2.4)],
  },
  {
    name: 'double-trouble',
    length: 48,
    items: [
      { at: 12, lane: 1, kind: 'jelly' },
      { at: 12, lane: 2, kind: 'jelly' },
      { at: 30, lane: 0, kind: 'puffer' },
      { at: 30, lane: 1, kind: 'puffer' },
      ...line(0, 6, 3),
      ...line(2, 24, 6),
    ],
  },
];

const RUNWAY = 24;
const END_CLEAR = 26;

export function buildSwimCourse(rng: SeededRandom, length: number): SwimCourse {
  const items: SwimItem[] = [];
  let bag: SwimChunk[] = [];
  let pos = RUNWAY;
  for (;;) {
    if (bag.length === 0) bag = rng.shuffle(SWIM_CHUNKS);
    const chunk = bag.pop()!;
    if (pos + chunk.length > length - END_CLEAR) break;
    for (const it of chunk.items) items.push({ distance: pos + it.at, lane: it.lane, kind: it.kind });
    pos += chunk.length;
  }
  items.sort((a, b) => a.distance - b.distance);
  return { length, items };
}

/** No row of obstacles may block all three lanes (there is always a way through). */
export function swimCourseHasPath(course: SwimCourse): boolean {
  const rows = new Map<number, Set<Lane>>();
  for (const it of course.items) {
    if (it.kind === 'coin') continue;
    const row = rows.get(it.distance) ?? new Set<Lane>();
    row.add(it.lane);
    rows.set(it.distance, row);
  }
  return [...rows.values()].every((row) => row.size < 3);
}
