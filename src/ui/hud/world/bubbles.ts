// Taunt speech bubbles (P5 jagged, `taunt` events) anchored above the speaker's head; clamped to the
// screen edge with the speaker's name when the speaker is off-screen.
import { Vector3 } from 'three';
import { clamp, clamp01 } from '../../../core/math';
import { ROSTER } from '../../../data/roster';
import type { Session } from '../../../core/contracts';
import type { RiderId } from '../../../core/types';
import { slam } from '../anim';
import { el, px, w, type W } from '../dom';
import { newPoint, type Projector } from './project';

const LIFE = 2.6;
const POOL = 4;

interface Bubble { root: W; inner: W; text: W; who: W; tail: W; rider: RiderId; t: number; active: boolean }

export class Bubbles {
  private pool: Bubble[] = [];
  private pt = newPoint();
  private v = new Vector3();

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
      this.pool.push({ root: w(root), inner: w(inner), text: w(text), who: w(who), tail: w(tail), rider: -1, t: 0, active: false });
    }
  }

  show(session: Session, rider: RiderId, text: string): void {
    const r = session.rider(rider);
    if (!r) return;
    const b = this.pool.find((x) => x.active && x.rider === rider)
      ?? this.pool.find((x) => !x.active)
      ?? this.pool.reduce((a, x) => (x.t > a.t ? x : a));
    b.active = true;
    b.rider = rider;
    b.t = 0;
    b.text.text(text);
    b.who.text(r.isPlayer ? '你' : ROSTER[r.character].name);
  }

  clear(): void {
    for (const b of this.pool) {
      b.active = false;
      b.root.show(false);
    }
  }

  update(session: Session, proj: Projector, k: number, dt: number): void {
    for (const b of this.pool) {
      if (!b.active) continue;
      b.t += dt;
      const r = session.rider(b.rider);
      if (!r || b.t >= LIFE || r.mods.invisible) {
        b.active = false;
        b.root.show(false);
        continue;
      }
      // Same anchor as the rival's name tag, raised by the tag's height so the two never collide.
      proj.project(proj.riderHead(session, r, r.isPlayer ? 0.7 : 0.45, this.v), this.pt);
      const tagLift = r.isPlayer ? 0 : 66 * k;
      // Off-screen speakers dock between the corner modules: above the speedometer / battle cluster.
      const mx = 190 * k;
      const top = 150 * k;
      const bottom = proj.height - 430 * k;
      const x = clamp(this.pt.x, mx, proj.width - mx);
      const y = this.pt.depth > 0 ? clamp(this.pt.y - tagLift, top, bottom) : bottom;
      const clamped = this.pt.depth <= 0 || Math.abs(x - this.pt.x) > 1 || Math.abs(y - (this.pt.y - tagLift)) > 1;
      const fade = clamp01((LIFE - b.t) / 0.25);
      b.root.show(true);
      b.root.op(fade);
      b.root.tf(`translate(${px(x)}, ${px(y)})`);
      b.inner.tf(`scale(${(k * slam(b.t, 0.16, 1.5)).toFixed(3)}) rotate(${r.isPlayer ? -3 : 3}deg)`);
      b.tail.show(!clamped);
    }
  }
}
