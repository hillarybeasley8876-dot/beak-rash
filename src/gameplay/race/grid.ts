// Starting grid: rivals sorted by strength (front rows = strongest), player mid-pack, staggered rows.
// On easy levels the most aggressive rival never starts right beside, ahead of or behind the player.
import { BIKES } from '../../data/bikes';
import { ROSTER } from '../../data/roster';
import type { Session } from '../../core/contracts';
import type { RiderState } from '../../core/types';
import { baseAggression } from './ai/personality';

const FRONT_S = 40;        // front row position (session convention)
const ROW_GAP = 6.5;       // m between rows
const COL_X = [-3.4, 0, 3.4];
const PLAYER_SLOT = 4;     // middle of the second row
const NEIGHBOURS = [1, 3, 5, 7];     // slots next to the player's
const CALM_SLOTS = [6, 0, 2];        // where the bully goes instead (diagonal, a row away)
const CALM_LEVELS = 2;               // levels with the bully kept away from the player

/** Rough pace rating used for grid order and AI strength (higher = faster). */
export function riderRating(r: RiderState): number {
  const st = ROSTER[r.character].stats;
  return st.speed * 1.0 + st.handling * 0.6 + st.power * 0.3 + BIKES[r.bike].topSpeed * 0.25;
}

/** Move the most aggressive rival off the player's neighbouring slots (swap with a calm slot). */
function calmNeighbours(order: RiderState[]): void {
  let bully = -1;
  order.forEach((r, i) => {
    if (r.isPlayer) return;
    if (bully < 0 || baseAggression(r.character) > baseAggression((order[bully] as RiderState).character)) bully = i;
  });
  if (!NEIGHBOURS.includes(bully)) return;
  const to = CALM_SLOTS.find((i) => i < order.length);
  if (to === undefined) return;
  const a = order[bully] as RiderState;
  order[bully] = order[to] as RiderState;
  order[to] = a;
}

export function regrid(session: Session): void {
  const jitter = session.rng.fork(0x6a1d);
  const rivals = session.riders
    .filter((r) => !r.isPlayer)
    .map((r) => ({ r, key: riderRating(r) + jitter.range(0, 1.2) }))
    .sort((a, b) => b.key - a.key)
    .map((e) => e.r);
  const order: RiderState[] = rivals.slice();
  order.splice(Math.min(PLAYER_SLOT, order.length), 0, session.player);
  if (session.config.level <= CALM_LEVELS) calmNeighbours(order);
  order.forEach((r, slot) => {
    const row = Math.floor(slot / 3);
    const col = slot % 3;
    r.s = FRONT_S - row * ROW_GAP - (col === 1 ? 1.4 : 0);
    r.x = COL_X[col] ?? 0;
    r.y = 0;
    r.speed = 0;
    r.vx = 0;
    r.mode = 'grid';
  });
  // Places follow the staggered positions, so the first standings update reports no phantom pass.
  order.map((r, slot) => ({ r, slot })).sort((a, b) => b.r.s - a.r.s || a.slot - b.slot)
    .forEach((e, i) => { e.r.place = i + 1; });
}
