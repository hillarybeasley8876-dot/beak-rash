// Starting grid: rivals sorted by strength and today's form (qualifying: front rows = strong or in form), the
// humans mid-pack, a staggered two-wide grid (every rider on its own s, sides alternating: the intro camera
// dollies down the middle presenting them one by one, and the HUD's calling card follows the s of its look point).
// On easy levels the most aggressive rival never starts right beside, ahead of or behind a human.
// Online (SPEC §28) the humans keep the middle slots core gave them, and the bully is kept off EVERY human's
// neighbouring slots — the sim's "the player" is a human, not the local rider.
import { BIKES } from '../../data/bikes';
import { ROSTER } from '../../data/roster';
import type { Session } from '../../core/contracts';
import type { RiderState } from '../../core/types';
import type { FormTable } from './ai/form';
import { baseAggression } from './ai/personality';

const FRONT_S = 40;        // front row position (session convention)
const ROW_GAP = 5;         // m between rows
const COL_X = [-2, 2];     // the intro camera passes down the middle (intro-camera.ts)
const COL_STAGGER = 2.5;   // m the right column sits behind the left one
const PLAYER_SLOT = 4;     // left side of the third row: mid-pack
const NEIGHBOUR_STEPS = [-2, -1, 1, 2];  // the slots next to a human (ahead of, beside and behind it)
const CALM_SLOTS = [7, 0, 1];        // where the bully goes instead (diagonally behind, or the front row)
const CALM_LEVELS = 2;               // levels with the bully kept away from the humans
const ONLINE_FRONT = 3;              // AI riders ahead of the humans' block (core's middle slots)
const RATING_W = 0.5, FORM_W = 1.5, LUCK = 1.5;   // grid key = rating share + today's pace form + a little luck

/** Rough pace rating used for grid order and AI strength (higher = faster). */
export function riderRating(r: RiderState): number {
  const st = ROSTER[r.character].stats;
  return st.speed * 1.0 + st.handling * 0.6 + st.power * 0.3 + BIKES[r.bike].topSpeed * 0.25;
}

/** Move the most aggressive rival off the neighbouring slots of every human (swap with a calm slot). */
function calmNeighbours(order: RiderState[], humans: readonly RiderState[]): void {
  let bully = -1;
  order.forEach((r, i) => {
    if (r.human) return;
    if (bully < 0 || baseAggression(r.character) > baseAggression((order[bully] as RiderState).character)) bully = i;
  });
  const protectedSlots = new Set<number>();
  for (const h of humans) {
    const slot = order.indexOf(h);
    if (slot < 0) continue;
    for (const step of NEIGHBOUR_STEPS) {
      const s = slot + step;
      if (s >= 0 && s < order.length) protectedSlots.add(s);
    }
  }
  if (!protectedSlots.has(bully)) return;
  const to = CALM_SLOTS.find((i) => i < order.length && !protectedSlots.has(i) && !order[i]?.human);
  if (to === undefined) return;
  const a = order[bully] as RiderState;
  order[bully] = order[to] as RiderState;
  order[to] = a;
}

export function regrid(session: Session, form: FormTable): void {
  const jitter = session.rng.fork(0x6a1d);
  const rivals = session.riders
    .filter((r) => !r.human)
    .map((r) => ({ r, key: RATING_W * riderRating(r) + FORM_W * (form.get(r.id)?.pace ?? 0) + jitter.range(0, LUCK) }))
    .sort((a, b) => b.key - a.key)
    .map((e) => e.r);
  // The humans of the race (offline: the player; online: every member, in id order).
  const humans = session.riders.filter((r) => r.human);
  const order: RiderState[] = rivals.slice();
  if (session.config.online) {
    // The humans keep the middle slots core gave them: a few AI riders ahead of them, the rest behind.
    const first = Math.max(0, Math.min(ONLINE_FRONT, rivals.length));
    order.splice(first, 0, ...humans);
  } else {
    order.splice(Math.min(PLAYER_SLOT, order.length), 0, ...humans);
  }
  if (session.config.level <= CALM_LEVELS) calmNeighbours(order, humans);
  order.forEach((r, slot) => {
    const row = Math.floor(slot / COL_X.length);
    const col = slot % COL_X.length;
    r.s = FRONT_S - row * ROW_GAP - col * COL_STAGGER;
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
