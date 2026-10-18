// Dressing context shared by a track's dressing modules: placer, rng, and the batched buffers
// (static props, unlit faces/glow, animated crowd/cloth/boats). finish() builds all meshes.
import { MeshBasicMaterial, type CanvasTexture, type Mesh } from 'three';
import type { Rng } from '../../core/rng';
import { breathe } from '../breathe';
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
  cover: PropBatch;      // ground cover (grass tufts, flowers, pebbles): double-sided, no outline/shadow
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
  // quality=low drops the outline hulls of thin cards and boats (half their draw calls / triangles);
  // medium keeps the boat hulls only.
  const low = ctx.quality === 'low';
  return {
    props: new PropBatch(ctx, 'props'),
    thin: new PropBatch(ctx, 'thin', { material: propsMat2(ctx), outline: ctx.quality === 'high' ? OUTLINE.small : 0 }),
    glow: new PropBatch(ctx, 'glow', { material: glowMat(ctx), outline: 0, castShadow: false, receiveShadow: false }),
    faces: new PropBatch(ctx, 'faces', { material: faceMat, outline: 0, castShadow: false }),
    // Animated batches cast no shadow: the sway lives in the colour shader only, so a depth-pass
    // shadow would stay frozen while the crowd hops and the boats bob.
    crowd: new PropBatch(ctx, 'crowd', {
      material: swayMat(ctx, 'bob'), hullMaterial: swayHullMat(ctx, 'bob'), outline: OUTLINE.small, castShadow: false,
    }),
    cloth: new PropBatch(ctx, 'cloth', { material: swayMat(ctx, 'wave', true), outline: 0, castShadow: false }),
    boats: new PropBatch(ctx, 'boats', {
      material: swayMat(ctx, 'float'), hullMaterial: swayHullMat(ctx, 'float'), outline: low ? 0 : OUTLINE.prop, castShadow: false,
    }),
    far: new PropBatch(ctx, 'far', { outline: 0, cell: 400, castShadow: false }),
    cover: new PropBatch(ctx, 'cover', { material: propsMat2(ctx), outline: 0, cell: 160, castShadow: false }),
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

/** Deferred atlas painted with fallback glyphs: repaint it once the fonts have loaded (unless disposed). */
export function repaintWhenFontsLoad(d: Dress): void {
  if (typeof document === 'undefined' || !document.fonts) return;
  let live = true;
  d.ctx.own({ dispose: () => { live = false; } });
  void document.fonts.ready.then(() => {
    if (!live) return;
    d.atlas.repaint();
    d.faceTex.needsUpdate = true;
    d.ctx.log('sign atlas repainted after late fonts');
  });
}

/** Build every batch; returns the meshes (for stats). */
export function finishDress(d: Dress): Mesh[] {
  d.faceTex.needsUpdate = true;
  return Object.values(d.b).flatMap((batch: PropBatch) => batch.finish());
}

/** finishDress, yielding to the browser inside and between batches (keeps the loading screen painting);
 *  `onBatch(f)` reports the finished fraction of batches. */
export async function finishDressYielding(d: Dress, onBatch?: (f: number) => void): Promise<Mesh[]> {
  d.faceTex.needsUpdate = true;
  const meshes: Mesh[] = [];
  const batches = Object.values(d.b) as PropBatch[];
  for (const [k, batch] of batches.entries()) {
    meshes.push(...await batch.finishYielding());
    onBatch?.((k + 1) / batches.length);
    await breathe();
  }
  return meshes;
}
