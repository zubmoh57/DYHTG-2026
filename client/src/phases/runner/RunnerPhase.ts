// Runner 1 and Runner 2 (Tejas): auto-run on water in three lanes, dodge branches with A/D.
// Runner 2 adds breadcrumbs (score only) and the heart before the boss (brief §4).

import * as THREE from 'three';
import { CONFIG } from '../../core/config';
import { LaneMover } from '../../core/LaneMover';
import type { Phase, PhaseContext, PhaseFactory } from '../../core/types';
import type { Course, CourseItem } from '../../course/types';
import { disposeObject } from '../../render/dispose';
import { CameraRig } from './cameraRig';
import { Particles, RunnerWorld, makeBranch, makeCrumb, makeHeart } from './runnerView';
import { buildStarterCourse } from './starterCourse';

export interface RunnerOptions {
  section: 'runner1' | 'runner2';
  length: number;
  crumbs: boolean;
  heart: boolean;
}

/** Half the depth of Bill's hitbox along the track. Items are caught with a swept check. */
const HIT_HALF_DEPTH = 0.45;
const PICKUP_HALF_DEPTH = 0.8;
/** Items are drawn this far ahead; beyond that the fog hides them anyway. */
const VIEW_AHEAD = 130;
const HIT_STOP_SEC = 0.07;

interface Placed {
  item: CourseItem;
  object: THREE.Object3D;
  done: boolean;
  /** Set once hit: the branch tumbles away for a moment. */
  flyT: number;
  phase: number;
}

export function createRunner(options: RunnerOptions): PhaseFactory {
  return (ctx: PhaseContext): Phase => {
    const root = new THREE.Group();
    const world = new RunnerWorld();
    const particles = new Particles(80);
    const rig = new CameraRig(ctx.defaultCamera);
    const lanes = new LaneMover();
    const course: Course = buildStarterCourse(ctx.rng(options.section), options);
    const placed: Placed[] = [];
    const flash = document.createElement('div');
    flash.className = 'screen-flash';

    let distance = 0;
    let speed = ctx.run.runnerSpeed;
    let hitStop = 0;
    let splashTimer = 0;
    let squashT = 1;
    let squashDir = 0;
    let time = 0;

    const flashScreen = (kind: 'hit' | 'heal') => {
      flash.className = 'screen-flash';
      void flash.offsetWidth; // restart the CSS animation
      flash.className = `screen-flash ${kind}`;
    };

    const onHit = (p: Placed) => {
      if (!ctx.damagePlayer()) return; // still invulnerable: no life lost, no slowdown
      speed *= CONFIG.runner.hitSpeedMultiplier; // confirmed: -30%, even mid-acceleration
      hitStop = HIT_STOP_SEC;
      rig.addTrauma(0.55);
      flashScreen('hit');
      ctx.bill.setPose('hit');
      ctx.emit({ type: 'cue', name: 'hit' });
      p.flyT = 0.0001;
      particles.burst(lanes.x, 0.4, -0.3, 14, { color: 0x8a5a2b, speed: 5, up: 5, life: 0.6, size: 1.2, grow: 0.2 });
      particles.burst(lanes.x, 0.1, -0.3, 10, { color: 0xffffff, speed: 3, up: 4, life: 0.5 });
    };

    const onPickup = (p: Placed) => {
      p.done = true;
      p.object.visible = false;
      const z = p.object.position.z;
      if (p.item.kind === 'crumb') {
        ctx.addScore(CONFIG.score.perBreadcrumb);
        ctx.emit({ type: 'cue', name: 'crumb' });
        particles.burst(lanes.x, 0.8, z, 6, { color: 0xffd98a, speed: 2, up: 3, life: 0.35, size: 0.8 });
      } else if (ctx.gainLife()) {
        ctx.emit({ type: 'cue', name: 'heart' });
        flashScreen('heal');
        particles.burst(lanes.x, 1.1, z, 16, { color: 0xff7aa8, speed: 4, up: 4, life: 0.6 });
      }
    };

    return {
      enter() {
        for (const item of course.items) {
          const object = item.kind === 'branch' ? makeBranch(item.lanes) : item.kind === 'crumb' ? makeCrumb() : makeHeart();
          if (item.kind !== 'branch') object.position.x = CONFIG.runner.lanes[item.lanes[0]];
          object.visible = false;
          root.add(object);
          placed.push({ item, object, done: false, flyT: 0, phase: Math.random() * Math.PI * 2 });
        }
        root.add(world.group, particles.group);
        ctx.scene.add(root);
        document.getElementById('ui')?.appendChild(flash);
        ctx.bill.setPose('run');
      },

      update(dt) {
        time += dt;

        // Steering works even during hit-stop, so the freeze never eats an input.
        const dir = lanes.handle(ctx.input);
        if (dir !== 0) {
          ctx.bill.setPose(dir < 0 ? 'laneLeft' : 'laneRight');
          ctx.emit({ type: 'cue', name: 'laneChange' });
          squashT = 0;
          squashDir = dir;
        }
        lanes.update(dt);

        // Hit-stop: the world freezes for a beat on impact. Bill and the camera keep moving.
        const worldDt = hitStop > 0 ? 0 : dt;
        hitStop = Math.max(0, hitStop - dt);

        speed = Math.min(CONFIG.runner.maxSpeed, speed + CONFIG.runner.acceleration * worldDt);
        const previous = distance;
        const step = speed * worldDt;
        distance = Math.min(course.length, distance + step);

        world.scroll(distance, step);

        for (const p of placed) {
          const z = -(p.item.distance - distance);
          if (p.flyT > 0) {
            // The branch Bill smashed tumbles up and away.
            p.flyT += dt;
            p.object.position.set(p.object.position.x, 0.3 + p.flyT * 6 - p.flyT * p.flyT * 14, z - p.flyT * 4);
            p.object.rotation.x += dt * 9;
            if (p.flyT > 0.6) p.object.visible = false;
            continue;
          }
          if (p.done) continue;

          // Swept check: did Bill's hitbox pass over this item since last frame? (No tunnelling.)
          const half = p.item.kind === 'branch' ? HIT_HALF_DEPTH : PICKUP_HALF_DEPTH;
          const crossed = previous <= p.item.distance + half && distance >= p.item.distance - half;
          if (crossed && p.item.lanes.includes(lanes.lane)) {
            if (p.item.kind === 'branch') {
              p.done = true;
              onHit(p);
            } else {
              onPickup(p);
            }
            continue;
          }
          if (distance > p.item.distance + half) {
            p.done = true; // passed safely
          }

          const ahead = p.item.distance - distance;
          p.object.visible = ahead < VIEW_AHEAD && ahead > -12;
          if (!p.object.visible) continue;
          p.object.position.z = z;
          if (p.item.kind === 'branch') {
            p.object.position.y = Math.sin(time * 2 + p.phase) * 0.05; // bobbing on the water
            p.object.rotation.z = Math.sin(time * 1.5 + p.phase) * 0.03;
          } else {
            p.object.rotation.y += dt * 2.5;
            p.object.position.y = (p.item.kind === 'heart' ? 1.1 : 0.7) + Math.sin(time * 3 + p.phase) * 0.12;
          }
        }

        // Bill: lane position, a squash-and-stretch pop on lane changes, splashes at his feet.
        const bill = ctx.bill.object;
        bill.position.x = lanes.x;
        squashT = Math.min(1, squashT + dt / 0.2);
        const back = 1 + 2.2 * Math.pow(squashT - 1, 3) + 1.2 * Math.pow(squashT - 1, 2); // ease-out-back
        // Stretch along the dash (wider, shorter), then spring back past 1 and settle.
        bill.scale.set(1 + 0.15 * (1 - back), 1 - 0.12 * (1 - back), 1);
        bill.rotation.z = -squashDir * 0.12 * (1 - squashT);

        // Blink while invulnerable after a hit.
        const invulnerable = performance.now() < ctx.run.invulnerableUntilMs;
        bill.visible = !invulnerable || Math.floor(performance.now() / 70) % 2 === 0;

        splashTimer -= worldDt;
        if (splashTimer <= 0 && worldDt > 0) {
          splashTimer = 0.09;
          particles.burst(lanes.x, 0.03, 0.2, 2, { color: 0xe8f7ff, speed: 1.4, up: 2.4, life: 0.28, size: 0.55, grow: 0.5 });
        }
        particles.update(dt, step);

        const speed01 = (speed - CONFIG.runner.startSpeed) / (CONFIG.runner.maxSpeed - CONFIG.runner.startSpeed);
        rig.update(dt, lanes.x, Math.max(0, speed01));

        ctx.setRunnerSpeed(speed);
        ctx.setPhaseProgress(distance, course.length);
        if (distance >= course.length) ctx.completePhase();
      },

      exit() {
        flash.remove();
        ctx.bill.object.scale.set(1, 1, 1);
        ctx.bill.object.rotation.z = 0;
        disposeObject(root);
      },

      dispose() {},
    };
  };
}
