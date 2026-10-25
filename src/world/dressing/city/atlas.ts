// Deferred sign atlas that paints in slices. The city's three atlases hold ~700 faces, and painting one
// in a single flush() is a 70–125 ms task that freezes the loading screen; this one records cells like
// SignAtlas's deferred mode and paints them with a yield to the browser whenever a slice ran long.
import { breathe } from '../../breathe';
import { SignAtlas } from '../../scenery/signs/atlas';

type Draw = Parameters<SignAtlas['paint']>[4];
interface Cell { x: number; y: number; w: number; h: number; draw: Draw }

export class SlicedAtlas extends SignAtlas {
  private readonly cells: Cell[] = [];
  private painted = false;

  constructor(size = 2048, height = 2048) {
    // The base atlas would paint immediately; cells are recorded here until flushSliced().
    super(size, height, false);
  }

  /** Record a cell (painted by flushSliced), or paint it right away once the atlas was flushed. */
  override paint(x: number, y: number, w: number, h: number, draw: Draw): void {
    const cell = { x, y, w, h, draw };
    this.cells.push(cell);
    if (this.painted) this.paintCell(cell);
  }

  /** Paint every recorded cell once, yielding whenever a run of cells took longer than `sliceMs`. */
  async flushSliced(sliceMs = 30): Promise<void> {
    if (this.painted) return;
    this.painted = true;
    let t0 = performance.now();
    for (const cell of this.cells) {
      this.paintCell(cell);
      if (performance.now() - t0 > sliceMs) {
        await breathe();
        t0 = performance.now();
      }
    }
  }

  /** SignAtlas API: everything in one go. */
  override flush(): void {
    void this.flushSliced(Infinity);
  }

  /** Clear and paint every recorded cell again (fonts that arrived late). */
  override repaint(): void {
    for (const cell of this.cells) {
      this.g.clearRect(cell.x, cell.y, cell.w, cell.h);
      this.paintCell(cell);
    }
  }

  private paintCell({ x, y, w, h, draw }: Cell): void {
    const g = this.g;
    g.save();
    g.translate(x, y);
    g.beginPath();
    g.rect(0, 0, w, h);
    g.clip();
    draw(g, w, h);
    g.restore();
  }
}
