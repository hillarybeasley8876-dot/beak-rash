// Canvas textures for the city's civil structures: retaining-wall concrete panels (joints, tone
// variation, rain stains, bolt heads) and the tunnel's glazed wall tiles.
import { CanvasTexture, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace, type WebGLRenderer } from 'three';
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
  t.wrapS = t.wrapT = RepeatWrapping;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return t;
}

/** Metres covered by one repeat of the concrete texture (both directions). */
export const CONCRETE_M = 4;

/** Precast concrete panels 2 m × 2 m: tone per panel, dark joints, rain stains from the top, bolts. */
export function concreteTexture(renderer: WebGLRenderer): CanvasTexture {
  const PX = 64, S = CONCRETE_M * PX;
  return tex(renderer, S, S, (g) => {
    const rng = new Rng(0xc0c2);
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        const l = rng.range(-10, 10);
        g.fillStyle = `rgb(${150 + l},${147 + l},${162 + l})`;
        g.fillRect(i * 2 * PX, j * 2 * PX, 2 * PX, 2 * PX);
        for (let k = 0; k < 6; k++) {
          const x = i * 2 * PX + rng.range(8, 2 * PX - 8), w = rng.range(3, 9), h = rng.range(20, 90);
          g.fillStyle = `rgba(40,36,60,${rng.range(0.08, 0.2).toFixed(2)})`;
          g.fillRect(x, j * 2 * PX + 4, w, h);
        }
        g.fillStyle = 'rgba(30,28,40,0.55)';
        for (const [bx, by] of [[0.25, 0.25], [1.75, 0.25], [0.25, 1.75], [1.75, 1.75]] as Array<[number, number]>) {
          g.beginPath();
          g.arc((i * 2 + bx) * PX, (j * 2 + by) * PX, 3, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
    g.fillStyle = '#3a3846';
    for (let k = 0; k < 2; k++) {
      g.fillRect(k * 2 * PX, 0, 3, S);
      g.fillRect(0, k * 2 * PX, S, 3);
    }
  });
}

/** Metres covered by one repeat of the tile texture (both directions). */
export const TILE_M = 2;

/** Glazed 0.25 m wall tiles (cream with a cool sheen, slight tone noise) and dark grout. */
export function tileTexture(renderer: WebGLRenderer): CanvasTexture {
  const PX = 128, S = TILE_M * PX, T = 0.25 * PX;
  return tex(renderer, S, S, (g) => {
    const rng = new Rng(0x711e);
    g.fillStyle = '#4a4656';
    g.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y += T) {
      for (let x = 0; x < S; x += T) {
        const l = rng.range(-8, 8);
        g.fillStyle = `rgb(${226 + l},${222 + l},${232 + l})`;
        g.fillRect(x + 2, y + 2, T - 4, T - 4);
        g.fillStyle = 'rgba(255,255,255,0.35)';
        g.fillRect(x + 4, y + 4, T - 12, 3);
      }
    }
  });
}
