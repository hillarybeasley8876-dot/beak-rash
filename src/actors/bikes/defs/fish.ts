// The tandem's passenger: a stiff, grumpy salted fish (咸鱼) strapped upright on the stoker saddle.
// Authored lying flat (head toward −Z, back +Y, flanks ±X), then stood up on the saddle by one matrix.
import { BufferAttribute, Color, Euler, Matrix4, PlaneGeometry, Quaternion, Shape, TorusGeometry, Vector2, Vector3, type BufferGeometry } from 'three';
import { decalUv } from '../build/atlas';
import { bar, extrude, smooth, v, type Seg, type V3 } from '../build/geo';
import type { PartSet } from '../build/partset';
import { facing } from '../parts/accessories';

const BACK = new Color('#5d6c78'), SIDE = new Color('#b4c0c8'), BELLY = new Color('#eceee6');
const HALF_T = 0.032; // half thickness incl. bevel
const p2 = (x: number, y: number): Vector2 => new Vector2(x, y);

/** Side profile, head toward +x (becomes −Z): smooth back and belly, spiky dorsal fin, forked tail,
 *  a sulky mouth notch. */
function profile(): Shape {
  const s = new Shape();
  s.moveTo(0.258, 0.012);
  s.splineThru([p2(0.21, 0.056), p2(0.12, 0.08), p2(0.06, 0.088)]);
  s.lineTo(0.0, 0.122);
  s.lineTo(-0.05, 0.08);
  s.splineThru([p2(-0.11, 0.054), p2(-0.17, 0.028)]);
  s.lineTo(-0.272, 0.092);
  s.lineTo(-0.24, 0.0);
  s.lineTo(-0.272, -0.088);
  s.lineTo(-0.17, -0.026);
  s.splineThru([p2(-0.08, -0.058), p2(0.06, -0.07), p2(0.17, -0.05), p2(0.236, -0.022)]);
  s.lineTo(0.214, -0.004);
  s.closePath();
  return s;
}

/** Belly-to-back colour ramp baked into a 'color' attribute. */
function shade(g: BufferGeometry): BufferGeometry {
  const p = g.getAttribute('position');
  const col = new Float32Array(p.count * 3), c = new Color();
  for (let i = 0; i < p.count; i++) {
    const t = Math.max(-1, Math.min(1, p.getY(i) / 0.075));
    if (t < 0) c.copy(SIDE).lerp(BELLY, -t);
    else c.copy(SIDE).lerp(BACK, t);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new BufferAttribute(col, 3));
  return g;
}

export function saltFish(ps: PartSet, seat: V3, seg: Seg): void {
  // Stood up (tilt about X), then turned 34° to its right: a sulky three-quarter pose that shows a flank
  // to the chase camera as well as from the side.
  const k = 1.15, q = new Quaternion().setFromEuler(new Euler(1.3, -0.6, 0, 'YXZ'));
  const tail = new Vector3(0, 0, 0.245 * k).applyQuaternion(q);
  const place = new Matrix4().compose(seat.clone().add(v(0, 0.012, 0.05)).sub(tail), q, new Vector3(k, k, k));
  const put = (g: BufferGeometry): BufferGeometry => g.applyMatrix4(place);
  const body = smooth(extrude(profile(), HALF_T * 2 - 0.028, 0.014, seg(1, 1), 2).rotateY(Math.PI / 2));
  ps.add(put(shade(body)), { outline: 0.012 });
  const strap = new TorusGeometry(1, 0.1, 3, seg(10, 6)).scale(0.05, 0.092, 0.1).translate(0, 0.008, 0.035);
  ps.add(put(strap), { color: '#e5191c', outline: 0.006 });
  const uv = decalUv('fishface');
  const at = (s: number): V3 => v(s * (HALF_T + 0.0012), 0.014, -0.162);
  ps.add(put(facing(new PlaneGeometry(0.18, 0.09), at(1), v(1, 0, 0), v(0, 1, 0))), { decal: uv });
  ps.add(put(facing(new PlaneGeometry(0.18, 0.09), at(-1), v(-1, 0, 0), v(0, 1, 0))), { decal: { ...uv, u0: uv.u1, u1: uv.u0 } });
  const band = new Vector3(0, 0.008, 0.035).applyMatrix4(place).add(v(0, 0, 0.05));
  ps.add(bar(band, seat.clone().add(v(0, -0.03, 0.06)), 0.03, 0.006), { color: '#e5191c', outline: 0.004 });
}
