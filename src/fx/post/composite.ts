// Composite pass material: feature defines per quality + uniform sync from PostState.
import { Color, ShaderMaterial, Vector2, Vector3, type PerspectiveCamera, type Texture } from 'three';
import { clamp01, DEG, lerp } from '../../core/math';
import { COMPOSITE_FRAG, COMPOSITE_VERT } from './composite-glsl';
import { REDUCED, type PostState } from '../state';

export interface CompositeFeatures {
  blur: boolean;     // radial speed/zoom blur + chromatic fringe taps
  taps: number;
  bloom: boolean;
  tonemap: 0 | 1;    // 0 = soft shoulder (keeps toon colours), 1 = ACES fit
}

/** Bloom energy grows with mip count; this keeps `grade.bloom` roughly "fraction of glow". */
const BLOOM_NORMALISE = 0.32;
/** Share of the luminance-normalised track tint applied to shadows / mid-tones. */
const TINT_STRENGTH = 0.5;
const WHITE = new Color(1, 1, 1);

export class Composite {
  readonly material: ShaderMaterial;
  private features: CompositeFeatures;
  private readonly center = new Vector2(0.5, 0.56);
  private readonly tintN = new Color();

  constructor(features: CompositeFeatures) {
    this.features = { ...features };
    const u = <T>(value: T): { value: T } => ({ value });
    this.material = new ShaderMaterial({
      vertexShader: COMPOSITE_VERT,
      fragmentShader: COMPOSITE_FRAG,
      defines: this.defines(),
      uniforms: {
        tScene: u<Texture | null>(null), tBloom: u<Texture | null>(null), tDepth: u<Texture | null>(null), tMask: u<Texture | null>(null), uMask: u(0), uMaskRes: u(new Vector2(1, 1)), uVicWB: u(new Color(1, 1, 1)), uLitWhite: u(1), uCastView: u(0),
        uNear: u(0.1), uFar: u(1000), uTanHalf: u(new Vector2(1, 1)), uViewUp: u(new Vector3(0, 1, 0)), uSubjectDepth: u(4), uBgBurst: u(0), uBgMargin: u(3), uBehindAt: u(2), uBurstInk: u(0), uRim: u(0),
        uRes: u(new Vector2(1, 1)), uTime: u(0),
        uExposure: u(1), uSat: u(1), uContrast: u(1), uBloom: u(0), uTintN: u(new Color(1, 1, 1)),
        uEdgeBlur: u(0), uChroma: u(0), uZoom: u(0), uBlurCenter: u(new Vector2(0.5, 0.56)),
        uKo: u(0), uHalftone: u(0), uRed: u(0), uGrain: u(0), uVignette: u(0), uLetterbox: u(0),
        uLines: u(0), uKoLines: u(0), uFocus: u(new Vector2(0.5, 0.5)), uLineRate: u(18), uGrainSeed: u(0),
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

  /** `camera` null = no depth-based effects (orthographic or unknown lens); `mask` = this frame's cast mask. */
  /** Debug: draw the cast roles (ghost red, victim green, attacker blue) instead of the KO look. */
  castView = false;

  sync(state: PostState, scene: Texture, bloom: Texture | null, depth: Texture | null, mask: Texture | null, camera: PerspectiveCamera | null, res: Vector2, time: number): void {
    const u = this.material.uniforms;
    const { grade, speed, cine, pulse } = state;
    u.tScene!.value = scene;
    u.tBloom!.value = bloom;
    u.tDepth!.value = camera ? depth : null;
    u.tMask!.value = camera ? mask : null;
    u.uMask!.value = camera && mask ? 1 : 0;
    u.uCastView!.value = this.castView ? 1 : 0;
    const img = mask?.image as { width?: number; height?: number } | undefined;
    (u.uMaskRes!.value as Vector2).set(img?.width ?? res.x, img?.height ?? res.y);
    if (camera) {
      u.uNear!.value = camera.near;
      u.uFar!.value = camera.far;
      const ty = Math.tan((camera.fov * DEG) / 2) / camera.zoom;
      (u.uTanHalf!.value as Vector2).set(ty * camera.aspect, ty);
      (u.uViewUp!.value as Vector3).set(0, 1, 0).transformDirection(camera.matrixWorldInverse);
    }
    u.uSubjectDepth!.value = cine.subjectDepth;
    u.uBgMargin!.value = cine.bgMargin;
    u.uBehindAt!.value = cine.behindAt;
    u.uBgBurst!.value = depth && camera ? cine.bgBurst : 0;
    u.uBurstInk!.value = cine.burstInk;
    u.uRim!.value = cine.rim;
    (u.uRes!.value as Vector2).copy(res);
    u.uTime!.value = time;
    u.uExposure!.value = grade.exposure;
    u.uSat!.value = grade.saturation;
    u.uContrast!.value = grade.contrast;
    u.uBloom!.value = grade.bloom * BLOOM_NORMALISE;
    (u.uTintN!.value as Color).copy(this.normalisedTint(grade.tint));
    (u.uVicWB!.value as Color).copy(grade.wb);
    u.uLitWhite!.value = grade.litWhite;
    // The release whoosh (rush) is never masked by the fading KO look, so it is on screen at the cut.
    const calm = state.reducedFlashes;
    u.uEdgeBlur!.value = speed.edgeBlur * (1 - cine.ko) + 0.04 * speed.rush;
    u.uChroma!.value = (speed.chroma * (1 - cine.ko) + pulse.chroma) * (calm ? REDUCED.chroma : 1);
    u.uZoom!.value = cine.zoom * (calm ? REDUCED.zoom : 1);
    // Reduced motion: speed lines re-randomise slowly (no 18 Hz flicker) and the grain stands still.
    u.uLineRate!.value = calm ? REDUCED.lineRate : 18;
    u.uGrainSeed!.value = calm ? 0 : (time * 7.31) % 1;
    const focusW = clamp01(Math.max(cine.ko, cine.zoom * 8, cine.heroLines * 4));
    (u.uBlurCenter!.value as Vector2).set(lerp(this.center.x, cine.focus.x, focusW), lerp(this.center.y, cine.focus.y, focusW));
    u.uKo!.value = cine.ko;
    u.uHalftone!.value = cine.halftone;
    u.uRed!.value = cine.red;
    u.uGrain!.value = cine.grain;
    u.uVignette!.value = cine.vignette;
    u.uLetterbox!.value = cine.letterbox;
    u.uLines!.value = Math.max(speed.lines * (1 - cine.ko), 0.9 * speed.rush, cine.heroLines);
    u.uKoLines!.value = cine.lines;
    (u.uFocus!.value as Vector2).copy(cine.focus);
    u.uDamage!.value = pulse.damage;
    u.uFlash!.value = pulse.flash;
    (u.uFlashColor!.value as Color).copy(pulse.flashColor);
    u.uImpact!.value = pulse.impact > 0 ? 1 : 0;
    (u.uImpactColor!.value as Color).copy(pulse.impactColor);
    (u.uLinesColor!.value as Color).copy(state.linesColor);
  }

  /** sRGB tint divided by its luma (brightness-neutral), pulled halfway to white. */
  private normalisedTint(tint: Color): Color {
    const t = this.tintN.copy(tint).convertLinearToSRGB();
    const l = Math.max(0.05, 0.2126 * t.r + 0.7152 * t.g + 0.0722 * t.b);
    return t.multiplyScalar(1 / l).lerp(WHITE, 1 - TINT_STRENGTH);
  }

  dispose(): void {
    this.material.dispose();
  }
}
