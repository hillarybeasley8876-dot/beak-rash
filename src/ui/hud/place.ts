// Top-left place block ("3RD /8", P5 skew, slam + arrow on change), race timer, and the
// top-right KO / 小鱼干 counters. The place block rides at 0.75 while cruising and slams to full size for
// a while after GO, on every place change and during a BUSTED ticket stop.
import './css/place.css';
import { el, w, type W } from './dom';
import { approach } from '../../core/math';
import { envelope, reducedMotion, slam } from './anim';

export const ordinal = (n: number): string => {
  const t = n % 100;
  if (t >= 11 && t <= 13) return 'TH';
  return ['TH', 'ST', 'ND', 'RD'][n % 10] ?? 'TH';
};

export function fmtTime(sec: number): string {
  const t = Math.max(0, sec);
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const cs = Math.floor((t * 100) % 100);
  return `${m}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

/** s the place-change slash takes to wipe across the shard. */
const FLASH = 0.16;
/** Cruising scale of the block, and how long it stays full size after GO / a place change. */
const QUIET = 0.75;
const LOUD_HOLD = 2.5;

export class PlaceBlock {
  readonly root: HTMLDivElement;
  private rootW: W;
  private size = 1;
  private block: W;
  private num: W;
  private suf: W;
  private of: W;
  private arrow: W;
  private flashW: W;
  private time: W;
  private tk: W;
  private tkN: W;
  private place = 0;
  private flashT = 9;
  private up = true;
  private tkShown = 0;
  private tkT = 9;

  /** `onTick(n)` runs as the BUSTED ticket counts down to n (3, 2, 1): its sound cue. */
  constructor(parent: HTMLElement, private onTick: (n: number) => void = () => {}) {
    this.root = el('div', 'plw', parent);
    this.rootW = w(this.root);
    const pl = el('div', 'pl', this.root);
    el('div', 'pl-shadow', pl);
    el('div', 'pl-shard', pl);
    // Place change: a white slash wipes across the shard (clipped to it); 1ST: a spinning star pokes out right.
    this.flashW = w(el('div', 'pl-slash', el('div', 'pl-flash', pl)));
    el('div', 'pl-star', pl);
    this.num = w(el('div', 'pl-num', pl, '1'));
    this.suf = w(el('div', 'pl-suf', pl, 'ST'));
    this.of = w(el('div', 'pl-of', pl, '/8'));
    this.arrow = w(el('div', 'pl-arrow', pl, '▲'));
    this.block = w(pl);
    const tm = el('div', 'tm', this.root);
    el('span', 'tm-lbl', tm, 'TIME');
    this.time = w(el('span', 'tm-val', tm, '0:00.00'));
    // BUSTED ticket stop: 罚停 4·3·2·1 while race holds the player (the stop is the whole penalty).
    const tk = el('span', 'tm-tk', tm);
    el('i', '', tk, '罚停');
    this.tkN = w(el('b', '', tk, '4'));
    this.tk = w(tk);
  }

  /** Place changed during the race: slam the number and flash an arrow. */
  flash(from: number, to: number): void {
    this.flashT = 0;
    const up = to < from;
    this.up = up;
    this.arrow.text(up ? '▲' : '▼');
    this.arrow.cls('up', up);
    this.arrow.cls('down', !up);
  }

  /** `ticket` = seconds of BUSTED hold left (0 = none). */
  update(place: number, total: number, time: number, ticket: number, dt: number): void {
    if (place !== this.place) {
      this.place = place;
      this.num.text(String(place));
      this.suf.text(ordinal(place));
      this.block.cls('is-first', place === 1);
    }
    this.of.text(`/${total}`);
    this.time.text(fmtTime(time));
    this.updateTicket(ticket, dt);
    this.flashT += dt;
    const t = this.flashT;
    this.updateSize(t < LOUD_HOLD || time < LOUD_HOLD || ticket > 0, dt);
    this.num.tf(t < 0.3 ? `scale(${slam(t, 0.2, 1.55).toFixed(3)})` : 'none');
    const wipe = t / FLASH;
    this.flashW.show(wipe < 1);
    if (wipe < 1) this.flashW.tf(`translateX(${(-160 + wipe * 520).toFixed(0)}px) skewX(-24deg)`);
    const a = envelope(t, 0, 0.08, 0.9, 1.2);
    this.arrow.op(a);
    this.arrow.tf(a > 0 ? `translateY(${((1 - a) * (this.up ? 18 : -18)).toFixed(1)}px)` : 'none');
  }

  /** Full size snaps in fast (slam-like), the shrink back to QUIET is slow. */
  private updateSize(loud: boolean, dt: number): void {
    const want = loud ? 1 : QUIET;
    this.size = reducedMotion() ? want : approach(this.size, want, (dt * (1 - QUIET)) / (loud ? 0.1 : 0.45));
    this.rootW.tf(this.size >= 0.999 ? 'none' : `scale(${this.size.toFixed(3)})`);
  }

  private updateTicket(ticket: number, dt: number): void {
    const n = ticket > 0 ? Math.ceil(ticket) : 0;
    if (n !== this.tkShown) {
      if (n > 0 && n < this.tkShown) this.onTick(n);
      this.tkShown = n;
      this.tkT = 0;
      if (n > 0) this.tkN.text(String(n));
    }
    this.tkT += dt;
    this.tk.show(n > 0);
    this.tk.tf(n > 0 && this.tkT < 0.3 ? `scale(${slam(this.tkT, 0.2, 1.5).toFixed(3)})` : 'none');
  }
}

export class Counters {
  readonly root: HTMLDivElement;
  private ko: W;
  private coins: W;
  private koRow: W;
  private bumpT = 9;
  private lastKo = -1;

  constructor(parent: HTMLElement) {
    this.root = el('div', 'ctr', parent);
    const koRow = el('div', 'ctr-row ko', this.root);
    el('span', 'ctr-k', koRow, 'KO');
    this.ko = w(el('span', 'ctr-v', koRow, '0'));
    this.koRow = w(koRow);
    const coinRow = el('div', 'ctr-row coin', this.root);
    el('span', 'ctr-k', coinRow, '小鱼干');
    this.coins = w(el('span', 'ctr-v', coinRow, '0'));
  }

  update(kos: number, coins: number, dt: number): void {
    if (kos !== this.lastKo) {
      if (this.lastKo >= 0 && kos > this.lastKo) this.bumpT = 0;
      this.lastKo = kos;
      this.ko.text(`×${kos}`);
    }
    this.coins.text(String(Math.round(coins)));
    this.bumpT += dt;
    this.koRow.tf(this.bumpT < 0.25 ? `scale(${slam(this.bumpT, 0.18, 1.5).toFixed(3)})` : 'none');
  }
}
