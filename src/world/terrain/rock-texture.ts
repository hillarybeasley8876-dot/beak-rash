// Light-neutral limestone texture for steep rock faces (multiplied with the terrain vertex colour):
// horizontal strata bands split into angular blocks by slanted fractures, each block with its own
// tone, a sunlit top ledge, a shaded underside and a lighter facet. Tiles seamlessly; one tile covers
// ROCK_TILE_M metres of face (terrain/material.ts projects it in world space).
import { CanvasTexture, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace, type WebGLRenderer } from 'three';
import { Rng } from '../../core/rng';

export const ROCK_TILE_M = 18;
const S = 512;

type Ctx2D = CanvasRenderingContext2D;

const grey = (l: number, a = 1): string => {
  const v = (k: number): number => Math.max(0, Math.min(255, Math.round(k * l)));
  return `rgba(${v(240)},${v(234)},${v(224)},${a})`;
};

/** One block: a quad between two slanted fractures, drawn at x and x − S so it wraps. */
function block(g: Ctx2D, rng: Rng, xa: number, xb: number, y0: number, y1: number, slantA: number, slantB: number): void {
  const tone = rng.range(0.84, 1.04);
  for (const off of [0, -S]) {
    const ax = xa + off, bx = xb + off;
    if (bx + Math.abs(slantB) < 0 || ax - Math.abs(slantA) > S) continue;
    const quad = (): void => {
      g.beginPath();
      g.moveTo(ax + slantA, y0); g.lineTo(bx + slantB, y0); g.lineTo(bx - slantB, y1); g.lineTo(ax - slantA, y1);
      g.closePath();
    };
    quad();
    g.fillStyle = grey(tone);
    g.fill();
    // Lighter facet: a triangle from the top-left corner (an angular plane catching the sun).
    g.beginPath();
    g.moveTo(ax + slantA, y0); g.lineTo(ax + (bx - ax) * rng.range(0.45, 0.8), y0); g.lineTo(ax - slantA, y0 + (y1 - y0) * rng.range(0.5, 0.9));
    g.closePath();
    g.fillStyle = grey(tone + 0.06, 0.8);
    g.fill();
    // Sunlit ledge on top, an occlusion gradient under each block, dark fracture joints.
    g.fillStyle = grey(1.08, 0.9);
    g.fillRect(ax + slantA, y0, bx - ax, 3);
    const ao = g.createLinearGradient(0, y1 - 11, 0, y1);
    ao.addColorStop(0, 'rgba(70,52,36,0)');
    ao.addColorStop(1, 'rgba(62,46,32,0.55)');
    g.fillStyle = ao;
    g.fillRect(ax - slantA, y1 - 11, bx - ax, 11);
    quad();
    g.strokeStyle = 'rgba(52,38,26,0.58)';
    g.lineWidth = 2.8;
    g.stroke();
  }
}

export function rockTexture(renderer: WebGLRenderer): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  if (!g) throw new Error('[track] 2D canvas unavailable');
  const rng = new Rng(0x57a7a);
  g.fillStyle = grey(0.95);
  g.fillRect(0, 0, S, S);
  let y = 0;
  while (y < S) {
    const left = S - y;
    const h = left < 120 ? left : rng.range(44, 110);
    let x = rng.range(0, 80), slant = rng.range(-14, 14);
    const x0 = x, s0 = slant;
    while (x < x0 + S - 1) {
      const w = Math.min(x0 + S - x, rng.range(70, 210));
      // The band's last fracture is its first one (shifted by S), so the tile wraps.
      const next = x + w >= x0 + S - 1 ? s0 : rng.range(-14, 14);
      block(g, rng, x, x + w, y, y + h, slant, next);
      x += w;
      slant = next;
    }
    y += h;
  }
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.minFilter = LinearMipmapLinearFilter;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  t.colorSpace = SRGBColorSpace;
  return t;
}
