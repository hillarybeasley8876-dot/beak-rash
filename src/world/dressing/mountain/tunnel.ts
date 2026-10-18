// Sunset Pass tunnel fit-out (env-mountain), on top of the shared tube (features/tunnel.ts): warm
// sodium pools on the road under every vault strip, sodium wall lamps with wall glows, green exit
// signs, one meme sign, daylight spill at both mouths, and a carved 落日隧道 plaque with two lamps
// over the entrance portal.
import { Color, Matrix4, Vector3 } from 'three';
import type { TrackFeature } from '../../../core/types';
import { CROWN, LAMP_EVERY, tunnelHalfW } from '../../features/tunnel';
import { box, trs } from '../../kit/shapes';
import { faceQuad } from '../../scenery/signs/boards';
import type { Dress } from '../dress';
import { passSignFace, tunnelPlaqueFace } from './faces';
import { LightPools } from './pools';
import { signFace } from './util';

const MEME = '鹈鹕请 收好喉囊';
export const TUNNEL_TEXTS = ['落日隧道', 'SUNSET TUNNEL', MEME];
const SODIUM = new Color(0.44, 0.27, 0.1);
const WALL_GLOW = new Color(0.34, 0.2, 0.08);
const SPILL = new Color(0.24, 0.18, 0.12);
/** No sodium pool closer than this to a mouth (the 9 m spill pool sits at 7 m). */
const MOUTH = 14;
const LAMP = new Color('#ffc46a').multiplyScalar(1.6);
const EXIT = new Color('#2bd96b').multiplyScalar(1.4);
const STONE = new Color('#5d5258');
const m = new Matrix4();
const UP = new Vector3(0, 1, 0);

export function tunnelFitOut(d: Dress): void {
  const pools = new LightPools(d.ctx);
  for (const f of d.ctx.L.features.filter((ft) => ft.kind === 'tunnel')) {
    const halfW = tunnelHalfW(d.field, f);
    // Sodium pools under the vault strips stay clear of the daylight spill (additive pools would stack and wash out the road).
    for (let s = f.s0 + 5; s < f.s1 - 3; s += LAMP_EVERY) {
      if (s + 1.2 < f.s0 + MOUTH || s + 1.2 > f.s1 - MOUTH) continue;
      for (const x of [-2.2, 2.2]) pools.road(s + 1.2, x, 4.2, 2.4, SODIUM);
    }
    // Daylight spilling in at both mouths.
    pools.road(f.s0 + 7, 0, 9, halfW, SPILL);
    pools.road(f.s1 - 7, 0, 9, halfW, SPILL);
    wallLamps(d, pools, f, halfW);
    plaque(d, f.s0, f.s1 - f.s0);
  }
  pools.build('mountain:tunnelPools');
}

/** Sodium lamps on both walls every 12 m (each with a glow on the wall), exit signs, one meme sign. */
function wallLamps(d: Dress, pools: LightPools, f: TrackFeature, halfW: number): void {
  const { q } = d.ctx;
  const fr = q.frameVis(f.s0);
  const c = new Vector3(), a = new Vector3(), n = new Vector3();
  for (let s = f.s0 + 8, k = 0; s < f.s1 - 6; s += 12, k++) {
    q.frameVis(s, fr);
    const yaw = Math.atan2(fr.tangent.x, fr.tangent.z);
    for (const side of [-1, 1] as const) {
      q.toWorld(s, side * (halfW - 0.08), 2.6, c);
      box(d.b.glow.at(c.x, c.z), trs(c.x, c.y, c.z, yaw, 0.14, 0.22, 0.7, m), LAMP);
      q.toWorld(s, side * (halfW - 0.03), 2.2, c);
      n.set(-fr.right.x * side, 0, -fr.right.z * side).normalize();
      pools.add(c, a.copy(fr.tangent).setY(0).normalize().multiplyScalar(2.8), UP.clone().multiplyScalar(1.5), n, WALL_GLOW);
      // Green emergency-exit boxes every fifth lamp, alternating walls.
      if (k % 5 === 2 && (k % 2 ? 1 : -1) === side) {
        q.toWorld(s + 3, side * (halfW - 0.08), 3.0, c);
        box(d.b.glow.at(c.x, c.z), trs(c.x, c.y, c.z, yaw, 0.12, 0.36, 0.9, m), EXIT);
      }
    }
  }
  // The meme sign: on the right wall at mid-tunnel, turned toward the riders.
  const sm = (f.s0 + f.s1) / 2;
  q.frameVis(sm, fr);
  q.toWorld(sm, halfW - 0.5, 2.1, c);
  n.set(-fr.right.x * 0.82 - fr.tangent.x * 0.57, 0, -fr.right.z * 0.82 - fr.tangent.z * 0.57).normalize();
  const rect = signFace(d, `pass:${MEME}`, () => passSignFace(d.atlas, MEME));
  if (rect) faceQuad(d.b.faces.at(c.x, c.z), c, Math.atan2(-n.x, -n.z), 2.2, 1.38, rect);
}

/** Carved stone plaque + two lamps over the portal at s (facing the riders who drive in). */
function plaque(d: Dress, s: number, len: number): void {
  const { q } = d.ctx;
  const fr = q.frameVis(s);
  const yaw = Math.atan2(fr.tangent.x, fr.tangent.z);
  const c = q.toWorld(s - 0.2, 0, CROWN + 1.75, new Vector3());
  box(d.b.props.at(c.x, c.z), trs(c.x, c.y, c.z, yaw, 6.2, 1.9, 0.3, m), STONE);
  const en = `SUNSET TUNNEL · ${Math.round(len)} m`;
  const rect = signFace(d, `plaque:${en}`, () => tunnelPlaqueFace(d.atlas, '落日隧道', en));
  q.toWorld(s - 0.4, 0, CROWN + 1.75, c);
  if (rect) faceQuad(d.b.faces.at(c.x, c.z), c, yaw, 5.8, 1.45, rect);
  for (const x of [-3.7, 3.7]) {
    q.toWorld(s - 0.45, x, CROWN + 1.75, c);
    box(d.b.glow.at(c.x, c.z), trs(c.x, c.y, c.z, yaw, 0.34, 0.5, 0.34, m), LAMP);
  }
}
