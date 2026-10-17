// The one renderer and its post-processing (Tejas): filmic tone mapping, soft shadows, image-based
// lighting for nicer materials, multisampled anti-aliasing and a gentle bloom so bright things
// (coins, the laser, muzzle flashes) glow. Phases never touch this; they just add objects.

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export class RenderPipeline {
  readonly renderer: THREE.WebGLRenderer;
  private readonly composer: EffectComposer;
  private readonly renderPass: RenderPass;
  private readonly bloom: UnrealBloomPass;

  /** `environment`: a scene to capture for reflections (e.g. the sky). Defaults to a soft studio. */
  constructor(container: HTMLElement, scene: THREE.Scene, camera: THREE.Camera, environment?: THREE.Scene) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    // Phones render bloom and shadows at a lower resolution so multiplayer stays smooth on them.
    const phone = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, phone ? 1.25 : 1.75));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    // Image-based lighting: every standard material reflects the sky (and the water picks up its
    // blue), without loading any image files. The far plane must reach the sky dome.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    scene.environment = pmrem.fromScene(environment ?? new RoomEnvironment(), 0.02, 0.1, 1000).texture;
    scene.environmentIntensity = 0.7;
    pmrem.dispose();

    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, target);
    this.renderPass = new RenderPass(scene, camera);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.32, 0.45, 0.9);
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass()); // tone mapping + sRGB happen here
  }

  setSize(width: number, height: number): void {
    this.renderer.setSize(width, height);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(width, height);
  }

  render(camera: THREE.Camera): void {
    this.renderPass.camera = camera;
    this.composer.render();
  }

  dispose(): void {
    this.composer.dispose();
    this.renderer.dispose();
  }
}
