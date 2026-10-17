// Floating damage numbers at the hit position: slam in, rise and fade. Crits are big and yellow,
// heavy hits larger, blocked hits read "BLOCK", damage taken by the player is red.
import { Vector3 } from 'three';
import { clamp01, easeOutCubic } from '../../../core/math';
import type { Vec3Like } from '../../../core/types';
import { jitter, reducedMotion, slam } from '../anim';
import { el, px, w, type W } from '../dom';
import { newPoint, type Projector } from './project';

const LIFE = 0.9;
const POOL = 14;

export interface DamageHit {
  pos: Vec3Like;
  damage: number;
  crit: boolean;
  heavy: boolean;
  blocked: boolean;
  /** Player is the victim (red) — or neither side is the player (smaller). */
  hurt: boolean;
  minor: boolean;
}

interface Num { root: W; inner: W; val: W; tag: W; pos: Vector3; t: number; dx: number; scale: number; active: boolean }

export class DamageNumbers {
  private pool: Num[] = [];
  private pt = newPoint();
  private serial = 0;

  constructor(parent: HTMLElement) {
    const host = el('div', 'brh-layer dn-host', parent);
    for (let i = 0; i < POOL; i++) {
      const root = el('div', 'wa dn', host);
      const inner = el('div', 'dn-in', root);
      const tag = el('span', 'dn-tag', inner);
      const val = el('span', 'dn-v', inner);
      this.pool.push({ root: w(root), inner: w(inner), val: w(val), tag: w(tag), pos: new Vector3(), t: 0, dx: 0, scale: 1, active: false });
    }
  }

  spawn(h: DamageHit): void {
    const n = this.pool.find((x) => !x.active) ?? this.pool.reduce((a, x) => (x.t > a.t ? x : a));
    this.serial++;
    n.active = true;
    n.t = 0;
    n.pos.set(h.pos.x, h.pos.y + 0.6, h.pos.z);
    n.dx = jitter(this.serial, 3) * 26;
    n.scale = h.minor ? 0.7 : 1;
    n.val.text(h.blocked ? 'BLOCK' : String(Math.max(1, Math.round(h.damage))));
    n.tag.text(h.crit ? 'CRIT!' : h.heavy ? 'HEAVY' : '');
    n.tag.show(!h.blocked && (h.crit || h.heavy));
    for (const [cls, on] of [['crit', h.crit], ['heavy', h.heavy], ['block', h.blocked], ['hurt', h.hurt]] as const) n.root.cls(cls, on);
  }

  clear(): void {
    for (const n of this.pool) {
      n.active = false;
      n.root.show(false);
    }
  }

  update(proj: Projector, k: number, dt: number): void {
    for (const n of this.pool) {
      if (!n.active) continue;
      n.t += dt;
      if (n.t >= LIFE) {
        n.active = false;
        n.root.show(false);
        continue;
      }
      proj.project(n.pos, this.pt, 80);
      if (!this.pt.onScreen) {
        n.root.show(false);
        continue;
      }
      const rise = reducedMotion() ? 0 : easeOutCubic(n.t / LIFE) * 90 * k;
      const s = k * n.scale * slam(n.t, 0.12, 1.8);
      n.root.show(true);
      n.root.op(clamp01((LIFE - n.t) / 0.25));
      n.root.tf(`translate(${px(this.pt.x + n.dx * k)}, ${px(this.pt.y - rise)})`);
      n.inner.tf(`scale(${s.toFixed(3)}) rotate(${(n.dx * 0.3).toFixed(1)}deg)`);
    }
  }
}
