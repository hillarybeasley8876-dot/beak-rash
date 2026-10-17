// Intro flyover: track title banner + one P5 "calling card" per rival (roster title + tagline). The
// card follows whichever rival the race camera is looking at; if none is in view it cycles the grid.
import '../css/intro.css';
import { Vector3 } from 'three';
import { ROSTER } from '../../../data/roster';
import { SKILLS } from '../../../data/skills';
import { TRACKS } from '../../../data/tracks';
import type { Session } from '../../../core/contracts';
import type { RiderState } from '../../../core/types';
import { enter, exit, fadeOut } from '../anim';
import { PortraitCard } from '../badge';
import { el } from '../dom';
import { setRansom } from '../ransom';
import { newPoint, type Projector } from '../world/project';
import { animateGlyphs } from './splash';

const MIN_SHOW = 0.6;
const CYCLE = 0.75;
const OUT = 0.1;
/** The next card waits for the previous one to drop out of the way. */
const ENTER_DELAY = 0.08;

interface Card { r: RiderState; root: HTMLDivElement; glyphs: HTMLElement[]; t: number }

export class IntroCards {
  private banner: HTMLDivElement;
  private card: Card | null = null;
  private leaving: Array<{ root: HTMLDivElement; t: number }> = [];
  private shown = new Set<number>();
  private active = false;
  private t = 0;
  private bannerOut = 1;
  private pt = newPoint();
  private v = new Vector3();

  constructor(private stage: HTMLElement) {
    this.banner = el('div', 'ib', stage);
    this.banner.style.visibility = 'hidden';
  }

  get running(): boolean {
    return this.active;
  }

  start(session: Session): void {
    this.stop(true);
    const info = TRACKS[session.track.id];
    this.banner.textContent = '';
    el('div', 'ib-en', this.banner, info?.nameEn ?? session.track.look.name);
    el('div', 'ib-cn', this.banner, info?.name ?? '');
    const meta = info ? `${info.weather} · ${info.lengthKm.toFixed(1)} KM · ${session.riders.length} RIDERS` : `${session.riders.length} RIDERS`;
    el('div', 'ib-meta', this.banner, meta);
    this.active = true;
    this.t = 0;
    this.bannerOut = 0;
  }

  stop(immediate = false): void {
    this.active = false;
    if (this.card) this.retire(this.card);
    this.card = null;
    this.shown.clear();
    if (immediate) {
      for (const l of this.leaving) l.root.remove();
      this.leaving = [];
      this.banner.style.visibility = 'hidden';
      this.bannerOut = 1;
    }
  }

  update(session: Session, proj: Projector, dt: number): void {
    this.t += dt;
    this.updateLeaving(dt);
    this.updateBanner(dt);
    if (!this.active) return;
    const card = this.card;
    if (card) {
      card.t += dt;
      this.drawCard(card);
    }
    if (card && card.t < MIN_SHOW) return;
    const next = this.pickInView(session, proj) ?? (this.t > 0.25 && (!card || card.t > CYCLE) ? this.nextInGrid(session) : null);
    if (next && next !== card?.r) this.show(next);
  }

  private pickInView(session: Session, proj: Projector): RiderState | null {
    let best: RiderState | null = null;
    let bestScore = Infinity;
    for (const r of session.riders) {
      if (r.isPlayer) continue;
      proj.project(proj.riderHead(session, r, 0, this.v), this.pt);
      if (!this.pt.onScreen || this.pt.depth > 24) continue;
      const score = Math.abs(this.pt.x / proj.width - 0.5) + this.pt.depth / 40 + (this.shown.has(r.id) ? 1 : 0);
      if (score < bestScore) {
        bestScore = score;
        best = r;
      }
    }
    return best && !this.shown.has(best.id) ? best : null;
  }

  private nextInGrid(session: Session): RiderState | null {
    const rivals = session.riders.filter((r) => !r.isPlayer && !this.shown.has(r.id));
    rivals.sort((a, b) => b.s - a.s);
    return rivals[0] ?? null;
  }

  private show(r: RiderState): void {
    if (this.card) this.retire(this.card);
    this.shown.add(r.id);
    const def = ROSTER[r.character];
    const root = el('div', 'ic', this.stage);
    el('div', 'ic-sh', root);
    const body = el('div', 'ic-card', root);
    const pc = el('div', 'ic-pc', body);
    pc.append(new PortraitCard(r.character, '', ['main']).node);
    el('div', 'ic-code', body, def.codename);
    const nameEl = el('div', 'ic-name', body);
    // Long names (薯条大盗) shrink so the ransom letters stay inside the card.
    nameEl.style.fontSize = `${Math.min(92, Math.floor(340 / (Array.from(def.name).length * 1.12)))}px`;
    const glyphs = setRansom(nameEl, def.name, { seed: r.id * 31 + 7, scheme: 'mix', tilt: 8 });
    el('div', 'ic-title', body, def.title);
    el('div', 'ic-tag', body, `「${def.tagline}」`);
    const skill = SKILLS[def.skill];
    if (skill) el('span', '', el('div', 'ic-skill', body), skill.glyph);
    this.card = { r, root, glyphs, t: this.leaving.length ? -ENTER_DELAY : 0 };
    this.drawCard(this.card);
  }

  private drawCard(c: Card): void {
    const t = Math.max(0, c.t);
    const inT = enter(t, 0.16);
    c.root.style.transform = `translateX(${((1 - inT) * 900).toFixed(0)}px) rotate(${(-4 - (1 - inT) * 8).toFixed(2)}deg)`;
    c.root.style.opacity = c.t < 0 ? '0' : '1';
    animateGlyphs(c.glyphs, t, 0.08, 0.05);
  }

  private retire(c: Card): void {
    this.leaving.push({ root: c.root, t: 0 });
  }

  private updateLeaving(dt: number): void {
    this.leaving = this.leaving.filter((l) => {
      l.t += dt;
      const o = exit(l.t, OUT, OUT);
      l.root.style.transform = `translate(${(o * -140).toFixed(0)}px, ${(o * 460).toFixed(0)}px) rotate(${(-4 - o * 16).toFixed(1)}deg)`;
      l.root.style.opacity = fadeOut(l.t, OUT, OUT).toFixed(3);
      if (l.t < OUT) return true;
      l.root.remove();
      return false;
    });
  }

  private updateBanner(dt: number): void {
    if (!this.active) this.bannerOut = Math.min(1, this.bannerOut + dt / OUT);
    const vis = this.bannerOut < 1;
    this.banner.style.visibility = vis ? 'inherit' : 'hidden';
    if (!vis) return;
    const o = exit(this.bannerOut, 1, 1);
    this.banner.style.transform = `translateX(${((1 - enter(this.t, 0.2)) * -900 - o * 900).toFixed(0)}px)`;
    this.banner.style.opacity = (1 - this.bannerOut).toFixed(3);
  }
}
