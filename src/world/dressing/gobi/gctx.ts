// The gobi dressing's own context: the `dress:gobi` group, the merged prop batches and the sign atlas.
import { Group, MeshBasicMaterial, type CanvasTexture, type Object3D } from 'three';
import type { Rng } from '../../../core/rng';
import type { WorldCtx } from '../../ctx';
import { glowMat, propsMat2 } from '../../mats';
import { Placer } from '../../scenery/place';
import type { AtlasRect } from '../../scenery/signs/atlas';
import { GobiAtlas } from './atlas';
import type { TerrainField } from '../../terrain/field';
import { GobiBatch } from './batch';

export interface GobiCtx {
  ctx: WorldCtx;
  /** Everything the gobi builds lives under this group (the acceptance test looks for `dress:gobi`). */
  group: Group;
  field: TerrainField;
  place: Placer;
  rng: Rng;
  atlas: GobiAtlas;
  faceTex: CanvasTexture;
  /** Outlined toon props (rocks, buildings, poles, camels). */
  props: GobiBatch;
  /** Double-sided cards (palm fronds, dust), outlined thinly. */
  thin: GobiBatch;
  /** Distant scenery: no outline (sub-pixel anyway), big cells. */
  far: GobiBatch;
  /** Unlit bits (lamps, lit windows). */
  glow: GobiBatch;
  /** Sign faces (atlas texture, unlit). */
  faces: GobiBatch;
  /** Objects spun about their Y axis every frame (dust devils). */
  spin: Array<{ obj: Object3D; speed: number }>;
  /** Objects nodding about their Z axis every frame (pumpjack beams). */
  nod: Array<{ obj: Object3D; phase: number; amp: number; speed: number }>;
  /** The side of the road a helper means, mirrored when the road runs the other way (SPEC §20). */
  side(side: -1 | 1): -1 | 1;
  /** Draw a sign face once per key (repeated signs share their atlas cell). */
  face(key: string, draw: () => AtlasRect | null): AtlasRect | null;
}

export function makeGobiCtx(ctx: WorldCtx, field: TerrainField, rng: Rng): GobiCtx {
  const group = new Group();
  group.name = 'dress:gobi';
  ctx.group.add(group);
  const atlas = new GobiAtlas(2048, 3072, false);
  const faceTex = ctx.own(atlas.texture(ctx.app.renderer));
  const faceMat = ctx.own(new MeshBasicMaterial({ map: faceTex, color: 0xf2f2f2 }));
  const cells = new Map<string, AtlasRect | null>();
  return {
    ctx, group, field, rng, atlas, faceTex,
    place: new Placer(ctx, field),
    props: new GobiBatch(ctx, 'gobi-props', group, { cell: 420 }),
    thin: new GobiBatch(ctx, 'gobi-thin', group, { cell: 420, material: propsMat2(ctx), outline: 0.025 }),
    far: new GobiBatch(ctx, 'gobi-far', group, { cell: 900, outline: 0, castShadow: false, receiveShadow: false }),
    glow: new GobiBatch(ctx, 'gobi-glow', group, { cell: 420, material: glowMat(ctx), outline: 0, castShadow: false, receiveShadow: false }),
    faces: new GobiBatch(ctx, 'gobi-faces', group, { cell: 420, material: faceMat, outline: 0, castShadow: false, receiveShadow: false }),
    spin: [],
    nod: [],
    side: (sd) => (sd * ctx.mirror) as -1 | 1,
    face(key, draw) {
      if (!cells.has(key)) cells.set(key, draw());
      return cells.get(key) ?? null;
    },
  };
}
