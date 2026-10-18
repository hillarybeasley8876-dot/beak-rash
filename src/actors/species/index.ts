// Species registry + per-(species, quality) geometry cache. Geometry is built once (SDF meshing is the
// expensive part) and shared by every rider of that species; each rider gets its own bones.
import { Matrix4, SkinnedMesh, type BufferGeometry } from 'three';
import { riderMaterial } from '../kit/material';
import type { CharacterId, Quality } from '../../core/types';
import { CharacterBuilder } from '../kit/builder';
import { hullFor } from '../kit/outline';
import { createRig, type Rig } from '../rig/skeleton';
import { capybara } from './capybara';
import { cat } from './cat';
import { corgi } from './corgi';
import { goose } from './goose';
import { pelican } from './pelican';
import { penguin } from './penguin';
import { pigeon } from './pigeon';
import { seagull } from './seagull';
import { shiba } from './shiba';
import { sloth } from './sloth';
import type { SpeciesDef } from './types';

const DEFS: Record<CharacterId, SpeciesDef> = { pelican, goose, capybara, cat, shiba, pigeon, penguin, seagull, sloth, corgi };

export function speciesDef(id: CharacterId): SpeciesDef {
  return DEFS[id] ?? pelican;
}

export interface SpeciesAsset {
  def: SpeciesDef;
  geometry: BufferGeometry;
  tris: number;
  buildMs: number;
}

const cache = new Map<string, SpeciesAsset>();

export function speciesAsset(id: CharacterId, quality: Quality): SpeciesAsset {
  const def = speciesDef(id);
  const key = `${def.id}|${quality}`;
  let a = cache.get(key);
  if (!a) {
    const t0 = performance.now();
    const b = new CharacterBuilder(quality === 'low' ? 0.8 : 1);
    def.build(b, quality);
    const geometry = b.build();
    a = { def, geometry, tris: b.triangles, buildMs: performance.now() - t0 };
    cache.set(key, a);
  }
  return a;
}

export interface CharacterInstance {
  mesh: SkinnedMesh;
  hull: SkinnedMesh;
  rig: Rig;
  def: SpeciesDef;
}

/** One rider's skinned body (shared geometry + material, own skeleton) with its outline hull. */
export function instantiate(id: CharacterId, quality: Quality, outlineWidth = 0.024): CharacterInstance {
  const asset = speciesAsset(id, quality);
  const rig = createRig(asset.def.joints);
  const mesh = new SkinnedMesh(asset.geometry, riderMaterial());
  mesh.name = `body:${asset.def.id}`;
  mesh.add(rig.bones[0] as SkinnedMesh['skeleton']['bones'][number]);
  mesh.bind(rig.skeleton, new Matrix4());
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  const hull = hullFor(mesh, outlineWidth) as SkinnedMesh;
  mesh.add(hull);
  return { mesh, hull, rig, def: asset.def };
}
