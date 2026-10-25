// One canvas atlas for every sign face on the track (billboards, road signs, banners, markers),
// so all signage renders with a single texture and material. Shelf packing, 2048 wide. A cell can be
// drawn again later (redrawCell: billboard art that landed late) and the atlas textures re-upload.
import { CanvasTexture, LinearMipmapLinearFilter, SRGBColorSpace, type WebGLRenderer } from 'three';

export interface AtlasRect { u0: number; v0: number; u1: number; v1: number }
type Draw = (g: CanvasRenderingContext2D, w: number, h: number) => void;
interface PaintJob { x: number; y: number; w: number; h: number; draw: Draw }
/** Cells drawn again (late art) upload together, this long after the last one (ms). */
const UPLOAD_DEBOUNCE = 150;

export class SignAtlas {
  readonly canvas: HTMLCanvasElement;
  readonly g: CanvasRenderingContext2D;
  /** Shelves of similar-height cells (best fit keeps mixed sizes from wasting rows). */
  private readonly shelves: Array<{ y: number; h: number; x: number }> = [];
  private nextY = 0;
  /** Deferred atlases record their cells and paint them on flush() (once the fonts are in). */
  private readonly jobs: PaintJob[] = [];
  private flushed = false;
  /** Textures made from this atlas that are still alive (redrawCell flags them), and how many were made. */
  private readonly textures = new Set<CanvasTexture>();
  private made = 0;
  private uploadTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(readonly size = 2048, readonly height = 2048, readonly deferred = false) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = size;
    this.canvas.height = height;
    const g = this.canvas.getContext('2d');
    if (!g) throw new Error('[track] 2D canvas unavailable');
    this.g = g;
  }

  /** Height of the atlas used by shelves so far (px). */
  get usedHeight(): number {
    return this.nextY;
  }

  /**
   * Reserve a w × h pixel cell; returns its pixel origin, the width granted and its UV rect (null
   * when full). Cells that tile the atlas width exactly (512, 1024…) give up the 4 px gutter, so
   * e.g. two 1024 faces or four 512 posters share one shelf.
   */
  alloc(w: number, h: number): { x: number; y: number; w: number; rect: AtlasRect } | null {
    const pad = 4;
    const cw = w < this.size && this.size % w === 0 ? w - pad : w;
    let shelf = this.shelves.find((s) => s.h >= h && s.h <= h * 1.25 && s.x + cw <= this.size);
    if (!shelf) {
      if (this.nextY + h > this.height) return null;
      shelf = { y: this.nextY, h, x: 0 };
      this.shelves.push(shelf);
      this.nextY += h + pad;
    }
    const x = shelf.x, y = shelf.y;
    shelf.x += cw + pad;
    const W = this.size, H = this.height;
    // Inset one texel so mipmaps do not bleed neighbours in.
    return { x, y, w: cw, rect: { u0: (x + 1) / W, u1: (x + cw - 1) / W, v0: 1 - (y + h - 1) / H, v1: 1 - (y + 1) / H } };
  }

  /** Paint a cell now, or (deferred atlas, before flush) record it for flush(). */
  paint(x: number, y: number, w: number, h: number, draw: Draw): void {
    const job = { x, y, w, h, draw };
    if (this.deferred) this.jobs.push(job);
    if (!this.deferred || this.flushed) this.run(job);
  }

  /** Clear and draw one cell again (billboard art that landed late), then re-upload the atlas textures. Skipped
   *  before a deferred atlas's flush (the flush paints the current state) and once every texture made from
   *  the atlas is disposed (the track is gone). */
  redrawCell(x: number, y: number, w: number, h: number, draw: Draw): void {
    if ((this.deferred && !this.flushed) || (this.made > 0 && !this.textures.size)) return;
    const job = { x, y, w, h, draw };
    this.g.clearRect(x, y, w, h);
    this.run(job);
    if (this.uploadTimer !== null) clearTimeout(this.uploadTimer);
    this.uploadTimer = setTimeout(() => {
      this.uploadTimer = null;
      for (const t of this.textures) t.needsUpdate = true;
      console.info('[track] sign atlas repainted: late billboard art landed');
    }, UPLOAD_DEBOUNCE);
  }

  /** Deferred atlas: paint every recorded cell (once). */
  flush(): void {
    if (this.flushed) return;
    this.flushed = true;
    for (const job of this.jobs) this.run(job);
  }

  /** Deferred atlas: clear and paint every recorded cell again (fonts that arrived late). */
  repaint(): void {
    for (const job of this.jobs) {
      this.g.clearRect(job.x, job.y, job.w, job.h);
      this.run(job);
    }
  }

  private run({ x, y, w, h, draw }: PaintJob): void {
    const g = this.g;
    g.save();
    g.translate(x, y);
    g.beginPath();
    g.rect(0, 0, w, h);
    g.clip();
    draw(g, w, h);
    g.restore();
  }

  texture(renderer: WebGLRenderer): CanvasTexture {
    const t = new CanvasTexture(this.canvas);
    t.colorSpace = SRGBColorSpace;
    t.minFilter = LinearMipmapLinearFilter;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    this.textures.add(t);
    this.made++;
    t.addEventListener('dispose', () => this.textures.delete(t));
    return t;
  }
}
