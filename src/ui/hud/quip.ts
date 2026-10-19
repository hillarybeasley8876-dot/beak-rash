// Player quip: a short speech bubble from the battle-cluster portrait (bottom right, clear of the road)
// with the player character's own lines — KO (koLines), skill casts (skillLines[slot]), respawn
// (hurtLines) and the player's `taunt` events (bell 叮叮叮！, gulp 咕嘟！). Rate-limited like rival
// taunts; the lifetime waits while the HUD is hidden (cinematics), so a KO line plays once the KNOCK OUT
// cinematic hands the screen back. rect() tells the taunt bubbles where it sits.
import './css/quip.css';
import { ROSTER } from '../../data/roster';
import type { CharacterId } from '../../core/types';
import { exit, fadeOut, slam } from './anim';
import { el, w, type W } from './dom';
import type { Rect } from './world/avoid';

export type QuipKind = 'ko' | 'hurt' | 'skill' | 'taunt';
/** Kinds whose lines come from the character's roster entry (taunt text arrives with the event). */
type RosterKind = Exclude<QuipKind, 'taunt'>;

const KINDS: readonly QuipKind[] = ['ko', 'hurt', 'skill', 'taunt'];
const LIFE = 2.2;
const PRIORITY: Record<QuipKind, number> = { taunt: 1, skill: 1, hurt: 2, ko: 3 };
/** Box anchor inside the bottom-right corner (css/quip.css .qp) and that corner's offsets (css/base.css). */
const RIGHT = 26 + 30;
const BOTTOM = 318 + 24;
const FALLBACK_H = 58;
/** s between skill quips (skills come every few seconds; KO / respawn lines are rare and always speak). */
const SKILL_GAP = 9;
/** A lower-priority line may replace the current one after it has been read this long. */
const MIN_READ = 1.2;

export class Quip {
  private root: W;
  private text: W;
  private box: HTMLElement;
  /** Unscaled box size of the current line, measured when the line is set (bus handlers, not per frame). */
  private bw = 0;
  private bh = 0;
  private kind: QuipKind | null = null;
  private t = LIFE;
  private clock = 0;
  private lastSkill = -SKILL_GAP;
  private character: CharacterId | null = null;
  private turn: Record<'ko' | 'hurt', number> = { ko: 0, hurt: 0 };

  constructor(parent: HTMLElement) {
    const root = el('div', 'qp', parent);
    const box = el('div', 'qp-box', root);
    this.box = box;
    this.text = w(el('span', 'qp-text', box));
    el('div', 'qp-tail', root);
    this.root = w(root);
    this.root.show(false);
  }

  /** New race: lines come from the player's character; nothing carries over. */
  reset(character: CharacterId | null): void {
    this.character = character;
    this.kind = null;
    this.t = LIFE;
    this.lastSkill = this.clock - SKILL_GAP;
    this.turn = { ko: 0, hurt: 0 };
    this.root.show(false);
  }

  /** `slot` = skill slot 1–3 (skill quips only). */
  say(kind: RosterKind, slot = 1): void {
    if (!this.character) return;
    const live = this.kind !== null && this.t < LIFE;
    if (live && this.kind && PRIORITY[kind] < PRIORITY[this.kind] && this.t < MIN_READ) return;
    if (kind === 'skill' && this.clock - this.lastSkill < SKILL_GAP) return;
    const line = this.pick(kind, slot);
    if (!line) return;
    if (kind === 'skill') this.lastSkill = this.clock;
    this.show(kind, line);
  }

  /** The player's own `taunt` line (bell, gulp swallow): spoken here instead of over the road. */
  line(text: string): void {
    if (!this.character || !text) return;
    if (this.kind !== null && this.t < LIFE && PRIORITY[this.kind] > PRIORITY.taunt && this.t < MIN_READ) return;
    this.show('taunt', text);
  }

  /** Screen rect of the box while a line is up (null otherwise), for the taunt-bubble layout. */
  rect(width: number, height: number, k: number, out: Rect): Rect | null {
    if (this.kind === null || this.t >= LIFE) return null;
    out.r = width - RIGHT * k;
    out.b = height - BOTTOM * k;
    // Unmeasured (HUD hidden when the line arrived): 30 px glyphs + the box padding.
    const bw = this.bw || 46 + 30 * (this.text.node.textContent?.length ?? 0);
    out.l = out.r - bw * k;
    out.t = out.b - (this.bh || FALLBACK_H) * k;
    return out;
  }

  private show(kind: QuipKind, line: string): void {
    this.kind = kind;
    this.t = 0;
    this.text.text(line);
    for (const k of KINDS) this.root.cls(`is-${k}`, k === kind);
    // Measured here (a bus handler: layout is clean apart from this line), never inside update().
    this.bw = this.box.offsetWidth;
    this.bh = this.box.offsetHeight;
  }

  private pick(kind: RosterKind, slot: number): string | undefined {
    const def = this.character ? ROSTER[this.character] : null;
    if (!def) return undefined;
    if (kind === 'skill') return def.skillLines[slot - 1] ?? def.skillLines[0];
    const lines = kind === 'ko' ? def.koLines : def.hurtLines;
    if (!lines.length) return undefined;
    const i = this.turn[kind]++ % lines.length;
    return lines[i];
  }

  /** `hudAlpha` < 1 (intro / cinematic fade) freezes the line until the HUD is back. */
  update(dt: number, hudAlpha: number): void {
    this.clock += dt;
    if (this.kind === null || this.t >= LIFE) return;
    if (hudAlpha >= 0.999) this.t += dt;
    const t = this.t;
    if (t >= LIFE) {
      this.kind = null;
      this.root.show(false);
      return;
    }
    this.root.show(true);
    const out = exit(t, LIFE, 0.18);
    this.root.tf(`translate(${(out * 60).toFixed(1)}px, ${(out * 24).toFixed(1)}px) rotate(-4deg) scale(${slam(t, 0.16, 1.45).toFixed(3)})`);
    this.root.op(fadeOut(t, LIFE, 0.18));
  }
}
