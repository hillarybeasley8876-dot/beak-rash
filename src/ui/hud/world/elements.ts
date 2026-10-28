// Element badges and reaction callouts (SPEC §24): a small round badge over every rider who carries an
// element aura (火 / 冰 / 雷 / 水) and the big slammed word at the victim when two elements react
// (蒸发！ 融化！ 冻结！ 感电！ 超导！ 超载！ 扩散！). Presentation only: it reads the session, never writes it.
import '../css/elements.css';
import { Vector3 } from 'three';
import { clamp } from '../../../core/math';
import type { Session } from '../../../core/contracts';
import type { GameEvents } from '../../../core/events-map';
import type { Element, RiderId, RiderState, StatusId } from '../../../core/types';
import { ELEMENT_CN, ELEMENT_COLOR, REACTION_CN, REACTION_COLOR } from '../../../data/skills';
import { fadeOut, slam } from '../anim';
import { el, w, type W } from '../dom';
import { newPoint, type Projector } from './project';
import type { TagBox } from './tags';

/** The status each element leaves on a rider (combat/elements.ts): ice also freezes at three cold stacks. */
const AURA_OF: Partial<Record<StatusId, Element>> = {
  burn: 'fire', charged: 'thunder', frozen: 'ice', cold: 'ice', wet: 'water',
};

/** A rider further ahead than this gets no badge (it would be a speck). */
const NEAR = 30;
const CALL_LIFE = 1.05;
const CALL_FONT = 76;

interface Badge { root: W; plate: W; glyph: W }

interface Callout {
  root: W; box: W; word: W; t: number; life: number; big: boolean;
  pos: Vector3; rider: RiderId | null;
}

/** The element a rider carries right now (the newest one); the rain's endless wet counts as none. */
function auraOf(r: RiderState): Element | null {
  for (let i = r.statuses.length - 1; i >= 0; i--) {
    const st = r.statuses[i];
    if (!st || st.time <= 0) continue;
    const element = AURA_OF[st.id];
    if (!element) continue;
    if (st.id === 'wet' && st.source === null) continue;  // the weather's wet: nobody carries it
    return element;
  }
  return null;
}

export class ElementLayer {
  readonly root: HTMLDivElement;
  private badges = new Map<RiderId, Badge>();
  private callouts: Callout[] = [];
  private off: (() => void) | null = null;
  private session: Session | null = null;
  private v = new Vector3();
  private pt = newPoint();
  /** The riders whose badge is on screen this frame. */
  private shown = new Set<RiderId>();

  constructor(parent: HTMLElement) {
    this.root = el('div', 'brh-layer el-host', parent);
    for (let i = 0; i < 4; i++) {
      const root = el('div', 'wa rx', this.root);
      const box = el('div', 'rx-b', root);
      const word = el('span', 'rx-w', box);
      this.callouts.push({ root: w(root), box: w(box), word: w(word), t: 0, life: 0, big: false, pos: new Vector3(), rider: null });
      w(root).show(false);
    }
  }

  /** A new race: the bus subscription follows the session's bus. */
  attach(session: Session | null): void {
    this.off?.();
    this.off = null;
    this.session = session;
    for (const c of this.callouts) {
      c.life = 0;
      c.root.show(false);
    }
    if (!session) return;
    this.off = session.app.bus.on('combat:reaction', (e) => this.onReaction(e));
  }

  dispose(): void {
    this.off?.();
    this.off = null;
  }

  /** A reaction happened: call it out at the victim. */
  private onReaction(e: GameEvents['combat:reaction']): void {
    const me = this.session?.player.id;
    const c = this.callouts.find((x) => x.life <= 0) ?? this.callouts.reduce((a, x) => (x.t > a.t ? x : a));
    c.t = 0;
    c.life = CALL_LIFE;
    c.rider = e.victim;
    c.big = e.attacker === me || e.victim === me;
    c.pos.set(e.pos.x, e.pos.y, e.pos.z);
    c.word.text(`${REACTION_CN[e.reaction]}！`);
    c.word.style('color', REACTION_COLOR[e.reaction]);
    c.box.attr('data-reaction', e.reaction);
    c.root.show(true);
  }

  /** The badges over the riders and the callouts at their anchors. */
  update(session: Session, proj: Projector, k: number, dt: number, tags: readonly TagBox[]): void {
    this.badgesFor(session, proj, k, tags);
    this.calloutsFor(session, proj, k, dt);
  }

  /** One badge per rider who carries an aura, just above their name tag. */
  private badgesFor(session: Session, proj: Projector, k: number, tags: readonly TagBox[]): void {
    const used = this.shown;
    used.clear();
    for (const r of session.riders) {
      const element = auraOf(r);
      if (!element) continue;
      const ds = r.s - session.player.s;
      if (ds < -8 || ds > NEAR || r.mode === 'crashed' || r.mode === 'busted') continue;
      proj.project(proj.riderHead(session, r, 0.55, this.v), this.pt);
      if (!this.pt.onScreen) continue;
      const badge = this.badgeOf(r.id);
      used.add(r.id);
      // Above the name tag when the plate still sits over its rider; a plate the layout pushed aside
      // (out of the keep-clear zone) would drag the badge into the sky, so then it stays over the head.
      const tag = tags.find((t) => t.id === r.id);
      const near = tag !== undefined && Math.abs(tag.cx - this.pt.x) < 90 * k && Math.abs(tag.b - this.pt.y) < 40 * k;
      const y = near ? tag.t - 18 * k : this.pt.y - 34 * k;
      const x = clamp(this.pt.x, 20 * k, proj.width - 20 * k);
      badge.root.tf(`translate(${x.toFixed(1)}px, ${clamp(y, 20 * k, proj.height - 20 * k).toFixed(1)}px)`);
      badge.root.show(true);
      badge.plate.attr('data-element', element);
      badge.plate.style('--c', ELEMENT_COLOR[element]);
      badge.glyph.text(ELEMENT_CN[element]);
    }
    for (const [id, badge] of this.badges) if (!used.has(id)) badge.root.show(false);
  }

  /** The callout word at the victim: slam in, rise, fade. */
  private calloutsFor(session: Session, proj: Projector, k: number, dt: number): void {
    for (const c of this.callouts) {
      if (c.life <= 0) continue;
      c.t += dt;
      if (c.t >= c.life) {
        c.life = 0;
        c.root.show(false);
        continue;
      }
      const rider = c.rider === null ? undefined : session.rider(c.rider);
      if (rider) proj.project(proj.riderHead(session, rider, 0.9, this.v), this.pt);
      else proj.project(c.pos, this.pt);
      const word = c.word.node as HTMLElement;
      const halfW = (word.offsetWidth || CALL_FONT * 2) / 2;
      const halfH = (word.offsetHeight || CALL_FONT) / 2;
      const x = clamp(this.pt.onScreen ? this.pt.x : proj.width / 2, halfW + 6, proj.width - halfW - 6);
      const y = clamp(this.pt.onScreen ? this.pt.y : proj.height * 0.45, halfH + 6, proj.height - halfH - 6);
      const rise = Math.min(1, c.t / c.life) * 46 * k;
      const s = k * slam(c.t, 0.12, 1.7) * (c.big ? 1.35 : 1);
      c.root.tf(`translate(${x.toFixed(1)}px, ${(y - rise).toFixed(1)}px)`);
      c.root.op(fadeOut(c.t, c.life, 0.3));
      c.word.tf(`scale(${s.toFixed(3)}) rotate(-7deg)`);
    }
  }

  /** The badge DOM for one rider (built once, reused every frame). */
  private badgeOf(id: RiderId): Badge {
    let b = this.badges.get(id);
    if (b) return b;
    const root = el('div', 'wa el', this.root);
    const plate = el('div', 'el-b', root);
    const glyph = el('span', 'el-g', plate);
    b = { root: w(root), plate: w(plate), glyph: w(glyph) };
    this.badges.set(id, b);
    return b;
  }
}
