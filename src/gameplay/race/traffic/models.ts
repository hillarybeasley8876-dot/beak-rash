// Builds merged geometries per vehicle type (paint / trim / decals) and the shared wheel.
import type { BufferGeometry } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { box, cylinder, decalQuad, merge, type V3 } from './kit';
import { compact, icecream, pickup, van, type ModelParts } from './models-cars';
import { bus, fish, truck } from './models-trucks';
import { decalUv } from './decals';
import type { VehicleType } from './types';

export interface VehicleModel {
  paint: BufferGeometry;
  trim: BufferGeometry;
  decal: BufferGeometry | null;
  blink: V3[];
  brake: V3[];
  head: V3[];
}

const BUILDERS: Record<VehicleType, () => ModelParts> = { compact, van, pickup, icecream, truck, bus, fish };

export const WHEEL_R = 0.4;

export function buildModel(type: VehicleType): VehicleModel {
  const parts = BUILDERS[type]();
  let decal: BufferGeometry | null = null;
  if (parts.decals.length) {
    const quads = parts.decals.map((d) => decalQuad(d.center, d.uDir, d.width, d.height, decalUv(d.region)));
    decal = mergeGeometries(quads, false);
    for (const q of quads) q.dispose();
    if (!decal) throw new Error(`[race] traffic: could not merge ${type} decals`);
  }
  return { paint: merge(parts.paint), trim: merge(parts.trim), decal, blink: parts.blink, brake: parts.brake, head: parts.head };
}

/** Unit wheel (radius WHEEL_R, axle along X) with a hub cross so spinning reads. */
export function buildWheel(): BufferGeometry {
  const axle: V3 = [0, 0, Math.PI / 2];
  return merge([
    cylinder(WHEEL_R, WHEEL_R, 0.3, '#1d1d22', [0, 0, 0], axle, 14),
    cylinder(0.23, 0.23, 0.32, '#c9ced6', [0, 0, 0], axle, 10),
    box([0.34, 0.07, 0.36], '#6f7782', [0, 0, 0]),
    box([0.34, 0.36, 0.07], '#6f7782', [0, 0, 0]),
  ]);
}
