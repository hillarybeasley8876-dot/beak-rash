// Dressing context shared by a track's dressing modules: placer, rng, and the batched buffers
// (static props, unlit faces/glow, animated crowd/cloth/boats). finish() builds all meshes.
import { MeshBasicMaterial, type CanvasTexture, type Mesh } from 'three';
import type { Rng } from '../../core/rng';
import type { WorldCtx } from '../ctx';
import { PropBatch } from '../kit/batch';
import { glowMat, OUTLINE, propsMat2 } from '../mats';
import type { TerrainField } from '../terrain/field';
import { Placer } from '../scenery/place';
import type { AtlasRect, SignAtlas } from '../scenery/signs/atlas';
import { swayHullMat, swayMat } from '../scenery/sway';

export interface Batches {
  props: PropBatch;      // outlined toon props
  thin: PropBatch;       // double-sided cards (fronds, sails), outlined
  glow: PropBatch;       // unlit lamps / windows, no outline
  faces: PropBatch;      // sign faces (atlas texture, unlit)
  crowd: PropBatch;      // bobbing spectators
  cloth: PropBatch;      // waving flags / pennants (double-sided)
  boats: PropBatch;      // floating boats and buoys
  far: PropBatch;        // distant vegetation: no outline (sub-pixel anyway), big cells
}

export interface Dress {
  ctx: WorldCtx;
  field: TerrainField;
  place: Placer;
  rng: Rng;
  b: Batches;
  atlas: SignAtlas;
  /** Atlas texture; flagged for upload once every face is drawn. */
  faceTex: CanvasTexture;
  /** Draw a sign face once per key (repeated signs share their atlas cell). */
  face(key: string, draw: () => AtlasRect | null): AtlasRect | null;
}

function makeBatches(ctx: WorldCtx, faceTex: CanvasTexture): Batches {
  const faceMat = ctx.own(new MeshBasicMaterial({ map: faceTex, color: 0xf2f2f2 }));
  return {
    props: new PropBatch(ctx, 'props'),
    thin: new PropBatch(ctx, 'thin', { material: propsMat2(ctx), outline: OUTLINE.small }),
    glow: new PropBatch(ctx, 'glow', { material: glowMat(ctx), outline: 0, castShadow: false, receiveShadow: false }),
    faces: new PropBatch(ctx, 'faces', { material: faceMat, outline: 0, castShadow: false }),
    crowd: new PropBatch(ctx, 'crowd', { material: swayMat(ctx, 'bob'), hullMaterial: swayHullMat(ctx, 'bob'), outline: OUTLINE.small }),
    cloth: new PropBatch(ctx, 'cloth', { material: swayMat(ctx, 'wave', true), outline: 0, castShadow: false }),
    boats: new PropBatch(ctx, 'boats', { material: swayMat(ctx, 'float'), hullMaterial: swayHullMat(ctx, 'float'), outline: OUTLINE.prop }),
    far: new PropBatch(ctx, 'far', { outline: 0, cell: 400, castShadow: false }),
  };
}

export function makeDress(ctx: WorldCtx, field: TerrainField, atlas: SignAtlas, rng: Rng): Dress {
  const faceTex = ctx.own(atlas.texture(ctx.app.renderer));
  const faces = new Map<string, AtlasRect | null>();
  const face = (key: string, draw: () => AtlasRect | null): AtlasRect | null => {
    if (!faces.has(key)) faces.set(key, draw());
    return faces.get(key) ?? null;
  };
  return { ctx, field, place: new Placer(ctx, field), rng, b: makeBatches(ctx, faceTex), atlas, faceTex, face };
}

/** Build every batch; returns the meshes (for stats). */
export function finishDress(d: Dress): Mesh[] {
  d.faceTex.needsUpdate = true;
  return Object.values(d.b).flatMap((batch: PropBatch) => batch.finish());
}
