// Per-sample side profiles (shoulders, edge kinds, surfaces, terrain ground) blended along s.
// Each segment's left/right overrides merge onto the previous profile; numeric values blend with a
// smoothstep over `sideEase` centred on the segment start, discrete ones switch at the midpoint.
import { smoothstep } from '../../core/math';
import type { Surface } from '../../core/types';
import type { EdgeKind, GroundDef, LayoutDef, SideDef } from './types';

export const EDGE_KINDS: readonly EdgeKind[] = ['rail', 'barrier', 'seawall', 'stone', 'parapet', 'rock', 'tunnel', 'stalls', 'quay', 'water'];
export const SURFACES: readonly Surface[] = ['road', 'curb', 'grass', 'sand', 'dirt', 'water', 'wall'];

export interface SideSamples {
  shoulder: Float32Array;
  edge: Uint8Array;      // index into EDGE_KINDS
  surface: Uint8Array;   // index into SURFACES
  ground: GroundDef[];
}

export interface SideTable { left: SideSamples; right: SideSamples }

/** Edges that end in a drop (the rider falls into the water) rather than a wall. */
export const isWaterEdge = (e: EdgeKind): boolean => e === 'quay' || e === 'water';

type SidePatch = Partial<Omit<SideDef, 'ground'>> & { ground?: Partial<GroundDef> };

const merge = (base: SideDef, p: SidePatch | undefined): SideDef =>
  p ? { ...base, ...p, ground: { ...base.ground, ...(p.ground ?? {}) } } : base;

function blendGround(a: GroundDef, b: GroundDef, t: number): GroundDef {
  const m = (x: number, y: number): number => x + (y - x) * t;
  const late = t >= 0.5 ? b : a;
  // abs/relative heights cannot blend meaningfully across a switch: take the late profile whole.
  if (a.abs !== b.abs || a.detached !== b.detached) return late;
  return {
    step: m(a.step, b.step), stepW: m(a.stepW, b.stepW), flat: m(a.flat, b.flat), slope: m(a.slope, b.slope),
    target: m(a.target, b.target), rough: m(a.rough, b.rough), abs: late.abs, detached: late.detached, mat: late.mat,
  };
}

export function buildSides(def: LayoutDef, starts: number[], sMin: number, n: number): SideTable {
  const keysL: SideDef[] = [], keysR: SideDef[] = [];
  let l = def.left, r = def.right;
  def.segments.forEach((g) => {
    l = merge(l, g.left);
    r = merge(r, g.right);
    keysL.push(l);
    keysR.push(r);
  });
  const ease = def.segments.map((g, i) => (i === 0 ? 0 : Math.min(g.sideEase ?? 24, g.len, def.segments[i - 1]?.len ?? 0)));
  const make = (): SideSamples => ({ shoulder: new Float32Array(n), edge: new Uint8Array(n), surface: new Uint8Array(n), ground: [] });
  const out: SideTable = { left: make(), right: make() };
  let k = 0;
  for (let i = 0; i < n; i++) {
    const s = sMin + i;
    while (k < starts.length - 1 && s >= (starts[k + 1] ?? Infinity)) k++;
    // Blend partner: the previous key while inside this key's ramp, else the next key inside its ramp.
    let a = k, b = k, t = 0;
    const e0 = ease[k] ?? 0, b0 = starts[k] ?? 0;
    const e1 = ease[k + 1] ?? 0, b1 = starts[k + 1];
    if (k > 0 && e0 > 0 && s < b0 + e0 / 2) { a = k - 1; b = k; t = smoothstep(b0 - e0 / 2, b0 + e0 / 2, s); }
    else if (b1 !== undefined && e1 > 0 && s > b1 - e1 / 2) { a = k; b = k + 1; t = smoothstep(b1 - e1 / 2, b1 + e1 / 2, s); }
    fill(out.left, i, keysL[a] ?? def.left, keysL[b] ?? def.left, s < 0 ? 0 : t);
    fill(out.right, i, keysR[a] ?? def.right, keysR[b] ?? def.right, s < 0 ? 0 : t);
  }
  return out;
}

/** Narrowest blended step width that still draws a rock face at the bound (profile.ts WALL_TOE rule). */
const FACE_W = 2.5;

/**
 * Blend parameter where the edge kind switches: the midpoint, except into / out of a 'rock' edge
 * whose wall only forms once the blended step is narrow: there the switch waits for the face, so
 * bounds() never reports a wall before (or after) one is drawn at the edge.
 */
function edgeSwitch(a: SideDef, b: SideDef): number {
  const ga = a.ground, gb = b.ground;
  if (ga.abs !== gb.abs || ga.detached !== gb.detached || (a.edge === 'rock') === (b.edge === 'rock')) return 0.5;
  const into = b.edge === 'rock';
  const wFrom = into ? ga.stepW : gb.stepW, wTo = into ? gb.stepW : ga.stepW;
  if (wTo >= FACE_W || wFrom <= FACE_W) return 0.5;
  const t = (wFrom - FACE_W) / (wFrom - wTo);
  return into ? t : 1 - t;
}

function fill(o: SideSamples, i: number, a: SideDef, b: SideDef, t: number): void {
  const late = t >= 0.5 ? b : a;
  o.shoulder[i] = a.shoulder + (b.shoulder - a.shoulder) * t;
  o.edge[i] = Math.max(0, EDGE_KINDS.indexOf((t >= edgeSwitch(a, b) ? b : a).edge));
  o.surface[i] = Math.max(0, SURFACES.indexOf(late.surface));
  o.ground[i] = blendGround(a.ground, b.ground, t);
}
