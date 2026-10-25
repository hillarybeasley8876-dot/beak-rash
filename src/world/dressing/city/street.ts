// City street furniture: street lamps with additive light pools on the wet asphalt, traffic lights
// at the zebra crossings, bus shelters (layout marks), vending machines, planter trees and parked
// scooters in the strip between the bollard kerb and the shop fronts.
import { Color } from 'three';
import { Rng } from '../../../core/rng';
import { busShelter, planterTree, scooter, streetLamp, trafficLight, TREE, vending } from '../../scenery/props/city-street';
import { postSign } from '../../scenery/signs/boards';
import { roadSignFace } from '../../scenery/signs/faces';
import type { City } from './city';
import type { Pools } from './paint';
import { hdr, mount, signInset, towardRiders, zoneAt, zoneRuns } from './util';

/** Lamp kinds: glow colour (HDR) + pool colour on the road. */
const LAMPS = {
  sodium: { glow: hdr('#ffb661', 2.6), pool: new Color(1.0, 0.6, 0.28).multiplyScalar(0.75) },
  led: { glow: hdr('#d8e8ff', 2.6), pool: new Color(0.55, 0.72, 1.0).multiplyScalar(0.65) },
  pink: { glow: hdr('#ff5fc8', 2.6), pool: new Color(1.0, 0.3, 0.75).multiplyScalar(0.62) },
};
type LampKind = keyof typeof LAMPS;

/** Zones with street lamps (the arcade has lanterns, the underpass / tunnel their own lights). */
const LAMP_ZONES = ['start', 'boulevard', 'corner', 'street', 'scramble', 'chicane', 'ramp', 'expressway', 'crest', 'drop', 'riverside', 'bridge', 'avenue', 'hairpin', 'sprint', 'finish'];

function lampKind(zone: string, rng: Rng): LampKind {
  if (zone === 'scramble' || zone === 'sprint') return rng.chance(0.35) ? 'pink' : 'led';
  if (['ramp', 'expressway', 'crest', 'drop', 'bridge'].includes(zone)) return 'sodium';
  return rng.chance(0.75) ? 'sodium' : 'led';
}

/** Plazas get slightly wider hot spots. */
const WIDE = ['start', 'scramble', 'finish'];

/** No flat decal pools where the road bends vertically (crest, drop): they would float or clip. */
function flatEnough(c: City, s: number): boolean {
  const q = c.d.ctx.q;
  return Math.abs(q.frameVis(s + 4).tangent.y - q.frameVis(s - 4).tangent.y) < 0.03;
}

/** Lamps every ~26 m per side (sides staggered), each with a hot spot on the road under its head. */
export function streetLamps(c: City, pools: Pools): number {
  const { ctx, b } = c.d;
  const rng = c.d.rng.fork(0x1a3b);
  let n = 0;
  for (const [s0, s1] of zoneRuns(ctx, LAMP_ZONES)) {
    for (const side of [-1, 1] as const) {
      for (let s = s0 + (side < 0 ? 6 : 19); s < s1 - 4; s += rng.range(24, 28)) {
        const mt = mount(c, s, side, 0.35);
        if (!mt) continue;
        const { sp, y } = mt;
        if (!mt.onDeck && !c.d.place.free(sp.pos.x, sp.pos.z, 0.45, 0.2)) continue;
        const kind = LAMPS[lampKind(zoneAt(ctx, s), rng)];
        const reach = mt.onDeck ? 1.8 : 2.6;
        streetLamp(b.props.at(sp.pos.x, sp.pos.z), b.glow.at(sp.pos.x, sp.pos.z), sp.pos.x, y, sp.pos.z, sp.faceRoad, kind.glow, reach, mt.onDeck ? 7 : 8);
        // A small hot spot under the head (wide discs flattened into glowing bars at the chase-cam angle;
        // the mirror's lamp-head reflections draw the long wet streaks).
        if (flatEnough(c, s)) pools.add(s, sp.x - side * reach, WIDE.includes(zoneAt(ctx, s)) ? 2.0 : 1.7, kind.pool);
        n++;
      }
    }
  }
  return n;
}

/** Traffic lights on both sides of each crossing (masts staggered before the stop line). */
export function trafficLights(c: City, at: number[]): void {
  const { b } = c.d;
  at.forEach((s, k) => {
    const phase = new Rng(0x7f1 + k).range(0, 14);
    for (const side of [-1, 1] as const) {
      const mt = mount(c, s - side * 3.2, side, 0.45);
      if (!mt || mt.onDeck) continue;
      const { sp, y } = mt;
      if (!c.d.place.free(sp.pos.x, sp.pos.z, 0.5, 0.2)) continue;
      trafficLight(b.props.at(sp.pos.x, sp.pos.z), c.cb.lights.at(sp.pos.x, sp.pos.z), sp.pos.x, y, sp.pos.z, sp.faceRoad, phase, 4.6);
    }
  });
}

/** Bus shelter with a lit ad box + a stop sign on a post, at a layout mark. */
export function busStop(c: City, s: number, side: -1 | 1, k: number): void {
  const { b, place, atlas } = c.d;
  const mt = mount(c, s, side, 0.55);
  if (!mt || mt.onDeck) return;
  const { sp, y } = mt;
  if (!place.free(sp.pos.x, sp.pos.z, 2.4, 0.2)) return;
  const ads = [hdr('#ff3d8b', 1.8), hdr('#3de0ff', 1.8), hdr('#ffd23d', 1.8)];
  busShelter(b.props.at(sp.pos.x, sp.pos.z), b.glow.at(sp.pos.x, sp.pos.z), sp.pos.x, y, sp.pos.z, sp.faceRoad, ads[k % ads.length] ?? (ads[0] as Color));
  const rect = c.d.face('sign:bus', () => roadSignFace(atlas, '公交站 鹈鹕大道'));
  const ps = place.spot(s - 3.4, side, signInset(1.5, 0.5));
  if (rect && place.claim(ps.pos.x, ps.pos.z, 0.3)) {
    postSign(b.props.at(ps.pos.x, ps.pos.z), b.faces.at(ps.pos.x, ps.pos.z), ps.pos.x, y, ps.pos.z, towardRiders(c.d.ctx, s, side, 0.5), 1.5, 0.95, 1.7, rect);
  }
}

/** Planter trees: cherry blossom along the boulevard / plazas / river, ginkgo on the avenues. */
const TREES: Record<string, 'cherry' | 'ginkgo'> = {
  start: 'cherry', boulevard: 'cherry', riverside: 'cherry', finish: 'cherry', scramble: 'ginkgo', avenue: 'ginkgo', hairpin: 'ginkgo',
};
const PROP_ZONES = ['start', 'boulevard', 'street', 'scramble', 'chicane', 'riverside', 'avenue', 'sprint', 'finish'];
const VENDING = [new Color('#d8262c'), new Color('#eeeef2'), new Color('#2a6fdb'), new Color('#1fae8c')];
const SCOOTERS = [new Color('#ff7aa2'), new Color('#7ad3ff'), new Color('#ffd166'), new Color('#f4f1ea'), new Color('#c3f584'), new Color('#e5191c')];

/** First free spot among the candidate offsets beyond the kerb (props stand clear of the facades). */
function kerbSpot(c: City, s: number, side: -1 | 1, us: number[], r: number): ReturnType<typeof mount> {
  for (const u of us) {
    const mt = mount(c, s, side, u);
    if (!mt || mt.onDeck) return null;
    if (c.d.place.free(mt.sp.pos.x, mt.sp.pos.z, r, 0.3)) return mt;
  }
  return null;
}

/** Curves tighter than this (m) swing the chase camera over the kerb: trees stand further back there. */
const TIGHT_R = 60;

/** Tightest radius (m) of the road within ±16 m of s. */
function tightest(c: City, s: number): number {
  let k = 0;
  for (let ds = -16; ds <= 16; ds += 4) k = Math.max(k, Math.abs(c.d.ctx.q.frameVis(s + ds).curvature));
  return k > 1e-6 ? 1 / k : Infinity;
}

/** The roundabout statue's sightline: no trees on its side from 90 m before its hairpin to the hairpin's end. */
function statueView(c: City, s: number, side: -1 | 1): boolean {
  const { L } = c.d.ctx;
  return L.marks.some((m) => {
    if (m.kind !== 'roundabout' || Math.sign(m.x) !== side) return false;
    const z = L.zones.find((zz) => m.s >= zz.s0 && m.s < zz.s1);
    return !!z && s > z.s0 - 90 && s < z.s1;
  });
}

function trees(c: City, rng: Rng): number {
  const { ctx, b } = c.d;
  let count = 0, tight = 0, view = 0, clear = Infinity;
  for (const z of ctx.L.zones) {
    const kind = TREES[z.name];
    if (!kind) continue;
    for (const side of [-1, 1] as const) {
      for (let s = z.s0 + 10 + rng.range(0, 5); s < z.s1 - 6; s += rng.range(15, 21)) {
        if (statueView(c, s, side)) { view++; continue; }
        // On tight curves the trunk stands >= 2.5 m back (the crown then clears the drivable edge by ~1 m).
        const isTight = tightest(c, s) < TIGHT_R;
        const mt = kerbSpot(c, s, side, isTight ? [2.6, 2.5] : [1.3, 1.0], 1.0);
        if (!mt) continue;
        const { x, z: wz } = mt.sp.pos;
        planterTree(c.cb.lit.at(x, wz), b.glow.at(x, wz), x, mt.y, wz, mt.sp.faceRoad, rng, kind);
        count++;
        if (isTight) { tight++; clear = Math.min(clear, mt.sp.u - TREE.reach); }
      }
    }
  }
  ctx.log(`city trees: ${count} (${tight} set back on curves under R ${TIGHT_R}, crown clearance >= ${tight ? clear.toFixed(2) : '-'} m; ${view} spots left open for the statue)`);
  return count;
}

function vendingPair(c: City, s: number, side: -1 | 1, rng: Rng): void {
  const { b } = c.d;
  const count = rng.int(1, 3);
  for (let i = 0; i < count; i++) {
    const mt = kerbSpot(c, s + i * 1.1, side, [2.1, 1.7, 1.3], 0.6);
    if (!mt) return;
    const { sp } = mt;
    vending(b.props.at(sp.pos.x, sp.pos.z), b.glow.at(sp.pos.x, sp.pos.z), sp.pos.x, mt.y, sp.pos.z, sp.faceRoad, rng.pick(VENDING), rng);
  }
}

function scooterRow(c: City, s: number, side: -1 | 1, rng: Rng): void {
  const { b } = c.d;
  const count = rng.int(3, 7), tilt = rng.range(0.3, 0.6) * (rng.chance(0.5) ? 1 : -1);
  for (let i = 0; i < count; i++) {
    const mt = kerbSpot(c, s + i * 0.85, side, [1.5, 1.2], 0.4);
    if (!mt) continue;
    const { sp } = mt;
    scooter(b.props.at(sp.pos.x, sp.pos.z), sp.pos.x, mt.y, sp.pos.z, sp.faceRoad + tilt + rng.range(-0.08, 0.08), rng.pick(SCOOTERS));
  }
}

/** Trees, vending machines and scooter rows along the street-level zones. Returns the tree count. */
export function kerbProps(c: City): number {
  const rng = c.d.rng.fork(0x4e7b);
  const n = trees(c, rng);
  for (const z of c.d.ctx.L.zones) {
    if (!PROP_ZONES.includes(z.name)) continue;
    for (const side of [-1, 1] as const) {
      for (let s = z.s0 + rng.range(5, 25); s < z.s1 - 6; s += rng.range(26, 48)) {
        if (rng.chance(0.5)) vendingPair(c, s, side, rng);
        else scooterRow(c, s, side, rng);
      }
    }
  }
  return n;
}
