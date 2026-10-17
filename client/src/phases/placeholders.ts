// Stand-in phases so the whole run (and death, oxygen failure, heart, retry, victory) is playable
// from hour 2. Each owner REPLACES their placeholder in phases/registry.ts with the real phase.
// These are deliberately crude: don't polish them, and don't copy their rules as the real ones.

import type { PhaseFactory } from '../core/types';

/** Transition stand-in: no input, Bill does something, then it moves on. */
export function placeholderTransition(seconds: number, pose: 'fly' | 'victory'): PhaseFactory {
  return (ctx) => {
    let t = 0;
    return {
      enter() {
        ctx.bill.setPose(pose);
      },
      update(dt) {
        t += dt;
        ctx.bill.object.position.y = Math.min(t, seconds) * (pose === 'fly' ? -0.6 : 0.6);
        ctx.setPhaseProgress(Math.min(t, seconds), seconds);
        if (t >= seconds) ctx.completePhase();
      },
      exit() {},
      dispose() {},
    };
  };
}
