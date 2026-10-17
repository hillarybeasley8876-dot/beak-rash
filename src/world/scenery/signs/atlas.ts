// One canvas atlas for every sign face on the track (billboards, road signs, banners, markers),
// so all signage renders with a single texture and material. Shelf packing, 2048².
import { CanvasTexture, LinearMipmapLinearFilter, SRGBColorSpace, type WebGLRenderer } from 'three';

export interface AtlasRect { u0: number; v0: number; u1: number; v1: number }

export class SignAtlas {
  readonly canvas: HTMLCanvasElement;
  readonly g: CanvasRenderingContext2D;
  /** Shelves of similar-height cells (best fit keeps mixed sizes from wasting rows). */
  private readonly shelves: Array<{ y: number; h: number; x: number }> = [];
  private nextY = 0;

  constructor(readonly size = 2048, readonly height = 2048) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = size;
    this.canvas.height = height;
    const g = this.canvas.getContext('2d');
    if (!g) throw new Error('[track] 2D canvas unavailable');
    this.g = g;
  }

  /** Reserve a w × h pixel cell; returns its pixel origin and UV rect (null when full). */
  alloc(w: number, h: number): { x: number; y: number; rect: AtlasRect } | null {
    const pad = 4;
    let shelf = this.shelves.find((s) => s.h >= h && s.h <= h * 1.25 && s.x + w <= this.size);
    if (!shelf) {
      if (this.nextY + h > this.height) return null;
      shelf = { y: this.nextY, h, x: 0 };
      this.shelves.push(shelf);
      this.nextY += h + pad;
    }
    const x = shelf.x, y = shelf.y;
    shelf.x += w + pad;
    const W = this.size, H = this.height;
    // Inset one texel so mipmaps do not bleed neighbours in.
    return { x, y, rect: { u0: (x + 1) / W, u1: (x + w - 1) / W, v0: 1 - (y + h - 1) / H, v1: 1 - (y + 1) / H } };
  }

  texture(renderer: WebGLRenderer): CanvasTexture {
    const t = new CanvasTexture(this.canvas);
    t.colorSpace = SRGBColorSpace;
    t.minFilter = LinearMipmapLinearFilter;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return t;
  }
}
