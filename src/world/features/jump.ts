// The jump markers (r5): a jump has to read as a jump from a hundred metres away. Every big jump
// gets a yellow JUMP sign on the roadside, a chevron arrow painted on the tarmac before it, and —
// for a jump hill — a striped kicker lip across the top of the crest. The landmark mega jump gets
// its own set: a big black-and-red MEGA board 120 m before it, so the rider sees it coming.
import { Color, DoubleSide, Matrix4, Mesh, MeshBasicMaterial, PlaneGeometry, Vector3, type Texture } from 'three';
import type { TrackFeature } from '../../core/types';
import type { WorldCtx } from '../ctx';
import type { PropBatch } from '../kit/batch';
import { box, trs } from '../kit/shapes';
import { decal, decalMat } from './decals';
import { jumpArrowTexture, jumpSignTexture, kickerBandTexture, megaSignTexture } from './textures';

/** How far before the jump the sign stands and where the arrow is painted (m). */
const SIGN_BEFORE = 24;
const ARROW_BEFORE = 40;
/** The mega jump's own board stands this far before it (m) — a whole straight of warning. */
const MEGA_SIGN_BEFORE = 120;
/** The word on the sign: the water town speaks Chinese. */
const SIGN_TEXT: Record<string, string> = { watertown: '起飞！' };
/** The word on the mega board. */
const MEGA_TEXT: Record<string, string> = { watertown: '起飞！' };

const POST = new Color('#3a3d45');

/** A big jump is one the layout marks with `data.big` (the jump hills and the big kickers). */
function isBig(f: TrackFeature): boolean {
  return f.data?.big === 1 || f.data?.big === true;
}

/** The landmark mega jump: the layout marks it with `data.mega`. */
function isMega(f: TrackFeature): boolean {
  return f.data?.mega === 1 || f.data?.mega === true;
}

/** The jump markers of a track: the signs, the arrows and the kicker lips. */
export function buildJumpMarkers(ctx: WorldCtx, batch: PropBatch): void {
  const hw = ctx.L.halfWidth;
  const text = SIGN_TEXT[ctx.id] ?? 'JUMP';
  const signTex = ctx.shared('jump-sign', () => jumpSignTexture(ctx.app.renderer, text));
  const arrowMat = decalMat(ctx, ctx.own(jumpArrowTexture(ctx.app.renderer)));
  const bandMat = decalMat(ctx, ctx.own(kickerBandTexture(ctx.app.renderer)));
  const megaTex = ctx.shared('mega-sign', () => megaSignTexture(ctx.app.renderer, MEGA_TEXT[ctx.id] ?? 'MEGA'));
  for (const f of ctx.L.features) {
    if (f.kind !== 'ramp' && f.kind !== 'jumpCrest') continue;
    if (!isBig(f)) continue;
    const s = f.s0;
    // The sign stands on the far side of the road from the jump, so it never blocks the line.
    const side = f.kind === 'ramp' && Math.min(f.x0, f.x1) > 0 ? -1 : 1;
    if (isMega(f)) {
      // The mega jump: its own big board 120 m before, on the same side as the ordinary sign but
      // further out, so both read in one glance from far down the road.
      sign(ctx, batch, megaTex, s - MEGA_SIGN_BEFORE, side * (hw + 1.8), 2);
      sign(ctx, batch, signTex, s - SIGN_BEFORE, side * (hw + 0.9));
      // Two arrows on the tarmac: one under the board, one at the lip.
      const ax = f.kind === 'ramp' ? (f.x0 + f.x1) / 2 : 0;
      decal(ctx, s - MEGA_SIGN_BEFORE + 10, s - MEGA_SIGN_BEFORE + 22, ax - 2.6, ax + 2.6, arrowMat);
      decal(ctx, s - ARROW_BEFORE - 6, s - ARROW_BEFORE, ax - 2.2, ax + 2.2, arrowMat);
    } else {
      sign(ctx, batch, signTex, s - SIGN_BEFORE, side * (hw + 0.9));
      // The arrow on the tarmac, in the middle of the road.
      const ax = f.kind === 'ramp' ? (f.x0 + f.x1) / 2 : 0;
      decal(ctx, s - ARROW_BEFORE - 6, s - ARROW_BEFORE, ax - 2.2, ax + 2.2, arrowMat);
    }
    if (f.kind === 'jumpCrest') {
      // The striped lip across the top of the crest.
      const peak = typeof f.data?.peak === 'number' ? f.data.peak : (f.s0 + f.s1) / 2;
      decal(ctx, peak - 1.4, peak + 1.4, -hw, hw, bandMat, { uRepeat: 4 });
    }
  }
}

/** The sign: a board on two posts, facing the rider. `scale` makes the mega board twice as big. */
function sign(ctx: WorldCtx, batch: PropBatch, tex: Texture, s: number, x: number, scale = 1): void {
  const W = 3.4 * scale, H = 1.7 * scale, BASE = 2.4 * scale;
  const fr = ctx.q.frameVis(s);
  const p = ctx.q.toWorld(s, x, BASE, new Vector3());
  const mesh = new Mesh(ctx.own(new PlaneGeometry(W, H)), ctx.own(new MeshBasicMaterial({ map: tex, side: DoubleSide })));
  // The board faces the rider: its width along the road, its height up, its face against the traffic.
  const basis = new Matrix4().makeBasis(
    new Vector3(fr.right.x, fr.right.y, fr.right.z),
    new Vector3(fr.up.x, fr.up.y, fr.up.z),
    new Vector3(-fr.tangent.x, -fr.tangent.y, -fr.tangent.z),
  );
  mesh.quaternion.setFromRotationMatrix(basis);
  mesh.position.copy(p);
  ctx.group.add(mesh);
  // The posts.
  const m = new Matrix4();
  const ry = Math.atan2(fr.tangent.x, fr.tangent.z);
  const buf = batch.at(p.x, p.z);
  for (const dx of [-W / 2 + 0.25, W / 2 - 0.25]) {
    const q = ctx.q.toWorld(s, x + dx, (BASE + H / 2) / 2, new Vector3());
    box(buf, trs(q.x, q.y, q.z, ry, 0.22 * scale, BASE + H / 2, 0.22 * scale, m), POST);
  }
}
