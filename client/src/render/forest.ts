// The forest river (Tejas): glossy flowing water, sloped grassy banks, and instanced trees, bushes,
// rocks, reeds and lily pads that scroll past and recycle. Instancing keeps hundreds of props to a
// handful of draw calls. Render-only; cosmetic randomness uses Math.random() on purpose.

import * as THREE from 'three';
import { grassTexture, rippleNormalMap } from './textures';

export const RIVER_HALF_WIDTH = 6;
const STRIP_LENGTH = 340;
const NEAR = 24; // props recycle once they're this far behind Bill
const SPAN = 260; // ...back to this far ahead
const WATER_TILE = 11;
const GRASS_TILE = 10;

/** Height of the bank at a distance from the river's centre line (only depends on x, so it scrolls). */
export function bankHeight(x: number): number {
  const d = Math.abs(x) - RIVER_HALF_WIDTH;
  if (d <= 0) return -0.4;
  const rise = Math.min(1, d / 3);
  return -0.4 + 1.3 * (rise * rise * (3 - 2 * rise)) + 0.35 * Math.sin(Math.abs(x) * 0.35);
}

interface Part {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  local: THREE.Matrix4;
}

interface Prop {
  x: number;
  y: number;
  z: number;
  scale: number;
  rotY: number;
}

const m4 = (x: number, y: number, z: number, sx = 1, sy = sx, sz = sx) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(sx, sy, sz));

const mat = (color: number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });

/** One kind of prop (e.g. pine tree), drawn as one InstancedMesh per part. */
class PropKind {
  readonly meshes: THREE.InstancedMesh[];
  private readonly matrix = new THREE.Matrix4();
  private readonly base = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly up = new THREE.Vector3(0, 1, 0);

  constructor(
    private readonly parts: Part[],
    readonly props: Prop[],
    castShadow: boolean,
  ) {
    this.meshes = parts.map((p) => {
      const mesh = new THREE.InstancedMesh(p.geometry, p.material, props.length);
      mesh.castShadow = castShadow;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false; // instances are spread along the whole river
      return mesh;
    });
    this.write();
  }

  scroll(step: number): void {
    for (const p of this.props) {
      p.z += step;
      if (p.z > NEAR) p.z -= SPAN + NEAR;
    }
    this.write();
  }

  private write(): void {
    this.props.forEach((p, i) => {
      this.q.setFromAxisAngle(this.up, p.rotY);
      this.base.compose(new THREE.Vector3(p.x, p.y, p.z), this.q, new THREE.Vector3(p.scale, p.scale, p.scale));
      this.parts.forEach((part, k) => {
        this.matrix.multiplyMatrices(this.base, part.local);
        this.meshes[k].setMatrixAt(i, this.matrix);
      });
    });
    this.meshes.forEach((m) => (m.instanceMatrix.needsUpdate = true));
  }
}

function scatter(count: number, minX: number, maxX: number, onBank: boolean, scale: [number, number]): Prop[] {
  return Array.from({ length: count }, () => {
    const x = (Math.random() < 0.5 ? -1 : 1) * (minX + Math.random() * (maxX - minX));
    return {
      x,
      y: onBank ? bankHeight(x) : 0,
      z: NEAR - Math.random() * (SPAN + NEAR),
      scale: scale[0] + Math.random() * (scale[1] - scale[0]),
      rotY: Math.random() * Math.PI * 2,
    };
  });
}

export class ForestRiver {
  readonly group = new THREE.Group();
  private readonly kinds: PropKind[] = [];
  private readonly waterNormals: THREE.Texture;
  private readonly grass: THREE.Texture[] = [];

  constructor() {
    // Water: glossy and reflective (it picks up the sky through the scene environment).
    this.waterNormals = rippleNormalMap();
    this.waterNormals.repeat.set((RIVER_HALF_WIDTH * 2 + 6) / WATER_TILE, STRIP_LENGTH / WATER_TILE);
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(RIVER_HALF_WIDTH * 2 + 6, STRIP_LENGTH),
      new THREE.MeshPhysicalMaterial({
        color: 0x1f7fa6,
        roughness: 0.1,
        metalness: 0.05,
        normalMap: this.waterNormals,
        normalScale: new THREE.Vector2(0.28, 0.28),
        clearcoat: 1,
        clearcoatRoughness: 0.12,
        envMapIntensity: 1.3,
      }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.z = NEAR - STRIP_LENGTH / 2;
    water.receiveShadow = true;
    this.group.add(water);

    // Banks: a smooth slope up from the water, then gently rolling ground.
    for (const side of [-1, 1]) {
      const width = 60;
      const geometry = new THREE.PlaneGeometry(width, STRIP_LENGTH, 60, 1);
      const pos = geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = side * (RIVER_HALF_WIDTH - 1 + (pos.getX(i) + width / 2));
        pos.setX(i, x);
        pos.setZ(i, bankHeight(x)); // plane is rotated below, so local z becomes height
      }
      if (side < 0) {
        // Mirroring x flips the triangles inside out; swap two corners of each to face up again.
        const index = geometry.index!;
        for (let i = 0; i < index.count; i += 3) {
          const b = index.getX(i + 1);
          index.setX(i + 1, index.getX(i + 2));
          index.setX(i + 2, b);
        }
      }
      geometry.computeVertexNormals();
      const texture = grassTexture();
      texture.repeat.set(width / GRASS_TILE, STRIP_LENGTH / GRASS_TILE);
      this.grass.push(texture);
      const bank = new THREE.Mesh(geometry, mat(0xffffff, { map: texture, roughness: 0.95 }));
      bank.rotation.x = -Math.PI / 2;
      bank.position.z = NEAR - STRIP_LENGTH / 2;
      bank.receiveShadow = true;
      this.group.add(bank);
    }

    const bark = mat(0x6b4a2f);
    const pineGreen = mat(0x2f6b3a);
    const leafGreen = mat(0x4f9a3c);
    const bushGreen = mat(0x3f8a3a);
    const stone = mat(0x8a8f95, { roughness: 0.75 });

    const cone = (r: number, h: number) => new THREE.ConeGeometry(r, h, 18, 1);
    const blob = (r: number) => new THREE.IcosahedronGeometry(r, 3);

    this.addKind(
      [
        { geometry: new THREE.CylinderGeometry(0.16, 0.24, 1.6, 10), material: bark, local: m4(0, 0.8, 0) },
        { geometry: cone(1.7, 2.4), material: pineGreen, local: m4(0, 2.2, 0) },
        { geometry: cone(1.35, 2.1), material: pineGreen, local: m4(0, 3.3, 0) },
        { geometry: cone(0.9, 1.8), material: pineGreen, local: m4(0, 4.35, 0) },
      ],
      scatter(70, 7.5, 48, true, [0.9, 1.8]),
    );
    this.addKind(
      [
        { geometry: new THREE.CylinderGeometry(0.18, 0.28, 2.4, 10), material: bark, local: m4(0, 1.2, 0) },
        { geometry: blob(1.3), material: leafGreen, local: m4(0, 3.1, 0, 1.25, 1, 1.25) },
        { geometry: blob(1), material: leafGreen, local: m4(0.85, 2.7, 0.3) },
        { geometry: blob(1), material: leafGreen, local: m4(-0.75, 2.8, -0.25, 0.9) },
        { geometry: blob(0.9), material: leafGreen, local: m4(0.1, 3.9, 0.1) },
      ],
      scatter(55, 8, 48, true, [0.8, 1.5]),
    );
    this.addKind(
      [
        { geometry: blob(0.7), material: bushGreen, local: m4(0, 0.45, 0) },
        { geometry: blob(0.55), material: bushGreen, local: m4(0.6, 0.35, 0.2) },
        { geometry: blob(0.5), material: bushGreen, local: m4(-0.55, 0.3, -0.1) },
      ],
      scatter(50, 6.6, 16, true, [0.7, 1.3]),
    );
    this.addKind(
      [{ geometry: new THREE.DodecahedronGeometry(0.8, 1), material: stone, local: m4(0, 0.2, 0, 1.3, 0.7, 1) }],
      scatter(36, 6.2, 22, true, [0.5, 1.4]),
    );

    // Reeds and cattails at the water's edge.
    const reed = mat(0x5f8f3c);
    const cattail = mat(0x6b4226);
    const reedParts: Part[] = [];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const h = 1.3 + (i % 3) * 0.35;
      reedParts.push({ geometry: new THREE.CylinderGeometry(0.03, 0.05, h, 6), material: reed, local: m4(Math.cos(a) * 0.25, h / 2, Math.sin(a) * 0.25) });
      if (i % 2 === 0) {
        reedParts.push({ geometry: new THREE.CapsuleGeometry(0.07, 0.3, 4, 8), material: cattail, local: m4(Math.cos(a) * 0.25, h + 0.1, Math.sin(a) * 0.25) });
      }
    }
    this.addKind(reedParts, scatter(46, 5.6, 6.8, false, [0.8, 1.2]).map((p) => ({ ...p, y: -0.3 })));

    // Lily pads with a few pink flowers, floating outside the lanes.
    const pad = new THREE.CylinderGeometry(0.55, 0.55, 0.04, 24, 1, false, 0.35, Math.PI * 1.85);
    this.addKind([{ geometry: pad, material: mat(0x3f9a4a, { roughness: 0.5 }), local: m4(0, 0.02, 0) }], scatter(40, 4.2, 5.8, false, [0.7, 1.3]));
    this.addKind(
      [
        { geometry: pad, material: mat(0x3f9a4a, { roughness: 0.5 }), local: m4(0, 0.02, 0) },
        { geometry: new THREE.ConeGeometry(0.16, 0.22, 8), material: mat(0xff8fc0, { roughness: 0.5 }), local: m4(0.1, 0.14, 0) },
        { geometry: new THREE.SphereGeometry(0.06, 8, 6), material: mat(0xffe066), local: m4(0.1, 0.2, 0) },
      ],
      scatter(16, 4.2, 5.8, false, [0.8, 1.2]),
    );

    // Far hills: big, hazy, static shapes so the horizon isn't empty.
    const hillMat = mat(0x3d7a45, { roughness: 1 });
    for (let i = 0; i < 9; i++) {
      const hill = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), hillMat);
      const side = i % 2 === 0 ? -1 : 1;
      hill.position.set(side * (25 + Math.random() * 70), -1, -150 - Math.random() * 30);
      hill.scale.set(30 + Math.random() * 30, 10 + Math.random() * 12, 20);
      this.group.add(hill);
    }
  }

  private addKind(parts: Part[], props: Prop[], castShadow = true): void {
    const kind = new PropKind(parts, props, castShadow);
    this.kinds.push(kind);
    this.group.add(...kind.meshes);
  }

  /** Move the world towards the camera by `step`; `distance` drives the flowing surfaces. */
  scroll(distance: number, step: number): void {
    this.waterNormals.offset.y = distance / WATER_TILE + performance.now() * 0.00003;
    this.waterNormals.offset.x = Math.sin(performance.now() * 0.0003) * 0.05;
    for (const g of this.grass) g.offset.y = distance / GRASS_TILE;
    if (step !== 0) for (const k of this.kinds) k.scroll(step);
  }
}
