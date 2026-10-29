// Status words (r7, SPEC §29): the moment a skill puts a status on a rider, its word (data/status-words.ts)
// slams in over that rider's head — P5 style, inked in the status colour on a black slab, bigger for riders
// near the player. One word per rider per status per REPOP s, at most POOL on screen, only for riders on
// screen and within RANGE m; the word rides above the name tag, so damage numbers keep their place.
import { Vector3 } from 'three';
import '../css/status.css';
import { clamp, clamp01, easeOutCubic } from '../../../core/math';
import type { Session } from '../../../core/contracts';
import type { RiderId, RiderState, StatusId } from '../../../core/types';
import { STATUS_WORDS } from '../../../data/status-words';
import { fadeOut, reducedMotion, slam } from '../anim';
import { el, px, w, type W } from '../dom';
import { newPoint, type Projector } from './project';
import type { TagBox } from './tags';

/** s a word stays on screen (slam in, hold, rise, fade). */
const LIFE = 1.1;
/** Words on screen at once (pooled; the oldest is reused). */
const POOL = 6;
/** m: a rider further away than this pops nothing (it would be a speck). */
const RANGE = 60;
/** s before the same rider may pop the same word again (a refresh is not a new status). */
const REPOP = 1.2;
/** m of head lift the word's anchor sits at, and how far above it the slab rides without a name tag. */
const LIFT = 1.05;
const HEAD_GAP = 46;
/** px above the player's own head: low, so it never lands in the column of words over the rivals ahead. */
const PLAYER_GAP = 62;
/** px above a name tag's box: clear of its status chips and of the element badge (elements.ts). */
const TAG_GAP = 56;
/** px between two words popped over the same rider in the same instant (a skill with two statuses). */
const STACK = 50;

/** One word on screen (the HUD debug surface). */
export interface StatusWordPop {
  rider: RiderId;
  status: StatusId;
  text: string;
  age: number;
}

interface Word {
  root: W; inner: W; text: W;
  rider: RiderId; status: StatusId; label: string;
  t: number; active: boolean;
}

export class StatusWords {
  private pool: Word[] = [];
  private pt = newPoint();
  private v = new Vector3();
  /** The statuses every rider carried last frame (one that was not there just took hold). */
  private prev = new Map<RiderId, Set<StatusId>>();
  private cur = new Map<RiderId, Set<StatusId>>();
  /** `${rider}:${status}` → when that word last popped (HUD time, so it holds under manual stepping). */
  private last = new Map<string, number>();
  private clock = 0;

  constructor(parent: HTMLElement) {
    const host = el('div', 'brh-layer stw-host', parent);
    for (let i = 0; i < POOL; i++) {
      const root = el('div', 'wa st-word', host);
      const inner = el('div', 'stw-in', root);
      const text = el('span', 'stw-t', inner);
      const word: Word = { root: w(root), inner: w(inner), text: w(text), rider: 0, status: 'stun', label: '', t: 0, active: false };
      word.root.show(false);
      this.pool.push(word);
    }
  }

  /** A new race: forget every status and every word. */
  attach(): void {
    this.prev.clear();
    this.cur.clear();
    this.last.clear();
    for (const word of this.pool) {
      word.active = false;
      word.root.show(false);
    }
  }

  /** The words on screen right now. */
  words(): StatusWordPop[] {
    return this.pool.filter((x) => x.active).map((x) => ({ rider: x.rider, status: x.status, text: x.label, age: x.t }));
  }

  update(session: Session, proj: Projector, k: number, dt: number, tags: readonly TagBox[]): void {
    this.clock += dt;
    this.scan(session, proj);
    this.draw(session, proj, k, dt, tags);
  }

  /** New statuses this frame pop their word; the two maps swap so a refresh is never a new status. */
  private scan(session: Session, proj: Projector): void {
    for (const set of this.cur.values()) set.clear();
    for (const r of session.riders) {
      let set = this.cur.get(r.id);
      if (!set) {
        set = new Set<StatusId>();
        this.cur.set(r.id, set);
      }
      for (const st of r.statuses) {
        const word = STATUS_WORDS[st.id];
        if (st.time <= 0 || !word) continue;
        set.add(st.id);
        if (this.prev.get(r.id)?.has(st.id)) continue;
        const key = `${r.id}:${st.id}`;
        if (this.clock - (this.last.get(key) ?? -Infinity) < REPOP) continue;
        if (!this.inView(session, r, proj)) continue;
        this.last.set(key, this.clock);
        this.pop(r.id, st.id, word);
      }
    }
    const swap = this.prev;
    this.prev = this.cur;
    this.cur = swap;
  }

  /** On screen, alive and close enough to read. */
  private inView(session: Session, r: RiderState, proj: Projector): boolean {
    if (r.mode === 'crashed' || r.mode === 'busted') return false;
    if (Math.abs(r.s - session.player.s) > RANGE) return false;
    proj.project(proj.riderHead(session, r, LIFT, this.v), this.pt, 40);
    return this.pt.onScreen;
  }

  private pop(rider: RiderId, status: StatusId, word: { word: string; color: string; bad: boolean }): void {
    const slot = this.pool.find((x) => !x.active) ?? this.pool.reduce((a, x) => (x.t > a.t ? x : a));
    slot.active = true;
    slot.t = 0;
    slot.rider = rider;
    slot.status = status;
    slot.label = word.word;
    slot.text.text(word.word);
    slot.text.style('color', word.color);
    slot.root.cls('is-good', !word.bad);
    slot.root.show(true);
  }

  /** The word follows its rider: above the name tag when there is one, above the head otherwise. */
  private draw(session: Session, proj: Projector, k: number, dt: number, tags: readonly TagBox[]): void {
    for (const word of this.pool) {
      if (!word.active) continue;
      word.t += dt;
      const r = session.rider(word.rider);
      if (word.t >= LIFE || !r) {
        word.active = false;
        word.root.show(false);
        continue;
      }
      proj.project(proj.riderHead(session, r, LIFT, this.v), this.pt, 40);
      if (!this.pt.onScreen) {
        word.root.show(false);
        continue;
      }
      word.root.show(true);
      const tag = tags.find((t) => t.id === r.id && Math.abs(t.cx - this.pt.x) < 120 * k && Math.abs(t.b - this.pt.y) < 90 * k);
      // Two words over one rider in the same instant (眩晕 + 减速) stack instead of covering each other.
      let stack = 0;
      for (const other of this.pool) if (other.active && other.rider === word.rider && other.t < word.t) stack++;
      const base = (tag ? tag.t - TAG_GAP * k : this.pt.y - (r.isPlayer ? PLAYER_GAP : HEAD_GAP) * k) - stack * STACK * k;
      const rise = reducedMotion() ? 0 : easeOutCubic(clamp01(word.t / LIFE)) * 46 * k;
      const s = k * (this.pt.depth < 20 ? 1.15 : 0.85) * slam(word.t, 0.12, 1.9);
      word.root.op(fadeOut(word.t, LIFE, 0.35));
      word.root.tf(`translate(${px(clamp(this.pt.x, 70 * k, proj.width - 70 * k))}, ${px(base - rise)})`);
      word.inner.tf(`scale(${s.toFixed(3)}) rotate(-6deg)`);
    }
  }
}
