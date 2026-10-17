// Transition 1 (Tejas, DESIGN_CHANGES.md): the end of Runner 1. A glowing whirlpool pond pops up on
// the river, the dog skids to a stop barking, and Bill jumps and dives head-first into it.
// No gameplay input (brief §3).

import * as THREE from 'three';
import type { Phase, PhaseContext, PhaseFactory } from '../../core/types';
import { disposeObject } from '../../render/dispose';
import { DogView } from '../runner/dogView';
import { Particles, RunnerWorld } from '../runner/runnerView';
import { SEA_COLOR } from '../underwater/underwaterView';
import { Fade, easeInOut, easeOut, easeOutBack, span } from './transitionKit';

const DURATION = 3;
const POND_START_Z = -22;
const POND_Z = -5.5;

function swirlTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d')!;
  const c = size / 2;
  const grad = g.createRadialGradient(c, c, 0, c, c, c);
  grad.addColorStop(0, '#04263f');
  grad.addColorStop(0.55, '#0e6aa0');
  grad.addColorStop(0.9, '#5fd0ff');
  grad.addColorStop(1, '#ffffff');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(c, c, c, 0, Math.PI * 2);
  g.fill();
  // Spiral arms of foam.
  g.strokeStyle = 'rgba(220,250,255,0.55)';
  g.lineCap = 'round';
  for (let arm = 0; arm < 4; arm++) {
    g.lineWidth = 7;
    g.beginPath();
    for (let t = 0; t < 1; t += 0.01) {
      const a = arm * (Math.PI / 2) + t * Math.PI * 2.6;
      const r = 10 + t * (c - 14);
      const x = c + Math.cos(a) * r;
      const y = c + Math.sin(a) * r;
      if (t === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createDive(): PhaseFactory {
  return (ctx: PhaseContext): Phase => {
    const root = new THREE.Group();
    const world = new RunnerWorld();
    const particles = new Particles(80);
    const dog = new DogView();
    const fade = new Fade(`#${SEA_COLOR.toString(16).padStart(6, '0')}`);
    const camera = ctx.defaultCamera;
    const startX = ctx.bill.object.position.x;

    const pond = new THREE.Group();
    const swirl = new THREE.Mesh(
      new THREE.CircleGeometry(2.1, 64),
      new THREE.MeshStandardMaterial({ map: swirlTexture(), roughness: 0.2, emissive: 0x1a8fd0, emissiveIntensity: 0.35 }),
    );
    swirl.rotation.x = -Math.PI / 2;
    swirl.position.y = 0.03;
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(2.15, 0.16, 16, 64),
      new THREE.MeshStandardMaterial({ color: 0xe8fbff, emissive: 0x9fe8ff, emissiveIntensity: 0.6, roughness: 0.3 }),
    );
    rim.rotation.x = -Math.PI / 2;
    rim.position.y = 0.06;
    pond.add(swirl, rim);

    let t = 0;
    let lastPondZ = POND_START_Z;
    let popped = false;
    let jumped = false;
    let splashed = false;

    return {
      enter() {
        pond.position.set(0, 0, POND_START_Z);
        pond.scale.setScalar(0.001);
        dog.root.scale.setScalar(0.8);
        dog.root.position.set(startX + 1.3, 0, 9);
        root.add(world.group, pond, dog.root, particles.group);
        ctx.scene.add(root);
        fade.mount();
        ctx.bill.setPose('run');
      },

      update(dt) {
        t += dt;
        const bill = ctx.bill.object;

        // 0–1.3 s: the pond pops up ahead and glides in as the river slows down.
        const approach = easeOut(span(t, 0, 1.3));
        const pondZ = POND_START_Z + (POND_Z - POND_START_Z) * approach;
        world.scroll(pondZ, pondZ - lastPondZ);
        lastPondZ = pondZ;
        const pop = span(t, 0.05, 0.55);
        pond.scale.setScalar(Math.max(0.001, easeOutBack(pop)));
        pond.position.z = pondZ;
        swirl.rotation.z -= dt * 2.2;
        if (!popped && pop > 0) {
          popped = true;
          ctx.emit({ type: 'cue', name: 'pondPop' });
          particles.burst(0, 0.2, pondZ, 20, { color: 0xbff4ff, speed: 5, up: 5, life: 0.7, size: 1.1, grow: 0.3 });
        }

        // The dog chases in and skids to a stop, barking, just behind.
        dog.root.position.z += (1.6 - dog.root.position.z) * Math.min(1, dt * 2.5);
        dog.root.position.x += (startX * 0.4 + 1.2 - dog.root.position.x) * Math.min(1, dt * 2);
        if (t > 1.6 && t < 1.65) dog.bark();
        dog.update(t > 1.4 ? dt * 0.3 : dt); // slows to a halt

        // Bill lines up with the pond, then jumps (1.3–1.9 s) and dives head-first into it.
        const jump = span(t, 1.3, 1.95);
        const plunge = span(t, 1.95, 2.25);
        if (jump === 0) {
          bill.position.x = startX * (1 - easeOut(span(t, 0, 1.1)));
        } else {
          if (!jumped) {
            jumped = true;
            ctx.bill.setPose('fly');
            ctx.emit({ type: 'cue', name: 'jump' });
          }
          bill.position.x = 0;
          bill.position.z = POND_Z * easeInOut(jump);
          bill.position.y = Math.sin(Math.PI * Math.min(1, jump)) * 2.4 - 2.2 * plunge;
          bill.rotation.x = -easeInOut(jump) * 1.5; // nose-down dive
          bill.visible = plunge < 1;
          if (!splashed && plunge > 0) {
            splashed = true;
            ctx.emit({ type: 'cue', name: 'splash' });
            particles.burst(0, 0.3, POND_Z, 34, { color: 0xffffff, speed: 6, up: 7, life: 0.9, size: 1.3, grow: 0.3 });
          }
        }
        particles.update(dt, 0);

        // Camera follows Bill in, then plunges below the surface.
        const dive = easeInOut(span(t, 2.15, DURATION));
        const follow = Math.min(0, bill.position.z);
        camera.position.set(bill.position.x * 0.4, 3.4 + jump * 0.6 - dive * 3.8, 6.5 + follow * 0.6 - dive * 4);
        camera.lookAt(0, 1 - dive * 2.5, follow - 8);
        fade.set(span(t, 2.4, DURATION));

        ctx.setPhaseProgress(Math.min(t, DURATION), DURATION);
        if (t >= DURATION) ctx.completePhase();
      },

      exit() {
        fade.remove();
        ctx.bill.object.rotation.set(0, Math.PI, 0);
        disposeObject(root);
      },

      dispose() {},
    };
  };
}
