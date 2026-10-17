// Render pipeline: scene → HDR (MSAA) target → bloom → composite to the screen in sRGB.
// Quality presets; low keeps only grade + vignette (+ cheap cinematic tints) in a single pass.
import {
  DepthTexture, HalfFloatType, LinearFilter, NoToneMapping, PerspectiveCamera, Vector2, WebGLRenderTarget,
  type Camera, type Scene, type WebGLRenderer,
} from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { Bloom } from './bloom';
import { Composite } from './composite';
import type { GpuTimer } from './timer';
import type { Quality } from '../../core/types';
import type { PostState } from '../state';

interface Preset { samples: number; bloom: boolean; blur: boolean; taps: number; bloomLevels: number }

const PRESETS: Record<Quality, Preset> = {
  low: { samples: 0, bloom: false, blur: false, taps: 2, bloomLevels: 4 },
  medium: { samples: 2, bloom: true, blur: true, taps: 5, bloomLevels: 4 },
  high: { samples: 4, bloom: true, blur: true, taps: 8, bloomLevels: 5 },
};

/** Debug/sandbox switches (all on by default). */
export interface PostToggles { enabled: boolean; bloom: boolean; blur: boolean }

export class PostPipeline {
  readonly toggles: PostToggles = { enabled: true, bloom: true, blur: true };
  /** Set by the debug bench to time scene / bloom / composite on the GPU. */
  timer: GpuTimer | null = null;
  /** Draw stats of the scene pass alone (the post passes add ~10 tiny draws). */
  readonly sceneStats = { calls: 0, triangles: 0 };
  private readonly preset: Preset;
  private readonly sceneRT: WebGLRenderTarget;
  private readonly bloom: Bloom | null;
  private readonly composite: Composite;
  private readonly quad: FullScreenQuad;
  private readonly size = new Vector2(1, 1);

  constructor(private readonly renderer: WebGLRenderer, quality: Quality) {
    this.preset = PRESETS[quality];
    this.sceneRT = new WebGLRenderTarget(1, 1, {
      type: HalfFloatType, minFilter: LinearFilter, magFilter: LinearFilter, samples: this.preset.samples,
    });
    this.sceneRT.texture.name = 'fx.scene';
    this.sceneRT.depthTexture = new DepthTexture(1, 1);
    this.sceneRT.depthTexture.name = 'fx.sceneDepth';
    this.bloom = this.preset.bloom ? new Bloom(this.preset.bloomLevels) : null;
    this.composite = new Composite({ blur: this.preset.blur, taps: this.preset.taps, bloom: this.preset.bloom, tonemap: 0 });
    this.quad = new FullScreenQuad(this.composite.material);
    renderer.info.autoReset = false;
  }

  setSize(width: number, height: number, dpr: number): void {
    const w = Math.max(1, Math.floor(width * dpr));
    const h = Math.max(1, Math.floor(height * dpr));
    this.size.set(w, h);
    this.sceneRT.setSize(w, h);
    this.bloom?.setSize(w, h);
  }

  render(scene: Scene, camera: Camera, state: PostState, timeReal: number): void {
    const r = this.renderer;
    r.info.reset();
    if (!this.toggles.enabled) {
      r.setRenderTarget(null);
      r.render(scene, camera);
      this.recordSceneStats();
      return;
    }
    const t = this.timer;
    r.setRenderTarget(this.sceneRT);
    t?.begin('scene');
    r.render(scene, camera);
    t?.end();
    this.recordSceneStats();
    const useBloom = this.bloom !== null && this.toggles.bloom && state.grade.bloom > 0.01;
    t?.begin('bloom');
    const bloomTex = useBloom && this.bloom ? this.bloom.render(r, this.sceneRT.texture, this.size, state.grade.threshold, 0.45) : null;
    t?.end();
    this.composite.setFeatures({
      blur: this.preset.blur && this.toggles.blur,
      taps: this.preset.taps,
      bloom: bloomTex !== null,
      tonemap: r.toneMapping === NoToneMapping ? 0 : 1,
    });
    const lens = camera instanceof PerspectiveCamera ? camera : null;
    this.composite.sync(state, this.sceneRT.texture, bloomTex, lens ? this.sceneRT.depthTexture : null, lens ?? { near: 0.1, far: 1000 }, this.size, timeReal);
    r.setRenderTarget(null);
    t?.begin('composite');
    this.quad.render(r);
    t?.end();
  }

  private recordSceneStats(): void {
    this.sceneStats.calls = this.renderer.info.render.calls;
    this.sceneStats.triangles = this.renderer.info.render.triangles;
  }

  dispose(): void {
    this.sceneRT.dispose();
    this.bloom?.dispose();
    this.composite.dispose();
    this.quad.dispose();
    this.renderer.info.autoReset = true;
  }
}
