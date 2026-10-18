// Pickup items in track space and the rows they come in (track 'pickupRow' features, or generated rows
// when a track defines none so every track has something to grab).
import type { Rng } from '../../../core/rng';
import type { RiderId, TrackFeature, WeaponId } from '../../../core/types';
import { PICKUP } from '../tuning';

export type PickupKind = 'coin' | 'fish' | 'crate' | 'can' | 'weapon';
export const ROW_KINDS: readonly PickupKind[] = ['coin', 'fish', 'crate', 'can'];

export interface Item {
  readonly id: number;
  kind: PickupKind;
  s: number;
  x: number;
  y: number;             // centre height above the road
  alive: boolean;
  respawnAt: number;     // combat time when a taken row item returns (Infinity = never)
  pop: number;           // 0..1 spawn pop-in
  phase: number;         // animation offset
  weapon: WeaponId;      // kind 'weapon'
  uses: number;
  vel: { s: number; x: number; y: number } | null; // in flight (dropped weapons)
  life: number;          // seconds left for drops (Infinity for row items)
  vacuumBy: RiderId | null;
  home: { s: number; x: number } | null; // where a row item sits (restored if Big Gulp drags it and misses)
}

/** A fresh item; ids come from the session's PickupSystem (same seed, same ids after a restart). */
export function makeItem(id: number, kind: PickupKind, s: number, x: number, phase: number): Item {
  return {
    id, kind, s, x, y: PICKUP.float, alive: true, respawnAt: Infinity, pop: 1, phase,
    weapon: 'none', uses: 0, vel: null, life: Infinity, vacuumBy: null, home: kind === 'weapon' ? null : { s, x },
  };
}

function rowKind(f: TrackFeature): PickupKind | 'mixed' {
  const k = f.data?.kind;
  return typeof k === 'string' && (ROW_KINDS as readonly string[]).includes(k) ? (k as PickupKind) : 'mixed';
}

/**
 * Lay one row: items every ~3 m from (s0,x0) to (s1,x1). 'coin' rows are all coins; fish/can/crate rows put
 * that item on every third slot with coins between; rows without a kind get one random special in the middle.
 */
export function layRow(f: TrackFeature, rng: Rng, out: Item[], nextId: () => number): void {
  const len = Math.max(0, f.s1 - f.s0);
  const n = Math.max(1, Math.round(len / 3) + 1);
  const kind = rowKind(f);
  const mid = Math.floor(n / 2);
  const special: PickupKind = rng.pick<PickupKind>(['crate', 'crate', 'fish', 'can', 'fish', 'can', 'crate']);
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const k = kind === 'mixed' ? (i === mid && n >= 3 ? special : 'coin') : kind === 'coin' || i % 3 === 1 || n < 3 ? kind : 'coin';
    out.push(makeItem(nextId(), k, f.s0 + len * t, f.x0 + (f.x1 - f.x0) * t, i * 0.7 + rng.next()));
  }
}

/** Fallback rows every PICKUP.autoRowEvery metres, alternating lanes, with a gentle diagonal. */
export function autoRows(length: number, halfWidth: (s: number) => number, rng: Rng): TrackFeature[] {
  const rows: TrackFeature[] = [];
  for (let s = 180; s < length - 150; s += PICKUP.autoRowEvery + rng.range(-40, 40)) {
    const lim = Math.max(1.5, halfWidth(s) - 1.6);
    const x0 = rng.range(-lim, lim);
    const x1 = Math.max(-lim, Math.min(lim, x0 + rng.range(-2.5, 2.5)));
    rows.push({ kind: 'pickupRow', s0: s, s1: s + 18, x0, x1 });
  }
  return rows;
}
