// Terrain height field shared by the near ribbons, the far grid and prop placement.
// Near the road heights come from the side profiles (track space); far away they blend into
// world-space hills / sea floor so nearest-point switches never leave creases. The hill over a
// tunnel is a separate cap mesh (features/tunnel.ts), so the field stays buried under the road.
import { smoothstep } from '../../core/math';
import { hashString } from '../../core/rng';
import type { TrackFrame } from '../../core/types';
import type { BuiltLayout } from '../layout/build';
import type { TrackQuery } from '../layout/query';
import type { GroundDef } from '../layout/types';
import { Noise2 } from './noise';
import { isShore, profileY } from './profile';

const CELL = 32;
const BURY = 4;            // terrain under the road sits this far below it

export interface Bump { x: number; z: number; r: number; h: number; mat: 'sand' | 'grass' | 'rock' }
export interface WorldSample { s: number; x: number; u: number; side: -1 | 1; h: number; g: GroundDef; bump: Bump | null }

/** Optional per-layout terrain modifier (LayoutDef.terrainMod), e.g. the shared slope between switchback legs. */
export interface TerrainMod {
  /** Max near-ribbon extent beyond the drivable edge at (s, side), m (Infinity = unlimited). */
  room(s: number, side: -1 | 1): number;
  /** Final height at world (wx, wz), u m beyond the edge of the road at s; h = the profile height. */
  height(s: number, side: -1 | 1, u: number, wx: number, wz: number, h: number): number;
}

export class TerrainField {
  readonly noise: Noise2;
  readonly bumps: Bump[];
  private readonly hash = new Map<number, number[]>();
  private readonly fr: TrackFrame;
  readonly mod: TerrainMod | null;

  constructor(readonly L: BuiltLayout, readonly q: TrackQuery) {
    this.noise = new Noise2(hashString(`terrain:${L.def.id}`));
    this.fr = q.frameVis(0);
    for (let i = 0; i < L.n; i++) {
      const key = this.key(Math.floor((L.px[i] ?? 0) / CELL), Math.floor((L.pz[i] ?? 0) / CELL));
      const list = this.hash.get(key);
      if (list) list.push(i); else this.hash.set(key, [i]);
    }
    this.bumps = (L.def.bumps ?? []).map((b) => {
      const f = q.frameVis(b.s);
      return { x: f.pos.x + f.right.x * b.x, z: f.pos.z + f.right.z * b.x, r: b.r, h: b.h, mat: b.mat ?? 'rock' };
    });
    this.mod = L.def.terrainMod ? L.def.terrainMod(this) : null;
  }

  private key(cx: number, cz: number): number {
    return (cx + 4096) * 8192 + (cz + 4096);
  }

  /** Drivable half-extent on one side at visual s (asphalt + shoulder). */
  bound(s: number, side: -1 | 1): number {
    const sd = side < 0 ? this.L.sides.left : this.L.sides.right;
    const f = Math.min(Math.max(s - this.L.sMin, 0), this.L.n - 1);
    const i = Math.min(Math.floor(f), this.L.n - 2), t = f - i;
    return this.L.halfWidth + (sd.shoulder[i] ?? 0) * (1 - t) + (sd.shoulder[i + 1] ?? 0) * t;
  }

  /** Road surface height at the drivable edge on one side (bank included). */
  edgeY(s: number, side: -1 | 1): number {
    const fr = this.q.frameVis(s, this.fr);
    return fr.pos.y + fr.right.y * side * this.bound(s, side);
  }

  ground(s: number, side: -1 | 1): GroundDef {
    const sd = side < 0 ? this.L.sides.left : this.L.sides.right;
    return sd.ground[this.q.sampleAt(s)] as GroundDef;
  }

  /** Terrain height under the road footprint: buried, except the open seabed under a bridge. */
  underRoad(s: number, roadY: number): number {
    const gl = this.ground(s, -1), gr = this.ground(s, 1);
    if (gl.detached && gr.detached) return Math.min(gl.abs ? gl.step : roadY + gl.step, gr.abs ? gr.step : roadY + gr.step);
    return roadY - BURY;
  }

  /** Height at track-space (s, x) — lateral x measured from the centre line — at world (wx, wz). */
  heightAt(s: number, x: number, wx: number, wz: number): number {
    const fr = this.q.frameVis(s, this.fr);
    const side: -1 | 1 = x < 0 ? -1 : 1;
    const bound = this.bound(s, side);
    const u = Math.abs(x) - bound;
    if (u < 0) return this.underRoad(s, fr.pos.y);
    const g = this.ground(s, side);
    const edgeY = fr.pos.y + fr.right.y * side * bound;
    const h = this.shape(g, edgeY, fr.pos.y, u, wx, wz).h;
    return this.mod ? this.mod.height(s, side, u, wx, wz, h) : h;
  }

  /** Profile + noise + far blend + landmark domes. */
  shape(g: GroundDef, edgeY: number, roadY: number, u: number, wx: number, wz: number): { h: number; bump: Bump | null } {
    const n = this.noise;
    let h = profileY(g, edgeY, roadY, u);
    const shore = isShore(g);
    // Dry land near the road never dips into ditches or below the sea; water areas (shores, the
    // cove under the bridge) keep their full relief.
    const dry = !shore && h > 0.4;
    const amp = g.rough * smoothstep(3, 28, u);
    if (amp > 0) {
      const nz = n.fbm(wx / 70, wz / 70, 3) + 0.35 * n.get(wx / 13, wz / 13);
      h += amp * (dry ? Math.max(nz, -0.25) : nz);
    }
    if (!shore) h += smoothstep(40, 300, u) * (26 * n.ridge(wx / 360, wz / 360, 3) + 10 * n.fbm(wx / 140, wz / 140, 2));
    const w = smoothstep(170, 430, u);
    if (w > 0) {
      const far = shore ? -24 + 2 * n.get(wx / 90, wz / 90) : 34 + 78 * n.ridge(wx / 430, wz / 430, 4) + 16 * n.fbm(wx / 170, wz / 170, 3);
      h += (far - h) * w;
    }
    if (dry) h = Math.max(h, 0.4);
    let bump: Bump | null = null;
    for (const b of this.bumps) {
      const d2 = (wx - b.x) ** 2 + (wz - b.z) ** 2;
      if (d2 >= b.r * b.r) continue;
      const t = 1 - d2 / (b.r * b.r);
      const by = (b.h + 14) * t * t * (1.6 - 0.6 * t) - 14 + 1.4 * n.get(wx / 9, wz / 9) * t;
      if (by > h) { h = by; bump = b; }
    }
    return { h, bump };
  }

  /** Nearest sample index to a world point (horizontal), over the whole visual road. */
  nearestSample(wx: number, wz: number): number {
    const L = this.L;
    let best = -1, bestD = Infinity;
    const cx = Math.floor(wx / CELL), cz = Math.floor(wz / CELL);
    for (let r = 0; r < 200; r++) {
      for (let gx = cx - r; gx <= cx + r; gx++) {
        const edgeRow = gx === cx - r || gx === cx + r;
        for (let gz = cz - r; gz <= cz + r; gz += edgeRow ? 1 : 2 * r) {
          const list = this.hash.get(this.key(gx, gz));
          if (!list) continue;
          for (const i of list) {
            const d = ((L.px[i] ?? 0) - wx) ** 2 + ((L.pz[i] ?? 0) - wz) ** 2;
            if (d < bestD) { bestD = d; best = i; }
          }
        }
      }
      if (best >= 0 && Math.sqrt(bestD) < r * CELL) break;
    }
    return Math.max(0, best);
  }

  /** Full sample at a world point: nearest s, lateral x (end rays extend straight), height. */
  sampleWorld(wx: number, wz: number): WorldSample {
    const L = this.L;
    const i = this.nearestSample(wx, wz);
    // Refine s on the neighbouring chords.
    let s = L.sMin + i, bestD = Infinity;
    for (const a of [i - 1, i]) {
      const b = a + 1;
      if (a < 0 || b >= L.n) continue;
      const ax = L.px[a] ?? 0, az = L.pz[a] ?? 0;
      const ex = (L.px[b] ?? 0) - ax, ez = (L.pz[b] ?? 0) - az;
      const t = Math.min(1, Math.max(0, ((wx - ax) * ex + (wz - az) * ez) / (ex * ex + ez * ez || 1)));
      const d = (ax + ex * t - wx) ** 2 + (az + ez * t - wz) ** 2;
      if (d < bestD) { bestD = d; s = L.sMin + a + t; }
    }
    const fr = this.q.frameVis(s, this.fr);
    const rl = Math.hypot(fr.right.x, fr.right.z) || 1;
    const x = ((wx - fr.pos.x) * fr.right.x + (wz - fr.pos.z) * fr.right.z) / rl;
    const side: -1 | 1 = x < 0 ? -1 : 1;
    const bound = this.bound(s, side);
    const u = Math.abs(x) - bound;
    const g = this.ground(s, side);
    if (u < 0) return { s, x, u, side, g, h: this.underRoad(s, fr.pos.y), bump: null };
    const edgeY = fr.pos.y + fr.right.y * side * bound;
    const { h, bump } = this.shape(g, edgeY, fr.pos.y, u, wx, wz);
    return { s, x, u, side, g, h: this.mod ? this.mod.height(s, side, u, wx, wz, h) : h, bump };
  }
}
