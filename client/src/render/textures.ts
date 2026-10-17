// Procedural textures (Tejas): drawn on a canvas at load time, so the game needs no image files.
// Everything here tiles seamlessly, which lets scrolling surfaces move without visible seams.

import * as THREE from 'three';

function canvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d')!];
}

function finish(c: HTMLCanvasElement, srgb: boolean, repeat = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 4;
  return t;
}

/**
 * A tileable normal map of gentle ripples, from a sum of integer-frequency waves (so it wraps).
 * Used for water: scroll its offset and the surface looks like it's flowing.
 */
export function rippleNormalMap(size = 256, waves = 14, seed = 1): THREE.CanvasTexture {
  let s = seed;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const w = Array.from({ length: waves }, () => ({
    fx: Math.round(1 + rand() * 6) * (rand() < 0.5 ? -1 : 1),
    fy: Math.round(1 + rand() * 8),
    phase: rand() * Math.PI * 2,
    amp: 0.4 + rand(),
  }));
  const height = (x: number, y: number) =>
    w.reduce((h, k) => h + k.amp * Math.sin(2 * Math.PI * (k.fx * x + k.fy * y) / size + k.phase), 0);

  const [c, g] = canvas(size);
  const img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = height(x + 1, y) - height(x - 1, y);
      const dy = height(x, y + 1) - height(x, y - 1);
      const n = new THREE.Vector3(-dx * 0.6, -dy * 0.6, 1).normalize();
      const i = (y * size + x) * 4;
      img.data[i] = (n.x * 0.5 + 0.5) * 255;
      img.data[i + 1] = (n.y * 0.5 + 0.5) * 255;
      img.data[i + 2] = (n.z * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return finish(c, false);
}

/** Soft, blotchy grass with darker tufts. Seamless. */
export function grassTexture(): THREE.CanvasTexture {
  const size = 256;
  const [c, g] = canvas(size);
  g.fillStyle = '#5aa64a';
  g.fillRect(0, 0, size, size);
  const blob = (x: number, y: number, r: number, color: string) => {
    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        const grad = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
        grad.addColorStop(0, color);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = grad;
        g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
      }
    }
  };
  for (let i = 0; i < 40; i++) blob(Math.random() * size, Math.random() * size, 20 + Math.random() * 40, 'rgba(120,190,80,0.35)');
  for (let i = 0; i < 40; i++) blob(Math.random() * size, Math.random() * size, 15 + Math.random() * 30, 'rgba(40,110,45,0.3)');
  g.strokeStyle = 'rgba(35,95,40,0.35)';
  g.lineWidth = 1.5;
  for (let i = 0; i < 500; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (Math.random() - 0.5) * 3, y - 4 - Math.random() * 5);
    g.stroke();
  }
  return finish(c, true);
}

/** Vertical bark streaks for branches (u runs around the branch, v along it). */
export function barkTexture(): THREE.CanvasTexture {
  const size = 128;
  const [c, g] = canvas(size);
  g.fillStyle = '#6b4526';
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 70; i++) {
    const y = Math.random() * size;
    g.strokeStyle = Math.random() < 0.5 ? 'rgba(40,24,12,0.55)' : 'rgba(150,105,65,0.35)';
    g.lineWidth = 1 + Math.random() * 3;
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= size; x += 16) g.lineTo(x, y + (Math.random() - 0.5) * 6);
    g.stroke();
  }
  return finish(c, true);
}

/** One leaf on a transparent background, for leaf cards. */
export function leafTexture(): THREE.CanvasTexture {
  const size = 64;
  const [c, g] = canvas(size);
  g.translate(size / 2, size / 2);
  const grad = g.createLinearGradient(0, -28, 0, 28);
  grad.addColorStop(0, '#7cc35a');
  grad.addColorStop(1, '#2f7d32');
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(0, -29);
  g.quadraticCurveTo(22, -6, 0, 29);
  g.quadraticCurveTo(-22, -6, 0, -29);
  g.fill();
  g.strokeStyle = 'rgba(230,255,200,0.6)';
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(0, -24);
  g.lineTo(0, 26);
  g.stroke();
  return finish(c, true, false);
}

/** The soft inside of a bread slice, with little air pockets. */
export function crumbTexture(): THREE.CanvasTexture {
  const size = 128;
  const [c, g] = canvas(size);
  const grad = g.createRadialGradient(64, 60, 10, 64, 64, 80);
  grad.addColorStop(0, '#fbe9c4');
  grad.addColorStop(1, '#f0d29c');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 90; i++) {
    g.fillStyle = `rgba(190,140,80,${0.15 + Math.random() * 0.25})`;
    g.beginPath();
    g.ellipse(Math.random() * size, Math.random() * size, 1 + Math.random() * 3, 1 + Math.random() * 2, Math.random() * 3, 0, Math.PI * 2);
    g.fill();
  }
  return finish(c, true, false);
}

/** A gold coin face with an embossed dollar sign. */
export function coinFaceTexture(): THREE.CanvasTexture {
  const size = 128;
  const [c, g] = canvas(size);
  const grad = g.createRadialGradient(50, 45, 8, 64, 64, 64);
  grad.addColorStop(0, '#fff3b0');
  grad.addColorStop(0.55, '#ffcc33');
  grad.addColorStop(1, '#c98a0b');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  g.strokeStyle = 'rgba(150,95,0,0.8)';
  g.lineWidth = 6;
  g.beginPath();
  g.arc(64, 64, 52, 0, Math.PI * 2);
  g.stroke();
  g.font = 'bold 76px Arial';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = 'rgba(255,250,210,0.9)';
  g.fillText('$', 66, 68);
  g.fillStyle = '#b07700';
  g.fillText('$', 64, 66);
  return finish(c, true, false);
}
