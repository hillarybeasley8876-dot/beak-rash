// Skill diamonds (U/I/O or LB/✚↑/✚↓ with glyph, cooldown sweep, ready pop, denied shake) + the ult diamond (P / R3)
// that fills with SP, and the weapon slot (icon, name, uses).
import './css/skills.css';
import { approach, clamp01 } from '../../core/math';
import { SKILLS, type SkillDef } from '../../data/skills';
import type { CharacterId, RiderState } from '../../core/types';
import { shake, slam } from './anim';
import { el, w, type W } from './dom';
import { keyGlyphs, SLOT_KEYS, type HudKey } from './glyphs';

const DENY_TEXT: Record<'cooldown' | 'sp' | 'state', string> = { cooldown: '冷却中', sp: 'SP 不足', state: '现在不行' };

/** Skills in the player's U/I/O slots and the ult, derived from data/skills.ts. */
export function playerKit(character: CharacterId): { slots: Array<SkillDef | null>; ult: SkillDef | null } {
  const own = Object.values(SKILLS).filter((s) => s.owner === character);
  const slots: Array<SkillDef | null> = [1, 2, 3].map((n) => own.find((s) => s.slot === n) ?? null);
  if (!slots.some(Boolean)) slots[0] = own.find((s) => s.slot === 'sig') ?? null;
  return { slots, ult: own.find((s) => s.slot === 'ult') ?? null };
}

class Diamond {
  readonly root: W;
  protected readonly boxEl: HTMLElement;
  protected readonly innerEl: HTMLElement;
  protected flash: W;
  private denyW: W;
  protected popT = 9;
  private denyT = 9;

  constructor(parent: HTMLElement, cls: string, glyph: string, key: HudKey) {
    const d = el('div', `sk-d ${cls}`, parent);
    this.root = w(d);
    this.boxEl = el('div', 'sk-box', d);
    this.innerEl = el('div', 'sk-in', d);
    el('span', 'sk-g', this.innerEl, glyph);
    keyGlyphs(el('span', 'sk-key', d), key);
    this.flash = w(el('div', 'sk-flash', d));
    this.denyW = w(el('div', 'sk-deny', d));
  }

  deny(text: string): void {
    this.denyT = 0;
    this.denyW.text(text);
  }

  protected animate(dt: number): void {
    this.popT += dt;
    this.denyT += dt;
    const sx = shake(this.denyT, 0.35, 7);
    const sc = this.popT < 0.25 ? slam(this.popT, 0.2, 1.35) : 1;
    this.root.tf(sx !== 0 || sc !== 1 ? `translateX(${sx.toFixed(1)}px) scale(${sc.toFixed(3)})` : 'none');
    this.flash.op(this.popT < 0.18 ? 1 - this.popT / 0.18 : 0);
    this.root.cls('is-denied', this.denyT < 0.3);
    const da = this.denyT < 0.9 ? (this.denyT < 0.7 ? 1 : 1 - (this.denyT - 0.7) / 0.2) : 0;
    this.denyW.op(da);
  }
}

class SkillDiamond extends Diamond {
  private sweep: W;
  private secs: W;
  private full: number;
  private prev = 0;

  constructor(parent: HTMLElement, readonly skill: SkillDef | null, key: HudKey) {
    super(parent, skill ? '' : 'is-empty', skill?.glyph ?? '—', key);
    this.full = Math.max(0.1, skill?.cooldown ?? 1);
    this.sweep = w(el('div', 'sk-sweep', this.boxEl));
    this.secs = w(el('span', 'sk-t', this.innerEl));
  }

  update(cd: number, dt: number): void {
    if (cd > this.prev + 0.05) this.full = Math.max(cd, 0.1); // cast: remember the real duration
    if (this.prev > 0 && cd <= 0) this.popT = 0;              // came off cooldown
    this.prev = cd;
    const cooling = cd > 0;
    this.root.cls('is-cd', cooling);
    this.root.cls('is-ready', !cooling && this.skill !== null);
    this.sweep.style('--cd', cooling ? clamp01(cd / this.full).toFixed(3) : '0');
    if (cooling) this.secs.text(cd >= 1 ? String(Math.ceil(cd)) : cd.toFixed(1));
    this.animate(dt);
  }
}

class UltDiamond extends Diamond {
  private fillW: W;
  private ready = false;
  /** Displayed fill; -1 = not drawn yet (snap to the real value on the first frame). */
  private shown = -1;

  constructor(parent: HTMLElement, glyph: string) {
    super(parent, 'ult', glyph, 'ult');
    this.fillW = w(el('div', 'sk-ultfill', this.boxEl));
  }

  update(sp: number, cost: number, dt: number): void {
    const f = clamp01(sp / Math.max(1, cost));
    this.shown = this.shown < 0 ? f : approach(this.shown, f, dt * 3);
    this.fillW.style('--fill', this.shown.toFixed(3));
    const ready = f >= 1;
    if (ready && !this.ready) this.popT = 0;
    this.ready = ready;
    this.root.cls('is-ready', ready);
    this.animate(dt);
  }
}

export class SkillRow {
  readonly root: HTMLDivElement;
  private diamonds: SkillDiamond[] = [];
  private ult: UltDiamond | null = null;
  private ultCost = 100;

  constructor(parent: HTMLElement, character: CharacterId) {
    this.root = el('div', 'sk', parent);
    const kit = playerKit(character);
    kit.slots.forEach((s, i) => this.diamonds.push(new SkillDiamond(this.root, s, SLOT_KEYS[i] ?? 'skill1')));
    if (kit.ult) {
      this.ult = new UltDiamond(this.root, kit.ult.glyph);
      this.ultCost = kit.ult.spCost > 0 ? kit.ult.spCost : 100;
    }
  }

  get ultCostSp(): number {
    return this.ultCost;
  }

  update(r: RiderState, dt: number): void {
    this.diamonds.forEach((d, i) => d.update(r.cooldowns[i] ?? 0, dt));
    this.ult?.update(r.sp, this.ultCost, dt);
  }

  /** skill:denied for the player. Slots 1–3 are the U/I/O skills (SkillDef.slot); anything else is the ult. */
  deny(slot: number, reason: 'cooldown' | 'sp' | 'state'): void {
    const text = DENY_TEXT[reason];
    if (slot >= 1 && slot <= this.diamonds.length) this.diamonds[slot - 1]?.deny(text);
    else this.ult?.deny(text);
  }
}
