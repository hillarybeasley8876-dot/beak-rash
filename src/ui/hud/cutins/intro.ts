// Intro flyover: track title banner + a P5 "calling card" (roster title + tagline) for the rival the race
// camera is presenting. Like race's IntroCamera.focus(): the subject is the rider nearest (in s, ≤ 4.5 m)
// to the camera's look point (where the view ray meets the look-target height); cards change with the subject.
import '../css/intro.css';
import { Vector3 } from 'three';
import { easeInOutCubic } from '../../../core/math';
import { ROSTER } from '../../../data/roster';
import { SKILLS } from '../../../data/skills';
import { TRACKS } from '../../../data/tracks';
import type { Session } from '../../../core/contracts';
import type { RiderState, TrackFrame } from '../../../core/types';
import { enter, exit, fadeOut } from '../anim';
import { PortraitCard } from '../badge';
import { el } from '../dom';
import { setRansom } from '../ransom';
import type { Projector } from '../world/project';
import { animateGlyphs } from './splash';

const MIN_SHOW = 0.25;
const OUT = 0.1;
/** Height of race's intro look target over the eased flyover e: 1.0 m at both ends, 1.1 m mid-way
 *  (gameplay/race/intro-camera.ts). Core request: a race:introFocus event would make this mirror unnecessary. */
const lookY = (e: number): number => 1 + 0.4 * e * (1 - e);
const FOCUS_RANGE = 4.5;   // m in s around the look point (race intro-camera.ts)
const PLAYER_FROM = 0.8;   // share of the flyover after which the camera may present the player
const INTRO_FALLBACK = 3.6;
/** The next card waits for the previous one to drop out of the way. */
const ENTER_DELAY = 0.08;

interface Card { r: RiderState; root: HTMLDivElement; glyphs: HTMLElement[]; t: number }

export class IntroCards {
  private banner: HTMLDivElement;
  private card: Card | null = null;
  private leaving: Array<{ root: HTMLDivElement; t: number }> = [];
  private active = false;
  private t = 0;
  private duration = INTRO_FALLBACK;
  private bannerOut = 1;
  private frame: TrackFrame | undefined;
  private o = new Vector3();
  private d = new Vector3();
  private v = new Vector3();

  constructor(private stage: HTMLElement) {
    this.banner = el('div', 'ib', stage);
    this.banner.style.visibility = 'hidden';
  }

  get running(): boolean {
    return this.active;
  }

  /** race:intro — flyover length, so the player becomes a valid subject at the same point as for race. */
  setDuration(seconds: number | undefined): void {
    this.duration = seconds !== undefined && seconds > 0 ? seconds : INTRO_FALLBACK;
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
    const subject = this.subject(session, proj);
    if (!subject || subject === card?.r) return;
    if (subject.isPlayer) {
      if (card) this.retire(card);
      this.card = null;
    } else this.show(subject);
  }

  /** Rider nearest the camera's look point (null = nobody near it: keep the current card). */
  private subject(session: Session, proj: Projector): RiderState | null {
    const p = session.player;
    this.frame = session.track.frameAt(p.s, this.frame);
    const up = this.frame.up;
    const progress = Math.min(1, this.t / this.duration);
    const plane = session.track.toWorld(p.s, 0, lookY(easeInOutCubic(progress)), this.v);
    proj.viewRay(this.o, this.d);
    const denom = this.d.x * up.x + this.d.y * up.y + this.d.z * up.z;
    if (denom > -1e-3) return null;
    const along = ((plane.x - this.o.x) * up.x + (plane.y - this.o.y) * up.y + (plane.z - this.o.z) * up.z) / denom;
    if (along <= 0 || along > 150) return null;
    const lookS = session.track.project(this.o.addScaledVector(this.d, along), p.s).s;
    const playerOk = progress >= PLAYER_FROM;
    let best: RiderState | null = null;
    let bestD = FOCUS_RANGE;
    for (const r of session.riders) {
      if (r.isPlayer && !playerOk) continue;
      const dist = Math.abs(r.s - lookS);
      if (dist < bestD) {
        bestD = dist;
        best = r;
      }
    }
    return best;
  }

  private show(r: RiderState): void {
    if (this.card) this.retire(this.card);
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
