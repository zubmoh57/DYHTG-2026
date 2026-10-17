// Transition 1 (Tejas): the end of Runner 1. A yellow sub surfaces ahead with its hatch open,
// Bill hops in, the hatch clangs shut and the sub dives. No gameplay input (brief §3).

import * as THREE from 'three';
import type { Phase, PhaseContext, PhaseFactory } from '../../core/types';
import { disposeObject } from '../../render/dispose';
import { Particles, RunnerWorld } from '../runner/runnerView';
import { SEA_COLOR } from '../underwater/underwaterView';
import { Fade, HATCH_HEIGHT, Submarine, easeInOut, easeOut, span } from './transitionKit';

const DURATION = 3.4;
const SUB_START_Z = -24;
const SUB_END_Z = -3.6;

export function createSubEntry(): PhaseFactory {
  return (ctx: PhaseContext): Phase => {
    const root = new THREE.Group();
    const world = new RunnerWorld();
    const sub = new Submarine();
    // Side-on to the camera, so the whole sub (and its portholes) is in view and the hull never
    // runs through Bill. The holder moves and rolls; the sub inside just faces sideways.
    const holder = new THREE.Group();
    sub.root.rotation.y = Math.PI / 2;
    holder.add(sub.root);
    const particles = new Particles(60);
    const fade = new Fade(`#${SEA_COLOR.toString(16).padStart(6, '0')}`);
    const camera = ctx.defaultCamera;
    const startX = ctx.bill.object.position.x; // the lane Runner 1 ended in
    let t = 0;
    let lastSubZ = SUB_START_Z;
    let splashed = false;
    let jumped = false;
    let landed = false;
    let clanged = false;

    return {
      enter() {
        holder.position.set(0, -3, SUB_START_Z);
        root.add(world.group, holder, particles.group);
        ctx.scene.add(root);
        fade.mount();
        ctx.bill.setPose('run');
      },

      update(dt) {
        t += dt;
        const bill = ctx.bill.object;

        // 0–1.5 s: the sub surfaces and glides up to Bill as the world slows down.
        const approach = easeOut(span(t, 0, 1.5));
        const subZ = SUB_START_Z + (SUB_END_Z - SUB_START_Z) * approach;
        world.scroll(subZ, subZ - lastSubZ);
        lastSubZ = subZ;
        const rise = easeOut(span(t, 0.1, 0.9));
        const sink = easeInOut(span(t, 2.55, 3.3));
        holder.position.set(0, -3 + 3 * rise - 3.2 * sink, subZ);
        holder.rotation.z = Math.sin(t * 2) * 0.025 + sink * 0.1;
        if (!splashed && t > 0.35) {
          splashed = true;
          particles.burst(0, 0.2, subZ + 2, 30, { color: 0xe8f7ff, speed: 6, up: 6, life: 0.8, size: 1.4, grow: 0.4 });
          ctx.emit({ type: 'cue', name: 'splash' });
        }

        // Bill drifts to the middle lane, then hops up into the hatch (1.5–2.1 s) and drops in.
        const jump = span(t, 1.5, 2.1);
        const drop = span(t, 2.1, 2.4);
        if (jump === 0) {
          bill.position.x = startX + (0 - startX) * easeOut(span(t, 0, 1.2));
        } else {
          if (!jumped) {
            jumped = true;
            ctx.bill.setPose('fly');
            ctx.emit({ type: 'cue', name: 'jump' });
          }
          bill.position.x = 0;
          bill.position.z = SUB_END_Z * easeInOut(jump);
          bill.position.y = (HATCH_HEIGHT + 0.3) * easeOut(jump) + Math.sin(Math.PI * jump) * 1.4 - 1.6 * drop;
          const shrink = 1 - 0.5 * drop;
          bill.scale.setScalar(shrink);
          bill.visible = drop < 1;
          if (!landed && drop > 0) {
            landed = true;
            ctx.emit({ type: 'cue', name: 'hatch' });
          }
        }

        // The lid swings shut with a clang and a little shake.
        const close = easeOut(span(t, 2.35, 2.55));
        sub.setLid(1 - close);
        if (!clanged && close >= 1) {
          clanged = true;
          ctx.emit({ type: 'cue', name: 'clang' });
          particles.burst(0, HATCH_HEIGHT, SUB_END_Z, 10, { color: 0xffffff, speed: 3, up: 2, life: 0.4, size: 0.7 });
        }
        if (sink > 0 && Math.random() < 0.6) {
          particles.burst((Math.random() - 0.5) * 3, 0.1, SUB_END_Z + (Math.random() - 0.5) * 4, 1, {
            color: 0xcfefff, speed: 1, up: 2, life: 0.6, size: 0.8,
          });
        }
        particles.update(dt, 0);

        // Camera: follows Bill forward, then tips down after the sub as it dives.
        const shake = clanged ? Math.max(0, 1 - (t - 2.55) * 4) * 0.08 * Math.sin(t * 70) : 0;
        const follow = Math.min(bill.position.z, 0);
        camera.position.set(bill.position.x * 0.4 + shake, 3.4 + 0.8 * jump - 1.5 * sink, 6.5 + follow * 0.7);
        camera.lookAt(0, 1 + 1.2 * jump - 2 * sink, follow - 8);

        fade.set(span(t, 2.9, DURATION));
        ctx.setPhaseProgress(Math.min(t, DURATION), DURATION);
        if (t >= DURATION) ctx.completePhase();
      },

      exit() {
        fade.remove();
        ctx.bill.object.scale.set(1, 1, 1);
        disposeObject(root);
      },

      dispose() {},
    };
  };
}
