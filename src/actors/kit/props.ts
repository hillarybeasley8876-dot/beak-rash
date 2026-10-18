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
  // Knot + two flared tails sticking out behind the head (they read from the chase cam).
  const tail = new CapsuleGeometry(0.02, 0.13, 3, 6);
  for (const s of [-1, 1]) {
    b.part({ geometry: tail, matrix: at([c[0] + s * 0.05, c[1] - 0.035, c[2] + r[2] + 0.07], [1.05, 0, s * 0.75], [1.9, 1, 0.45]), color, bone: B.hat });
  }
  tail.dispose();
  b.part({ geometry: new SphereGeometry(0.03, 8, 6), matrix: at([c[0], c[1] - 0.005, c[2] + r[2] + 0.012], [0, 0, 0], [1.2, 1, 0.8]), color, bone: B.hat });
}

/** Pixel sunglasses: blocky black lenses with white shine pixels; `c` = centre of the top bar, width `w`, `roll` (rad)
 *  tilts them, `temple` (m) adds arms running back to the head sides so they sit on the face instead of floating. */
export function addPixelShades(b: CharacterBuilder, c: V3, w: number, o: { roll?: number; temple?: number; bone?: number } = {}): void {
  const px = w / 11, bone = o.bone ?? B.head, roll = o.roll ?? 0;
  const box = new BoxGeometry(px, px, px * 0.8);
  const rows = ['XXXXXXXXXXX', '.XWXX.XWXX.', '.XXXX.XXXX.', '..XX...XX..'];
  const place = (x: number, y: number): V3 => [c[0] + x * Math.cos(roll) - y * Math.sin(roll), c[1] + x * Math.sin(roll) + y * Math.cos(roll), c[2]];
  rows.forEach((row, ry) => {
    [...row].forEach((ch, cx) => {
      if (ch === '.') return;
      b.part({ geometry: box, matrix: at(place((cx - 5) * px, -ry * px), [0, 0, roll]), color: ch === 'W' ? 0xffffff : 0x0b0b0f, bone, outline: 0.3 });
    });
  });
  box.dispose();
  if (!o.temple) return;
  for (const s of [-1, 1]) {
    const p = place(s * 5 * px, 0), len = o.temple;
    b.part({ geometry: new BoxGeometry(px * 0.6, px * 0.6, len), matrix: at([p[0] + s * len * 0.1, p[1], p[2] + len / 2], [0, s * 0.2, 0]), color: 0x0b0b0f, bone, outline: 0.3 });
  }
}

/** Yuzu stem + leaf on top of a yuzu (the capybara's citrus-peel helmet): `top` = top of the fruit, r = fruit radius. */
export function addLeafStem(b: CharacterBuilder, top: V3, r: number): void {
  b.part({ geometry: new CylinderGeometry(r * 0.08, r * 0.1, r * 0.3, 6), matrix: at([top[0], top[1] + r * 0.06, top[2]]), color: 0x5a4a2a, bone: B.hat });
  const leaf = new Shape();
  leaf.moveTo(0, 0);
  leaf.quadraticCurveTo(r * 0.5, r * 0.35, r * 1.1, 0);
  leaf.quadraticCurveTo(r * 0.5, -r * 0.35, 0, 0);
  const g = extrudeSmooth(leaf, { depth: r * 0.08, bevel: 0.4, curveSegments: 4, bevelSegments: 1 });
  b.part({ geometry: g, matrix: at([top[0], top[1] + r * 0.12, top[2]], [Math.PI / 2 - 0.4, 0.6, 0]), color: 0x3f9c3a, bone: B.hat, outline: 0.6 });
  g.dispose();
}

const FRY = 0xf2c14e, FRY_END = 0xd39a2c;

/** Stolen french fries poking out of the beak corner: two chunky golden fries fanned out, each slightly bent, with
 *  soft darker-gold ends (pale thin fries read as a cigarette). `rot` orients the pair (+Y = along the fries). */
export function addFry(b: CharacterBuilder, p: V3, len: number, rot: V3): void {
  const base = at(p, rot), w = 0.019;
  for (const [fan, l] of [[0, len], [0.42, len * 0.78]] as const) {
    const fry = base.clone().multiply(new Matrix4().makeRotationZ(fan));
    for (const seg of [0, 1] as const) {
      const h = l * 0.5 + 0.008;
      const m = seg === 0 ? fry.clone().multiply(new Matrix4().makeTranslation(0, l * 0.25, 0))
        : fry.clone().multiply(new Matrix4().makeTranslation(0, l * 0.5, 0)).multiply(new Matrix4().makeRotationZ(-0.2))
          .multiply(new Matrix4().makeTranslation(0, l * 0.25, 0));
      const inv = m.clone().invert(), v = new Vector3();
      const color = (x: number, y: number, z: number): number => (seg === 1 && v.set(x, y, z).applyMatrix4(inv).y > h * 0.3 ? FRY_END : FRY);
      b.part({ geometry: new BoxGeometry(w, h, w, 1, 4, 1), matrix: m, color, bone: B.head, outline: 0.7 });
    }
  }
}

/** Silver whistle held in the mouth. */
export function addWhistle(b: CharacterBuilder, p: V3): void {
  b.part({ geometry: new CapsuleGeometry(0.014, 0.05, 3, 8), matrix: at(p, [Math.PI / 2, 0, 0]), color: 0xd8dde6, bone: B.head, outline: 0.6 });
  b.part({ geometry: new SphereGeometry(0.022, 10, 8), matrix: at([p[0], p[1] - 0.006, p[2] - 0.035]), color: 0xd8dde6, bone: B.head, outline: 0.6 });
  b.part({ geometry: new TorusGeometry(0.012, 0.003, 4, 10), matrix: at([p[0], p[1], p[2] + 0.035]), color: 0xe5191c, bone: B.head, outline: 0.3 });
}
