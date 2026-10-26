// The mega jump's set piece (r5): the landmark launch of every track gets its own look — a big
// board with the word, a structure around the crest and the props that make the place. The road
// signs and the arrows are drawn by world/features/jump.ts; this is the scenery around them.
import { Color, Matrix4, Vector3 } from 'three';
import type { Rng } from '../../core/rng';
import type { TrackFeature } from '../../core/types';
import type { WorldCtx } from '../ctx';
import type { MeshBuf } from '../geom';
import { box, cone, cylinder, trs } from '../kit/shapes';
import { fan, flagPole, pennants } from '../scenery/props/event';
import { lantern, prayerFlags } from '../scenery/props/mountain-deco';
import { timberDeck } from '../scenery/props/mountain-hairpin';
import type { Placer } from '../scenery/place';
import { billboard, yawFor } from '../scenery/signs/boards';
import type { AtlasRect, SignAtlas } from '../scenery/signs/atlas';
import { warnFace } from '../scenery/signs/faces';
import { camel } from './gobi/critters';
import type { GobiCtx } from './gobi/gctx';
import type { Dress } from './dress';

const m = new Matrix4();
const RED = new Color('#e5191c'), YEL = new Color('#ffe600');
const TIMBER = new Color('#6b4a2f'), STEEL = new Color('#7d8794');

/** The batches the set piece draws into (the plain dressing and the gobi's own both fit). */
export interface MegaBatch { at(x: number, z: number): MeshBuf }

/** Everything the set piece needs from a track's dressing. */
export interface MegaWorld {
  ctx: WorldCtx;
  place: Placer;
  rng: Rng;
  atlas: SignAtlas;
  face(key: string, draw: () => AtlasRect | null): AtlasRect | null;
  props: MegaBatch;
  faces: MegaBatch;
  cloth: MegaBatch;
  glow: MegaBatch;
  side(side: -1 | 1): -1 | 1;
}

/** The mega jump of a track: the layout marks its crest with `data.mega`. */
export function megaCrest(ctx: WorldCtx): TrackFeature | null {
  for (const f of ctx.L.features) {
    if (f.kind !== 'jumpCrest' && f.kind !== 'ramp') continue;
    if (f.data?.mega === 1 || f.data?.mega === true) return f;
  }
  return null;
}

/** The yaw that turns a sign face toward the riders coming up the road. */
function toward(d: MegaWorld, s: number, side: -1 | 1, turn = 0.3): number {
  const fr = d.ctx.q.frameVis(s);
  const tl = Math.hypot(fr.tangent.x, fr.tangent.z) || 1, rl = Math.hypot(fr.right.x, fr.right.z) || 1;
  const nx = (-fr.tangent.x / tl) * Math.cos(turn) - side * (fr.right.x / rl) * Math.sin(turn);
  const nz = (-fr.tangent.z / tl) * Math.cos(turn) - side * (fr.right.z / rl) * Math.sin(turn);
  return yawFor(nx, nz);
}

/** The big board on the roadside: a yellow warning plate with the word, facing the riders. */
function board(d: MegaWorld, s: number, side: -1 | 1, glyph: string, caption: string, w = 2.8, h = 2.2): void {
  const rect = d.face(`mega-${caption}`, () => warnFace(d.atlas, glyph, caption));
  if (!rect) return;
  const sp = d.place.spot(s, side, 2.6);
  if (!d.place.claim(sp.pos.x, sp.pos.z, 0.9)) return;
  billboard(d.props.at(sp.pos.x, sp.pos.z), d.faces.at(sp.pos.x, sp.pos.z),
    sp.pos.x, sp.pos.y, sp.pos.z, toward(d, s, side), w, h, 1.3, rect);
}

/** A cheering crowd on the roadside: the jump's audience. */
function crowd(d: MegaWorld, s0: number, s1: number, side: -1 | 1, u: number, n: number): void {
  for (let i = 0; i < n; i++) {
    const s = s0 + ((s1 - s0) * i) / Math.max(1, n - 1);
    const sp = d.place.spot(s, side, u + d.rng.range(0, 0.8));
    if (!d.place.claim(sp.pos.x, sp.pos.z, 0.7)) continue;
    fan(d.props.at(sp.pos.x, sp.pos.z), sp.pos.x, sp.pos.y, sp.pos.z, sp.faceRoad, d.rng);
  }
}

/** A pole with a flag at the roadside (the ramp's markers). */
function pole(d: MegaWorld, s: number, side: -1 | 1, u: number, h: number, col: Color): void {
  const sp = d.place.spot(s, side, u);
  if (!d.place.claim(sp.pos.x, sp.pos.z, 0.6)) return;
  flagPole(d.props.at(sp.pos.x, sp.pos.z), d.cloth.at(sp.pos.x, sp.pos.z), sp.pos.x, sp.pos.y, sp.pos.z, h, sp.faceRoad, col, d.rng);
}

/** A cone on the roadside (a hazard marker). */
function coneAt(d: MegaWorld, s: number, side: -1 | 1, u: number): void {
  const sp = d.place.spot(s, side, u);
  if (!d.place.claim(sp.pos.x, sp.pos.z, 0.5)) return;
  cone(d.props.at(sp.pos.x, sp.pos.z), trs(sp.pos.x, sp.pos.y, sp.pos.z, 0, 0.34, 0.8, 0.34, m), RED, 8);
}

/** A pier from the road's edge down to the ground (the viaduct's legs). */
function column(d: MegaWorld, s: number, side: -1 | 1, u: number, w = 0.5): void {
  const sp = d.place.spot(s, side, u);
  const h = Math.max(0.4, d.ctx.q.frameVis(s).pos.y - sp.pos.y);
  box(d.props.at(sp.pos.x, sp.pos.z), trs(sp.pos.x, sp.pos.y + h / 2, sp.pos.z, 0, w, h, w, m), STEEL);
}

/** The coast: a timber boardwalk deck with the crowd on it, and bunting over the road before it. */
function coastMega(d: MegaWorld, crest: number): void {
  const side = d.side(1);
  board(d, crest - 30, side, '飞', '起飞！MEGA', 2.8, 2.2);
  // The deck is 8 m deep: centred 4.5 m out, its front edge stays 0.5 m clear of the bound.
  const sp = d.place.spot(crest - 4, side, 4.5);
  timberDeck(d.props.at(sp.pos.x, sp.pos.z), sp.pos.x, sp.pos.y, sp.pos.z, sp.faceRoad, 9, 8);
  crowd(d, crest - 8, crest + 1, side, 5.5, 6);
  // The bunting the riders pass under on the way up.
  const a = d.place.spot(crest - 44, d.side(-1), 1.4);
  const b = d.place.spot(crest - 44, side, 1.4);
  const top = (p: typeof a): Vector3 => new Vector3(p.pos.x, p.pos.y + 5.2, p.pos.z);
  for (const p of [a, b]) {
    cylinder(d.props.at(p.pos.x, p.pos.z), trs(p.pos.x, p.pos.y, p.pos.z, 0, 0.12, 5.2, 0.12, m), TIMBER, 6, 1, 1, false);
  }
  pennants(d.cloth.at(a.pos.x, a.pos.z), top(a), top(b), 1.3, d.rng);
}

/** The city: the flyover's steel piers under the launch and a line of cones along the deck. */
function cityMega(d: MegaWorld, crest: number): void {
  const side = d.side(1);
  board(d, crest - 34, side, '飞', '飞跃 断层', 2.8, 2.2);
  for (let i = 0; i < 5; i++) {
    const s = crest - 8 + i * 4;
    for (const sd of [-1, 1] as const) column(d, s, d.side(sd), 0.4, 0.6);
  }
  for (let i = 0; i < 6; i++) coneAt(d, crest - 30 + i * 6, side, 1.1);
  crowd(d, crest - 26, crest - 18, d.side(-1), 1.6, 4);
}

/** The mountain: a timber kicker frame on the cliff edge and prayer flags over the road. */
function mountainMega(d: MegaWorld, crest: number): void {
  const side = d.side(1);
  board(d, crest - 30, side, '飞', '悬崖 起飞！', 2.8, 2.2);
  const sp = d.place.spot(crest - 2, side, 2.8);
  timberDeck(d.props.at(sp.pos.x, sp.pos.z), sp.pos.x, sp.pos.y, sp.pos.z, sp.faceRoad, 6, 6);
  crowd(d, crest - 6, crest + 2, side, 4, 4);
  const a = d.place.spot(crest - 36, d.side(-1), 1.2);
  const b = d.place.spot(crest - 36, side, 1.2);
  const y = d.ctx.q.frameVis(crest - 36).pos.y + 5.4;
  prayerFlags(d.cloth.at(a.pos.x, a.pos.z), new Vector3(a.pos.x, y, a.pos.z), new Vector3(b.pos.x, y, b.pos.z), 1.4, d.rng);
}

/** The water town: lanterns along the tall humpback's parapet. */
function watertownMega(d: MegaWorld, crest: number): void {
  const side = d.side(1);
  board(d, crest - 26, side, '飞', '起飞！石拱桥', 2.6, 2);
  for (let i = 0; i < 7; i++) {
    const s = crest - 14 + i * 5;
    for (const sd of [-1, 1] as const) {
      const sp = d.place.spot(s, d.side(sd), 0.5);
      const y = d.ctx.q.frameVis(s).pos.y + 0.5;
      lantern(d.props.at(sp.pos.x, sp.pos.z), d.glow.at(sp.pos.x, sp.pos.z), sp.pos.x, y, sp.pos.z, d.rng, 1);
    }
  }
}

/** The gobi: flag poles marking the dune ramp and a caravan watching from the sand. */
function gobiMega(d: MegaWorld, crest: number): void {
  const side = d.side(1);
  board(d, crest - 30, side, '飞', 'MEGA 沙丘', 2.8, 2.2);
  for (let i = 0; i < 5; i++) {
    const s = crest - 26 + i * 13;
    pole(d, s, d.side(-1), 2.4, 3.4, YEL);
    pole(d, s + 6, side, 2.4, 3.4, RED);
  }
  for (let i = 0; i < 3; i++) {
    const sp = d.place.spot(crest + 26 + i * 10, side, 13 + d.rng.range(0, 6));
    if (!d.place.claim(sp.pos.x, sp.pos.z, 2.4)) continue;
    camel(d.props.at(sp.pos.x, sp.pos.z), sp.pos.x, sp.pos.y, sp.pos.z, sp.faceRoad, d.rng, 1);
  }
}

/** The set piece: the board and the scenery around the mega jump of this track. */
export function megaSetPiece(d: MegaWorld): void {
  const f = megaCrest(d.ctx);
  if (!f) return;
  const crest = (f.s0 + f.s1) / 2;
  switch (d.ctx.id) {
    case 'coast': coastMega(d, crest); break;
    case 'city': cityMega(d, crest); break;
    case 'mountain': mountainMega(d, crest); break;
    case 'watertown': watertownMega(d, crest); break;
    case 'gobi': gobiMega(d, crest); break;
    default: break;
  }
}

/** The mega world of a track's plain dressing. */
export function megaOf(d: Dress): MegaWorld {
  return {
    ctx: d.ctx, place: d.place, rng: d.rng, atlas: d.atlas, face: d.face,
    props: d.b.props, faces: d.b.faces, cloth: d.b.cloth, glow: d.b.glow, side: d.side,
  };
}

/** The mega world of the gobi's own dressing context (it has no cloth batch: the flags are cards). */
export function megaOfGobi(g: GobiCtx): MegaWorld {
  return {
    ctx: g.ctx, place: g.place, rng: g.rng, atlas: g.atlas, face: g.face,
    props: g.props, faces: g.faces, cloth: g.thin, glow: g.glow, side: g.side,
  };
}
