// Composite pass material: feature defines per quality + uniform sync from PostState.
import { Color, ShaderMaterial, Vector2, type Texture } from 'three';
import { clamp01, lerp } from '../../core/math';
import { COMPOSITE_FRAG } from './composite-glsl';
import { FULLSCREEN_VERT } from './glsl-common';
import type { PostState } from '../state';

export interface CompositeFeatures {
  blur: boolean;     // radial speed/zoom blur + chromatic fringe taps
  taps: number;
  bloom: boolean;
  tonemap: 0 | 1;    // 0 = soft shoulder (keeps toon colours), 1 = ACES fit
}

/** Bloom energy grows with mip count; this keeps `grade.bloom` roughly "fraction of glow". */
const BLOOM_NORMALISE = 0.32;

export class Composite {
  readonly material: ShaderMaterial;
  private features: CompositeFeatures;
  private readonly center = new Vector2(0.5, 0.56);

  constructor(features: CompositeFeatures) {
    this.features = { ...features };
    const u = <T>(value: T): { value: T } => ({ value });
    this.material = new ShaderMaterial({
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: COMPOSITE_FRAG,
      defines: this.defines(),
      uniforms: {
        tScene: u<Texture | null>(null), tBloom: u<Texture | null>(null), tDepth: u<Texture | null>(null),
        uNear: u(0.1), uFar: u(1000), uSubjectDepth: u(4), uBgBurst: u(0), uBgMargin: u(3),
        uRes: u(new Vector2(1, 1)), uTime: u(0),
        uExposure: u(1), uSat: u(1), uContrast: u(1), uBloom: u(0), uTint: u(new Color(1, 1, 1)),
        uEdgeBlur: u(0), uChroma: u(0), uZoom: u(0), uBlurCenter: u(new Vector2(0.5, 0.56)),
        uKo: u(0), uHalftone: u(0), uRed: u(0), uGrain: u(0), uVignette: u(0), uLetterbox: u(0),
        uLines: u(0), uKoLines: u(0), uFocus: u(new Vector2(0.5, 0.5)),
        uDamage: u(0), uFlash: u(0), uImpact: u(0),
        uFlashColor: u(new Color(1, 1, 1)), uImpactColor: u(new Color(1, 1, 1)), uLinesColor: u(new Color(1, 1, 1)),
      },
      depthTest: false,
      depthWrite: false,
    });
    this.material.name = 'fx.composite';
  }

  private defines(): Record<string, number> {
    const f = this.features;
    return { FX_BLUR: f.blur ? 1 : 0, FX_TAPS: Math.max(2, f.taps), FX_BLOOM: f.bloom ? 1 : 0, FX_TONEMAP: f.tonemap };
  }

  setFeatures(next: CompositeFeatures): void {
    const f = this.features;
    if (f.blur === next.blur && f.taps === next.taps && f.bloom === next.bloom && f.tonemap === next.tonemap) return;
    this.features = { ...next };
    this.material.defines = this.defines();
    this.material.needsUpdate = true;
  }

  sync(state: PostState, scene: Texture, bloom: Texture | null, depth: Texture | null, camera: { near: number; far: number }, res: Vector2, time: number): void {
    const u = this.material.uniforms;
    const { grade, speed, cine, pulse } = state;
    u.tScene!.value = scene;
    u.tBloom!.value = bloom;
    u.tDepth!.value = depth;
    u.uNear!.value = camera.near;
    u.uFar!.value = camera.far;
    u.uSubjectDepth!.value = cine.subjectDepth;
    u.uBgMargin!.value = cine.bgMargin;
    u.uBgBurst!.value = depth ? cine.bgBurst : 0;
    (u.uRes!.value as Vector2).copy(res);
    u.uTime!.value = time;
    u.uExposure!.value = grade.exposure;
    u.uSat!.value = grade.saturation;
    u.uContrast!.value = grade.contrast;
    u.uBloom!.value = grade.bloom * BLOOM_NORMALISE;
    (u.uTint!.value as Color).copy(grade.tint);
    u.uEdgeBlur!.value = speed.edgeBlur * (1 - cine.ko);
    u.uChroma!.value = speed.chroma * (1 - cine.ko) + pulse.chroma;
    u.uZoom!.value = cine.zoom;
    const focusW = clamp01(Math.max(cine.ko, cine.zoom * 8));
    (u.uBlurCenter!.value as Vector2).set(lerp(this.center.x, cine.focus.x, focusW), lerp(this.center.y, cine.focus.y, focusW));
    u.uKo!.value = cine.ko;
    u.uHalftone!.value = cine.halftone;
    u.uRed!.value = cine.red;
    u.uGrain!.value = cine.grain;
    u.uVignette!.value = cine.vignette;
    u.uLetterbox!.value = cine.letterbox;
    u.uLines!.value = speed.lines * (1 - cine.ko);
    u.uKoLines!.value = cine.lines;
    (u.uFocus!.value as Vector2).copy(cine.focus);
    u.uDamage!.value = pulse.damage;
    u.uFlash!.value = pulse.flash;
    (u.uFlashColor!.value as Color).copy(pulse.flashColor);
    u.uImpact!.value = pulse.impact > 0 ? 1 : 0;
    (u.uImpactColor!.value as Color).copy(pulse.impactColor);
    (u.uLinesColor!.value as Color).copy(state.linesColor);
  }

  dispose(): void {
    this.material.dispose();
  }
}
