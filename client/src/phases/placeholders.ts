// Stand-in phases so the whole run (and death, oxygen failure, heart, retry, victory) is playable
// from hour 2. Each owner REPLACES their placeholder in phases/registry.ts with the real phase.
// These are deliberately crude: don't polish them, and don't copy their rules as the real ones.

import * as THREE from 'three';
import { CONFIG } from '../core/config';
import { LaneMover } from '../core/LaneMover';
import type { Phase, PhaseContext, PhaseFactory } from '../core/types';
import { disposeObject } from '../render/dispose';

const mat = (color: number) => new THREE.MeshStandardMaterial({ color });

/** Runner stand-in: water, three lanes, seeded branches, real damage and the 30% slow. */
export function placeholderRunner(section: 'runner1' | 'runner2', length: number, withHeart: boolean): PhaseFactory {
  return (ctx: PhaseContext): Phase => {
    const group = new THREE.Group();
    const lanes = new LaneMover();
    const rng = ctx.rng(section);
    const branches: { mesh: THREE.Mesh; lane: number; hit: boolean }[] = [];
    let heart: { mesh: THREE.Mesh; lane: number } | null = null;
    let distance = 0;
    let nextSpawnAt = 25;
    let speed = ctx.run.runnerSpeed;

    const spawnBranch = (lane: number, z: number) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 0.6, 0.6), mat(0x6b4423));
      mesh.position.set(CONFIG.runner.lanes[lane], 0.3, z);
      group.add(mesh);
      branches.push({ mesh, lane, hit: false });
    };

    return {
      enter() {
        const water = new THREE.Mesh(new THREE.PlaneGeometry(12, 400), mat(0x2f8fd8));
        water.rotation.x = -Math.PI / 2;
        water.position.z = -150;
        group.add(water);
        for (const x of CONFIG.runner.lanes) {
          const line = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 400), mat(0xbfe6ff));
          line.rotation.x = -Math.PI / 2;
          line.position.set(x, 0.01, -150);
          group.add(line);
        }
        if (withHeart) {
          const lane = rng.int(0, 2);
          const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.5), mat(0xff4f8b));
          mesh.position.set(CONFIG.runner.lanes[lane], 0.8, -(length * 0.8));
          group.add(mesh);
          heart = { mesh, lane };
        }
        ctx.scene.add(group);
        ctx.bill.setPose('run');
      },

      update(dt) {
        const dir = lanes.handle(ctx.input);
        if (dir !== 0) ctx.bill.setPose(dir < 0 ? 'laneLeft' : 'laneRight');
        lanes.update(dt);
        ctx.bill.object.position.x = lanes.x;

        speed = Math.min(CONFIG.runner.maxSpeed, speed + CONFIG.runner.acceleration * dt);
        const step = speed * dt;
        distance += step;

        // Spawn by distance travelled, never by time (brief §9).
        while (distance + 60 > nextSpawnAt && nextSpawnAt < length - 10) {
          spawnBranch(rng.int(0, 2), -(nextSpawnAt - distance));
          nextSpawnAt += 18;
        }

        for (const b of branches) {
          b.mesh.position.z += step;
          if (!b.hit && b.lane === lanes.lane && Math.abs(b.mesh.position.z) < 0.6) {
            b.hit = true;
            if (ctx.damagePlayer()) {
              speed *= CONFIG.runner.hitSpeedMultiplier;
              ctx.bill.setPose('hit');
              ctx.emit({ type: 'cue', name: 'hit' });
            }
          }
        }
        if (heart) {
          heart.mesh.position.z += step;
          if (heart.lane === lanes.lane && Math.abs(heart.mesh.position.z) < 0.7) {
            ctx.gainLife();
            heart.mesh.removeFromParent();
            heart = null;
          }
        }

        ctx.setRunnerSpeed(speed);
        ctx.setPhaseProgress(Math.min(distance, length), length);
        if (distance >= length) ctx.completePhase();
      },

      exit() {
        disposeObject(group);
      },
      dispose() {},
    };
  };
}

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

/** Underwater stand-in: first-person camera, Space-only windows, missed windows cost oxygen. */
export function placeholderUnderwater(windows: number): PhaseFactory {
  return (ctx) => {
    const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 200);
    const group = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.12, 12, 48), mat(0xffcc00));
    const oldBackground = ctx.scene.background;
    const oldFog = ctx.scene.fog;
    const open = 1.0; // seconds each window is open
    const gap = 0.6;
    let t = 0;
    let done = 0;
    let succeeded = false;

    return {
      enter() {
        ctx.bill.object.visible = false;
        ctx.scene.background = new THREE.Color(0x0b3d5c);
        ctx.scene.fog = new THREE.Fog(0x0b3d5c, 5, 40);
        camera.position.set(0, 1.5, 0);
        camera.lookAt(0, 1.5, -10);
        ring.position.set(0, 1.5, -6);
        group.add(ring);
        ctx.scene.add(group);
        ctx.setCamera(camera);
      },
      update(dt) {
        t += dt;
        const inWindow = t > gap && t <= gap + open;
        (ring.material as THREE.MeshStandardMaterial).color.set(
          succeeded ? 0x37d67a : inWindow ? 0xffcc00 : 0x555555,
        );
        ring.rotation.z += dt;
        if (inWindow && !succeeded && ctx.input.spacePressed) {
          succeeded = true;
          ctx.emit({ type: 'cue', name: 'boost' });
        }
        if (t > gap + open) {
          if (!succeeded) ctx.loseOxygen();
          done++;
          t = 0;
          succeeded = false;
          if (done >= windows) ctx.completePhase();
        }
        ctx.setPhaseProgress(done, windows);
      },
      exit() {
        ctx.scene.background = oldBackground;
        ctx.scene.fog = oldFog;
        disposeObject(group);
      },
      dispose() {},
    };
  };
}


/**
 * Boss stand-in (DUCK_RUN_ADDENDUM §1–2): three aimed shots to dodge, then Ready → Aim → Fire.
 *
 * Confirmed and followed here: shots aim at the player, the volley is cleared before the attack,
 * Space only during the attack, damage from reaction time (faster = more), holding Space = Miss
 * for 0, one attack per reload.
 *
 * PLACEHOLDER choices the team has NOT agreed (Zubair must ask before building the real boss):
 * the lane is sampled at the moment of firing, Space during Ready/Aim = Miss, a held key is only
 * checked when Fire appears, no press = Miss, the timings and the linear damage formula.
 */
export function placeholderBoss(): PhaseFactory {
  return (ctx) => {
    const R = CONFIG.boss.reaction;
    const group = new THREE.Group();
    const lanes = new LaneMover();
    const pigeonMat = mat(0x8a8f9c);
    const pigeon = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 3), pigeonMat);
    const bullets: { mesh: THREE.Mesh; lane: number }[] = [];
    const prompt = document.createElement('div');
    prompt.className = 'reaction';

    type Mode = 'dodge' | 'ready' | 'aim' | 'fire' | 'result' | 'won';
    let mode: Mode = 'dodge';
    let t = 0;
    let shots = 0;

    const show = (text: string, fire = false) => {
      prompt.textContent = text;
      prompt.classList.toggle('fire', fire);
      if (!prompt.isConnected) document.getElementById('ui')?.appendChild(prompt);
    };
    const hide = () => prompt.remove();

    const setMode = (next: Mode) => {
      mode = next;
      t = 0;
    };

    const startDodge = () => {
      setMode('dodge');
      shots = 0;
      hide();
      ctx.requestInputMode('lanes');
    };

    const startReload = () => {
      bullets.forEach((b) => b.mesh.removeFromParent());
      bullets.length = 0; // no live bullet during the attack (brief §6)
      setMode('ready');
      ctx.requestInputMode('timing');
      ctx.bill.setPose('idle');
      show('Ready');
    };

    /** PLACEHOLDER formula: linear from maxDamage at 0 ms to minDamage at the end of the window. */
    const reactionDamage = (reactionSec: number) => {
      const k = Math.min(1, Math.max(0, reactionSec / R.fireWindowSec));
      return Math.round(R.maxDamage + (R.minDamage - R.maxDamage) * k);
    };

    const resolve = (text: string, damage: number) => {
      if (damage > 0) {
        ctx.bill.setPose('attack');
        ctx.emit({ type: 'cue', name: 'laser' });
        ctx.damageBoss(damage);
      } else {
        ctx.emit({ type: 'cue', name: 'miss' });
      }
      show(text);
      setMode('result');
    };

    return {
      enter() {
        pigeon.position.set(0, 1.5, -18);
        group.add(pigeon);
        ctx.scene.add(group);
        ctx.bill.setPose('run');
        startDodge();
      },

      update(dt) {
        t += dt;

        if (mode === 'won') {
          pigeon.rotation.z = Math.min(t, 1) * (Math.PI / 2);
          if (t > 1.2) ctx.completePhase();
          return;
        }

        if (mode === 'dodge') {
          const dir = lanes.handle(ctx.input);
          if (dir !== 0) ctx.bill.setPose(dir < 0 ? 'laneLeft' : 'laneRight');
          lanes.update(dt);
          ctx.bill.object.position.x = lanes.x;

          // Wind-up: the pigeon flashes for 0.5 s before each shot, then fires at the duck's lane.
          const nextShotAt = (shots + 1) * CONFIG.boss.shotIntervalSec;
          const windingUp = shots < CONFIG.boss.shotsPerVolley && t > nextShotAt - 0.5;
          pigeonMat.color.set(windingUp ? 0xff8a3d : 0x8a8f9c);
          if (shots < CONFIG.boss.shotsPerVolley && t > nextShotAt) {
            const lane = lanes.lane; // PLACEHOLDER: aim sampled at the moment of firing
            const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.4), mat(0xffe14d));
            mesh.position.set(CONFIG.runner.lanes[lane], 1, pigeon.position.z);
            group.add(mesh);
            bullets.push({ mesh, lane });
            shots++;
            ctx.emit({ type: 'cue', name: 'shot' });
          }
          for (const b of bullets) {
            b.mesh.position.z += 14 * dt;
            if (b.lane === lanes.lane && Math.abs(b.mesh.position.z) < 0.6 && ctx.damagePlayer()) {
              ctx.bill.setPose('hit');
            }
          }
          const allGone = bullets.every((b) => b.mesh.position.z > 3);
          if (shots === CONFIG.boss.shotsPerVolley && allGone) startReload();
          return;
        }

        if (mode === 'ready' || mode === 'aim') {
          // PLACEHOLDER: pressing before Fire uses up this reload's attack as a Miss.
          if (ctx.input.spacePressed) return resolve('Miss: too early', 0);
          const limit = mode === 'ready' ? R.readySec : R.aimSec;
          if (t >= limit) {
            if (mode === 'ready') {
              setMode('aim');
              show('Aim');
              return;
            }
            // Confirmed: a held key is a Miss and never fires by itself.
            if (ctx.input.spaceHeld) return resolve('Miss: Space was held', 0);
            setMode('fire');
            show('FIRE!', true);
          }
          return;
        }

        if (mode === 'fire') {
          if (ctx.input.spacePressed) {
            const damage = reactionDamage(t);
            return resolve(`${Math.round(t * 1000)} ms · ${damage.toLocaleString()} damage`, damage);
          }
          if (t >= R.fireWindowSec) resolve('Miss: too slow', 0); // PLACEHOLDER: no press = 0
          return;
        }

        // mode === 'result': show the outcome briefly, then the next volley or the win.
        if (ctx.run.bossHealth <= 0) {
          hide();
          setMode('won');
          ctx.requestInputMode('none');
          ctx.bill.setPose('victory');
          return;
        }
        if (t > 0.9) {
          ctx.bill.setPose('run');
          startDodge();
        }
      },

      exit() {
        hide();
        disposeObject(group);
      },
      dispose() {},
    };
  };
}
