// 青石板 flagstone paving for the water town's lanes: blue-grey slabs laid in courses across the
// whole width of the lane, dark joints between them and a gentle colour variation from slab to
// slab (toon, not photo). A line of smaller, darker drain stones runs down the middle of the lane.
// No paint of any kind.
// The texture tiles every FLAGSTONE_PERIOD metres along the road; across the road it is drawn once,
// so the courses line up with the slab edges and the lane has no tiling seam.
import { CanvasTexture, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace, type WebGLRenderer } from 'three';
import { Rng } from '../../core/rng';

/** Along-track period of the paving texture (m): an integer number of courses, so it tiles. */
export const FLAGSTONE_PERIOD = 24;

/** The paving's own numbers (metres, unless the name says so). */
const TUNE = {
  course: 0.75,   // the height of a course (a row of slabs)
  joint: 0.03,    // the dark gap between the slabs
  pxPerM: 64,     // the texture's resolution
  slabs: [1.2, 1.5, 1.8, 2.1, 2.4],  // the slab lengths across the lane
  drainHalf: 0.2, // the half width of the drain line down the middle
  drainLen: 0.4,  // the length of one drain stone
  hue: 206, hueSpread: 9,  // the blue-grey of the stone
  sat: [7, 14],    // %
  light: [57, 67], // %
  jointColor: '#161b21',
  wornChance: 0.3, // the chance of a worn, darker slab
  wornDrop: 8,     // how much darker a worn slab is (%)
  edgeLight: 9,    // the lit chamfer along a slab's upper edge (%)
};

const C = (h: number, s: number, l: number): string => `hsl(${h.toFixed(0)} ${s.toFixed(0)}% ${l.toFixed(0)}%)`;

/** A slab's own colour: blue-grey, a little lighter or darker than its neighbours. */
function slabColor(rng: Rng, worn: boolean): string {
  const l = rng.range(TUNE.light[0], TUNE.light[1]) - (worn ? TUNE.wornDrop : 0);
  return C(TUNE.hue + rng.range(-TUNE.hueSpread, TUNE.hueSpread), rng.range(TUNE.sat[0], TUNE.sat[1]), l);
}

/**
 * The flagstone paving of a lane `halfWidth` m wide: courses of slabs across the whole lane, dark
 * joints, a lit chamfer on every slab and a drain line down the middle.
 */
export function flagstoneTexture(renderer: WebGLRenderer, halfWidth: number): CanvasTexture {
  const PX = TUNE.pxPerM;
  const W = Math.round(halfWidth * 2 * PX);
  const H = Math.round(FLAGSTONE_PERIOD * PX);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  if (!g) throw new Error('[track] 2D canvas unavailable');
  const rng = new Rng(0x51a60e);
  const X = (m: number): number => (m + halfWidth) * PX;
  const Y = (m: number): number => m * PX;
  const jPx = TUNE.joint * PX;
  // The joints: the dark gaps the slabs leave between them.
  g.fillStyle = TUNE.jointColor;
  g.fillRect(0, 0, W, H);
  for (let cy = 0; cy < FLAGSTONE_PERIOD; cy += TUNE.course) {
    // Courses are staggered, the way a mason lays them: the first slab of a course starts off the
    // lane's edge, so no two courses line up.
    let x = -halfWidth - rng.range(0, 2.4);
    while (x < halfWidth) {
      const len = rng.pick(TUNE.slabs);
      const worn = rng.chance(TUNE.wornChance);
      const x0 = X(x) + jPx / 2;
      const y0 = Y(cy) + jPx / 2;
      const w = Math.max(1, (len - TUNE.joint) * PX);
      const h = Math.max(1, (TUNE.course - TUNE.joint) * PX);
      g.fillStyle = slabColor(rng, worn);
      g.fillRect(x0, y0, w, h);
      // The lit top edge of the slab, so the courses read as separate stones.
      g.fillStyle = `rgba(255,255,255,${(TUNE.edgeLight / 100).toFixed(3)})`;
      g.fillRect(x0, y0, w, Math.max(1, 0.04 * PX));
      g.fillStyle = 'rgba(0,0,0,0.16)';
      g.fillRect(x0, y0 + h - Math.max(1, 0.04 * PX), w, Math.max(1, 0.04 * PX));
      // A few worn patches on the stone.
      if (rng.chance(0.35)) {
        g.fillStyle = `rgba(214,212,202,${rng.range(0.05, 0.12).toFixed(3)})`;
        g.fillRect(x0 + rng.range(0, w * 0.6), y0 + rng.range(0, h * 0.6), rng.range(w * 0.1, w * 0.4), rng.range(h * 0.15, h * 0.5));
      }
      x += len;
    }
  }
  // The drain line: smaller, darker stones set down the middle of the lane.
  for (let cy = 0; cy < FLAGSTONE_PERIOD; cy += TUNE.course) {
    for (let dx = -TUNE.drainHalf; dx < TUNE.drainHalf - 0.01; dx += TUNE.drainLen) {
      g.fillStyle = C(TUNE.hue, 8, rng.range(44, 51));
      g.fillRect(X(dx) + jPx / 2, Y(cy) + jPx / 2, (TUNE.drainLen - TUNE.joint) * PX, (TUNE.course - TUNE.joint) * PX);
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
