// Canvas textures for the city's road paint: sidewalk paving (kerb stone, tactile strip, slabs),
// zebra crossings, the scramble-crossing plaza pattern and the soft radial lamp pool.
import { CanvasTexture, ClampToEdgeWrapping, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace, type WebGLRenderer } from 'three';
import { Rng } from '../../../core/rng';

function tex(renderer: WebGLRenderer, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  if (!g) throw new Error('[track] 2D canvas unavailable');
  draw(g);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.minFilter = LinearMipmapLinearFilter;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return t;
}

/** Metres across the paving texture (u = metres from the asphalt edge / PAVE_W, clamped). */
export const PAVE_W = 5;
/** Metres along s per paving texture repeat. */
export const PAVE_L = 4;

/** Sidewalk: light kerb stone at the asphalt edge, gutter line, yellow tactile strip, square slabs. */
export function pavingTexture(renderer: WebGLRenderer): CanvasTexture {
  const PX = 64; // px per metre
  const t = tex(renderer, PAVE_W * PX, PAVE_L * PX, (g) => {
    const rng = new Rng(0x9a7e);
    g.fillStyle = '#8d8b96';
    g.fillRect(0, 0, PAVE_W * PX, PAVE_L * PX);
    for (let x = 0.6; x < PAVE_W; x += 0.5) {
      for (let y = 0; y < PAVE_L; y += 0.5) {
        const l = rng.range(-12, 12);
        g.fillStyle = `rgb(${141 + l},${139 + l},${150 + l})`;
        g.fillRect(x * PX + 1, y * PX + 1, 0.5 * PX - 2, 0.5 * PX - 2);
      }
    }
    g.fillStyle = '#c9c7cf';
    g.fillRect(0, 0, 0.26 * PX, PAVE_L * PX);
    g.fillStyle = '#3d3c46';
    g.fillRect(0.26 * PX, 0, 0.05 * PX, PAVE_L * PX);
    for (let y = 0; y < PAVE_L; y += 1) { g.fillStyle = '#9d9ba6'; g.fillRect(0, y * PX, 0.26 * PX, 2); }
    g.fillStyle = '#e8b51f';
    g.fillRect(0.75 * PX, 0, 0.3 * PX, PAVE_L * PX);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    for (let y = 4; y < PAVE_L * PX; y += 8) for (let x = 0.77 * PX; x < 1.04 * PX; x += 8) g.fillRect(x, y, 3, 3);
  });
  t.wrapS = ClampToEdgeWrapping;
  t.wrapT = RepeatWrapping;
  return t;
}

/** Zebra: white bars along the road, 0.5 m wide every 1 m across (u = metres / 14 across 14 m). */
export function zebraTexture(renderer: WebGLRenderer): CanvasTexture {
  return tex(renderer, 448, 64, (g) => {
    g.clearRect(0, 0, 448, 64);
    g.fillStyle = 'rgba(244,244,240,0.95)';
    for (let x = 0.25; x < 14; x += 1) g.fillRect(x * 32, 3, 16, 58);
  });
}

/** Scramble plaza (u across 2·half m, v along len m): crossings at both ends, two diagonals, stop lines. */
export function scrambleTexture(renderer: WebGLRenderer, half: number, len: number): CanvasTexture {
  const PX = 16;
  const W = Math.round(half * 2 * PX), H = Math.round(len * PX);
  return tex(renderer, W, H, (g) => {
    g.clearRect(0, 0, W, H);
    const bars = (x0: number, y0: number, x1: number, y1: number, width: number): void => {
      const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy);
      g.save();
      g.translate(x0 * PX, y0 * PX);
      g.rotate(Math.atan2(dy, dx));
      g.fillStyle = 'rgba(244,244,240,0.92)';
      for (let d = 0.4; d < L - 0.4; d += 1) g.fillRect(d * PX, (-width / 2) * PX, 0.5 * PX, width * PX);
      g.restore();
    };
    const w = half * 2;
    bars(0, 3, w, 3, 4);
    bars(0, len - 3, w, len - 3, 4);
    bars(1.5, 6, w - 1.5, len - 6, 3.6);
    bars(w - 1.5, 6, 1.5, len - 6, 3.6);
    g.fillStyle = 'rgba(244,244,240,0.92)';
    g.fillRect(0, 5.6 * PX, W, 0.35 * PX);
    g.fillRect(0, (len - 6) * PX, W, 0.35 * PX);
  });
}

/** Soft lamp pool: radial falloff with a brighter core (white; tinted by vertex colour). */
export function poolTexture(renderer: WebGLRenderer): CanvasTexture {
  return tex(renderer, 128, 128, (g) => {
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    grd.addColorStop(0.6, 'rgba(255,255,255,0.16)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
  });
}
