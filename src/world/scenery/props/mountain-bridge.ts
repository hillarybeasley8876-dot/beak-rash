// Sunset Pass gorge bridge (env-mountain): a vermilion suspension bridge — twin portal towers with
// little pagoda caps, parabolic main cables with prayer flags, thin hangers, a truss girder under the
// deck and concrete anchor blocks. Pure geometry: the dressing passes deck points along the road.
import { Color, Matrix4, Quaternion, Vector3 } from 'three';
import type { Rng } from '../../../core/rng';
import type { MeshBuf } from '../../geom';
import { box, cone, cylinder, sphere, trs } from '../../kit/shapes';
import { lantern, prayerFlags } from './mountain-deco';

const C = (h: string): Color => new Color(h);
const PAL = {
  tower: C('#d8402a'), towerDark: C('#9e2a1f'), cable: C('#b8321f'), hanger: C('#3a2c33'),
  girder: C('#6c6472'), truss: C('#c23a26'), cap: C('#2b2530'), gold: C('#ffcf4a'), concrete: C('#b9ad9f'),
};
const UP = new Vector3(0, 1, 0);
const m = new Matrix4(), q = new Quaternion(), dir = new Vector3(), sc = new Vector3();

/** Cylinder rod from a to b (radius r). */
export function rod(buf: MeshBuf, a: Vector3, b: Vector3, r: number, col: Color, segs = 6): void {
  dir.subVectors(b, a);
  const len = dir.length();
  if (len < 1e-4) return;
  q.setFromUnitVectors(UP, dir.divideScalar(len));
  m.compose(a, q, sc.set(r, len, r));
  cylinder(buf, m, col, segs, 1, 1, false);
}

/** A point on the road deck: centre at the road surface, unit right and tangent (horizontal). */
export interface DeckPoint { c: Vector3; r: Vector3; t: Vector3 }

const off = (p: DeckPoint, side: number, half: number, y: number): Vector3 =>
  new Vector3().copy(p.c).addScaledVector(p.r, side * half).addScaledVector(UP, y);

/** Box girder under the deck with red side trusses (deck points every few metres). */
function girder(props: MeshBuf, deck: DeckPoint[], half: number): void {
  for (let i = 0; i + 1 < deck.length; i++) {
    const a = deck[i] as DeckPoint, b = deck[i + 1] as DeckPoint;
    const mid = new Vector3().addVectors(a.c, b.c).multiplyScalar(0.5);
    const len = a.c.distanceTo(b.c);
    const yaw = Math.atan2(a.t.x, a.t.z);
    box(props, trs(mid.x, mid.y - 1.45, mid.z, yaw, 2 * half + 0.3, 2.5, len + 0.02, m), PAL.girder);
    for (const side of [-1, 1]) {
      const top0 = off(a, side, half + 0.2, -0.25), bot0 = off(a, side, half + 0.2, -2.55);
      const top1 = off(b, side, half + 0.2, -0.25), bot1 = off(b, side, half + 0.2, -2.55);
      rod(props, bot0, top0, 0.12, PAL.truss, 4);
      rod(props, i % 2 ? bot0 : top0, i % 2 ? top1 : bot1, 0.1, PAL.truss, 4);
      rod(props, top0, top1, 0.13, PAL.truss, 4);
    }
  }
}

/** Portal tower over the deck point: two legs from the ground, three cross beams, pagoda caps. */
function tower(props: MeshBuf, glow: MeshBuf, p: DeckPoint, half: number, groundY: number, h: number, rng: Rng): void {
  const yaw = Math.atan2(p.t.x, p.t.z);
  const base = Math.min(groundY, p.c.y) - 3;
  for (const side of [-1, 1]) {
    const foot = off(p, side, half, 0);
    const lowH = p.c.y - base, upH = h;
    box(props, trs(foot.x, base + lowH / 2, foot.z, yaw, 1.7, lowH, 1.7, m), PAL.towerDark);
    box(props, trs(foot.x, p.c.y + upH / 2, foot.z, yaw, 1.3, upH, 1.3, m), PAL.tower);
    // Pagoda cap: square eave + pyramid roof + gold finial.
    box(props, trs(foot.x, p.c.y + h + 0.15, foot.z, yaw, 2.1, 0.3, 2.1, m), PAL.cap);
    cone(props, new Matrix4().compose(new Vector3(foot.x, p.c.y + h + 0.3, foot.z), q.setFromAxisAngle(UP, yaw + Math.PI / 4), sc.set(1.35, 1.3, 1.35)), PAL.cap, 4);
    sphere(props, trs(foot.x, p.c.y + h + 1.75, foot.z, 0, 0.2, 0.2, 0.2, m), PAL.gold, 6, 4);
  }
  const mid = p.c;
  for (const [y, hh] of [[7.4, 1.5], [h * 0.62 + 2, 1.0], [h - 0.7, 1.2], [-3.1, 1.0]] as Array<[number, number]>) {
    box(props, trs(mid.x, mid.y + y, mid.z, yaw, 2 * half + 1.3, hh, 1.0, m), y === 7.4 ? PAL.towerDark : PAL.tower);
  }
  // Two lanterns under the portal beam, over the shoulders.
  for (const side of [-1, 1]) {
    const lp = off(p, side, half - 1.6, 6.65);
    lantern(props, glow, lp.x, lp.y, lp.z, rng, 0.9);
  }
}

export interface BridgeOpts {
  half: number;            // lateral offset of towers / cables from the centre line
  towerH: number;          // tower height above the deck
  ground0: number; ground1: number;            // ground under each tower
  /** Back-stay anchors (centre line); `block` = false when the cable runs into a rock face. */
  anchors: [Anchor, Anchor];
}

export interface Anchor { at: Vector3; block: boolean }

/** Suspension bridge along `deck` (first / last points = towers). */
export function suspensionBridge(props: MeshBuf, thin: MeshBuf, glow: MeshBuf, cloth: MeshBuf, deck: DeckPoint[], o: BridgeOpts, rng: Rng): void {
  const n = deck.length;
  const first = deck[0] as DeckPoint, last = deck[n - 1] as DeckPoint;
  girder(props, deck, o.half);
  tower(props, glow, first, o.half, o.ground0, o.towerH, rng);
  tower(props, glow, last, o.half, o.ground1, o.towerH, rng);
  const top = o.towerH - 0.7, low = 1.9;
  for (const side of [-1, 1]) {
    const pts = deck.map((p, i) => {
      const t = i / (n - 1);
      return off(p, side, o.half, low + (top - low) * (2 * t - 1) ** 2);
    });
    for (let i = 0; i + 1 < n; i++) rod(props, pts[i] as Vector3, pts[i + 1] as Vector3, 0.2, PAL.cable);
    for (let i = 1; i + 1 < n; i++) rod(thin, pts[i] as Vector3, off(deck[i] as DeckPoint, side, o.half, -0.2), 0.05, PAL.hanger, 4);
    o.anchors.forEach((anchor, j) => {
      const k = j === 0 ? 0 : n - 1;
      const p = deck[k] as DeckPoint;
      const a = new Vector3().copy(anchor.at).addScaledVector(p.r, side * o.half);
      rod(props, pts[k] as Vector3, a, 0.2, PAL.cable);
      if (anchor.block) box(props, trs(a.x, a.y + 0.6, a.z, Math.atan2(p.t.x, p.t.z), 2.6, 3.2, 3.6, m), PAL.concrete);
    });
    const lowPt = pts[Math.floor((n - 1) / 2)] as Vector3;
    const sag = (top - low) / 4;
    prayerFlags(cloth, (pts[0] as Vector3).clone().setY((pts[0] as Vector3).y - 0.3), lowPt, sag, rng);
    prayerFlags(cloth, lowPt, (pts[n - 1] as Vector3).clone().setY((pts[n - 1] as Vector3).y - 0.3), sag, rng);
  }
}
