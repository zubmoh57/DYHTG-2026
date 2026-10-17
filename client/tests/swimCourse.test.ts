import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/core/config';
import { createRandom, deriveSeed } from '../src/core/seededRandom';
import { SWIM_CHUNKS, buildSwimCourse, swimCourseHasPath } from '../src/phases/underwater/swimCourse';

const swim = (seed: number) => buildSwimCourse(createRandom(deriveSeed(seed, 'underwater')), CONFIG.swim.distance);

describe('swim course (DESIGN_CHANGES.md)', () => {
  it('is the same for everyone in a room (same seed)', () => {
    expect(swim(3)).toEqual(swim(3));
    expect(swim(3)).not.toEqual(swim(4));
  });

  it('always leaves a way through, for 1,000 seeds', () => {
    for (let seed = 0; seed < 1000; seed++) expect(swimCourseHasPath(swim(seed)), `seed ${seed}`).toBe(true);
  });

  it('has enough coins that the 100-coin laser is reachable, but not trivially', () => {
    for (let seed = 0; seed < 200; seed++) {
      const coins = swim(seed).items.filter((i) => i.kind === 'coin').length;
      expect(coins, `seed ${seed}`).toBeGreaterThanOrEqual(CONFIG.powerUps.laserCoins + 15);
      expect(coins, `seed ${seed}`).toBeLessThanOrEqual(220);
    }
  });

  it('never puts creatures in all three lanes of any chunk row', () => {
    for (const chunk of SWIM_CHUNKS) {
      const rows = new Map<number, Set<number>>();
      for (const it of chunk.items) {
        if (it.kind === 'coin') continue;
        rows.set(it.at, (rows.get(it.at) ?? new Set()).add(it.lane));
      }
      rows.forEach((row) => expect(row.size, chunk.name).toBeLessThan(3));
    }
  });
});
