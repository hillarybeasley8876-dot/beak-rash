// Canvas-generated road textures (no files): asphalt with lane markings, a neutral grain for verges,
// and the chequered start/finish strip. All tile along s; colour space sRGB; mipmaps + anisotropy.
import { CanvasTexture, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace, type WebGLRenderer } from 'three';
import { Rng } from '../../core/rng';

/** Along-track period of the asphalt texture (one dash + gap). */
export const ROAD_PERIOD = 12;
const DASH = 4.5;

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  if (!g) throw new Error('[track] 2D canvas unavailable');
  return [c, g];
}

function finish(c: HTMLCanvasElement, renderer: WebGLRenderer, srgb = true): CanvasTexture {
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.minFilter = LinearMipmapLinearFilter;
  t.anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy());
  if (srgb) t.colorSpace = SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

/** Speckle grain: `n` dots of random size and lightness around the base colour. */
function speckle(g: CanvasRenderingContext2D, w: number, h: number, rng: Rng, n: number, spread: number): void {
  for (let i = 0; i < n; i++) {
    const l = rng.range(-spread, spread);
    g.fillStyle = l > 0 ? `rgba(255,255,255,${l})` : `rgba(0,0,0,${-l})`;
    const r = rng.range(0.6, 2.2);
    g.fillRect(rng.range(0, w), rng.range(0, h), r, r);
  }
}

/**
 * Asphalt across the full road width (u: −hw..+hw → 0..1), one dash period along v, on the track's base
 * colour (looks.ts RoadLook). Edge lines, white lane dashes at ±hw/2 and a double yellow centre line.
 */
export function asphaltTexture(renderer: WebGLRenderer, halfWidth: number, base: string): CanvasTexture {
  const W = 512, H = 512;
  const [c, g] = canvas(W, H);
  const rng = new Rng(0xa5fa17);
  const pxPerM = W / (halfWidth * 2);
  const X = (m: number): number => (m + halfWidth) * pxPerM;
  g.fillStyle = base;
  g.fillRect(0, 0, W, H);
  // Worn wheel tracks: slightly darker bands in every lane.
  for (const lane of [-5.25, -1.75, 1.75, 5.25]) {
    for (const off of [-0.75, 0.75]) {
      g.fillStyle = 'rgba(30,32,40,0.14)';
      g.fillRect(X(lane + off - 0.35), 0, 0.7 * pxPerM, H);
    }
  }
  speckle(g, W, H, rng, 9000, 0.09);
  // Patch repairs with tar-sealed seams, and a few sealed cracks running along the road.
  for (let i = 0; i < 7; i++) {
    const x = rng.range(0, W - 90), y = rng.range(0, H - 70), w = rng.range(30, 90), h = rng.range(20, 70);
    g.fillStyle = 'rgba(40,42,50,0.09)';
    g.fillRect(x, y, w, h);
    g.strokeStyle = 'rgba(20,20,26,0.2)';
    g.lineWidth = 2;
    g.strokeRect(x, y, w, h);
  }
  g.strokeStyle = 'rgba(18,18,24,0.3)';
  for (let i = 0; i < 6; i++) {
    g.lineWidth = rng.range(1.2, 2.2);
    let x = rng.range(20, W - 20), y = rng.range(0, H * 0.6);
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 6; k++) { x += rng.range(-10, 10); y += rng.range(12, 26); g.lineTo(x, y); }
    g.stroke();
  }
  const line = (m: number, wM: number, color: string, y0 = 0, y1 = H): void => {
    g.fillStyle = color;
    g.fillRect(X(m) - (wM * pxPerM) / 2, y0, wM * pxPerM, y1 - y0);
  };
  const white = '#f4f4ef', yellow = '#ffd21f';
  line(-halfWidth + 0.35, 0.22, white);
  line(halfWidth - 0.35, 0.22, white);
  line(-0.14, 0.13, yellow);
  line(0.14, 0.13, yellow);
  const dashPx = (DASH / ROAD_PERIOD) * H;
  for (const m of [-halfWidth / 2, halfWidth / 2]) line(m, 0.16, white, 0, dashPx);
  // Paint wear on the markings.
  speckle(g, W, H, rng, 1400, 0.12);
  return finish(c, renderer);
}

/** Neutral grain (~mid grey, multiplied with vertex colours) for verges and shoulders. */
export function grainTexture(renderer: WebGLRenderer): CanvasTexture {
  const S = 256;
  const [c, g] = canvas(S, S);
  const rng = new Rng(0x6a17);
  g.fillStyle = '#e6e6e6';
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 420; i++) {
    const l = rng.range(0.03, 0.09);
    g.fillStyle = rng.chance(0.5) ? `rgba(255,255,255,${l})` : `rgba(0,0,0,${l})`;
    g.beginPath();
    g.ellipse(rng.range(0, S), rng.range(0, S), rng.range(3, 14), rng.range(2, 9), rng.range(0, Math.PI), 0, Math.PI * 2);
    g.fill();
  }
  speckle(g, S, S, rng, 3000, 0.06);
  return finish(c, renderer);
}

/** Chequered strip, `cols` squares across, two rows. */
export function checkerTexture(renderer: WebGLRenderer, cols: number): CanvasTexture {
  const cell = 32;
  const [c, g] = canvas(cols * cell, cell * 2);
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < 2; j++) {
      g.fillStyle = (i + j) % 2 === 0 ? '#111114' : '#f6f6f2';
      g.fillRect(i * cell, j * cell, cell, cell);
    }
  }
  const t = finish(c, renderer);
  t.wrapS = t.wrapT = RepeatWrapping;
  return t;
}
