// Garage repair-stand jaw: a small inked toon clamp around the seatpost at the turntable pivot, drawn in
// front of the bike, so the hang reads as "clamped by the seatpost" even where the rear wheel hides the
// clamp head painted in art/garage. Own geometries + materials (disposed with the turntable).
import {
  BackSide, BoxGeometry, CylinderGeometry, Group, Mesh, MeshBasicMaterial, MeshToonMaterial, type BufferGeometry,
} from 'three';
import { toonRamp } from '../../render/toon';

const INK = '#0b0b0f';
const HULL = 0.012;           // m, inverted-hull outline thickness
const POST_AHEAD = -0.035;    // m along −Z: the seatpost leans back, so 12 cm under the saddle it sits ahead

export interface ClampJaw {
  readonly group: Group;
  dispose(): void;
}

export function clampJaw(): ClampJaw {
  const group = new Group();
  const geos: BufferGeometry[] = [];
  const steel = new MeshToonMaterial({ color: '#d9d9e0', gradientMap: toonRamp() });
  const red = new MeshToonMaterial({ color: '#e5191c', gradientMap: toonRamp() });
  const ink = new MeshBasicMaterial({ color: INK, side: BackSide });
  /** A part plus its slightly larger back-face twin (the black outline). */
  const part = (geo: BufferGeometry, hull: BufferGeometry, mat: MeshToonMaterial): Group => {
    geos.push(geo, hull);
    const g = new Group();
    g.add(new Mesh(geo, mat), new Mesh(hull, ink));
    return g;
  };
  const cyl = (r: number, len: number): [CylinderGeometry, CylinderGeometry] =>
    [new CylinderGeometry(r, r, len, 24), new CylinderGeometry(r + HULL, r + HULL, len + 2 * HULL, 24)];
  // Jaw barrel across the post (axis = bike X), a red band, and the quick-release lever on the near side.
  const barrel = part(...cyl(0.06, 0.19), steel);
  barrel.rotation.z = Math.PI / 2;
  const band = part(...cyl(0.064, 0.04), red);
  band.rotation.z = Math.PI / 2;
  const lever = part(new BoxGeometry(0.028, 0.15, 0.036), new BoxGeometry(0.028 + 2 * HULL, 0.15 + 2 * HULL, 0.036 + 2 * HULL), red);
  lever.position.set(-0.11, -0.055, 0.012);
  lever.rotation.x = 0.5;
  group.add(barrel, band, lever);
  group.position.z = POST_AHEAD;
  group.renderOrder = 2;
  return {
    group,
    dispose: () => {
      for (const g of geos) g.dispose();
      steel.dispose();
      red.dispose();
      ink.dispose();
    },
  };
}
