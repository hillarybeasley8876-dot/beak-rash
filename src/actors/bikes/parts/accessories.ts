// Accessories (bike space): fenders (arc sweeps), rear rack and decal quads.
// Angles: wheel plane, from +Z (behind the hub) toward +Y (up).
import { BufferAttribute, BufferGeometry, Matrix4, PlaneGeometry, Vector3 } from 'three';
import { decalUv, type DecalId } from '../build/atlas';
import { cyl, tube, v, type Seg, type V3 } from '../build/geo';
import type { PartSet } from '../build/partset';

const DEG = Math.PI / 180;

/** Closed profile [radial offset, x] swept along an arc of radius rf around `hub`, from a0° to a1°. */
export function arcSweep(hub: V3, rf: number, a0: number, a1: number, profile: ReadonlyArray<readonly [number, number]>, steps: number): BufferGeometry {
  const P = profile.length, pos: number[] = [], idx: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = (a0 + ((a1 - a0) * i) / steps) * DEG;
    for (const [dr, x] of profile) pos.push(hub.x + x, hub.y + Math.sin(a) * (rf + dr), hub.z + Math.cos(a) * (rf + dr));
  }
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < P; j++) {
      const a = i * P + j, b = i * P + ((j + 1) % P), c = a + P, d = b + P;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // Make faces point outward: the profile's outermost point must have a normal away from the hub.
  let k = 0;
  profile.forEach(([dr], j) => { if (dr > (profile[k] as readonly [number, number])[0]) k = j; });
  const mid = Math.floor(steps / 2) * P + k;
  const n = new Vector3().fromBufferAttribute(g.getAttribute('normal'), mid);
  const p = new Vector3().fromBufferAttribute(g.getAttribute('position'), mid).sub(hub).setX(0);
  if (n.dot(p) < 0) {
    const ix = g.index as BufferAttribute;
    for (let t = 0; t < ix.count; t += 3) { const b = ix.getX(t + 1); ix.setX(t + 1, ix.getX(t + 2)); ix.setX(t + 2, b); }
    g.computeVertexNormals();
  }
  return g;
}

/** Mudguard around the tyre from a0° to a1°. */
export function fender(ps: PartSet, hub: V3, R: number, a0: number, a1: number, halfW: number, color: string, seg: Seg, paint = 0): void {
  const prof = [[0.004, -halfW], [0.013, -halfW * 0.45], [0.013, halfW * 0.45], [0.004, halfW]] as const;
  ps.add(arcSweep(hub, R + 0.012, a0, a1, prof, seg(9, 5)), { color, outline: 0.008, paint });
}

/** Flat rear rack over the wheel; returns the platform top centre (→ rack marker). */
export function rack(ps: PartSet, hub: V3, y: number, z0: number, z1: number, halfW: number, front: V3, color: string, seg: Seg): V3 {
  const o = { color, outline: 0.006 };
  for (const s of [-1, 1]) {
    ps.add(tube([v(s * halfW, y, z0), v(s * halfW, y, z1), v(s * halfW * 0.7, y - 0.03, z1 + 0.04)], 0.008, seg(4, 3), 4), o);
    ps.add(cyl(v(s * halfW, y, z1 - 0.02), v(s * 0.055, hub.y, hub.z), 0.007, 0.007, 4), o);
    ps.add(cyl(v(s * halfW, y, z0), front.clone().setX(s * 0.03), 0.006, 0.006, 4), o);
  }
  for (let k = 0; k < 4; k++) {
    const z = z0 + ((z1 - z0) * (k + 0.5)) / 4;
    ps.add(cyl(v(-halfW, y + 0.004, z), v(halfW, y + 0.004, z), 0.0065, 0.0065, 4), o);
  }
  return v(0, y + 0.012, (z0 + z1) / 2);
}

/** Orient a +Z-facing plane so it faces `normal` with +Y toward `up`. */
export function facing(g: BufferGeometry, at: V3, normal: V3, up: V3): BufferGeometry {
  const zA = normal.clone().normalize(), xA = up.clone().cross(zA).normalize(), yA = zA.clone().cross(xA);
  return g.applyMatrix4(new Matrix4().makeBasis(xA, yA, zA).setPosition(at));
}

/** Decal quad (atlas rect `id`) on a surface at `at` facing `normal`; `both` adds the mirrored back face. */
export function decal(ps: PartSet, id: DecalId, at: V3, normal: V3, up: V3, w: number, h: number, both = false, mirror = false): void {
  const uv = decalUv(id);
  const rect = mirror ? { ...uv, u0: uv.u1, u1: uv.u0 } : uv;
  ps.add(facing(new PlaneGeometry(w, h), at, normal, up), { decal: rect });
  if (both) ps.add(facing(new PlaneGeometry(w, h), at, normal.clone().negate(), up), { decal: rect });
}

/** Decal on both sides of a frame tube a → b (text runs along the tube, upright on both sides). */
export function tubeDecal(ps: PartSet, id: DecalId, a: V3, b: V3, r: number, w: number, h: number, t = 0.5): void {
  const dir = b.clone().sub(a).normalize();
  const up = new Vector3(0, -dir.z, dir.y);
  if (up.y < 0) up.negate();
  const at = a.clone().lerp(b, t);
  decal(ps, id, at.clone().setX(at.x + r + 0.0015), new Vector3(1, 0, 0), up, w, h);
  decal(ps, id, at.clone().setX(at.x - r - 0.0015), new Vector3(-1, 0, 0), up, w, h);
}
