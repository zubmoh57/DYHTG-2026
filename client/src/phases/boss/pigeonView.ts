// The pigeon boss, its shotgun, bullets and Bill's laser (Tejas). Built from primitives.
// Render-only: Zubair's sim/boss.ts decides shots, prompts and damage.

import * as THREE from 'three';

const std = (color: number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...extra });

export class PigeonView {
  readonly root = new THREE.Group();
  /** Turns to aim; the gun hangs off it. */
  private readonly body = new THREE.Group();
  private readonly gun = new THREE.Group();
  private readonly muzzle: THREE.Mesh;
  private readonly materials: THREE.MeshStandardMaterial[] = [];
  private flinch = 0;
  private flash = 0;
  private fallT = -1;
  private time = 0;

  constructor() {
    const grey = std(0x8a8f9c);
    const dark = std(0x5c6170);
    const neck = std(0x5f8a72, { metalness: 0.4, roughness: 0.35 }); // the shiny green-purple neck
    const pink = std(0xd98a8a);
    this.materials.push(grey, dark, neck);

    const torso = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 16), grey);
    torso.scale.set(1.25, 1.45, 1.1);
    torso.position.y = 1.9;
    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 12), neck);
    chest.scale.set(1, 0.9, 0.7);
    chest.position.set(0, 2.55, 0.45);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.62, 18, 14), grey);
    head.position.set(0, 3.55, 0.25);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 8), std(0x3d3d3d));
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 3.45, 0.95);
    const cere = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), std(0xf0ece0));
    cere.position.set(0, 3.58, 0.8);

    // Angry eyes: orange iris, black pupil, a slanted brow.
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), std(0xff8c1a));
      eye.position.set(side * 0.28, 3.68, 0.72);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), std(0x111111));
      pupil.position.set(side * 0.28, 3.68, 0.86);
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.07, 0.07), std(0x2b2b2b));
      brow.position.set(side * 0.26, 3.9, 0.8);
      brow.rotation.z = side * -0.45;
      this.body.add(eye, pupil, brow);
    }

    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.SphereGeometry(0.8, 14, 10), dark);
      wing.scale.set(0.35, 1, 0.9);
      wing.position.set(side * 1.2, 1.9, -0.05);
      wing.rotation.z = side * 0.25;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.7, 6), pink);
      leg.position.set(side * 0.45, 0.4, 0.1);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.06, 0.4), pink);
      foot.position.set(side * 0.45, 0.05, 0.25);
      this.body.add(wing, leg, foot);
    }

    // The shotgun, held across the chest and pointing at the duck (+Z).
    const metal = std(0x2a2d33, { metalness: 0.7, roughness: 0.3 });
    const wood = std(0x7a4a24);
    for (const side of [-1, 1]) {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.7, 10), metal);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(side * 0.09, 0, 0.85);
      this.gun.add(barrel);
    }
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.32, 0.9), wood);
    stock.position.set(0, -0.08, -0.3);
    this.muzzle = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xffc94d, transparent: true, opacity: 0 }),
    );
    this.muzzle.position.z = 1.8;
    this.gun.add(stock, this.muzzle);
    this.gun.position.set(0.3, 2.2, 1.2);

    this.body.add(torso, chest, head, beak, cere, this.gun);

    // A floating crate to stand on.
    const crate = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.2, 2.4), std(0x9a6b3c));
    crate.position.y = -0.4;
    this.root.add(crate, this.body);
    this.root.scale.setScalar(1.3);
    this.root.traverse((o) => (o.castShadow = true));
  }

  /** World position of the gun's muzzle, where bullets start. */
  muzzleWorld(target: THREE.Vector3): THREE.Vector3 {
    return this.muzzle.getWorldPosition(target);
  }

  /** Turn towards an x position on the water (where the duck is). */
  aimAt(x: number, dt: number): void {
    const angle = Math.atan2(x - this.root.position.x, -this.root.position.z) * 0.9;
    this.body.rotation.y += (angle - this.body.rotation.y) * Math.min(1, dt * 6);
  }

  /** 0..1 while winding up a shot: the muzzle glows brighter. */
  setWindUp(amount: number): void {
    const m = this.muzzle.material as THREE.MeshBasicMaterial;
    m.opacity = Math.max(this.flash, amount * 0.6);
    this.muzzle.scale.setScalar(0.5 + amount * 0.8 + this.flash);
  }

  fire(): void {
    this.flash = 1;
    this.flinch = Math.max(this.flinch, 0.35); // recoil
  }

  hit(): void {
    this.flinch = 1;
  }

  defeat(): void {
    if (this.fallT < 0) this.fallT = 0;
  }

  update(dt: number): void {
    this.time += dt;
    this.flash = Math.max(0, this.flash - dt * 5);
    this.flinch = Math.max(0, this.flinch - dt * 3);

    // Idle bob, a knock back on hits, and a white flash.
    this.body.position.y = Math.sin(this.time * 2.2) * 0.06;
    this.body.position.z = -this.flinch * 0.6;
    this.body.rotation.x = -this.flinch * 0.35;
    for (const m of this.materials) m.emissive.setScalar(this.flinch > 0.6 ? (this.flinch - 0.6) * 1.5 : 0);

    if (this.fallT >= 0) {
      this.fallT += dt;
      this.body.rotation.x = -Math.min(1, this.fallT * 1.4) * (Math.PI / 2);
      this.root.position.y = -Math.max(0, this.fallT - 0.8) * 1.5; // sinks
    }
  }
}

/** A glowing shotgun slug. */
export function makeBullet(): THREE.Mesh {
  const bullet = new THREE.Mesh(new THREE.SphereGeometry(0.38, 14, 10), new THREE.MeshBasicMaterial({ color: 0xff7a1a }));
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.62, 14, 10),
    new THREE.MeshBasicMaterial({ color: 0xffc94d, transparent: true, opacity: 0.35 }),
  );
  bullet.add(glow);
  return bullet;
}

/** Bill's laser: a bright beam that fades out. */
export class Laser {
  readonly mesh: THREE.Mesh;
  private life = 0;

  constructor() {
    this.mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 1, 10, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xff3ea5, transparent: true, opacity: 0 }),
    );
    this.mesh.visible = false;
  }

  fire(from: THREE.Vector3, to: THREE.Vector3): void {
    const mid = from.clone().add(to).multiplyScalar(0.5);
    const length = from.distanceTo(to);
    this.mesh.position.copy(mid);
    this.mesh.scale.set(1, length, 1);
    this.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
    this.mesh.visible = true;
    this.life = 0.35;
  }

  update(dt: number): void {
    if (!this.mesh.visible) return;
    this.life -= dt;
    const m = this.mesh.material as THREE.MeshBasicMaterial;
    m.opacity = Math.max(0, this.life / 0.35);
    this.mesh.scale.x = this.mesh.scale.z = 0.6 + m.opacity * 1.6;
    if (this.life <= 0) this.mesh.visible = false;
  }
}
