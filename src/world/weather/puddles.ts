// Rain puddles: seeded patches of standing water on the drivable road (SPEC §20). They are gameplay
// features (the sim makes them slick), so they sit on the asphalt, well clear of the start / finish
// grid and off the bridges, tunnels and ramps.
import { hashString, Rng } from '../../core/rng';
import type { TrackId } from '../../core/types';
import type { BuiltLayout } from '../layout/build';
import { TUNE } from './table';

/** s spans a puddle may not sit on: bridges, tunnels and ramps, plus a margin. */
function blockedSpans(L: BuiltLayout): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const f of L.features) {
    if (f.kind === 'bridge' || f.kind === 'tunnel' || f.kind === 'ramp') out.push([f.s0 - TUNE.puddle.block, f.s1 + TUNE.puddle.block]);
  }
  return out;
}

/** Add the rain puddles of one track to its built layout. Seeded per track: the same track rains the same. */
export function addRainPuddles(L: BuiltLayout, id: TrackId): void {
  const existing = L.features.filter((f) => f.kind === 'puddle');
  const want = Math.max(TUNE.puddle.min - existing.length, existing.length) + TUNE.puddle.extra;
  const s0 = TUNE.puddle.keepClear;
  const s1 = L.length - TUNE.puddle.keepClear;
  if (want <= 0 || s1 <= s0) return;
  const blocked = blockedSpans(L);
  const taken: Array<[number, number]> = existing.map((f) => [f.s0, f.s1]);
  const rng = new Rng(hashString(`puddle:${id}`));
  const hw = L.halfWidth;
  const span = s1 - s0;
  for (let i = 0; i < want; i++) {
    const slot = s0 + (span * (i + 0.5)) / want;
    for (let attempt = 0; attempt < 8; attempt++) {
      const centre = slot + rng.range(-1, 1) * (span / want) * 0.35;
      const len = rng.range(TUNE.puddle.lenMin, TUNE.puddle.lenMax);
      const a = centre - len / 2, b = centre + len / 2;
      if (a < s0 || b > s1) continue;
      if (blocked.some(([x, y]) => b > x && a < y)) continue;
      if (taken.some(([x, y]) => b > x && a < y)) continue;
      const wide = rng.range(TUNE.puddle.wideMin, TUNE.puddle.wideMax);
      const lo = -hw + TUNE.puddle.margin + wide / 2;
      const hi = hw - TUNE.puddle.margin - wide / 2;
      const cx = hi > lo ? rng.range(lo, hi) : 0;
      L.features.push({ kind: 'puddle', s0: a, s1: b, x0: cx - wide / 2, x1: cx + wide / 2 });
      taken.push([a, b]);
      break;
    }
  }
}
