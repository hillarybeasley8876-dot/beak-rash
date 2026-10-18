// Progress strip: every rider's head badge at its share of the track, the player's marker on top,
// a checkered finish flag and the distance still to ride.
import './css/progress.css';
import { clamp01 } from '../../core/math';
import type { RiderState } from '../../core/types';
import { badge } from './badge';
import { el, px, w, type W } from './dom';

const BAR = 760; // px between the start and the flag (1080p reference)

const FLAG_SVG =
  '<svg viewBox="0 0 64 70" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
  '<path d="M10 4 L10 70" stroke="#0B0B0F" stroke-width="7" stroke-linecap="round"/>' +
  '<path d="M10 4 L10 70" stroke="#fff" stroke-width="3" stroke-linecap="round"/>' +
  '<path d="M12 6 C26 0 40 12 58 6 L58 38 C40 44 26 32 12 38 Z" fill="#fff" stroke="#0B0B0F" stroke-width="4" stroke-linejoin="round"/>' +
  '<path d="M12 6 L23 4.6 L23 15.5 L12 17 Z M34 7.7 L46 9.6 L46 20.6 L34 18.7 Z M23 15.5 L34 18.7 L34 29.5 L23 26.4 Z ' +
  'M46 20.6 L58 17 L58 27.6 L46 31.4 Z M12 27.3 L23 26.4 L23 36 L12 38 Z M34 29.5 L46 31.4 L46 41 L34 39 Z" fill="#0B0B0F"/>' +
  '</svg>';

interface Head { node: W; rider: RiderState }

export class ProgressStrip {
  readonly root: HTMLDivElement;
  private fill: W;
  private dist: W;
  private headsHost: HTMLDivElement;
  private heads: Head[] = [];
  private me: Head | null = null;

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
  }

  /** Rebuild the badges for a new rider list (player last so it draws on top). */
  setRiders(riders: readonly RiderState[]): void {
    this.headsHost.textContent = '';
    this.heads = [];
    this.me = null;
    const ordered = riders.filter((r) => !r.isPlayer).concat(riders.filter((r) => r.isPlayer));
    for (const r of ordered) {
      const node = el('div', `pg-h${r.isPlayer ? ' me' : ''}`, this.headsHost);
      node.append(badge(r.character));
      if (r.isPlayer) el('div', 'pg-me-tag', node, 'YOU');
      const head = { node: w(node), rider: r };
      this.heads.push(head);
      if (r.isPlayer) this.me = head;
    }
  }

  update(trackLength: number): void {
    const len = Math.max(1, trackLength);
    for (const h of this.heads) {
      const r = h.rider;
      const p = r.finishTime !== null ? 1 : clamp01(r.s / len);
      h.node.tf(`translateX(${px(p * BAR)})`);
      // Down riders are labelled by cause: KO (knocked out), 翻车 (any other crash), 罚停 (BUSTED ticket stop).
      h.node.cls('is-down', r.mode === 'crashed' || r.mode === 'busted');
      h.node.cls('is-wreck', r.mode === 'crashed' && r.crash?.cause !== 'ko');
      h.node.cls('is-busted', r.mode === 'busted');
      h.node.cls('is-hidden', !r.isPlayer && r.mods.invisible);
    }
    if (!this.me) return;
    const me = this.me.rider;
    const p = me.finishTime !== null ? 1 : clamp01(me.s / len);
    this.fill.tf(`scaleX(${p.toFixed(3)})`);
    this.dist.text((Math.max(0, len - me.s) / 1000).toFixed(2));
  }
}
