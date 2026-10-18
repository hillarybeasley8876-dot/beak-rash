// Roundabout monument: a gilded pelican riding a bicycle (the benchmark prompt, cast in bronze) with
// a red helmet. Chunky primitives in a statue palette; local −Z = the way the bike points.
import { Color, Matrix4, Vector3 } from 'three';
import type { PropBatch } from '../../kit/batch';
import type { MeshBuf } from '../../geom';
import { box, cone, cylinder, sphere, trs } from '../../kit/shapes';

// Lit by uplights: pushed past 1.0 so the gold reads bright under the moon.
const GOLD = new Color('#f0c050').multiplyScalar(2.1), BRONZE = new Color('#c08a32').multiplyScalar(1.8);
const DARK = new Color('#4a3618'), RED = new Color('#ff2a2a').multiplyScalar(1.7), POUCH = new Color('#ffb070').multiplyScalar(1.8);
const lm = new Matrix4(), wm = new Matrix4(), rx = new Matrix4(), rzM = new Matrix4();

/** Statue of scale `k` standing at (x, y, z), bike pointing along `dir` (horizontal). */
export function statue(batch: PropBatch, x: number, y: number, z: number, dir: { x: number; z: number }, k = 2.6): void {
  const buf: MeshBuf = batch.at(x, z);
  const yaw = Math.atan2(-dir.x, -dir.z);
  const base = trs(x, y, z, yaw, k, k, k, new Matrix4());
  const put = (local: Matrix4, fn: (mm: Matrix4) => void): void => fn(wm.multiplyMatrices(base, local));
  const bar = (ax: number, ay: number, az: number, bx: number, by: number, bz: number, r: number, col: Color): void => {
    const a = new Vector3(ax, ay, az), b = new Vector3(bx, by, bz), d = b.clone().sub(a);
    const len = d.length();
    const q = new Matrix4().lookAt(a, b, new Vector3(0, 1, 0));
    // lookAt points −Z at b; rotate a unit box so its length runs along that axis.
    put(new Matrix4().makeTranslation((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2).multiply(q).multiply(new Matrix4().makeScale(r, r, len)), (mm) => box(buf, mm, col));
  };
  // Wheels: discs on the X axis with tyres and hubs.
  for (const wz of [-0.56, 0.56]) {
    rx.makeRotationZ(Math.PI / 2);
    put(trs(0.04, 0.36, wz, 0, 1, 1, 1, lm).multiply(rx).multiply(rzM.makeScale(0.36, 0.08, 0.36)), (mm) => cylinder(buf, mm, DARK, 18));
    put(trs(0.045, 0.36, wz, 0, 1, 1, 1, lm).multiply(rx).multiply(rzM.makeScale(0.12, 0.09, 0.12)), (mm) => cylinder(buf, mm, GOLD, 10));
  }
  // Frame.
  bar(0, 0.36, 0.56, 0, 0.62, 0.05, 0.05, BRONZE);
  bar(0, 0.62, 0.05, 0, 0.36, 0.56, 0.05, BRONZE);
  bar(0, 0.36, 0.05, 0, 0.88, 0.12, 0.05, BRONZE);
  bar(0, 0.86, 0.1, 0, 0.84, -0.42, 0.05, BRONZE);
  bar(0, 0.62, 0.05, 0, 0.84, -0.42, 0.05, BRONZE);
  bar(0, 0.84, -0.42, 0, 0.36, -0.56, 0.05, BRONZE);
  bar(0, 0.84, -0.42, 0, 1.0, -0.46, 0.04, BRONZE);
  put(trs(0, 1.0, -0.46, 0, 0.5, 0.04, 0.04, lm), (mm) => box(buf, mm, DARK));
  put(trs(0, 0.9, 0.14, 0, 0.12, 0.05, 0.22, lm), (mm) => box(buf, mm, DARK));
  // Pelican: body leaning forward, wings to the bars, S-neck, head, huge beak with a pouch.
  put(trs(0, 1.18, 0.05, 0, 0.3, 0.36, 0.46, lm).multiply(rx.makeRotationX(-0.35)), (mm) => sphere(buf, mm, GOLD, 12, 8));
  for (const sx of [-1, 1]) {
    put(trs(sx * 0.27, 1.16, -0.1, sx * 0.15, 0.08, 0.18, 0.42, lm).multiply(rx.makeRotationX(-0.5)), (mm) => sphere(buf, mm, BRONZE, 8, 6));
    bar(sx * 0.1, 0.95, 0.1, sx * 0.13, 0.55, -0.12, 0.05, BRONZE);
    bar(sx * 0.13, 0.55, -0.12, sx * 0.12, 0.42, 0.06, 0.045, BRONZE);
    put(trs(sx * 0.12, 0.4, 0.0, 0, 0.09, 0.03, 0.16, lm), (mm) => box(buf, mm, GOLD));
  }
  bar(0, 1.38, -0.18, 0, 1.6, -0.12, 0.09, GOLD);
  bar(0, 1.6, -0.12, 0, 1.78, -0.24, 0.08, GOLD);
  put(trs(0, 1.86, -0.27, 0, 0.15, 0.14, 0.17, lm), (mm) => sphere(buf, mm, GOLD, 10, 7));
  put(trs(0, 1.9, -0.25, 0, 0.17, 0.12, 0.2, lm), (mm) => sphere(buf, mm, RED, 10, 5));
  put(trs(0, 1.85, -0.4, 0, 0.07, 0.05, 0.72, lm).multiply(rx.makeRotationX(-Math.PI / 2)), (mm) => cone(buf, mm, GOLD, 8));
  put(trs(0, 1.75, -0.62, 0, 0.09, 0.09, 0.3, lm), (mm) => sphere(buf, mm, POUCH, 8, 6));
}
