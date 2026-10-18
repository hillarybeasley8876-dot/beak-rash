// Taunt speech bubbles (P5 jagged, `taunt` events from rivals; the player's own lines go to the quip).
// One layout pass per frame: a bubble sits above its speaker's drawn name tag (or head) and settles
// clear of tags, other bubbles, the static HUD modules, the quip and the chip column, nearest speaker
// first; at most two float at once (later lines wait briefly, nearest first). Speakers off screen or
// inside the keep-clear area above the vanishing point get a bubble docked at their screen side with
// the speaker's name, stacked per side above the corner modules (and above the quip on the right).
import { Vector3 } from 'three';
import { clamp01, damp } from '../../../core/math';
import { ROSTER } from '../../../data/roster';
import type { Session } from '../../../core/contracts';
import type { RiderId } from '../../../core/types';
import { slam } from '../anim';
import { el, px, w, type W } from '../dom';
import { boxAt, overlaps, settle, type Bounds, type Rect } from './avoid';
import { newPoint, type Projector, type ScreenPoint } from './project';
import type { TagBox } from './tags';
import type { HudZones } from './zones';

const LIFE = 2.6;
const FADE = 0.25;
const POOL = 4;
const MAX_FLOAT = 2;   // bubbles over the road at once
const MAX_WAIT = 2;    // s a queued line may wait for a free slot before it is dropped
const MIN_READ = 1.3;  // s a floating line stays up before a queued one may hurry it out
const TAIL = 20;       // px (1080p) the tail hangs below the box
const WHO = 16;        // px the speaker label pokes out above the box
const PAD = 6;
const GAP = 14;
const DOCK_BASE = 430; // px above the bottom edge where docked stacks start (over the corner modules)
const FALLBACK_W = 280;
const FALLBACK_H = 64;

type State = 'off' | 'wait' | 'on';

interface Bubble {
  root: W; inner: W; text: W; who: W; tail: W;
  rider: RiderId; state: State; t: number; wait: number;
  pt: ScreenPoint; depth: number; docked: boolean; left: boolean;
  /** Unscaled box size, measured when the line is set (in the bus handler, never per frame). */
  w: number; h: number;
  /** Settled bottom-centre of the box (px) and whether the tail still points at the speaker. */
  x: number; y: number; tailOn: boolean;
  /** Docked: smoothed stack position (px), NaN = place at once. */
  dockY: number;
  rect: Rect;
}

/** Dynamic obstacles of this frame: the player quip, the chip column and the callout stack (null when absent). */
export interface BubbleObstacles { quip: Rect | null; chips: Rect | null; callouts: Rect | null }

const byDepth = (a: Bubble, b: Bubble): number => a.depth - b.depth;
const inside = (x: number, y: number, r: Rect): boolean => x > r.l && x < r.r && y > r.t && y < r.b;

export class Bubbles {
  private pool: Bubble[] = [];
  private v = new Vector3();
  private placed: Rect[] = [];
  private bounds: Bounds = { minX: 0, maxX: 0, top: 0, bottom: 0 };
  private out = { x: 0, y: 0 };
  /** Next free bottom y of the docked stacks this frame (left / right side). */
  private stackL = 0;
  private stackR = 0;

  constructor(parent: HTMLElement) {
    const host = el('div', 'brh-layer tb-host', parent);
    for (let i = 0; i < POOL; i++) {
      const root = el('div', 'wa tb', host);
      const inner = el('div', 'tb-in', root);
      el('div', 'tb-out', inner);
      const box = el('div', 'tb-box', inner);
      const text = el('span', 'tb-text', box);
      const who = el('span', 'tb-who', inner);
      const tail = el('div', 'tb-tail', inner);
      this.pool.push({
        root: w(root), inner: w(inner), text: w(text), who: w(who), tail: w(tail),
        rider: -1, state: 'off', t: 0, wait: 0, pt: newPoint(), depth: 0, docked: false, left: false,
        w: 0, h: 0, x: 0, y: 0, tailOn: false, dockY: NaN, rect: { l: 0, r: 0, t: 0, b: 0 },
      });
    }
  }

  show(session: Session, rider: RiderId, text: string): void {
    const r = session.rider(rider);
    if (!r) return;
    // Same speaker → new line in place; else a free bubble; else bump the farthest queued line; else the oldest.
    const waiting = this.pool.filter((x) => x.state === 'wait');
    const b = this.pool.find((x) => x.state !== 'off' && x.rider === rider)
      ?? this.pool.find((x) => x.state === 'off')
      ?? (waiting.length ? waiting.reduce((a, x) => (x.depth > a.depth ? x : a)) : null)
      ?? this.pool.reduce((a, x) => (x.t > a.t ? x : a));
    if (b.state === 'off') {
      b.state = 'wait';
      b.dockY = NaN;
    }
    b.wait = 0;
    b.rider = rider;
    b.t = 0;
    b.text.text(text);
    b.who.text(r.isPlayer ? '你' : ROSTER[r.character].name);
    // Measured here, in the bus handler (layout is clean apart from this text), not inside update().
    const node = b.inner.node as HTMLElement;
    b.w = node.offsetWidth || FALLBACK_W;
    b.h = node.offsetHeight || FALLBACK_H;
  }

  clear(): void {
    for (const b of this.pool) this.off(b);
  }

  /** `tags` = the name tags drawn this frame (NameTags.boxes()); `zones` updated for this viewport. */
  update(
    session: Session, proj: Projector, k: number, dt: number, tags: readonly TagBox[], zones: HudZones, dyn: BubbleObstacles,
  ): void {
    if (!this.pool.some((b) => b.state !== 'off')) return;
    const live = this.pool.filter((b) => b.state !== 'off' && this.track(b, session, proj, zones));
    let floating = live.filter((b) => b.state === 'on' && !b.docked).length;
    for (const b of live.filter((x) => x.state === 'wait').sort(byDepth)) {
      if (b.docked || floating < MAX_FLOAT) {
        b.state = 'on';
        if (!b.docked) floating++;
      } else if ((b.wait += dt) > MAX_WAIT) this.off(b);
    }
    const queued = live.some((b) => b.state === 'wait');
    const on = live.filter((b) => {
      if (b.state !== 'on') return false;
      b.t += dt;
      if (queued && !b.docked && b.t >= MIN_READ && b.t < LIFE - FADE) b.t = LIFE - FADE;
      if (b.t < LIFE) return true;
      this.off(b);
      return false;
    });
    this.placed.length = 0;
    const base = proj.height - DOCK_BASE * k;
    this.stackL = base;
    this.stackR = dyn.quip ? Math.min(base, dyn.quip.t - GAP * k) : base;
    for (const b of on) if (b.docked) this.dock(b, proj, k, dt, tags);
    this.float(on.filter((b) => !b.docked).sort(byDepth), tags, zones, dyn, proj, k, dt);
    for (const b of on) this.draw(b, session, k);
  }

  /** Project the speaker; false (and hidden) once the speaker is gone or invisible. Docks speakers off
   *  screen or inside the keep-clear area above the vanishing point. */
  private track(b: Bubble, session: Session, proj: Projector, zones: HudZones): boolean {
    const r = session.rider(b.rider);
    if (!r || r.mods.invisible) {
      this.off(b);
      return false;
    }
    proj.project(proj.riderHead(session, r, r.isPlayer ? 0.7 : 0.45, this.v), b.pt);
    b.docked = !b.pt.onScreen || inside(b.pt.x, b.pt.y, zones.centre);
    b.left = b.pt.x < proj.width / 2;
    b.depth = b.pt.depth > 0 ? b.pt.depth : 1e4;
    return true;
  }

  /** Dock one bubble on top of its side's stack: above the speedometer (left) or the cluster and quip (right). */
  private dock(b: Bubble, proj: Projector, k: number, dt: number, tags: readonly TagBox[]): void {
    const bw = b.w * k;
    const bh = (b.h + WHO) * k;
    let target = b.left ? this.stackL : this.stackR;
    b.x = b.left ? 24 * k + bw / 2 : proj.width - 24 * k - bw / 2;
    // Climb past name tags of riders out at that edge.
    for (let pass = 0; pass < 4; pass++) {
      const hit = tags.find((t) => overlaps(boxAt(b.x, target, bw, bh, b.rect), t, PAD * k));
      if (!hit) break;
      target = hit.t - PAD * k;
    }
    // Eases down when room frees up, but never sits below its slot (the quip may appear under it).
    b.dockY = Number.isNaN(b.dockY) ? target : Math.min(target, damp(b.dockY, target, 14, dt));
    b.y = b.dockY;
    if (b.left) this.stackL = target - bh - GAP * k;
    else this.stackR = target - bh - GAP * k;
    b.tailOn = false;
    this.placed.push(boxAt(b.x, b.y, bw, bh, b.rect));
  }

  /** On-screen speakers, nearest first: above the speaker's tag, settled clear of every obstacle. */
  private float(
    list: Bubble[], tags: readonly TagBox[], zones: HudZones, dyn: BubbleObstacles, proj: Projector, k: number, dt: number,
  ): void {
    const bounds = this.bounds;
    bounds.top = 150 * k;
    bounds.bottom = proj.height - 120 * k;
    const fixed: Rect[] = [...zones.fixed, zones.centre];
    if (dyn.quip) fixed.push(dyn.quip);
    if (dyn.chips) fixed.push(dyn.chips);
    if (dyn.callouts) fixed.push(dyn.callouts);
    for (const b of list) {
      const bw = b.w * k;
      const h = (b.h + WHO + TAIL) * k;
      const own = tags.find((t) => t.id === b.rider);
      const tipX = own ? own.cx : b.pt.x;
      const tipY = own ? own.t - 2 * k : b.pt.y - 8 * k;
      bounds.minX = 24 * k + bw / 2;
      bounds.maxX = proj.width - 24 * k - bw / 2;
      const obstacles: Rect[] = fixed.concat(this.placed, tags.filter((t) => t.id !== b.rider));
      const at = settle(tipX, tipY, bw, h, obstacles, bounds, PAD * k, this.out);
      const rect = boxAt(at.x, at.y, bw, h, b.rect);
      // Nowhere free between the modules: dock it at its side instead of covering the HUD.
      if (fixed.some((o) => overlaps(rect, o, 0))) {
        b.docked = true;
        this.dock(b, proj, k, dt, tags);
        continue;
      }
      b.dockY = NaN;
      b.x = at.x;
      b.y = at.y - TAIL * k;
      b.tailOn = Math.abs(at.x - tipX) < bw * 0.3 && Math.abs(at.y - tipY) < 40 * k;
      this.placed.push(rect);
    }
  }

  private draw(b: Bubble, session: Session, k: number): void {
    const r = session.rider(b.rider);
    b.root.show(true);
    b.root.op(clamp01((LIFE - b.t) / FADE));
    b.root.tf(`translate(${px(b.x)}, ${px(b.y)})`);
    b.root.cls('is-dock', b.docked);
    b.inner.tf(`scale(${(k * slam(b.t, 0.16, 1.5)).toFixed(3)}) rotate(${r?.isPlayer ? -3 : 3}deg)`);
    b.tail.show(b.tailOn);
  }

  private off(b: Bubble): void {
    b.state = 'off';
    b.root.show(false);
  }
}
