// Colour grade from the track look (eased in real time), and the speed sensation from the player.
import { Color, NoToneMapping, type WebGLRenderer } from 'three';
import { clamp01, damp, smoothstep } from '../core/math';
import { BIKES } from '../data/bikes';
import type { EnvLook, RiderState } from '../core/types';
import type { PostState } from './state';

const MENU_GRADE: EnvLook['grade'] = { saturation: 1.05, contrast: 1.04, tint: '#ffffff', bloom: 0.25, night: false };
const tint = new Color();

/** Ease the grade toward the look (snap = jump straight there, e.g. on race start). */
export function updateGrade(state: PostState, look: EnvLook | null, renderer: WebGLRenderer, dtReal: number, snap = false): void {
  const g = look?.grade ?? MENU_GRADE;
  const k = snap ? 1 : 1 - Math.exp(-4 * dtReal);
  const s = state.grade;
  s.saturation += (g.saturation - s.saturation) * k;
  s.contrast += (g.contrast - s.contrast) * k;
  s.bloom += (Math.max(0, g.bloom) - s.bloom) * k;
  s.threshold += ((g.night ? 0.7 : 1.0) - s.threshold) * k;
  tint.set(g.tint);
  s.tint.lerp(tint, k);
  const exposure = renderer.toneMapping === NoToneMapping ? 1 : renderer.toneMappingExposure;
  s.exposure += (exposure - s.exposure) * k;
}

/** Speed lines, edge blur and chromatic fringe that grow with speed, boost and slipstream. */
export class SpeedFeel {
  private blur = 0;
  private chroma = 0;
  private lines = 0;

  update(state: PostState, player: RiderState | null, dtReal: number): void {
    let tBlur = 0, tChroma = 0, tLines = 0;
    if (player && (player.mode === 'racing' || player.mode === 'finished')) {
      const top = BIKES[player.bike]?.topSpeed ?? 20;
      const v = player.speed / top;
      const boost = player.boostTime > 0 ? clamp01(0.45 + player.boostPower * 1.6) : 0;
      const draft = player.draft > 0.35 ? player.draft : 0;
      tBlur = 0.018 * smoothstep(0.55, 1.2, v) + 0.032 * boost;
      tChroma = 0.0016 * smoothstep(0.6, 1.2, v) + 0.0042 * boost;
      tLines = Math.max(boost * 0.8, draft * 0.42, 0.42 * smoothstep(1.02, 1.35, v));
    }
    // Fast attack, slower release so boosts punch in and ease out.
    const rate = (cur: number, target: number): number => (target > cur ? 9 : 2.6);
    this.blur = damp(this.blur, tBlur, rate(this.blur, tBlur), dtReal);
    this.chroma = damp(this.chroma, tChroma, rate(this.chroma, tChroma), dtReal);
    this.lines = damp(this.lines, tLines, rate(this.lines, tLines), dtReal);
    // The release whoosh rides on top (eased so it swells, then thins out).
    const w = state.pulse.whoosh;
    const rush = w * w * (3 - 2 * w);
    state.speed.edgeBlur = this.blur + 0.04 * rush;
    state.speed.chroma = this.chroma + 0.003 * rush;
    const lines = Math.max(this.lines, 0.9 * rush);
    state.speed.lines = lines < 0.01 ? 0 : lines;
  }

  reset(): void {
    this.blur = this.chroma = this.lines = 0;
  }
}
