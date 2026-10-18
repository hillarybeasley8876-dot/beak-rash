// Coast tunnel signage: meme exit signs on the walls and P5 name plates over both portals
// (鹈鹕岬隧道). Faces are drawn into the dressing's sign atlas (unlit faces batch).
import { Color, Matrix4, Vector3 } from 'three';
import type { Rng } from '../../../core/rng';
import type { TrackFeature } from '../../../core/types';
import { FONT } from '../../fonts';
import { box, trs } from '../../kit/shapes';
import { faceQuad, yawFor } from '../../scenery/signs/boards';
import { cell } from '../../scenery/signs/faces';
import type { AtlasRect, SignAtlas } from '../../scenery/signs/atlas';
import { halftone, label, P5, ransom, star } from '../../scenery/signs/p5draw';
import type { Dress } from '../dress';

export const TUNNEL_NAME = '鹈鹕岬隧道';
export const TUNNEL_SIGNS = ['出口 → 海鲜大排档', '隧道内 禁止投喂鹈鹕', '请开灯 鹈鹕眼神不好', '紧急停车带 鱼也能停'];
const EXIT_GREEN = '#0f9d58';
const FRAME = new Color('#1c1d22'), CONCRETE = new Color('#cfccc4');
/** Portal lintel: bottom above the vault crown, height, and the name plate width (m). */
const LINTEL = { base: 0.875, h: 3.3, plateW: 14.5 } as const;
const m = new Matrix4();
const P = new Vector3();

function exitFace(atlas: SignAtlas, text: string): AtlasRect | null {
  return cell(atlas, 512, 128, (g, w, h) => {
    g.fillStyle = EXIT_GREEN;
    g.fillRect(0, 0, w, h);
    g.fillStyle = P5.white;
    g.fillRect(10, 10, 96, h - 20);
    label(g, 'EXIT', 58, h / 2 + 2, 40, EXIT_GREEN, FONT.en, 400);
    label(g, text, (w + 106) / 2, h / 2 + 3, Math.min(54, (w - 140) / Math.max(4, Array.from(text).length) * 1.12), P5.white, FONT.cn, 400);
    g.lineWidth = 8;
    g.strokeStyle = P5.white;
    g.strokeRect(4, 4, w - 8, h - 8);
  });
}

/** Portal name plate (4.9:1): ransom-note 鹈鹕岬隧道 on black with a red jagged band and stars. */
function plateFace(atlas: SignAtlas, rng: Rng, len: number): AtlasRect | null {
  return cell(atlas, 1024, 208, (g, w, h) => {
    g.fillStyle = P5.black;
    g.fillRect(0, 0, w, h);
    g.fillStyle = P5.red;
    g.beginPath();
    g.moveTo(0, h * 0.16); g.lineTo(w, h * 0.04); g.lineTo(w, h * 0.68); g.lineTo(w * 0.45, h * 0.76); g.lineTo(0, h * 0.84);
    g.closePath();
    g.fill();
    halftone(g, 0, 0, w, h, 'rgba(255,255,255,0.12)', 14);
    star(g, 62, h * 0.44, 46, P5.yellow, 0.2);
    star(g, w - 62, h * 0.44, 46, P5.yellow, -0.2);
    ransom(g, rng, TUNNEL_NAME, 130, 4, w - 260, h * 0.78);
    label(g, `PELICAN CAPE TUNNEL · ${Math.round(len)} M`, w / 2, h * 0.91, 24, P5.yellow, FONT.en, 400);
  });
}

export function tunnelSigns(d: Dress, f: TrackFeature, halfW: number, crown: number): void {
  const { ctx, b, atlas } = d;
  // Exit signs on alternate walls every 45 m, 2.3 m up, facing into the tube.
  TUNNEL_SIGNS.forEach((text, k) => {
    const s = f.s0 + 18 + k * 40;
    if (s > f.s1 - 12) return;
    const side: -1 | 1 = k % 2 ? 1 : -1;
    const rect = d.face(`tunnelExit:${text}`, () => exitFace(atlas, text));
    if (!rect) return;
    const fr = ctx.q.frameVis(s);
    ctx.q.toWorld(s, side * (halfW - 0.04), 2.35, P);
    faceQuad(b.faces.at(P.x, P.z), P, yawFor(-fr.right.x * side, -fr.right.z * side), 2.6, 0.65, rect);
  });
  // Portal facades: concrete pilasters + a deep black lintel carrying the name plate (readable from
  // ~80 m), on both portals (the exit one faces riders looking back and the bridge). `out` points away from the tube.
  const plate = d.face('tunnelPlate', () => plateFace(atlas, d.rng.fork(0x7e1a), f.s1 - f.s0));
  const pilasterH = crown + LINTEL.base + LINTEL.h + 0.3;
  for (const [sp, out] of [[f.s0, -1], [f.s1, 1]] as Array<[number, number]>) {
    const fr = ctx.q.frameVis(sp);
    const yaw = yawFor(fr.tangent.x * out, fr.tangent.z * out);
    const W = 2 * (halfW + 2.15), y = crown + LINTEL.base + LINTEL.h / 2;
    ctx.q.toWorld(sp + out * 0.45, 0, y, P);
    box(b.props.at(P.x, P.z), trs(P.x, P.y, P.z, yaw, W, LINTEL.h, 0.4, m), FRAME);
    if (plate) {
      ctx.q.toWorld(sp + out * 0.68, 0, y, P);
      faceQuad(b.faces.at(P.x, P.z), P, yaw, LINTEL.plateW, LINTEL.plateW * (208 / 1024), plate);
    }
    for (const side of [-1, 1] as const) {
      ctx.q.toWorld(sp + out * 0.4, side * (halfW + 1.5), 0, P);
      box(b.props.at(P.x, P.z), trs(P.x, P.y + pilasterH / 2 - 0.3, P.z, yaw, 1.3, pilasterH, 0.7, m), CONCRETE);
    }
  }
}
