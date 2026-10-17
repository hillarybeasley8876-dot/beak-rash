// Jagged P5 geometry as CSS clip-path polygons (percent coordinates) and SVG point lists.
import { Rng } from '../../core/rng';

const pct = (v: number): string => `${v.toFixed(2)}%`;

/** Star burst: `points` spikes, inner radius ratio `inner` (0..1), optional per-spike jitter. */
export function starPoints(points: number, inner: number, jitter = 0, seed = 1): Array<[number, number]> {
  const rng = new Rng(seed);
  const out: Array<[number, number]> = [];
  for (let i = 0; i < points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const base = i % 2 === 0 ? 1 : inner;
    const r = base * (1 - (i % 2 === 0 ? rng.range(0, jitter) : 0));
    out.push([50 + Math.cos(a) * 50 * r, 50 + Math.sin(a) * 50 * r]);
  }
  return out;
}

export const starClip = (points: number, inner: number, jitter = 0, seed = 1): string =>
  `polygon(${starPoints(points, inner, jitter, seed).map(([x, y]) => `${pct(x)} ${pct(y)}`).join(',')})`;

/** Rectangle whose left/right edges are torn into zigzag teeth (`depth` in % of width). */
export function tornClip(teeth: number, depth: number, seed = 1): string {
  const rng = new Rng(seed);
  const pts: string[] = [];
  for (let i = 0; i <= teeth; i++) {
    const y = (i / teeth) * 100;
    pts.push(`${pct(i % 2 ? depth * rng.range(0.5, 1) : 0)} ${pct(y)}`);
  }
  for (let i = teeth; i >= 0; i--) {
    const y = (i / teeth) * 100;
    pts.push(`${pct(100 - (i % 2 ? depth * rng.range(0.5, 1) : 0))} ${pct(y)}`);
  }
  return `polygon(${pts.join(',')})`;
}

/** Parallelogram-ish jagged shard: skewed quad with a few notches along top and bottom. */
export function shardClip(skew: number, notches: number, depth: number, seed = 1): string {
  const rng = new Rng(seed);
  const top: string[] = [];
  const bottom: string[] = [];
  for (let i = 0; i <= notches; i++) {
    const t = i / notches;
    const dy = i > 0 && i < notches ? rng.range(0, depth) : 0;
    top.push(`${pct(skew + t * (100 - skew))} ${pct(dy)}`);
    bottom.push(`${pct(t * (100 - skew))} ${pct(100 - (i > 0 && i < notches ? rng.range(0, depth) : 0))}`);
  }
  return `polygon(${top.join(',')},${bottom.reverse().join(',')})`;
}

/** SVG `points` attribute for a star of radius r centred at (cx, cy). */
export function starSvg(cx: number, cy: number, r: number, points: number, inner: number, jitter = 0, seed = 1): string {
  return starPoints(points, inner, jitter, seed)
    .map(([x, y]) => `${(cx + ((x - 50) / 50) * r).toFixed(1)},${(cy + ((y - 50) / 50) * r).toFixed(1)}`)
    .join(' ');
}
