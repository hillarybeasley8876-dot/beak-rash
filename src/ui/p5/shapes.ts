// Shape generators: jagged clip-path polygons, torn paper edges, star bursts (SVG markup).
// Seeded so a panel keeps its silhouette across re-renders (cosmetic Rng, not session.rng).
import { Rng, hashString } from '../../core/rng';

const rngFor = (seed: number | string): Rng => new Rng(typeof seed === 'number' ? seed : hashString(seed));
const pct = (v: number): string => `${v.toFixed(2)}%`;

export interface JaggedOpts {
  /** Corner jitter in % of width / height. */
  jx?: number;
  jy?: number;
  /** Extra points per edge (each nudged in/out). */
  notches?: number;
}

/** Irregular 4-sided polygon: every corner and a few edge points jittered inward. */
export function jagged(seed: number | string, o: JaggedOpts = {}): string {
  const r = rngFor(seed);
  const jx = o.jx ?? 2.5;
  const jy = o.jy ?? 6;
  const n = o.notches ?? 1;
  const pts: string[] = [];
  const edge = (x0: number, y0: number, x1: number, y1: number, nx: number, ny: number): void => {
    pts.push(`${pct(x0)} ${pct(y0)}`);
    for (let i = 1; i <= n; i++) {
      const t = (i / (n + 1)) * r.range(0.8, 1.2);
      const d = r.range(0, 1);
      pts.push(`${pct(x0 + (x1 - x0) * t + nx * d * jx)} ${pct(y0 + (y1 - y0) * t + ny * d * jy)}`);
    }
  };
  const c = (v: number, j: number): number => v + r.range(0, j);
  const tl: [number, number] = [c(0, jx), c(0, jy)];
  const tr: [number, number] = [100 - r.range(0, jx), c(0, jy)];
  const br: [number, number] = [100 - r.range(0, jx), 100 - r.range(0, jy)];
  const bl: [number, number] = [c(0, jx), 100 - r.range(0, jy)];
  edge(tl[0], tl[1], tr[0], tr[1], 0, 1);
  edge(tr[0], tr[1], br[0], br[1], -1, 0);
  edge(br[0], br[1], bl[0], bl[1], 0, -1);
  edge(bl[0], bl[1], tl[0], tl[1], 1, 0);
  return `polygon(${pts.join(', ')})`;
}

/** Rectangle whose `side` edge is torn into small zig-zags (paper rip). */
export function torn(seed: number | string, side: 'top' | 'bottom' | 'left' | 'right' = 'bottom', depth = 4, teeth = 28): string {
  const r = rngFor(seed);
  const rip: string[] = [];
  for (let i = 0; i <= teeth; i++) {
    const t = (i / teeth) * 100;
    const d = (i % 2 === 0 ? r.range(0.1, 0.5) : r.range(0.6, 1)) * depth;
    if (side === 'bottom') rip.push(`${pct(100 - t)} ${pct(100 - d)}`);
    else if (side === 'top') rip.push(`${pct(t)} ${pct(d)}`);
    else if (side === 'right') rip.push(`${pct(100 - d)} ${pct(t)}`);
    else rip.push(`${pct(d)} ${pct(100 - t)}`);
  }
  const body =
    side === 'bottom' ? ['0% 0%', '100% 0%', ...rip] :
    side === 'top' ? [...rip, '100% 100%', '0% 100%'] :
    side === 'right' ? ['0% 0%', ...rip, '0% 100%'] :
    ['100% 0%', '100% 100%', ...rip, '0% 0%'];
  return `polygon(${body.join(', ')})`;
}

export interface StarOpts {
  points?: number;
  inner?: number;       // inner radius 0..1
  wobble?: number;      // 0 = regular star, 0.3 = comic explosion
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  seed?: number | string;
  rotate?: number;      // degrees
}

/** SVG path data for a star/burst on a 200×200 box centred at (100,100). */
export function starPath(o: StarOpts = {}): string {
  const r = rngFor(o.seed ?? 7);
  const n = o.points ?? 5;
  const inner = o.inner ?? 0.45;
  const wob = o.wobble ?? 0;
  const rot = ((o.rotate ?? -90) * Math.PI) / 180;
  const d: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = rot + (i * Math.PI) / n;
    const base = i % 2 === 0 ? 96 : 96 * inner;
    const rad = base * (1 - r.range(0, wob));
    d.push(`${i === 0 ? 'M' : 'L'}${(100 + Math.cos(a) * rad).toFixed(1)} ${(100 + Math.sin(a) * rad).toFixed(1)}`);
  }
  return `${d.join(' ')}Z`;
}

export function starSvg(o: StarOpts = {}): string {
  const stroke = o.stroke ? ` stroke="${o.stroke}" stroke-width="${o.strokeWidth ?? 6}" stroke-linejoin="miter"` : '';
  return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="${starPath(o)}" fill="${o.fill ?? '#e5191c'}"${stroke}/></svg>`;
}
