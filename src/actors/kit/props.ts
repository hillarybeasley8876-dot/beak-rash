// Signature props: police cap, bandana, pixel "deal-with-it" shades, yuzu, french fry, whistle.
// Hat-like props ride the `hat` bone (they fly off in crashes); face props ride the head.
import { BoxGeometry, CapsuleGeometry, CylinderGeometry, Matrix4, Quaternion, Shape, SphereGeometry, TorusGeometry, Vector3, Euler } from 'three';
import type { CharacterBuilder } from './builder';
import { extrudeSmooth } from './shapes';
import type { V3 } from './sdf';
import { B } from '../rig/skeleton';

const at = (p: V3, rot: V3 = [0, 0, 0], s: V3 = [1, 1, 1]): Matrix4 =>
  new Matrix4().compose(new Vector3(p[0], p[1], p[2]), new Quaternion().setFromEuler(new Euler(rot[0], rot[1], rot[2])), new Vector3(s[0], s[1], s[2]));

/** Police cap: crown + band + brim + gold badge. `c` = crown centre, `r` = crown radius. */
export function addPoliceCap(b: CharacterBuilder, c: V3, r: number, pitch: number): void {
  const rot: V3 = [-pitch, 0, 0];
  b.part({ geometry: new CylinderGeometry(r * 1.12, r * 0.95, r * 0.75, 18), matrix: at(c, rot), color: 0x1d2a5c, bone: B.hat });
  b.part({ geometry: new CylinderGeometry(r * 0.97, r * 0.97, r * 0.28, 18), matrix: at([c[0], c[1] - r * 0.4, c[2]], rot), color: 0x111827, bone: B.hat });
  b.part({ geometry: new CylinderGeometry(r * 0.75, r * 0.8, r * 0.07, 16, 1, false, Math.PI * 0.5, Math.PI), matrix: at([c[0], c[1] - r * 0.5, c[2] - r * 0.6], [-pitch - 0.25, 0, 0]), color: 0x0b0b0f, bone: B.hat });
  b.part({ geometry: new SphereGeometry(r * 0.16, 10, 6), matrix: at([c[0], c[1] - r * 0.05, c[2] - r * 1.02], rot, [1, 1.15, 0.45]), color: 0xffd23f, bone: B.hat, outline: 0.5 });
}

/** Bandana: a forehead band (front raised by `tilt`) plus a knot with two tails at the back. */
export function addBandana(b: CharacterBuilder, c: V3, r: V3, color: number, tilt = 0.35): void {
  b.part({ geometry: new TorusGeometry(1, 0.16, 6, 24), matrix: at(c, [Math.PI / 2 + tilt, 0, 0], [r[0], r[2], r[1]]), color, bone: B.hat });
  const tail = new CapsuleGeometry(0.018, 0.09, 3, 6);
  for (const s of [-1, 1]) {
    b.part({ geometry: tail, matrix: at([c[0] + s * 0.03, c[1] - 0.02, c[2] + r[2] + 0.04], [0.9, 0, s * 0.5], [1.4, 1, 0.5]), color, bone: B.hat });
  }
  tail.dispose();
  b.part({ geometry: new SphereGeometry(0.022, 8, 6), matrix: at([c[0], c[1], c[2] + r[2] + 0.005]), color, bone: B.hat });
}

/** Pixel sunglasses: blocky black lenses with white shine pixels, centred at `c`, width `w`. */
export function addPixelShades(b: CharacterBuilder, c: V3, w: number, bone: number = B.head): void {
  const px = w / 11;
  const box = new BoxGeometry(px, px, px * 0.8);
  const rows = ['XXXXXXXXXXX', '.XWXX.XWXX.', '.XXXX.XXXX.', '..XX...XX..'];
  rows.forEach((row, ry) => {
    [...row].forEach((ch, cx) => {
      if (ch === '.') return;
      const p: V3 = [c[0] + (cx - 5) * px, c[1] - ry * px, c[2]];
      b.part({ geometry: box, matrix: at(p), color: ch === 'W' ? 0xffffff : 0x0b0b0f, bone, outline: 0.3 });
    });
  });
  box.dispose();
}

/** Yuzu (citron) balanced on top: dimpled orange sphere + stem + leaf. */
export function addYuzu(b: CharacterBuilder, c: V3, r: number): void {
  b.part({ geometry: new SphereGeometry(r, 16, 12), matrix: at(c, [0, 0, 0], [1, 0.86, 1]), color: (x, y, z) => ((Math.sin(x * 160) + Math.sin(z * 150)) * 0.5 > 0.7 ? 0xf2a51a : 0xffb81f), bone: B.hat });
  b.part({ geometry: new CylinderGeometry(r * 0.08, r * 0.1, r * 0.3, 6), matrix: at([c[0], c[1] + r * 0.92, c[2]]), color: 0x5a4a2a, bone: B.hat });
  const leaf = new Shape();
  leaf.moveTo(0, 0);
  leaf.quadraticCurveTo(r * 0.5, r * 0.35, r * 1.1, 0);
  leaf.quadraticCurveTo(r * 0.5, -r * 0.35, 0, 0);
  const g = extrudeSmooth(leaf, { depth: r * 0.08, bevel: 0.4, curveSegments: 4, bevelSegments: 1 });
  b.part({ geometry: g, matrix: at([c[0], c[1] + r * 0.98, c[2]], [Math.PI / 2 - 0.4, 0.6, 0]), color: 0x3f9c3a, bone: B.hat, outline: 0.6 });
  g.dispose();
}

/** A golden french fry poking out of the beak, from `a` to `b2`. */
export function addFry(b: CharacterBuilder, p: V3, len: number, rot: V3): void {
  const m = at(p, rot);
  const tip = new Vector3(0, len * 0.5, 0).applyMatrix4(m);
  b.part({ geometry: new BoxGeometry(0.018, len, 0.018), matrix: m, color: (x, y, z) => (Math.hypot(x - tip.x, y - tip.y, z - tip.z) < len * 0.22 ? 0xd9341c : 0xffe9a3), bone: B.head, outline: 0.7 });
}

/** Silver whistle held in the mouth. */
export function addWhistle(b: CharacterBuilder, p: V3): void {
  b.part({ geometry: new CapsuleGeometry(0.014, 0.05, 3, 8), matrix: at(p, [Math.PI / 2, 0, 0]), color: 0xd8dde6, bone: B.head, outline: 0.6 });
  b.part({ geometry: new SphereGeometry(0.022, 10, 8), matrix: at([p[0], p[1] - 0.006, p[2] - 0.035]), color: 0xd8dde6, bone: B.head, outline: 0.6 });
  b.part({ geometry: new TorusGeometry(0.012, 0.003, 4, 10), matrix: at([p[0], p[1], p[2] + 0.035]), color: 0xe5191c, bone: B.head, outline: 0.3 });
}
