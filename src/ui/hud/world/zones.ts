// Screen rectangles of the static HUD modules that world-anchored overlays must keep clear of, plus the
// keep-clear area just above the road's vanishing point. Derived from the 1080p reference layout
// (css/base.css corners, place / progress / speedo / cluster / skills CSS) and k: nothing is measured.
import type { Rect } from './avoid';

const rect = (): Rect => ({ l: 0, r: 0, t: 0, b: 0 });
const set = (o: Rect, l: number, t: number, r: number, b: number): Rect => {
  o.l = l;
  o.t = t;
  o.r = r;
  o.b = b;
  return o;
};

/** Battle cluster box (css/cluster.css .cl) and its corner offsets (css/base.css .brh-corner.br). */
const CL_W = 720;
const CL_H = 380;
const CL_RIGHT = 30;
const CL_BOTTOM = 24;

export class HudZones {
  readonly place = rect();
  readonly progress = rect();
  readonly counters = rect();
  readonly speedo = rect();
  readonly cluster = rect();
  /** The cluster's bars, skill diamonds and weapon slot (everything but the portrait card). */
  readonly gauges = rect();
  /** Above the vanishing point (x 38–62 %, y 25–50 %): no tag plates or floating bubbles. */
  readonly centre = rect();
  /** Static modules as one list (obstacles for floating bubbles). */
  readonly fixed: readonly Rect[] = [this.place, this.progress, this.counters, this.speedo, this.cluster];
  private key = '';

  /** Recompute for this viewport (cheap no-op while the size is unchanged). */
  update(W: number, H: number, k: number): void {
    const key = `${W}x${H}@${k.toFixed(4)}`;
    if (key === this.key) return;
    this.key = key;
    // Place block 330×176 + timer row (+ ticket chip), top-left at (34k, 26k).
    set(this.place, 0, 0, (34 + 440) * k, (26 + 250) * k);
    // Progress strip: START label to the km readout, top 30k, 104 px tall (player badge + YOU tag).
    set(this.progress, W / 2 - 470 * k, 0, W / 2 + 570 * k, (30 + 112) * k);
    // KO / 小鱼干 counters, top-right at (34k, 30k).
    set(this.counters, W - (34 + 240) * k, 0, W, (30 + 120) * k);
    // Speedometer 300×300 + the BOOST / SLIPSTREAM tag column to its right (css/speedo.css .spd-tags).
    set(this.speedo, 0, H - (26 + 330) * k, (30 + 570) * k, H);
    const x0 = W - (CL_RIGHT + CL_W) * k;
    const y0 = H - (CL_BOTTOM + CL_H) * k;
    set(this.cluster, x0, y0, W, H);
    set(this.gauges, x0 + 40 * k, y0 + 80 * k, x0 + 492 * k, y0 + 370 * k);
    set(this.centre, W * 0.38, H * 0.25, W * 0.62, H * 0.5);
  }
}
