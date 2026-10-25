// Police 2.0 HUD (SPEC §14): the wanted-star badge next to the place block and the red "!" over a corgi
// that is winding up its baton (world-anchored; an edge arrow points at it when it is off screen).
import { Vector3 } from 'three';
import { clamp } from '../../../core/math';
import { R4_HUD as S } from '../../../data/strings';
import type { Session } from '../../../core/contracts';
import type { Vec3Like } from '../../../core/types';
import { reducedMotion, slam } from '../anim';
import { el, w, type W } from '../dom';
import { newPoint, type Projector } from '../world/project';

/** The corgi's baton: a black stick with a red band and a yellow tip. */
const BATON_SVG = '<svg viewBox="0 0 24 24"><rect x="10" y="2" width="4" height="20" rx="2" fill="#0B0B0F"/>'
  + '<rect x="10" y="9" width="4" height="4" fill="#E5191C"/><circle cx="12" cy="3" r="2.4" fill="#FFE600"/></svg>';

/** Wanted stars: 1–3, next to the place badge; hidden while the player is not wanted. */
export class WantedBadge {
  readonly root: HTMLDivElement;
  private inner: W;
  private stars: W[] = [];
  private level = 0;
  private t = 9;

  constructor(parent: HTMLElement) {
    this.root = el('div', 'brh-wanted', parent);
    this.root.dataset.level = '0';
    const inner = el('div', 'brh-wanted-in', this.root);
    this.inner = w(inner);
    const label = el('span', 'brh-wanted-t', inner);
    el('b', '', label, S.wanted.en);
    el('i', '', label, S.wanted.cn);
    for (let i = 0; i < 3; i++) this.stars.push(w(el('span', 'brh-wanted-s', inner, '★')));
    w(this.root).show(false);
  }

  /** `level` = the wanted stars (0..3); 0 hides the badge. */
  set(level: number): void {
    const l = Math.max(0, Math.min(3, Math.round(level)));
    if (l === this.level) return;
    const up = l > this.level;
    this.level = l;
    this.root.dataset.level = String(l);
    this.stars.forEach((s, i) => s.cls('on', i < l));
    w(this.root).show(l > 0);
    if (up) this.t = 0;
  }

  update(dt: number): void {
    if (this.level <= 0) return;
    this.t += dt;
    const s = reducedMotion() ? 1 : slam(this.t, 0.22, 1.6);
    this.inner.tf(`scale(${s.toFixed(3)})`);
  }
}

/** The wind-up warning over the corgi that is about to swing its baton. */
export class BatonWarn {
  readonly root: HTMLDivElement;
  private rootW: W;
  private obstacleId = -1;
  private fallback: Vec3Like = { x: 0, y: 1, z: 0 };
  private t = 0;
  private life = 0;
  private pt = newPoint();
  private v = new Vector3();

  constructor(parent: HTMLElement) {
    this.root = el('div', 'brh-baton-warn', parent);
    this.rootW = w(this.root);
    const inner = el('div', 'brh-baton-warn-in', this.root);
    el('div', 'brh-baton-warn-burst', inner);
    el('span', 'brh-baton-warn-t', inner, '!');
    const baton = el('div', 'brh-baton-warn-baton', inner);
    baton.innerHTML = BATON_SVG;
    el('div', 'brh-baton-warn-arrow', inner);
    this.rootW.show(false);
  }

  /** `time` = seconds until the strike (the warning lives a little longer than that). */
  show(obstacleId: number, pos: Vec3Like, time: number): void {
    this.obstacleId = obstacleId;
    this.fallback = { x: pos.x, y: pos.y, z: pos.z };
    this.t = 0;
    this.life = Math.max(0.3, time) + 0.3;
    this.rootW.show(true);
  }

  /** Drop the warning (a new race). */
  clear(): void {
    this.life = 0;
    this.rootW.show(false);
  }

  update(session: Session, proj: Projector, k: number, dt: number): void {
    if (this.life <= 0) return;
    this.t += dt;
    if (this.t >= this.life) {
      this.life = 0;
      this.rootW.show(false);
      return;
    }
    proj.project(this.anchor(session), this.pt);
    const behind = this.pt.depth <= 0;
    const cx = proj.width / 2;
    const cy = proj.height / 2;
    const dx = this.pt.x - cx;
    const dy = (behind ? cy : this.pt.y) - cy;
    const x = clamp(this.pt.x, 74 * k, proj.width - 74 * k);
    const y = clamp(behind ? cy : this.pt.y, 96 * k, proj.height - 150 * k);
    const edge = !this.pt.onScreen;
    this.rootW.cls('is-edge', edge);
    this.root.style.setProperty('--ar', `${(Math.atan2(dy, dx) * 180 / Math.PI).toFixed(1)}deg`);
    this.rootW.tf(`translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`);
  }

  /** The corgi's world position: its obstacle (900 / 901) when it is on the road, else the event's position. */
  private anchor(session: Session): Vec3Like {
    const o = session.obstacles.find((x) => x.id === this.obstacleId);
    if (o) return session.track.toWorld(o.s, o.x, o.height + 0.5, this.v);
    return this.fallback;
  }
}
