// Granite setts: the water town's shoulders are stone, not dirt. A pavement of small grey blocks
// with dark joints, laid in courses and tinted from stone to stone (toon, not photo). The texture
// covers SIDE_PERIOD metres in each direction, so the shoulder mesh's own u = x/4, v = s/4 mapping
// lines the setts up with the world.
import { CanvasTexture, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace, type WebGLRenderer } from 'three';
import { Rng } from '../../core/rng';

/** The metres one tile of the sett paving covers. */
export const SETT_PERIOD = 4;

/** The paving's own numbers (metres, unless the name says so). */
const TUNE = {
  course: 0.25,  // the height of a course of setts
  joint: 0.025,  // the dark gap between the setts
  pxPerM: 64,    // the texture's resolution
  sett: [0.28, 0.34, 0.4, 0.46],  // the sett lengths along a course
  hue: 205, hueSpread: 6,
  sat: [3, 8],
  light: [56, 66],
  jointColor: '#2b3138',
};

const C = (h: number, s: number, l: number): string => `hsl(${h.toFixed(0)} ${s.toFixed(0)}% ${l.toFixed(0)}%)`;

/** The granite sett pavement: a tile of small grey blocks with dark joints. */
export function settTexture(renderer: WebGLRenderer): CanvasTexture {
  const PX = TUNE.pxPerM;
  const S = Math.round(SETT_PERIOD * PX);
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const g = c.getContext('2d');
  if (!g) throw new Error('[track] 2D canvas unavailable');
  const rng = new Rng(0x5e77a1);
  const jPx = TUNE.joint * PX;
  g.fillStyle = TUNE.jointColor;
  g.fillRect(0, 0, S, S);
  for (let cy = 0; cy < SETT_PERIOD; cy += TUNE.course) {
    // The courses are staggered, so the joints zig-zag like a real sett pavement.
    let x = -rng.range(0, 0.46);
    while (x < SETT_PERIOD) {
      const len = rng.pick(TUNE.sett);
      const l = rng.range(TUNE.light[0], TUNE.light[1]);
      const h = TUNE.hue + rng.range(-TUNE.hueSpread, TUNE.hueSpread);
      g.fillStyle = C(h, rng.range(TUNE.sat[0], TUNE.sat[1]), l);
      g.fillRect(x * PX + jPx / 2, cy * PX + jPx / 2, Math.max(1, (len - TUNE.joint) * PX), Math.max(1, (TUNE.course - TUNE.joint) * PX));
      // The lit chamfer along the sett's upper edge and the shade under it.
      g.fillStyle = 'rgba(255,255,255,0.10)';
      g.fillRect(x * PX + jPx / 2, cy * PX + jPx / 2, Math.max(1, (len - TUNE.joint) * PX), Math.max(1, 0.03 * PX));
      g.fillStyle = 'rgba(0,0,0,0.14)';
      g.fillRect(x * PX + jPx / 2, cy * PX + TUNE.course * PX - jPx / 2 - Math.max(1, 0.03 * PX), Math.max(1, (len - TUNE.joint) * PX), Math.max(1, 0.03 * PX));
      x += len;
    }
  }
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.minFilter = LinearMipmapLinearFilter;
  t.anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy());
  t.colorSpace = SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}
