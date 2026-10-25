// Weapon slot: icon, name, the weapon's trait (SPEC §15) and the remaining uses (pips, or ∞ for bare
// wings). The count is combat's own RiderState.weaponUses (stolen and picked-up weapons keep their wear);
// '?' if combat never set it.
import { WEAPONS } from '../../data/weapons';
import type { RiderState, WeaponId } from '../../core/types';
import { slam } from './anim';
import { el, w, type W } from './dom';
import { weaponIcon } from './icons';
import './css/r4.css';

const MAX_PIPS = 10;

/** Hits left on r's weapon: a number, Infinity for bare wings, null when combat has not reported it. */
export function usesLeft(r: RiderState): number | null {
  if (r.weapon === 'none') return Infinity;
  return Number.isFinite(r.weaponUses) ? Math.max(0, r.weaponUses) : null;
}

export class WeaponSlot {
  readonly root: HTMLDivElement;
  private rootW: W;
  private ico: HTMLDivElement;
  private name: W;
  private trait: W;
  private usesHost: HTMLDivElement;
  private flashW: W;
  private pips: W[] = [];
  private count: W | null = null;
  /** The weapon on display (the rider's, or the one combat:weaponPick just reported). */
  private shown: WeaponId | null = null;
  /** The weapon combat:weaponPick reported — the HUD may hear of it before the rider state shows it. */
  private picked: WeaponId | null = null;
  private uses: number | null = -1;
  private flashT = 9;

  constructor(parent: HTMLElement) {
    this.root = el('div', 'wp', parent);
    this.rootW = w(this.root);
    el('span', 'wp-k', this.root, 'WEAPON');
    const body = el('div', 'wp-body', this.root);
    this.ico = el('div', 'wp-ico', body);
    const txt = el('div', 'wp-txt', body);
    this.name = w(el('span', 'wp-n', txt));
    this.trait = w(el('span', 'wp-trait', txt));
    this.usesHost = el('div', 'wp-u', body);
    this.flashW = w(el('div', 'wp-flash', this.root));
  }

  update(r: RiderState, dt: number): void {
    const id = r.weapon !== 'none' ? r.weapon : (this.picked ?? 'none');
    if (id !== this.shown) this.set(id);
    // The wear of a weapon the HUD only heard about is unknown: the slot says '?'.
    const uses = this.shown === r.weapon ? usesLeft(r) : null;
    if (uses !== this.uses) {
      this.uses = uses;
      this.renderUses();
    }
    this.flashT += dt;
    const t = this.flashT;
    this.rootW.tf(t < 0.25 ? `skewX(-14deg) scale(${slam(t, 0.2, 1.3).toFixed(3)})` : 'skewX(-14deg)');
    this.flashW.op(t < 0.3 ? 1 - t / 0.3 : 0);
  }

  /** combat:weaponPick: the HUD heard of the weapon (the rider state may catch up a frame later). */
  setPicked(weapon: WeaponId): void {
    this.picked = weapon;
  }

  /** The weapon is gone (dropped or broken): the slot falls back to the rider's own weapon. */
  clearPicked(): void {
    this.picked = null;
  }

  /** Rebuild the slot for a new weapon: pips sized by the weapon's full uses, or a ×N / ∞ counter. */
  private set(weapon: WeaponId): void {
    const def = WEAPONS[weapon];
    const changed = this.shown !== null && weapon !== this.shown;
    this.shown = weapon;
    this.uses = -1;
    this.ico.innerHTML = weaponIcon(weapon);
    this.name.text(def.name);
    this.trait.text(def.traitName ?? '');
    this.usesHost.textContent = '';
    this.pips = [];
    this.count = null;
    if (Number.isFinite(def.uses) && def.uses <= MAX_PIPS) {
      for (let i = 0; i < def.uses; i++) this.pips.push(w(el('span', 'wp-pip', this.usesHost)));
    }
    this.count = w(el('span', 'wp-x', this.usesHost));
    if (changed && weapon !== 'none') this.flashT = 0;
  }

  private renderUses(): void {
    const u = this.uses;
    const known = u !== null && u >= 0;
    const usePips = this.pips.length > 0 && known;
    this.pips.forEach((p, i) => {
      p.style('display', usePips ? '' : 'none');
      p.cls('off', !known || i >= (u ?? 0));
    });
    this.count?.style('display', usePips ? 'none' : '');
    this.count?.text(u === null ? '?' : Number.isFinite(u) ? `×${u}` : '∞');
    this.rootW.cls('is-last', u !== null && Number.isFinite(u) && u <= 1);
    this.rootW.cls('is-unknown', u === null);
  }
}
