import { describe, expect, it } from 'vitest';
import { SOUNDS } from '../src/audio/sounds';
import { PANELS } from '../src/ui/intro';
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
