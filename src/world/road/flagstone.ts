// 青石板 flagstone paving for the water town's lanes: blue-grey slabs laid in courses along the road,
// dark joints between them and a gentle colour variation from slab to slab (toon, not photo). A
// line of smaller, darker drain stones runs down the middle of the lane. No paint of any kind.
// The texture tiles every FLAGSTONE_PERIOD metres along the road; across the road it is drawn once.
import { CanvasTexture, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace, type WebGLRenderer } from 'three';
import { Rng } from '../../core/rng';

/** Along-track period of the paving texture (m): an integer number of courses, so it tiles. */
export const FLAGSTONE_PERIOD = 12;
/** The course (row of slabs) height in metres. */
const COURSE = 0.75;
/** The joint width in metres. */
const JOINT = 0.05;
/** The drain stones down the middle: half width and the stone length (m). */
const DRAIN_W = 0.5, DRAIN_LEN = 0.5;

const C = (h: number, s: number, l: number): string => `hsl(${h.toFixed(0)} ${s.toFixed(0)}% ${l.toFixed(0)}%)`;

/** A slab's own colour: blue-grey, a little lighter or darker than the last one. */
function slabColor(rng: Rng): string {
  return C(205 + rng.range(-9, 9), rng.range(6, 13), rng.range(40, 50));
}

/**
 * The flagstone paving of a lane `halfWidth` m wide: courses of slabs, dark joints, a drain line.
 */
export function flagstoneTexture(renderer: WebGLRenderer, halfWidth: number): CanvasTexture {
  const W = 512, H = 512;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  if (!g) throw new Error('[track] 2D canvas unavailable');
  const rng = new Rng(0x51a60e);
  const pxPerM = W / (halfWidth * 2);
  const pyPerM = H / FLAGSTONE_PERIOD;
  const X = (m: number): number => (m + halfWidth) * pxPerM;
  const Y = (m: number): number => m * pyPerM;
  // The joints: the dark gaps the slabs leave between them.
  g.fillStyle = '#3b434e';
  g.fillRect(0, 0, W, H);
  // A worn, slightly warmer track down the middle of the lane.
  const wear = g.createLinearGradient(X(-1.6), 0, X(1.6), 0);
  wear.addColorStop(0, 'rgba(190,180,160,0)');
  wear.addColorStop(0.5, 'rgba(190,180,160,0.10)');
  wear.addColorStop(1, 'rgba(190,180,160,0)');
  g.fillStyle = wear;
  g.fillRect(X(-1.6), 0, X(1.6) - X(-1.6), H);
  for (let cy = 0; cy < FLAGSTONE_PERIOD; cy += COURSE) {
    // Courses are staggered by half a slab, the way a mason lays them.
    let x = -rng.range(0, 1.5);
    while (x < halfWidth * 2) {
      const len = rng.pick([1.5, 1.5, 2.25, 3]);
      const drain = x + len > -DRAIN_W && x < DRAIN_W;
      if (!drain) {
        const col = slabColor(rng);
        const x0 = X(x + JOINT / 2), w = Math.max(1, (len - JOINT) * pxPerM);
        const y0 = Y(cy + JOINT / 2), h = Math.max(1, (COURSE - JOINT) * pyPerM);
        g.fillStyle = col;
        g.fillRect(x0, y0, w, h);
        // The lit top edge of the slab, so the courses read as separate stones.
        g.fillStyle = 'rgba(255,255,255,0.10)';
        g.fillRect(x0, y0, w, Math.max(1, 0.05 * pyPerM));
        g.fillStyle = 'rgba(0,0,0,0.10)';
        g.fillRect(x0, y0 + h - Math.max(1, 0.05 * pyPerM), w, Math.max(1, 0.05 * pyPerM));
        // A few worn patches on the stone.
        if (rng.chance(0.3)) {
          g.fillStyle = `rgba(210,205,190,${rng.range(0.05, 0.13).toFixed(3)})`;
          g.fillRect(x0 + rng.range(0, w * 0.6), y0 + rng.range(0, h * 0.6), rng.range(w * 0.1, w * 0.4), rng.range(h * 0.15, h * 0.5));
        }
      }
      x += len;
    }
    // The drain stones: smaller, darker, set in the middle of the lane.
    for (let dx = -DRAIN_W; dx < DRAIN_W - 0.01; dx += DRAIN_LEN) {
      g.fillStyle = C(206, 8, rng.range(31, 37));
      g.fillRect(X(dx + JOINT / 2), Y(cy + JOINT / 2), Math.max(1, (DRAIN_LEN - JOINT) * pxPerM), Math.max(1, (COURSE - JOINT) * pyPerM));
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
