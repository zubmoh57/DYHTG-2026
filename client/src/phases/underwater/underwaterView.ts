// Underwater scenery seen from inside the sub (Tejas). Render-only: speed and distance come from
// Zubair's sim/underwater.ts. Cosmetic randomness uses Math.random() on purpose.

import * as THREE from 'three';

const SEABED_Y = -5;
const FAR = 120;
const NEAR = 6;
const TILE = 10;

export const SEA_COLOR = 0x0b4a6e;

interface Drifter {
  object: THREE.Object3D;
  /** Extra sideways/vertical motion so fish swim and bubbles rise. */
  vx: number;
  vy: number;
  sway: number;
}

function sandTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#c9b27a';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = 'rgba(120,95,50,0.35)';
  for (let i = 0; i < 90; i++) g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  g.strokeStyle = 'rgba(255,255,255,0.12)';
  for (let i = 0; i < 6; i++) {
    g.beginPath();
    g.moveTo(0, i * 22 + 8);
    g.bezierCurveTo(40, i * 22, 88, i * 22 + 16, 128, i * 22 + 8);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class UnderwaterWorld {
  readonly group = new THREE.Group();
  private readonly sand: THREE.CanvasTexture;
  private readonly drifters: Drifter[] = [];
  private time = 0;

  constructor() {
    this.sand = sandTexture();
    this.sand.repeat.set(80 / TILE, (FAR + NEAR) / TILE);
    const seabed = new THREE.Mesh(
      new THREE.PlaneGeometry(80, FAR + NEAR),
      new THREE.MeshStandardMaterial({ map: this.sand, roughness: 1 }),
    );
    seabed.rotation.x = -Math.PI / 2;
    seabed.position.set(0, SEABED_Y, NEAR - (FAR + NEAR) / 2);
    this.group.add(seabed);

    const kelpMat = new THREE.MeshStandardMaterial({ color: 0x2f8f4e, flatShading: true });
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x5b6470, flatShading: true });
    const fishColors = [0xff9f1c, 0xffd23f, 0xff5d73, 0x4fc3f7];
    const bubbleMat = new THREE.MeshBasicMaterial({ color: 0xcfefff, transparent: true, opacity: 0.55 });

    const place = (o: THREE.Object3D, side: 'any' | 'edge') => {
      const x = side === 'edge' ? (Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 14) : (Math.random() - 0.5) * 24;
      o.position.set(x, o.position.y, -Math.random() * FAR);
    };

    for (let i = 0; i < 40; i++) {
      const height = 3 + Math.random() * 5;
      const kelp = new THREE.Mesh(new THREE.BoxGeometry(0.25, height, 0.08), kelpMat);
      kelp.geometry.translate(0, height / 2, 0);
      kelp.position.y = SEABED_Y;
      place(kelp, 'edge');
      this.group.add(kelp);
      this.drifters.push({ object: kelp, vx: 0, vy: 0, sway: Math.random() * 6 });
    }
    for (let i = 0; i < 18; i++) {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6 + Math.random() * 1.4, 0), rockMat);
      rock.position.y = SEABED_Y + 0.3;
      rock.rotation.set(Math.random(), Math.random(), Math.random());
      place(rock, 'edge');
      this.group.add(rock);
      this.drifters.push({ object: rock, vx: 0, vy: 0, sway: 0 });
    }
    for (let i = 0; i < 14; i++) {
      const fish = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color: fishColors[i % fishColors.length] });
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), mat);
      body.scale.set(1.6, 1, 0.7);
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.35, 4), mat);
      tail.rotation.z = Math.PI / 2;
      tail.position.x = -0.6;
      fish.add(body, tail);
      fish.position.y = SEABED_Y + 1.5 + Math.random() * 6;
      const vx = (Math.random() < 0.5 ? -1 : 1) * (1 + Math.random() * 2);
      fish.rotation.y = vx > 0 ? 0 : Math.PI;
      place(fish, 'any');
      this.group.add(fish);
      this.drifters.push({ object: fish, vx, vy: 0, sway: Math.random() * 6 });
    }
    for (let i = 0; i < 50; i++) {
      const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.05 + Math.random() * 0.08, 6, 5), bubbleMat);
      bubble.position.y = SEABED_Y + Math.random() * 9;
      place(bubble, 'any');
      this.group.add(bubble);
      this.drifters.push({ object: bubble, vx: 0, vy: 0.6 + Math.random() * 0.8, sway: Math.random() * 6 });
    }
  }

  /** Move everything towards the sub by `step` units. */
  update(dt: number, distance: number, step: number): void {
    this.time += dt;
    this.sand.offset.y = distance / TILE;
    for (const d of this.drifters) {
      const o = d.object;
      o.position.z += step;
      o.position.x += d.vx * dt;
      if (d.vy) {
        o.position.y += d.vy * dt;
        if (o.position.y > SEABED_Y + 10) o.position.y = SEABED_Y;
      }
      if (d.sway && !d.vx && !d.vy) o.rotation.z = Math.sin(this.time * 1.3 + d.sway) * 0.12; // kelp sways
      if (o.position.z > NEAR) {
        o.position.z -= FAR + NEAR;
        if (d.vx) o.position.x = (Math.random() - 0.5) * 24;
      }
      if (Math.abs(o.position.x) > 20) o.position.x = -Math.sign(o.position.x) * 19;
    }
  }
}
