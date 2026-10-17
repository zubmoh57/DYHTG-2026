import { describe, expect, it } from 'vitest';
import { SOUNDS } from '../src/audio/sounds';
import { INTRO_SEC, PANEL_SEC, PANELS } from '../src/ui/intro';
import { SCENES } from '../src/ui/introArt';

describe('story intro', () => {
  it('has art and words for every panel', () => {
    for (const panel of PANELS) {
      if (panel.scene !== 'title') expect(SCENES[panel.scene]).toContain('<svg');
      expect(panel.lines.length).toBeGreaterThan(0);
      for (const line of panel.lines) expect(line.text.trim()).not.toBe('');
    }
  });

  it('only plays sounds that exist', () => {
    for (const panel of PANELS) if (panel.sound) expect(SOUNDS[panel.sound]).toBeTypeOf('function');
  });

  it('ends on the title card', () => {
    expect(PANELS[PANELS.length - 1].scene).toBe('title');
  });
});

describe('intro timing', () => {
  it('gives every panel its own time and adds up to the whole intro', () => {
    expect(PANEL_SEC).toHaveLength(PANELS.length);
    for (const sec of PANEL_SEC) expect(sec).toBeGreaterThan(2);
    expect(PANEL_SEC.reduce((a, b) => a + b, 0)).toBeCloseTo(INTRO_SEC);
  });
});
