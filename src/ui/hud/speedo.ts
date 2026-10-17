// Jagged speedometer: 240° dial, needle, big km/h readout, drift charge ring + level pips + sparks in
// the level colour, and BOOST / SLIPSTREAM tags that slash in beside it.
import './css/speedo.css';
import { approach, clamp01, KMH } from '../../core/math';
import type { RiderState } from '../../core/types';
import { reducedMotion } from './anim';
import { el, svg, w, type W } from './dom';
import { starSvg } from './shapes';

const MAX_KMH = 100;
const RED_KMH = 75;
const A0 = 150;
const SWEEP = 240;
const CX = 150;
const CY = 150;
export const DRIFT_T = [0, 0.55, 1.2, 2.0];
export const DRIFT_COLORS = ['#FFFFFF', '#2FA8FF', '#FF8A00', '#FF3FD2'];

const pt = (deg: number, r: number): string => {
  const a = (deg * Math.PI) / 180;
  return `${(CX + Math.cos(a) * r).toFixed(1)} ${(CY + Math.sin(a) * r).toFixed(1)}`;
};
const arc = (r: number, from = A0, to = A0 + SWEEP): string =>
  `M ${pt(from, r)} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${pt(to, r)}`;

export const driftLevel = (charge: number): number =>
  charge >= DRIFT_T[3]! ? 3 : charge >= DRIFT_T[2]! ? 2 : charge >= DRIFT_T[1]! ? 1 : 0;

interface Tag { root: W; fill: W; vis: number }

export class Speedo {
  readonly root: HTMLDivElement;
  private rootW: W;
  private num: W;
  private needle: W;
  private speedArc: W;
  private driftArc: W;
  private dlbl: W;
  private pips: W[] = [];
  private boost: Tag;
  private draft: Tag;
  private boostMax = 0.01;
  private kmh = -1;
  private level = -1;
  /** Drift level reported by the sim through rider:drift events (authoritative once seen). */
  private eventLevel = 0;
  private sawEvents = false;

  constructor(parent: HTMLElement) {
    this.root = el('div', 'spd', parent);
    this.rootW = w(this.root);
    const s = svg('svg', { class: 'spd-svg', viewBox: '0 0 300 300' }, this.root);
    svg('polygon', { points: starSvg(CX, CY, 146, 26, 0.9, 0.07, 7), fill: '#E5191C', transform: 'translate(9 9)' }, s);
    svg('polygon', { points: starSvg(CX, CY, 146, 26, 0.9, 0.07, 7), fill: '#0B0B0F', stroke: '#fff', 'stroke-width': 4, 'stroke-linejoin': 'round' }, s);
    svg('path', { d: arc(112), fill: 'none', stroke: '#2a2a30', 'stroke-width': 24 }, s);
    svg('path', { d: arc(112, A0 + (SWEEP * RED_KMH) / MAX_KMH), fill: 'none', stroke: '#5c0b10', 'stroke-width': 24 }, s);
    this.speedArc = w(svg('path', { d: arc(112), fill: 'none', stroke: '#fff', 'stroke-width': 24, pathLength: 100, 'stroke-dasharray': '100 200', 'stroke-dashoffset': 100 }, s));
    for (let v = 0; v <= MAX_KMH; v += 10) {
      const a = A0 + (SWEEP * v) / MAX_KMH;
      const major = v % 20 === 0;
      svg('path', { d: `M ${pt(a, major ? 92 : 98)} L ${pt(a, 126)}`, stroke: '#0B0B0F', 'stroke-width': major ? 6 : 3 }, s);
    }
    svg('path', { d: arc(84), fill: 'none', stroke: '#1a1a1f', 'stroke-width': 10 }, s);
    this.driftArc = w(svg('path', { d: arc(84), fill: 'none', stroke: '#2FA8FF', 'stroke-width': 10, pathLength: 100, 'stroke-dasharray': '100 200', 'stroke-dashoffset': 100 }, s));
    for (let i = 0; i < 7; i++) {
      const a = A0 - 18 + i * 46;
      const r = 150 + (i % 2) * 10;
      const c = pt(a, r).split(' ').map(Number);
      svg('polygon', { class: 'spd-spark', points: starSvg(c[0] ?? 0, c[1] ?? 0, 13 - (i % 3) * 2, 4, 0.3), fill: 'var(--dc)', stroke: '#0B0B0F', 'stroke-width': 2 }, s);
    }
    this.needle = w(svg('polygon', { points: '150,140 272,150 150,160 132,150', fill: '#E5191C', stroke: '#0B0B0F', 'stroke-width': 4, 'stroke-linejoin': 'round', transform: `rotate(${A0} ${CX} ${CY})` }, s));
    svg('circle', { cx: CX, cy: CY, r: 14, fill: '#0B0B0F', stroke: '#fff', 'stroke-width': 4 }, s);
    this.dlbl = w(el('div', 'spd-dlbl', this.root, 'DRIFT'));
    this.num = w(el('div', 'spd-num', this.root, '0'));
    el('div', 'spd-unit', this.root, 'KM/H');
    const pips = el('div', 'spd-pips', this.root);
    for (let i = 0; i < 3; i++) this.pips.push(w(el('div', 'spd-pip', pips)));
    const tags = el('div', 'spd-tags', this.root);
    this.boost = this.makeTag(tags, 'boost', 'BOOST');
    this.draft = this.makeTag(tags, 'draft', 'SLIPSTREAM');
  }

  private makeTag(parent: HTMLElement, cls: string, label: string): Tag {
    const root = el('div', `spd-tag ${cls}`, parent);
    el('span', 'spd-tag-k', root, label);
    const meter = el('span', 'spd-tag-m', root);
    return { root: w(root), fill: w(el('span', 'spd-tag-f', meter)), vis: 0 };
  }

  /** rider:drift events from the sim (player only). */
  onDrift(phase: 'start' | 'level' | 'end', level: number): void {
    this.sawEvents = true;
    this.eventLevel = phase === 'end' || phase === 'start' ? 0 : Math.max(this.eventLevel, level);
  }

  update(r: RiderState, dt: number): void {
    const kmh = Math.max(0, r.speed * KMH);
    const shown = Math.round(kmh);
    if (shown !== this.kmh) {
      this.kmh = shown;
      this.num.text(String(shown));
    }
    const f = clamp01(kmh / MAX_KMH);
    this.speedArc.attr('stroke-dashoffset', (100 - f * 100).toFixed(1));
    this.speedArc.attr('stroke', r.boostTime > 0 ? '#FFE600' : kmh >= RED_KMH ? '#FF1E3C' : '#FFFFFF');
    this.needle.attr('transform', `rotate(${(A0 + SWEEP * f).toFixed(1)} ${CX} ${CY})`);
    this.updateDrift(r);
    this.updateTags(r, dt);
  }

  private updateDrift(r: RiderState): void {
    const drifting = r.drifting && r.mode === 'racing';
    const charge = drifting ? r.driftCharge : 0;
    const lvl = drifting ? (this.sawEvents ? this.eventLevel : driftLevel(charge)) : 0;
    if (lvl !== this.level) {
      this.level = lvl;
      const color = DRIFT_COLORS[lvl] ?? '#fff';
      this.rootW.style('--dc', lvl === 0 ? '#9fd8ff' : color);
      this.driftArc.attr('stroke', lvl === 0 ? '#9fd8ff' : color);
      this.pips.forEach((p, i) => p.cls('on', i < lvl));
      this.dlbl.text(lvl > 0 ? `DRIFT L${lvl}` : 'DRIFT');
    }
    this.rootW.cls('is-drift', drifting && lvl > 0);
    this.dlbl.show(drifting);
    const lo = DRIFT_T[Math.min(lvl, 3)] ?? 0;
    const hi = DRIFT_T[Math.min(lvl + 1, 3)] ?? 2;
    const p = !drifting ? 0 : lvl >= 3 ? 1 : clamp01((charge - lo) / Math.max(0.01, hi - lo));
    this.driftArc.attr('stroke-dashoffset', (100 - p * 100).toFixed(1));
  }

  private updateTags(r: RiderState, dt: number): void {
    const boosting = r.boostTime > 0.02;
    if (!boosting) this.boostMax = 0.01;
    else this.boostMax = Math.max(this.boostMax, r.boostTime);
    this.slideTag(this.boost, boosting, boosting ? r.boostTime / this.boostMax : 0, dt);
    const drafting = r.draft > 0.05 && r.mode === 'racing';
    this.slideTag(this.draft, drafting, r.draft, dt);
    this.draft.root.cls('is-ready', r.draft > 0.8);
  }

  private slideTag(tag: Tag, on: boolean, fill: number, dt: number): void {
    tag.vis = approach(tag.vis, on ? 1 : 0, dt / 0.12);
    tag.root.op(tag.vis);
    tag.root.tf(`skewX(-14deg) translateX(${(reducedMotion() ? 0 : (1 - tag.vis) * -40).toFixed(1)}px)`);
    if (tag.vis > 0) tag.fill.tf(`scaleX(${clamp01(fill).toFixed(3)})`);
  }
}
