// Shared bits for the two transitions (Tejas): a screen fade, easing, and the models they need
// (the submarine, the fishing hook with its dollar, Bill's dollar-sign eyes). Render-only.

import * as THREE from 'three';

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
/** 0..1 progress of `t` through the window [from, to]. */
export const span = (t: number, from: number, to: number) => clamp01((t - from) / (to - from));
export const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
export const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
export const easeOutBack = (x: number) => 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2);

/** A full-screen colour fade on top of the game. */
export class Fade {
  readonly element = document.createElement('div');

  constructor(color: string) {
    this.element.className = 'fade';
    this.element.style.background = color;
    this.element.style.opacity = '0';
  }

  mount(): void {
    document.getElementById('ui')?.appendChild(this.element);
  }

  set(opacity: number): void {
    this.element.style.opacity = clamp01(opacity).toFixed(3);
  }

  remove(): void {
    this.element.remove();
  }
}

const std = (color: number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...extra });

/** Height of the open hatch above the waterline when the sub has surfaced. */
export const HATCH_HEIGHT = 2.75;

/** A cartoon yellow submarine. Its origin is the hatch's centre at the waterline. */
export class Submarine {
  readonly root = new THREE.Group();
  readonly lid = new THREE.Group();

  constructor() {
    const yellow = std(0xf2c12e);
    const darkYellow = std(0xd9a21b);
    const metal = std(0x6c7a86, { metalness: 0.6, roughness: 0.35 });

    const hull = new THREE.Mesh(new THREE.CapsuleGeometry(1.4, 5.2, 8, 20), yellow);
    hull.rotation.x = Math.PI / 2;
    hull.position.set(0, 0, -0.8);
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.95, 1.4, 20), darkYellow);
    tower.position.y = 1.95;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.09, 10, 24), metal);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = HATCH_HEIGHT;
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.52, 24), std(0x111417));
    hole.rotation.x = -Math.PI / 2;
    hole.position.y = HATCH_HEIGHT + 0.005;

    // The lid hinges at the back of the rim.
    const lidDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.1, 24), metal);
    lidDisc.position.z = 0.58;
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.04, 8, 16), std(0xc0392b));
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(0, 0.08, 0.58);
    this.lid.add(lidDisc, wheel);
    this.lid.position.set(0, HATCH_HEIGHT, -0.58);
    this.setLid(1);

    const periscope = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.2, 8), metal);
    pole.position.y = 0.6;
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.4), metal);
    eye.position.set(0, 1.2, 0.12);
    periscope.add(pole, eye);
    periscope.position.set(0.45, 2.6, -0.4);

    const portMat = std(0x1d3557, { metalness: 0.3, roughness: 0.2 });
    for (let i = 0; i < 3; i++) {
      for (const side of [-1, 1]) {
        const port = new THREE.Mesh(new THREE.CircleGeometry(0.24, 16), portMat);
        port.position.set(side * 1.41, 0.3, 1.2 - i * 1.5);
        port.rotation.y = side * (Math.PI / 2);
        this.root.add(port);
      }
    }
    const prop = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.18, 0.08), metal);
    prop.position.set(0, 0, -4.4);
    this.root.add(hull, tower, rim, hole, this.lid, periscope, prop);
    this.root.traverse((o) => (o.castShadow = true));
  }

  /** 1 = lid wide open, 0 = shut. */
  setLid(open: number): void {
    this.lid.rotation.x = -open * 1.9;
  }
}

function dollarTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#6fbf73';
  g.fillRect(0, 0, 256, 128);
  g.strokeStyle = '#2e7d32';
  g.lineWidth = 8;
  g.strokeRect(8, 8, 240, 112);
  g.fillStyle = '#e8f5e9';
  g.beginPath();
  g.ellipse(128, 64, 34, 40, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#1b5e20';
  g.font = 'bold 56px Arial';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('$', 128, 66);
  g.font = 'bold 26px Arial';
  g.fillText('100', 44, 34);
  g.fillText('100', 212, 96);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A fishing hook with a dollar bill on it, hanging from a line. Origin = the bottom of the hook. */
export class DollarHook {
  readonly root = new THREE.Group();

  constructor() {
    const metal = new THREE.MeshStandardMaterial({ color: 0xc8cdd3, metalness: 0.85, roughness: 0.25 });
    const line = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 30, 4),
      new THREE.MeshBasicMaterial({ color: 0xf5f5f5, transparent: true, opacity: 0.7 }),
    );
    line.position.y = 15.6;
    const shank = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 8), metal);
    shank.position.y = 0.4;
    const bend = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.03, 8, 20, Math.PI * 1.3), metal);
    bend.rotation.z = Math.PI;
    bend.position.set(0.16, 0.1, 0);
    const bill = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 0.45),
      new THREE.MeshStandardMaterial({ map: dollarTexture(), side: THREE.DoubleSide, roughness: 0.8 }),
    );
    bill.position.set(0.3, -0.12, 0.02);
    bill.rotation.z = -0.35;
    this.root.add(line, shank, bend, bill);
  }
}

function dollarEyeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const g = canvas.getContext('2d')!;
  g.font = 'bold 56px Arial';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 8;
  g.strokeStyle = '#0b3d17';
  g.strokeText('$', 32, 34);
  g.fillStyle = '#39d353';
  g.fillText('$', 32, 34);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Two "$" signs that pop over Bill's eyes. Add `group` to Bill's object; set `pop` 0..1. */
export class DollarEyes {
  readonly group = new THREE.Group();
  private readonly sprites: THREE.Sprite[] = [];

  constructor() {
    const material = new THREE.SpriteMaterial({ map: dollarEyeTexture(), depthTest: false });
    for (const side of [-1, 1]) {
      const sprite = new THREE.Sprite(material);
      // Bill's eyes in his own space (render/character.ts: head at 1.45, eyes ±0.065 and forward).
      sprite.position.set(side * 0.07, 1.49, 0.25);
      sprite.renderOrder = 10;
      this.sprites.push(sprite);
      this.group.add(sprite);
    }
    this.pop(0);
  }

  pop(amount: number): void {
    const s = 0.16 * Math.max(0, amount);
    for (const sprite of this.sprites) sprite.scale.set(s, s, s);
    this.group.visible = amount > 0.01;
  }
}
