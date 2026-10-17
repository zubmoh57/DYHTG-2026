// Runner visuals (Tejas): water, banks, branches, breadcrumbs, the heart and splashes.
// Render-only. Collision uses lanes and distances from the course, never these meshes.
// Cosmetic randomness uses Math.random() on purpose: it must not touch the seeded gameplay RNG.

import * as THREE from 'three';
import { CONFIG } from '../../core/config';
import type { Lane } from '../../course/types';

const LANES = CONFIG.runner.lanes;
const LANE_WIDTH = 2.5;
const WATER_WIDTH = 26;
const STRIP_LENGTH = 320;
const STRIP_NEAR = 30; // how far the water reaches behind the camera
const TILE = 8; // world units per repeat of the water texture

const PALETTE = {
  water: '#2e8ed6',
  ripple: 'rgba(255,255,255,0.35)',
  lanes: 0x5fb4ef,
  divider: 0xe8f6ff,
  grass: '#5dbb63',
  grassDark: 'rgba(40,110,50,0.35)',
  reed: 0x3f8f45,
  reedTip: 0x8a5a2b,
  lily: 0x48a858,
  log: 0x7a4a24,
  logEnd: 0xc8925a,
  leaf: 0x3e9c4a,
  crumb: 0xe2b26a,
  heart: 0xff4f8b,
};

function canvasTexture(draw: (g: CanvasRenderingContext2D, size: number) => void, size = 256): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  draw(canvas.getContext('2d')!, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** A long strip of scrolling ground. Moving the texture (not the mesh) makes the world feel fast. */
function scrollingStrip(texture: THREE.CanvasTexture, width: number, x: number, y: number): THREE.Mesh {
  texture.repeat.set(width / TILE, STRIP_LENGTH / TILE);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, STRIP_LENGTH),
    new THREE.MeshStandardMaterial({ map: texture, roughness: 0.35, metalness: 0.05 }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, y, STRIP_NEAR - STRIP_LENGTH / 2);
  mesh.receiveShadow = true;
  return mesh;
}

export class RunnerWorld {
  readonly group = new THREE.Group();
  private readonly scrolling: THREE.CanvasTexture[] = [];
  private readonly drifters: THREE.Object3D[] = [];

  constructor() {
    const water = canvasTexture((g, s) => {
      g.fillStyle = PALETTE.water;
      g.fillRect(0, 0, s, s);
      g.strokeStyle = PALETTE.ripple;
      g.lineWidth = 3;
      for (let i = 0; i < 26; i++) {
        const x = Math.random() * s;
        const y = Math.random() * s;
        const w = 14 + Math.random() * 28;
        g.beginPath();
        g.ellipse(x, y, w, w * 0.22, 0, Math.PI * 1.1, Math.PI * 1.9);
        g.stroke();
      }
    });
    this.scrolling.push(water);
    this.group.add(scrollingStrip(water, WATER_WIDTH, 0, 0));

    // A slightly lighter band over the three lanes, with two divider lines, so lanes read instantly.
    const band = new THREE.Mesh(
      new THREE.PlaneGeometry(LANE_WIDTH * 3, STRIP_LENGTH),
      new THREE.MeshBasicMaterial({ color: PALETTE.lanes, transparent: true, opacity: 0.25 }),
    );
    band.rotation.x = -Math.PI / 2;
    band.position.set(0, 0.01, STRIP_NEAR - STRIP_LENGTH / 2);
    this.group.add(band);
    for (const x of [-LANE_WIDTH / 2, LANE_WIDTH / 2]) {
      const line = new THREE.Mesh(
        new THREE.PlaneGeometry(0.07, STRIP_LENGTH),
        new THREE.MeshBasicMaterial({ color: PALETTE.divider, transparent: true, opacity: 0.45 }),
      );
      line.rotation.x = -Math.PI / 2;
      line.position.set(x, 0.02, STRIP_NEAR - STRIP_LENGTH / 2);
      this.group.add(line);
    }

    for (const side of [-1, 1]) {
      const grass = canvasTexture((g, s) => {
        g.fillStyle = PALETTE.grass;
        g.fillRect(0, 0, s, s);
        g.fillStyle = PALETTE.grassDark;
        for (let i = 0; i < 60; i++) g.fillRect(Math.random() * s, Math.random() * s, 3, 10 + Math.random() * 12);
      });
      this.scrolling.push(grass);
      this.group.add(scrollingStrip(grass, 40, side * (WATER_WIDTH / 2 + 20), 0.15));

      // Reeds along the bank and lily pads on the outer water, recycled as the world scrolls.
      for (let i = 0; i < 26; i++) {
        const reed = new THREE.Group();
        const stalk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.05, 0.07, 1.6, 5),
          new THREE.MeshStandardMaterial({ color: PALETTE.reed }),
        );
        stalk.position.y = 0.8;
        const tip = new THREE.Mesh(
          new THREE.CylinderGeometry(0.1, 0.1, 0.45, 6),
          new THREE.MeshStandardMaterial({ color: PALETTE.reedTip }),
        );
        tip.position.y = 1.55;
        reed.add(stalk, tip);
        reed.position.set(side * (WATER_WIDTH / 2 - 0.5 + Math.random() * 2), 0, -Math.random() * 220);
        reed.rotation.z = (Math.random() - 0.5) * 0.25;
        this.group.add(reed);
        this.drifters.push(reed);
      }
      for (let i = 0; i < 10; i++) {
        const lily = new THREE.Mesh(
          new THREE.CylinderGeometry(0.6 + Math.random() * 0.4, 0.6, 0.05, 12, 1, false, 0.3, Math.PI * 1.85),
          new THREE.MeshStandardMaterial({ color: PALETTE.lily }),
        );
        lily.position.set(side * (5.5 + Math.random() * 5), 0.03, -Math.random() * 220);
        lily.rotation.y = Math.random() * Math.PI * 2;
        this.group.add(lily);
        this.drifters.push(lily);
      }
    }
  }

  /** Move the world towards the camera by `step` units. */
  scroll(distance: number, step: number): void {
    const offset = distance / TILE;
    for (const t of this.scrolling) t.offset.y = offset;
    for (const d of this.drifters) {
      d.position.z += step;
      if (d.position.z > STRIP_NEAR) d.position.z -= 220;
    }
  }
}

// --- Course items --------------------------------------------------------------------------

const logMaterial = () => new THREE.MeshStandardMaterial({ color: PALETTE.log, roughness: 0.9 });

/** A branch lying across one or more lanes. Neighbouring lanes become one long log. */
export function makeBranch(lanes: Lane[]): THREE.Group {
  const group = new THREE.Group();
  const sorted = [...lanes].sort();
  const runs: Lane[][] = [];
  for (const lane of sorted) {
    const last = runs[runs.length - 1];
    if (last && lane === last[last.length - 1] + 1) last.push(lane);
    else runs.push([lane]);
  }

  for (const run of runs) {
    const x = run.reduce<number>((sum, l) => sum + LANES[l], 0) / run.length;
    const width = run.length * LANE_WIDTH - 0.35;
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, width, 10), logMaterial());
    log.rotation.z = Math.PI / 2;
    log.position.set(x, 0.3, 0);
    log.castShadow = true;
    group.add(log);

    for (const end of [-1, 1]) {
      const cap = new THREE.Mesh(
        new THREE.CircleGeometry(0.3, 10),
        new THREE.MeshStandardMaterial({ color: PALETTE.logEnd }),
      );
      cap.position.set(x + end * (width / 2 + 0.005), 0.3, 0);
      cap.rotation.y = (end * Math.PI) / 2;
      group.add(cap);
    }

    // A couple of twigs with leaves, so it reads as a branch and not a pipe.
    for (let i = 0; i < run.length + 1; i++) {
      const tx = x - width / 2 + ((i + 0.5) / (run.length + 1)) * width;
      const twig = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 1.1, 5), logMaterial());
      twig.position.set(tx, 0.75, 0);
      twig.rotation.z = (Math.random() - 0.5) * 1.2;
      group.add(twig);
      const leaf = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.32, 0),
        new THREE.MeshStandardMaterial({ color: PALETTE.leaf, flatShading: true }),
      );
      leaf.position.set(tx + twig.rotation.z * -0.4, 1.25, 0);
      group.add(leaf);
    }
  }
  return group;
}

export function makeCrumb(): THREE.Mesh {
  const crumb = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.3, 0.45),
    new THREE.MeshStandardMaterial({ color: PALETTE.crumb, emissive: 0x6b4a10, emissiveIntensity: 0.35, roughness: 0.8 }),
  );
  crumb.position.y = 0.7;
  crumb.castShadow = true;
  return crumb;
}

export function makeHeart(): THREE.Mesh {
  const shape = new THREE.Shape();
  shape.moveTo(5, 5);
  shape.bezierCurveTo(5, 5, 4, 0, 0, 0);
  shape.bezierCurveTo(-6, 0, -6, 7, -6, 7);
  shape.bezierCurveTo(-6, 11, -3, 15.4, 5, 19);
  shape.bezierCurveTo(12, 15.4, 16, 11, 16, 7);
  shape.bezierCurveTo(16, 7, 16, 0, 10, 0);
  shape.bezierCurveTo(7, 0, 5, 5, 5, 5);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 4,
    bevelEnabled: true,
    bevelSize: 1,
    bevelThickness: 1,
    bevelSegments: 2,
  });
  geometry.center();
  geometry.rotateZ(Math.PI); // the shape is drawn point-up
  geometry.scale(0.05, 0.05, 0.05);
  const heart = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color: PALETTE.heart, emissive: 0xc0124f, emissiveIntensity: 0.45 }),
  );
  heart.position.y = 1.1;
  heart.castShadow = true;
  return heart;
}

// --- Particles -------------------------------------------------------------------------------

interface Particle {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  velocity: THREE.Vector3;
  age: number;
  life: number;
  grow: number;
}

/** A small pool of blobs for splashes, wood chips and crumb pops. They drift with the world. */
export class Particles {
  readonly group = new THREE.Group();
  private readonly pool: Particle[] = [];
  private cursor = 0;

  constructor(size = 60) {
    const geometry = new THREE.SphereGeometry(0.1, 6, 5);
    for (let i = 0; i < size; i++) {
      const material = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.visible = false;
      this.group.add(mesh);
      this.pool.push({ mesh, material, velocity: new THREE.Vector3(), age: 0, life: 0, grow: 0 });
    }
  }

  burst(
    x: number,
    y: number,
    z: number,
    count: number,
    options: { color: number; speed: number; up: number; life: number; size?: number; grow?: number },
  ): void {
    for (let i = 0; i < count; i++) {
      const p = this.pool[this.cursor];
      this.cursor = (this.cursor + 1) % this.pool.length;
      p.mesh.visible = true;
      p.mesh.position.set(x + (Math.random() - 0.5) * 0.3, y, z + (Math.random() - 0.5) * 0.3);
      p.mesh.scale.setScalar(options.size ?? 1);
      p.material.color.setHex(options.color);
      p.material.opacity = 1;
      p.velocity.set(
        (Math.random() - 0.5) * options.speed,
        options.up * (0.6 + Math.random() * 0.6),
        (Math.random() - 0.3) * options.speed,
      );
      p.age = 0;
      p.life = options.life * (0.7 + Math.random() * 0.6);
      p.grow = options.grow ?? 1.5;
    }
  }

  update(dt: number, worldStep: number): void {
    for (const p of this.pool) {
      if (!p.mesh.visible) continue;
      p.age += dt;
      if (p.age >= p.life) {
        p.mesh.visible = false;
        continue;
      }
      p.velocity.y -= 12 * dt;
      p.mesh.position.addScaledVector(p.velocity, dt);
      p.mesh.position.z += worldStep;
      if (p.mesh.position.y < 0.02) {
        p.mesh.position.y = 0.02;
        p.velocity.set(0, 0, 0);
      }
      const k = p.age / p.life;
      p.material.opacity = 1 - k * k;
      p.mesh.scale.multiplyScalar(1 + p.grow * dt);
    }
  }
}
