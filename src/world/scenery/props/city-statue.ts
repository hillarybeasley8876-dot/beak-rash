// Roundabout monument: a gilded pelican riding a bicycle (the benchmark prompt, cast in bronze) with
// a red helmet. Toon gold in the self-lit city batch (aux style 5: cel ramp + outline + an emissive
// share, as if floodlit); local −Z = the way the bike points.
import { Color, Matrix4, Vector3 } from 'three';
import type { AuxBuf } from '../../dressing/city/batch';
import { box, cone, cylinder, sphere, trs } from '../../kit/shapes';

const GOLD = new Color('#f2b632'), GOLD_SHADE = new Color('#c27a1c'), BRONZE = new Color('#9a6420');
const DARK = new Color('#2c2014'), RED = new Color('#e5191c'), POUCH = new Color('#ff9a5c'), HOOK = new Color('#d8261c');
/** Emissive share of the floodlit gold (style 5). */
const LIT = 0.36;
const lm = new Matrix4(), wm = new Matrix4(), rx = new Matrix4(), rzM = new Matrix4();
const a = new Vector3(), b = new Vector3(), up = new Vector3(0, 1, 0);

/** Point on the cubic Bézier p0..p3 at t. */
function bez(p: number[][], t: number, out: Vector3): Vector3 {
  const u = 1 - t, w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
  out.set(0, 0, 0);
  p.forEach((q, i) => out.add(new Vector3(q[0], q[1], q[2]).multiplyScalar(w[i] ?? 0)));
  return out;
}

/** Statue of scale `k` standing at (x, y, z), bike pointing along `dir` (horizontal). */
export function statue(buf: AuxBuf, x: number, y: number, z: number, dir: { x: number; z: number }, k = 2.6): void {
  const yaw = Math.atan2(-dir.x, -dir.z);
  const base = trs(x, y, z, yaw, k, k, k, new Matrix4());
  const put = (local: Matrix4, fn: (mm: Matrix4) => void): void => fn(wm.multiplyMatrices(base, local));
  const bar = (ax: number, ay: number, az: number, bx: number, by: number, bz: number, r: number, col: Color): void => {
    a.set(ax, ay, az);
    b.set(bx, by, bz);
    const len = a.distanceTo(b);
    const q = new Matrix4().lookAt(a, b, up);
    // lookAt points −Z at b; rotate a unit box so its length runs along that axis.
    put(new Matrix4().makeTranslation((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2).multiply(q).multiply(new Matrix4().makeScale(r, r, len)), (mm) => box(buf, mm, col));
  };
  buf.setAux(5, LIT);
  // Wheels: tyres with gold hubs.
  for (const wz of [-0.56, 0.56]) {
    rx.makeRotationZ(Math.PI / 2);
    put(trs(0.04, 0.36, wz, 0, 1, 1, 1, lm).multiply(rx).multiply(rzM.makeScale(0.36, 0.08, 0.36)), (mm) => cylinder(buf, mm, DARK, 18));
    put(trs(0.045, 0.36, wz, 0, 1, 1, 1, lm).multiply(rx).multiply(rzM.makeScale(0.12, 0.09, 0.12)), (mm) => cylinder(buf, mm, GOLD, 10));
  }
  // Frame, bars, saddle.
  bar(0, 0.36, 0.56, 0, 0.62, 0.05, 0.05, BRONZE);
  bar(0, 0.62, 0.05, 0, 0.36, 0.56, 0.05, BRONZE);
  bar(0, 0.36, 0.05, 0, 0.88, 0.12, 0.05, BRONZE);
  bar(0, 0.86, 0.1, 0, 0.84, -0.42, 0.05, BRONZE);
  bar(0, 0.62, 0.05, 0, 0.84, -0.42, 0.05, BRONZE);
  bar(0, 0.84, -0.42, 0, 0.36, -0.56, 0.05, BRONZE);
  bar(0, 0.84, -0.42, 0, 1.0, -0.46, 0.04, BRONZE);
  put(trs(0, 1.0, -0.46, 0, 0.5, 0.04, 0.04, lm), (mm) => box(buf, mm, DARK));
  put(trs(0, 0.9, 0.14, 0, 0.12, 0.05, 0.22, lm), (mm) => box(buf, mm, DARK));
  // Body leaning forward with a shaded belly, wings reaching for the bars, legs to the pedals.
  put(trs(0, 1.18, 0.05, 0, 0.3, 0.36, 0.46, lm).multiply(rx.makeRotationX(-0.35)), (mm) => sphere(buf, mm, GOLD, 16, 11, GOLD_SHADE));
  put(trs(0, 1.3, 0.42, 0, 0.16, 0.1, 0.14, lm).multiply(rx.makeRotationX(0.5)), (mm) => cone(buf, mm, GOLD_SHADE, 8));
  for (const sx of [-1, 1]) {
    put(trs(sx * 0.27, 1.16, -0.1, sx * 0.15, 0.09, 0.2, 0.46, lm).multiply(rx.makeRotationX(-0.5)), (mm) => sphere(buf, mm, GOLD_SHADE, 12, 8, BRONZE));
    bar(sx * 0.1, 0.95, 0.1, sx * 0.13, 0.55, -0.12, 0.05, GOLD_SHADE);
    bar(sx * 0.13, 0.55, -0.12, sx * 0.12, 0.42, 0.06, 0.045, GOLD_SHADE);
    put(trs(sx * 0.12, 0.4, 0.0, 0, 0.1, 0.03, 0.18, lm), (mm) => box(buf, mm, GOLD));
  }
  // S-curved neck: a chain of overlapping spheres along a Bézier (forward, back, forward again).
  const neck = [[0, 1.34, -0.2], [0, 1.64, 0.1], [0, 1.6, -0.4], [0, 1.86, -0.28]];
  const p = new Vector3();
  for (let i = 0; i <= 8; i++) {
    bez(neck, i / 8, p);
    const r = 0.095 - i * 0.003;
    put(trs(p.x, p.y, p.z, 0, r, r, r, lm), (mm) => sphere(buf, mm, GOLD, 10, 7));
  }
  // Head with a tuft, red helmet, eyes; the HUGE beak with a red hooked tip over a big pouch.
  put(trs(0, 1.9, -0.28, 0, 0.15, 0.14, 0.17, lm), (mm) => sphere(buf, mm, GOLD, 12, 9));
  put(trs(0, 1.94, -0.26, 0, 0.17, 0.12, 0.2, lm), (mm) => sphere(buf, mm, RED, 12, 5));
  put(trs(0, 2.02, -0.2, 0, 0.035, 0.14, 0.035, lm), (mm) => cone(buf, mm, GOLD, 6));
  for (const sx of [-1, 1]) put(trs(sx * 0.12, 1.92, -0.36, 0, 0.03, 0.035, 0.03, lm), (mm) => sphere(buf, mm, DARK, 6, 4));
  put(trs(0, 1.88, -0.36, 0, 0.075, 0.045, 0.95, lm).multiply(rx.makeRotationX(-Math.PI / 2)), (mm) => cone(buf, mm, GOLD, 10));
  put(trs(0, 1.86, -1.3, 0, 0.05, 0.06, 0.06, lm), (mm) => sphere(buf, mm, HOOK, 8, 6));
  put(trs(0, 1.74, -0.82, 0, 0.11, 0.13, 0.42, lm).multiply(rx.makeRotationX(0.12)), (mm) => sphere(buf, mm, POUCH, 14, 9));
  buf.setAux(0);
}
