// Underwater (Tejas renders; Zubair's sim/underwater.ts decides). First-person sub, Space-only
// timing ring, boosts, and oxygen that is separate from lives (brief §5, ZUBAIR_BASE.md).

import * as THREE from 'three';
import { FixedStep } from '../../core/fixedStep';
import type { Phase, PhaseContext, PhaseFactory } from '../../core/types';
import { disposeObject } from '../../render/dispose';
import { createUnderwater, stepUnderwater, UNDERWATER_TICK_MS, type UnderwaterEvent } from '../../sim/underwater';
import { getTimingAccuracy } from '../../sim/timing-ring';
import { TimingRingView } from '../../ui/timingRingView';
import { SEA_COLOR, UnderwaterWorld } from './underwaterView';

const BASE_FOV = 70;

export function createUnderwaterPhase(): PhaseFactory {
  return (ctx: PhaseContext): Phase => {
    const sim = createUnderwater(); // Zubair's provisional tuning (ZUBAIR_BASE.md)
    const clock = new FixedStep(UNDERWATER_TICK_MS / 1000);
    const camera = new THREE.PerspectiveCamera(BASE_FOV, window.innerWidth / window.innerHeight, 0.1, 200);
    const world = new UnderwaterWorld();
    const ring = new TimingRingView();
    const porthole = document.createElement('div');
    porthole.className = 'porthole';
    const oldBackground = ctx.scene.background;
    const oldFog = ctx.scene.fog;
    let time = 0;
    let kick = 0; // FOV punch when a boost lands

    const handle = (event: UnderwaterEvent) => {
      if (event.type === 'timing-result') {
        if (event.result.outcome === 'oxygen-loss') {
          ctx.emit({ type: 'cue', name: 'oxygenLost' });
          ctx.loseOxygen(); // the shared controller fails the run at 0 (sim mirrors the same count)
        } else {
          kick = event.result.outcome === 'strong-boost' ? 1 : 0.6;
          ctx.emit({ type: 'cue', name: event.result.outcome === 'strong-boost' ? 'perfect' : 'boost' });
        }
      } else if (event.type === 'failed') {
        ctx.failRun('oxygen'); // no-op if loseOxygen() already ended the run
      } else {
        ctx.completePhase();
      }
    };

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    };

    return {
      enter() {
        ctx.bill.object.visible = false; // we're inside the sub, looking out
        ctx.scene.background = new THREE.Color(SEA_COLOR);
        ctx.scene.fog = new THREE.Fog(SEA_COLOR, 6, 70);
        camera.position.set(0, 0, 0);
        ctx.scene.add(world.group);
        ctx.setCamera(camera);
        const ui = document.getElementById('ui');
        ui?.append(porthole, ring.element);
        window.addEventListener('resize', onResize);
      },

      update(dt) {
        time += dt;
        const before = sim.distance;
        // Each fresh Space edge goes to exactly one 60 Hz tick (FixedStep), never to several.
        clock.advance(dt, ctx.input.spacePressed, (press) => {
          for (const event of stepUnderwater(sim, press)) handle(event);
        });

        world.update(dt, sim.distance, sim.distance - before);

        // The ring: live while a window is open, then frozen on its result until the next window.
        if (sim.phase === 'active') {
          ring.show({
            progress: sim.timing.elapsedMs / sim.timing.durationMs,
            accuracy: getTimingAccuracy(sim.timing),
            result: sim.timing.result,
          });
        } else {
          ring.hide();
        }

        // A gentle sub bob, plus a punch of speed when a boost lands.
        kick = Math.max(0, kick - dt * 1.5);
        const boosting = sim.speed > sim.tuning.baseSpeed;
        camera.position.y = Math.sin(time * 1.4) * 0.12;
        camera.rotation.z = Math.sin(time * 0.9) * 0.015;
        const fov = BASE_FOV + (boosting ? 6 : 0) + kick * 6;
        if (Math.abs(camera.fov - fov) > 0.05) {
          camera.fov += (fov - camera.fov) * Math.min(1, dt * 8);
          camera.updateProjectionMatrix();
        }
        porthole.classList.toggle('boosting', boosting);

        ctx.setPhaseProgress(sim.distance, sim.tuning.distance);
      },

      exit() {
        window.removeEventListener('resize', onResize);
        porthole.remove();
        ring.element.remove();
        ctx.scene.background = oldBackground;
        ctx.scene.fog = oldFog;
        disposeObject(world.group);
      },

      dispose() {},
    };
  };
}
