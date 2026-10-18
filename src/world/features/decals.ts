// Road decals conforming to the surface: start/finish chequers + painted words, grid slots, oil
// slicks, puddles, animated boost pads (exactly over their feature boxes) and 'paint' mark words.
import { DoubleSide, Mesh, MeshBasicMaterial, MeshToonMaterial, type Texture } from 'three';
import { toonRamp } from '../../render/toon';
import type { TrackFeature } from '../../core/types';
import type { WorldCtx } from '../ctx';
import { FONT } from '../fonts';
import { GridGeo, frameOffset } from '../geom';
import { boostTexture, checkerTexture, gridTexture, oilTexture, puddleTexture, wordTexture } from './textures';

const LIFT = 0.012;
export const START_LINE_S = 46;
const GRID_ROWS = [40, 33.5, 27];
const GRID_X = [-3.4, 0, 3.4];

interface DecalOpts { lift?: number; uRepeat?: number; vRepeat?: number; order?: number }

/** Rectangle in track space (s0..s1 × x0..x1) following the road, uv 0..1 (u across, v along). */
export function decal(
  ctx: WorldCtx, s0: number, s1: number, x0: number, x1: number, mat: MeshBasicMaterial | MeshToonMaterial, opts: DecalOpts = {},
): Mesh {
  const rows = Math.max(2, Math.ceil(Math.abs(s1 - s0)) + 1);
  const g = new GridGeo(rows, 2);
  const fr = ctx.q.frameVis(s0);
  for (let r = 0; r < rows; r++) {
    const t = r / (rows - 1);
    const s = s0 + (s1 - s0) * t;
    ctx.q.frameVis(s, fr);
    const v = t * (opts.vRepeat ?? 1);
    g.set(r, 0, frameOffset(fr, Math.min(x0, x1), opts.lift ?? LIFT), fr.up, 0, v);
    g.set(r, 1, frameOffset(fr, Math.max(x0, x1), opts.lift ?? LIFT), fr.up, opts.uRepeat ?? 1, v);
  }
  const mesh = new Mesh(ctx.own(g.build()), mat);
  mesh.renderOrder = opts.order ?? 1;
  mesh.receiveShadow = true;
  ctx.group.add(mesh);
  return mesh;
}

function decalMat(ctx: WorldCtx, map: Texture, lit = true): MeshToonMaterial | MeshBasicMaterial {
  const common = {
    map, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: DoubleSide,
  };
  return ctx.own(lit ? new MeshToonMaterial({ ...common, gradientMap: toonRamp() }) : new MeshBasicMaterial(common));
}

export function buildDecals(ctx: WorldCtx): void {
  const { app, L } = ctx;
  const hw = L.halfWidth;
  // Start: chequered line ahead of the grid, painted START before it; grid slots behind.
  const checker = decalMat(ctx, ctx.own(checkerTexture(app.renderer, 28)));
  decal(ctx, START_LINE_S, START_LINE_S + 1.0, -hw, hw, checker);
  decal(ctx, L.length, L.length + 1.0, -hw, hw, checker);
  const start = decalMat(ctx, ctx.own(wordTexture(app.renderer, 'START')));
  decal(ctx, START_LINE_S + 3, START_LINE_S + 9, 1.2, hw - 0.9, start);
  decal(ctx, START_LINE_S + 3, START_LINE_S + 9, -hw + 0.9, -1.2, start);
  const finish = decalMat(ctx, ctx.own(wordTexture(app.renderer, 'FINISH')));
  decal(ctx, L.length - 10, L.length - 3, 1.0, hw - 0.9, finish);
  decal(ctx, L.length - 10, L.length - 3, -hw + 0.9, -1.0, finish);
  const grid = decalMat(ctx, ctx.own(gridTexture(app.renderer, GRID_X, hw)));
  for (const s of GRID_ROWS) decal(ctx, s - 2.6, s + 0.9, -hw, hw, grid);
  // Feature decals.
  const oil = decalMat(ctx, ctx.own(oilTexture(app.renderer)));
  const puddle = decalMat(ctx, ctx.own(puddleTexture(app.renderer)));
  const boostTex = ctx.own(boostTexture(app.renderer));
  const boost = decalMat(ctx, boostTex, false);
  for (const f of L.features) placeFeatureDecal(ctx, f, oil, puddle, boost);
  // Painted road words from layout marks { kind: 'paint', data: { text } }: one glyph block per half.
  for (const m of L.marks) {
    if (m.kind !== 'paint') continue;
    const word = decalMat(ctx, ctx.own(wordTexture(app.renderer, String(m.data.text ?? ''), '#f5f5f0', FONT.cn)));
    decal(ctx, m.s, m.s + 6, 0.9, hw - 1.2, word);
    decal(ctx, m.s, m.s + 6, -hw + 1.2, -0.9, word);
  }
  ctx.onUpdate((dtSim) => {
    boostTex.offset.y -= dtSim * 1.6;
  });
}

function placeFeatureDecal(ctx: WorldCtx, f: TrackFeature, oil: Mesh['material'], puddle: Mesh['material'], boost: Mesh['material']): void {
  const pad = 0.15;
  if (f.kind === 'oil') decal(ctx, f.s0 - pad, f.s1 + pad, f.x0 - pad, f.x1 + pad, oil as MeshToonMaterial);
  else if (f.kind === 'puddle') decal(ctx, f.s0 - pad, f.s1 + pad, f.x0 - pad, f.x1 + pad, puddle as MeshToonMaterial);
  else if (f.kind === 'boostPad') {
    decal(ctx, f.s0, f.s1, f.x0, f.x1, boost as MeshBasicMaterial, { vRepeat: Math.max(1, Math.round((f.s1 - f.s0) / 2)) });
  }
}
