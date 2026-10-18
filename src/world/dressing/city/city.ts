// City dressing context: the shared Dress (props, glow, faces atlas, crowd, cloth) plus the city's
// own batches (window-shader buildings, neon / screen atlases, light cycles), building lots and the
// sign slots buildings offer to the neon pass.
import { CanvasTexture } from 'three';
import type { Mesh } from 'three';
import { SignAtlas } from '../../scenery/signs/atlas';
import type { SignSlot } from '../../scenery/props/city-building';
import type { Dress } from '../dress';
import { AuxBatch, OUTLINE } from './batch';
import { Lots } from './lots';
import { buildingMat, cycleMat, neonMat } from './mats';

export interface CityBatches {
  body: AuxBatch;      // buildings + their roof clutter (window shader, outlined, shadows)
  far: AuxBatch;       // skyline blocks (window shader, no outline, no shadows)
  lights: AuxBatch;    // light cycles: traffic lights, crossing men, aviation blinkers
  neon: AuxBatch;      // neon sign faces (HDR atlas)
  screens: AuxBatch;   // LED screens (HDR atlas of poster art)
}

export interface City {
  d: Dress;
  lots: Lots;
  cb: CityBatches;
  slots: SignSlot[];
  neonAtlas: SignAtlas;
  screenAtlas: SignAtlas;
  neonTex: CanvasTexture;
  screenTex: CanvasTexture;
}

export function makeCity(d: Dress): City {
  const { ctx } = d;
  const neonAtlas = new SignAtlas(2048, 2048), screenAtlas = new SignAtlas(2048, 2048);
  const neonTex = ctx.own(neonAtlas.texture(ctx.app.renderer));
  const screenTex = ctx.own(screenAtlas.texture(ctx.app.renderer));
  const cb: CityBatches = {
    body: new AuxBatch(ctx, 'city:body', { material: buildingMat(ctx), outline: OUTLINE.building, castShadow: true, receiveShadow: true, cell: 360, reflect: true }),
    far: new AuxBatch(ctx, 'city:far', { material: buildingMat(ctx), cell: 600, reflect: true }),
    lights: new AuxBatch(ctx, 'city:lights', { material: cycleMat(ctx), reflect: true, cell: 400 }),
    neon: new AuxBatch(ctx, 'city:neon', { material: neonMat(ctx, 'signs', neonTex), reflect: true, cell: 400 }),
    screens: new AuxBatch(ctx, 'city:screens', { material: neonMat(ctx, 'screens', screenTex), reflect: true, cell: 500 }),
  };
  return { d, lots: new Lots(d.place), cb, slots: [], neonAtlas, screenAtlas, neonTex, screenTex };
}

/** Upload the atlases and build every city batch. */
export function finishCity(c: City): Mesh[] {
  c.neonTex.needsUpdate = true;
  c.screenTex.needsUpdate = true;
  return Object.values(c.cb).flatMap((b: AuxBatch) => b.finish());
}
