// City building kit: boxes whose side faces carry facade coordinates for the night-window shader
// (uv = window bays across × floors up) and per-building window parameters in `aux`.
// Local frame like scenery/props/building.ts: origin at the front-centre ground point, front faces −Z.
import { Color, Matrix4, Vector3 } from 'three';
import type { AuxBuf } from '../../dressing/city/batch';

export interface WinSpec {
  style: number;   // 1 flats, 2 offices, 3 mixed, 4 shop glass (see dressing/city/glsl.ts)
  seed: number;
  lit: number;     // lit ratio 0..1
  led: number;     // LED floor-line colour index (0 none)
  bay: number;     // window bay width (m)
  floor: number;   // floor height (m)
  y0: number;      // local height where the window grid starts
}

// Faces: normal, u tangent (so that n × u = up on the sides).
const FACES: Array<[[number, number, number], [number, number, number]]> = [
  [[0, 0, -1], [-1, 0, 0]], [[0, 0, 1], [1, 0, 0]], [[1, 0, 0], [0, 0, -1]], [[-1, 0, 0], [0, 0, 1]], [[0, 1, 0], [1, 0, 0]],
];

const n = new Vector3(), u = new Vector3(), v = new Vector3(), p = new Vector3(), wn = new Vector3(), c = new Vector3();
const rot = new Matrix4();

/**
 * Box centred at local (cx, cy, cz), size (sx, sy, sz). Side faces get windows when `win` is given
 * (the top never does; `roof` colours it). Bottom faces are skipped (never seen).
 */
export function fbox(buf: AuxBuf, base: Matrix4, cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, col: Color, win: WinSpec | null, roof?: Color, sides = 0b11111): void {
  rot.extractRotation(base);
  const half = [sx / 2, sy / 2, sz / 2];
  FACES.forEach(([nn, uu], f) => {
    if (!(sides & (1 << f))) return;
    n.set(nn[0], nn[1], nn[2]);
    u.set(uu[0], uu[1], uu[2]);
    v.crossVectors(n, u);
    const hn = Math.abs(n.x) * (half[0] ?? 0) + Math.abs(n.y) * (half[1] ?? 0) + Math.abs(n.z) * (half[2] ?? 0);
    const hu = Math.abs(u.x) * (half[0] ?? 0) + Math.abs(u.z) * (half[2] ?? 0);
    const hv = Math.abs(v.x) * (half[0] ?? 0) + Math.abs(v.y) * (half[1] ?? 0) + Math.abs(v.z) * (half[2] ?? 0);
    const top = f === 4;
    const w = top ? null : win;
    if (w) buf.setAux(w.style, w.seed + f * 0.37, w.lit, w.led);
    else buf.setAux(0);
    wn.copy(n).applyMatrix4(rot);
    const fc = top && roof ? roof : col;
    // Whole bays across the face so no window is cut at a corner.
    const bays = w ? Math.max(1, Math.round((2 * hu) / w.bay)) : 0;
    const ids: number[] = [];
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as Array<[number, number]>) {
      c.set(cx, cy, cz).addScaledVector(n, hn).addScaledVector(u, a * hu).addScaledVector(v, b * hv);
      p.copy(c).applyMatrix4(base);
      const uc = w ? ((a + 1) / 2) * bays : 0;
      const vc = w ? (c.y - w.y0) / w.floor : 0;
      ids.push(buf.vert(p, wn, fc, uc, vc));
    }
    buf.quad(ids[0] ?? 0, ids[1] ?? 0, ids[2] ?? 0, ids[3] ?? 0);
  });
  buf.setAux(0);
}

/** Window spec helper: bays sized so a face of width `w` holds whole windows. */
export function winSpec(style: number, seed: number, lit: number, led = 0, bay = 2.0, floor = 3.2, y0 = 0): WinSpec {
  return { style, seed, lit, led, bay, floor, y0 };
}

/** Colour from a hex string (shared by the city prop files). */
export const C = (h: string): Color => new Color(h);

export const CPAL = {
  walls: [new Color('#4a4e7a'), new Color('#5a6182'), new Color('#6e4a74'), new Color('#3d6670'), new Color('#7a7684'), new Color('#844a4e'), new Color('#9a8f7c')],
  towers: [new Color('#3c4470'), new Color('#4a5378'), new Color('#30596a'), new Color('#5a4c78'), new Color('#62667c')],
  roof: new Color('#22232c'), trim: new Color('#15161c'), concrete: new Color('#6b6a72'), steel: new Color('#8b93a3'),
  awning: [new Color('#e5191c'), new Color('#ff8a1f'), new Color('#2f7fc1'), new Color('#1fae8c'), new Color('#ffe600')],
  tank: new Color('#7f8794'), ac: new Color('#a7adb8'),
};
