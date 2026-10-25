// City dressing context: the shared Dress (props, glow, faces atlas, crowd, cloth) plus the city's
// own batches (window-shader buildings, neon / screen atlases, light cycles), building lots and the
// sign slots buildings offer to the neon pass.
import { CanvasTexture } from 'three';
import type { Mesh } from 'three';
import { breathe } from '../../breathe';
import type { SignSlot } from '../../scenery/props/city-building';
import { repaintWhenFontsLoad, type Dress } from '../dress';
import { SlicedAtlas } from './atlas';
import { AuxBatch, OUTLINE } from './batch';
import { Lots } from './lots';
import { buildingMat, cycleMat, neonMat } from './mats';

export interface CityBatches {
  body: AuxBatch;      // buildings + their roof clutter (window shader, outlined, shadows)
  far: AuxBatch;       // skyline blocks (window shader, no outline, no shadows)
  lights: AuxBatch;    // light cycles: traffic lights, crossing men, aviation blinkers
  neon: AuxBatch;      // neon sign faces (HDR atlas)
  screens: AuxBatch;   // LED screens (HDR atlas of poster art)
  lit: AuxBatch;       // self-lit toon props (aux style 5): tree canopies, statue, flowers (prop outline)
}

export interface City {
  d: Dress;
  lots: Lots;
  cb: CityBatches;
  slots: SignSlot[];
  neonAtlas: SlicedAtlas;
  screenAtlas: SlicedAtlas;
  neonTex: CanvasTexture;
  screenTex: CanvasTexture;
}

export function makeCity(d: Dress): City {
  const { ctx } = d;
  // Deferred atlases: faces are recorded while the city builds and painted once the fonts are in (paintAtlases).
  const neonAtlas = new SlicedAtlas(), screenAtlas = new SlicedAtlas();
  const neonTex = ctx.own(neonAtlas.texture(ctx.app.renderer));
  const screenTex = ctx.own(screenAtlas.texture(ctx.app.renderer));
  const cb: CityBatches = {
    body: new AuxBatch(ctx, 'city:body', { material: buildingMat(ctx), outline: OUTLINE.building, castShadow: true, receiveShadow: true, cell: 360, reflect: true }),
    far: new AuxBatch(ctx, 'city:far', { material: buildingMat(ctx), cell: 600, reflect: true }),
    lights: new AuxBatch(ctx, 'city:lights', { material: cycleMat(ctx), reflect: true, cell: 400 }),
    neon: new AuxBatch(ctx, 'city:neon', { material: neonMat(ctx, 'signs', neonTex), reflect: true, cell: 400 }),
    screens: new AuxBatch(ctx, 'city:screens', { material: neonMat(ctx, 'screens', screenTex), reflect: true, cell: 500 }),
    lit: new AuxBatch(ctx, 'city:lit', { material: buildingMat(ctx), outline: OUTLINE.prop, castShadow: true, receiveShadow: true, cell: 500 }),
  };
  return { d, lots: new Lots(d.place), cb, slots: [], neonAtlas, screenAtlas, neonTex, screenTex };
}

/** Paint the deferred atlases (shared faces, neon, screens) in slices; if the fonts were late, repaint once they arrive. */
export async function paintAtlases(c: City, faces: SlicedAtlas, fontsReady: boolean): Promise<void> {
  for (const atlas of [faces, c.neonAtlas, c.screenAtlas]) await atlas.flushSliced();
  if (fontsReady || typeof document === 'undefined' || !document.fonts) return;
  repaintWhenFontsLoad(c.d);
  let live = true;
  c.d.ctx.own({ dispose: () => { live = false; } });
  void document.fonts.ready.then(() => {
    if (!live) return;
    c.neonAtlas.repaint();
    c.screenAtlas.repaint();
    c.neonTex.needsUpdate = true;
    c.screenTex.needsUpdate = true;
    c.d.ctx.log('city atlases repainted after late fonts');
  });
}

/** Upload the atlases and build every city batch, yielding inside and between batches; `onBatch(f)`
 *  reports the finished fraction of batches. */
export async function finishCity(c: City, onBatch?: (f: number) => void): Promise<Mesh[]> {
  c.neonTex.needsUpdate = true;
  c.screenTex.needsUpdate = true;
  const meshes: Mesh[] = [];
  const batches = Object.values(c.cb) as AuxBatch[];
  for (const [k, batch] of batches.entries()) {
    meshes.push(...await batch.finishYielding());
    onBatch?.((k + 1) / batches.length);
    await breathe();
  }
  return meshes;
}
