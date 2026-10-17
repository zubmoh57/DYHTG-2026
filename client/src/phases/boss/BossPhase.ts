// The pigeon boss (Tejas renders; Zubair's sim/boss.ts decides). Dodge three aimed shots with A/D,
// then react to Ready → Aim → green FIRE with Space for the laser (GAME_BRIEF §6, ZUBAIR_BASE.md).

import * as THREE from 'three';
import { CONFIG } from '../../core/config';
import { LaneMover } from '../../core/LaneMover';
import type { Phase, PhaseContext, PhaseFactory } from '../../core/types';
import { disposeObject } from '../../render/dispose';
import {
  advanceBossReload,
  beginBossReload,
  beginNextBossVolley,
  createBoss,
  fireBossShot,
  getBossPrompt,
  pressBossAttack,
  resolveBossProjectile,
  type BossAttackResult,
} from '../../sim/boss';
import { CameraRig } from '../runner/cameraRig';
import { Particles, RunnerWorld } from '../runner/runnerView';
import { Laser, PigeonView, makeBullet } from './pigeonView';

const PIGEON_Z = -17;
const RESULT_SEC = 1.1;
const R = CONFIG.boss.reaction;

/** PLACEHOLDER curve (UNDECIDED): linear from maxDamage at 0 ms to minDamage at the end of Fire. */
const damageForReaction = (reactionMs: number) => {
  const k = Math.min(1, Math.max(0, reactionMs / (R.fireWindowSec * 1000)));
  return Math.round(R.maxDamage + (R.minDamage - R.maxDamage) * k);
};

interface Bullet {
  id: number;
  mesh: THREE.Mesh;
  lane: number;
  from: THREE.Vector3;
  t: number;
  duration: number;
}

export function createBossPhase(): PhaseFactory {
  return (ctx: PhaseContext): Phase => {
    const sim = createBoss({
      readyMs: R.readySec * 1000,
      aimMs: R.aimSec * 1000,
      fireMs: R.fireWindowSec * 1000,
      damageForReaction,
      noPressDamage: R.noPressDamage,
    });
    const root = new THREE.Group();
    const world = new RunnerWorld();
    const pigeon = new PigeonView();
    const laser = new Laser();
    const particles = new Particles(70);
    const rig = new CameraRig(ctx.defaultCamera);
    const lanes = new LaneMover();
    const bullets: Bullet[] = [];
    const prompt = document.createElement('div');
    prompt.className = 'reaction';

    let volleyT = 0; // seconds since this volley started
    let resultT = -1; // seconds the last attack result has been on screen
    let wonT = -1;
    let drift = 0;

    const say = (text: string, kind: '' | 'fire' | 'good' | 'bad' = '') => {
      prompt.textContent = text;
      prompt.className = `reaction ${kind}`.trim();
      if (!prompt.isConnected) document.getElementById('ui')?.appendChild(prompt);
    };

    const showResult = (result: BossAttackResult) => {
      resultT = 0;
      ctx.requestInputMode('none');
      if (result.damage > 0) ctx.damageBoss(result.damage); // mirror the sim's HP once, never subtract twice
      if (result.reason === 'reaction') {
        const from = ctx.bill.object.position.clone().add(new THREE.Vector3(0, 1.45, -0.4));
        const to = pigeon.root.position.clone().add(new THREE.Vector3(0, 3.2, 0));
        laser.fire(from, to);
        pigeon.hit();
        rig.addTrauma(0.35);
        ctx.bill.setPose('attack');
        ctx.emit({ type: 'cue', name: 'laser' });
        particles.burst(to.x, to.y, to.z + 0.8, 18, { color: 0xb8bcc8, speed: 6, up: 4, life: 0.8, size: 1.3, grow: 0.2 });
        say(`${Math.round(result.reactionMs ?? 0)} ms · ${result.damage.toLocaleString()} damage`, 'good');
      } else {
        ctx.emit({ type: 'cue', name: 'miss' });
        const text =
          result.reason === 'early'
            ? 'Too early! 1 damage'
            : result.reason === 'held'
              ? 'Space was held! 1 damage'
              : `Too slow!${result.damage ? ` ${result.damage} damage` : ''}`;
        say(text, 'bad');
      }
    };

    const startVolley = () => {
      volleyT = 0;
      resultT = -1;
      prompt.remove();
      ctx.requestInputMode('lanes');
      ctx.bill.setPose('run');
    };

    const spawnBullet = (id: number) => {
      // PLACEHOLDER targeting (UNDECIDED): aim at the duck's lane when fired, then fly straight.
      const lane = lanes.lane;
      const mesh = makeBullet();
      const from = pigeon.muzzleWorld(new THREE.Vector3());
      mesh.position.copy(from);
      root.add(mesh);
      bullets.push({ id, mesh, lane, from, t: 0, duration: -from.z / CONFIG.boss.bulletSpeed });
      pigeon.fire();
      rig.addTrauma(0.12);
      ctx.emit({ type: 'cue', name: 'shot' });
    };

    return {
      enter() {
        pigeon.root.position.set(0, 0, PIGEON_Z);
        root.add(world.group, pigeon.root, laser.mesh, particles.group);
        ctx.scene.add(root);
        startVolley();
      },

      update(dt) {
        drift += dt * 2;
        world.scroll(drift, dt * 2); // the water keeps flowing gently in the arena
        pigeon.update(dt);
        laser.update(dt);
        particles.update(dt, 0);

        if (wonT >= 0) {
          wonT += dt;
          if (wonT > 2) ctx.completePhase();
          rig.update(dt, lanes.x, 0);
          return;
        }

        if (sim.phase === 'volley') {
          volleyT += dt;
          const dir = lanes.handle(ctx.input);
          if (dir !== 0) ctx.bill.setPose(dir < 0 ? 'laneLeft' : 'laneRight');
          lanes.update(dt);
          pigeon.aimAt(lanes.x, dt);

          // Three shots, each after a visible wind-up (the muzzle glows, then fires).
          const nextShotAt = (sim.shotsFired + 1) * CONFIG.boss.shotIntervalSec;
          const windUp = sim.shotsFired < 3 ? 1 - (nextShotAt - volleyT) / CONFIG.boss.windUpSec : 0;
          pigeon.setWindUp(Math.max(0, Math.min(1, windUp)));
          if (sim.shotsFired < 3 && volleyT >= nextShotAt) {
            const id = fireBossShot(sim);
            if (id !== null) spawnBullet(id);
          }

          for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            b.t += dt;
            const k = b.t / b.duration; // 1 = level with the duck
            b.mesh.position.set(
              b.from.x + (CONFIG.runner.lanes[b.lane] - b.from.x) * k,
              b.from.y + (1 - b.from.y) * k,
              b.from.z * (1 - k),
            );
            const reached = k >= 1;
            const hits = reached && b.lane === lanes.lane;
            if (hits && ctx.damagePlayer()) {
              ctx.bill.setPose('hit');
              rig.addTrauma(0.5);
              particles.burst(lanes.x, 1, 0, 12, { color: 0xffa040, speed: 4, up: 3, life: 0.5 });
            }
            // Only resolve once the bullet can no longer hurt the duck (ZUBAIR_BASE.md step 3).
            if (hits || k > 1.15) {
              b.mesh.removeFromParent();
              resolveBossProjectile(sim, b.id);
              bullets.splice(i, 1);
            }
          }

          if (beginBossReload(sim)) {
            ctx.requestInputMode('timing'); // Space only; the duck can't move now
            ctx.bill.setPose('idle');
            pigeon.setWindUp(0);
          }
        } else if (sim.phase === 'reload' && resultT < 0) {
          // Advance with the held state from BEFORE this frame's press, then apply the press.
          const heldBefore = ctx.input.spaceHeld && !ctx.input.spacePressed;
          let result = advanceBossReload(sim, dt * 1000, heldBefore);
          if (!result && ctx.input.spacePressed) result = pressBossAttack(sim);
          if (result) showResult(result);
          else {
            const p = getBossPrompt(sim);
            if (p === 'ready') say('Ready');
            else if (p === 'aim') say('Aim');
            else if (p === 'fire') say('FIRE!', 'fire');
          }
        } else if (resultT >= 0) {
          resultT += dt;
          if (resultT >= RESULT_SEC) {
            if (beginNextBossVolley(sim)) startVolley();
            else if (sim.phase === 'defeated') {
              wonT = 0;
              prompt.remove();
              pigeon.defeat();
              ctx.bill.setPose('victory');
              ctx.emit({ type: 'cue', name: 'bossDefeated' });
              particles.burst(0, 3, PIGEON_Z + 1, 30, { color: 0xc8ccd6, speed: 7, up: 6, life: 1.2, size: 1.4, grow: 0.1 });
            }
          }
        }

        ctx.bill.object.position.x = lanes.x;
        const invulnerable = performance.now() < ctx.run.invulnerableUntilMs;
        ctx.bill.object.visible = !invulnerable || Math.floor(performance.now() / 70) % 2 === 0;
        rig.update(dt, lanes.x, 0);
        ctx.setPhaseProgress(CONFIG.boss.health - sim.hp, CONFIG.boss.health);
      },

      exit() {
        prompt.remove();
        disposeObject(root);
      },

      dispose() {},
    };
  };
}
