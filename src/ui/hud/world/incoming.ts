// Incoming-projectile warning (projectile:spawn aimed at the player): a hazard chip above the bottom edge on
// the side the shot comes from, with the skill glyph + name, the shooter and an estimated time to impact,
// dead-reckoned in sim time from the launch (SPEC §7: launch speed = shooter's speed + 22 m/s). Cleared
// on projectile:end. Combat keeps projectile positions private, so the estimate is all the HUD can show.
import { approach, clamp } from '../../../core/math';
import { ROSTER } from '../../../data/roster';
import { SKILLS } from '../../../data/skills';
import type { Session } from '../../../core/contracts';
import type { GameEvents } from '../../../core/events-map';
import type { RiderId } from '../../../core/types';
import { reducedMotion } from '../anim';
import { el, px, w, type W } from '../dom';
import type { Projector } from './project';

const LAUNCH_BONUS = 22;

interface Shot { id: number; owner: RiderId; skill: string; s: number; x: number; speed: number; at: number }

export class IncomingWarning {
  private root: W;
  private inner: W;
  private glyph: W;
  private name: W;
  private eta: W;
  private shots: Shot[] = [];
  private vis = 0;
  private side = 0;
  private shown: Shot | null = null;

  constructor(parent: HTMLElement) {
    const root = el('div', 'eg-inc', parent);
    const inner = el('div', 'eg-inc-in', root);
    el('span', 'eg-inc-arrow', inner, '▲');
    this.glyph = w(el('span', 'eg-inc-g', inner));
    const txt = el('span', 'eg-inc-t', inner);
    el('b', '', txt, 'INCOMING!');
    this.name = w(el('i', '', txt));
    this.eta = w(el('span', 'eg-inc-eta', inner));
    this.root = w(root);
    this.inner = w(inner);
  }

  spawn(session: Session, e: GameEvents['projectile:spawn']): void {
    if (e.target !== session.player.id) return;
    const owner = session.rider(e.owner);
    const at = session.track.project(e.pos, owner?.s ?? session.player.s);
    this.shots.push({ id: e.id, owner: e.owner, skill: e.kind, s: at.s, x: at.x, speed: (owner?.speed ?? 0) + LAUNCH_BONUS, at: session.time });
  }

  /** The chip is on screen (the bottom-centre prompt chip waits meanwhile). */
  get up(): boolean {
    return this.vis > 0.01;
  }

  end(id: number): void {
    this.shots = this.shots.filter((s) => s.id !== id);
  }

  clear(): void {
    this.shots = [];
    this.shown = null;
    this.vis = 0;
    this.root.show(false);
  }

  update(session: Session, proj: Projector, k: number, dt: number): void {
    const me = session.player;
    let best: Shot | null = null;
    let bestEta = Infinity;
    for (const sh of this.shots) {
      const s = sh.s + sh.speed * Math.max(0, session.time - sh.at);
      const closing = sh.speed - me.speed;
      const eta = s >= me.s ? 0 : closing > 0.5 ? (me.s - s) / closing : 99;
      if (eta < bestEta) {
        bestEta = eta;
        best = sh;
      }
    }
    this.vis = approach(this.vis, best ? 1 : 0, dt * 8);
    this.root.show(this.vis > 0.01);
    if (this.vis <= 0.01) return;
    if (best && best !== this.shown) this.label(session, best);
    if (best) {
      this.eta.text(bestEta >= 9.95 ? '' : bestEta < 0.05 ? '!' : `${bestEta.toFixed(1)}s`);
      this.side = clamp((best.x - me.x) / 5, -1, 1);
    }
    // Centred over the road, kept clear of the battle cluster (bottom right, from ~62 % of the width).
    const x = clamp(proj.width / 2 + this.side * proj.width * 0.12, proj.width * 0.3, proj.width * 0.6 - 170 * k);
    this.root.tf(`translate(${px(x)}, ${px(proj.height - 190 * k)})`);
    const pulse = reducedMotion() ? 1 : 1 + 0.06 * Math.sin(session.time * 18);
    this.inner.tf(`scale(${(k * pulse).toFixed(3)}) skewX(-12deg)`);
    this.root.op(this.vis);
  }

  private label(session: Session, sh: Shot): void {
    this.shown = sh;
    const def = SKILLS[sh.skill];
    const owner = session.rider(sh.owner);
    this.glyph.text(def?.glyph ?? '!');
    this.name.text(`${def?.name ?? sh.skill}${owner ? ` · ${ROSTER[owner.character].name}` : ''}`);
  }
}
