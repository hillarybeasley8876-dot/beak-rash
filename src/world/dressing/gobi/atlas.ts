// The gobi's sign atlas: a SignAtlas that paints every face the moment it is created (the shared
// deferred atlas paints them all in one flush at the end, which is one long task on a track with this
// many billboards) and can redraw them all when the fonts arrive late.
import { SignAtlas } from '../../scenery/signs/atlas';

type Draw = Parameters<SignAtlas['paint']>[4];

export class GobiAtlas extends SignAtlas {
  private readonly drawn: Array<{ x: number; y: number; w: number; h: number; draw: Draw }> = [];

  override paint(x: number, y: number, w: number, h: number, draw: Draw): void {
    this.drawn.push({ x, y, w, h, draw });
    super.paint(x, y, w, h, draw);
  }

  /** Repaint every face (the fonts were late; the faces fell back to a system font). */
  repaintAll(): void {
    for (const j of this.drawn) this.redrawCell(j.x, j.y, j.w, j.h, j.draw);
  }
}
