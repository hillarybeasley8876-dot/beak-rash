// Progress strip: the player's marker at its share of the track (red fill, distance to go), a checkered
// finish flag, and every rival's head badge. Rubber banding keeps the field within a few px of each other
// on a 3 km bar, so rival badges fan out in race order from the player's marker (ahead → right, behind →
// left, ≥ GAP px apart, nearest rival drawn on top) and the gaps to the riders just ahead / behind are
// written next to the marker in metres.
import './css/progress.css';
import { clamp, clamp01, damp } from '../../core/math';
import type { RiderState } from '../../core/types';
import { badge } from './badge';
import { el, px, w, type W } from './dom';

const BAR = 760;  // px between the start and the flag (1080p reference)
const GAP = 28;   // px between neighbouring rival badges (34 px wide: they overlap slightly)
const NEAR = 15;  // px from the player's marker to the first rival on either side
const MAX_GAP_M = 999;
const MAX_Z = 20;

const FLAG_SVG =
  '<svg viewBox="0 0 64 70" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
  '<path d="M10 4 L10 70" stroke="#0B0B0F" stroke-width="7" stroke-linecap="round"/>' +
  '<path d="M10 4 L10 70" stroke="#fff" stroke-width="3" stroke-linecap="round"/>' +
  '<path d="M12 6 C26 0 40 12 58 6 L58 38 C40 44 26 32 12 38 Z" fill="#fff" stroke="#0B0B0F" stroke-width="4" stroke-linejoin="round"/>' +
  '<path d="M12 6 L23 4.6 L23 15.5 L12 17 Z M34 7.7 L46 9.6 L46 20.6 L34 18.7 Z M23 15.5 L34 18.7 L34 29.5 L23 26.4 Z ' +
  'M46 20.6 L58 17 L58 27.6 L46 31.4 Z M12 27.3 L23 26.4 L23 36 L12 38 Z M34 29.5 L46 31.4 L46 41 L34 39 Z" fill="#0B0B0F"/>' +
  '</svg>';

interface Head { node: W; rider: RiderState; x: number; want: number; ds: number }

/** Spread one side's badges outward from `from` in order, at least GAP apart, inside [0, BAR]. */
function fan(side: Head[], from: number, dir: 1 | -1): void {
  let edge = from + dir * (NEAR - GAP);
  for (const h of side) {
    const want = dir > 0 ? Math.max(h.want, edge + GAP) : Math.min(h.want, edge - GAP);
    h.want = clamp(want, 0, BAR);
    edge = want;
  }
}

export class ProgressStrip {
  readonly root: HTMLDivElement;
  private fill: W;
  private dist: W;
  private gapAhead: W;
  private gapBehind: W;
  private headsHost: HTMLDivElement;
  private heads: Head[] = [];
  private me: Head | null = null;
  private fresh = true;

  constructor(parent: HTMLElement) {
    this.root = el('div', 'pg', parent);
    const bar = el('div', 'pg-bar', this.root);
    this.fill = w(el('div', 'pg-fill', bar));
    el('div', 'pg-ticks', bar);
    el('div', 'pg-stretch', bar);
    el('div', 'pg-start', this.root, 'START');
    el('div', 'pg-flag', this.root).innerHTML = FLAG_SVG;
    const dist = el('div', 'pg-dist', this.root);
    this.dist = w(el('span', '', dist, '0.00'));
    el('small', '', dist, 'KM');
    this.headsHost = el('div', 'pg-heads', this.root);
    this.gapAhead = w(el('span', 'pg-gap ahead'));
    this.gapBehind = w(el('span', 'pg-gap behind'));
  }

  /** Rebuild the badges for a new rider list (player last so it draws on top). */
  setRiders(riders: readonly RiderState[]): void {
    this.headsHost.textContent = '';
    this.heads = [];
    this.me = null;
    this.fresh = true;
    const ordered = riders.filter((r) => !r.isPlayer).concat(riders.filter((r) => r.isPlayer));
    for (const r of ordered) {
      const node = el('div', `pg-h${r.isPlayer ? ' me' : ''}`, this.headsHost);
      node.append(badge(r.character));
      const head: Head = { node: w(node), rider: r, x: 0, want: 0, ds: 0 };
      if (r.isPlayer) {
        el('div', 'pg-me-tag', node, 'YOU');
        node.append(this.gapAhead.node, this.gapBehind.node);
        this.me = head;
      }
      this.heads.push(head);
    }
  }

  update(trackLength: number, dt: number): void {
    const me = this.me;
    if (!me) return;
    const len = Math.max(1, trackLength);
    const prog = (r: RiderState): number => (r.finishTime !== null ? 1 : clamp01(r.s / len));
    const meP = prog(me.rider);
    const ahead: Head[] = [];
    const behind: Head[] = [];
    for (const h of this.heads) {
      h.want = prog(h.rider) * BAR;
      h.ds = h.rider.s - me.rider.s;
      if (h !== me) (h.ds >= 0 ? ahead : behind).push(h);
    }
    ahead.sort((a, b) => a.ds - b.ds);
    behind.sort((a, b) => b.ds - a.ds);
    fan(ahead, me.want, 1);
    fan(behind, me.want, -1);
    ahead.forEach((h, i) => h.node.style('z-index', String(MAX_Z - i)));
    behind.forEach((h, i) => h.node.style('z-index', String(MAX_Z - i)));
    for (const h of this.heads) this.draw(h, dt);
    this.fresh = false;
    this.gap(this.gapAhead, ahead[0], '+');
    this.gap(this.gapBehind, behind[0], '−');
    this.fill.tf(`scaleX(${meP.toFixed(3)})`);
    this.dist.text((Math.max(0, len - me.rider.s) / 1000).toFixed(2));
  }

  private draw(h: Head, dt: number): void {
    const r = h.rider;
    h.x = this.fresh ? h.want : damp(h.x, h.want, 12, dt);
    h.node.tf(`translateX(${px(h.x)})`);
    // Down riders are labelled by cause: KO (knocked out), 翻车 (any other crash), 罚停 (BUSTED ticket stop).
    h.node.cls('is-down', r.mode === 'crashed' || r.mode === 'busted');
    h.node.cls('is-wreck', r.mode === 'crashed' && r.crash?.cause !== 'ko');
    h.node.cls('is-busted', r.mode === 'busted');
    h.node.cls('is-hidden', !r.isPlayer && r.mods.invisible);
  }

  /** Metres to the nearest rival on one side of the player (hidden when there is none in reach). */
  private gap(label: W, h: Head | undefined, sign: string): void {
    const m = h ? Math.round(Math.abs(h.ds)) : Infinity;
    label.show(m <= MAX_GAP_M);
    if (m <= MAX_GAP_M) label.text(`${sign}${m}M`);
  }
}
