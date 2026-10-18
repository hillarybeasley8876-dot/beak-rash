// Top-left place block ("3RD /8", P5 skew, slam + arrow on change), race timer, and the
// top-right KO / 小鱼干 counters.
import './css/place.css';
import { el, w, type W } from './dom';
import { envelope, slam } from './anim';

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

export class PlaceBlock {
  readonly root: HTMLDivElement;
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

  constructor(parent: HTMLElement) {
    this.root = el('div', 'plw', parent);
    const pl = el('div', 'pl', this.root);
    el('div', 'pl-star', pl);
    el('div', 'pl-shadow', pl);
    el('div', 'pl-shard', pl);
    this.flashW = w(el('div', 'pl-flash', pl));
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
    this.num.tf(t < 0.3 ? `scale(${slam(t, 0.2, 1.55).toFixed(3)})` : 'none');
    this.flashW.op(t < 0.14 ? 1 - t / 0.14 : 0);
    const a = envelope(t, 0, 0.08, 0.9, 1.2);
    this.arrow.op(a);
    this.arrow.tf(a > 0 ? `translateY(${((1 - a) * (this.up ? 18 : -18)).toFixed(1)}px)` : 'none');
  }

  private updateTicket(ticket: number, dt: number): void {
    const n = ticket > 0 ? Math.ceil(ticket) : 0;
    if (n !== this.tkShown) {
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
