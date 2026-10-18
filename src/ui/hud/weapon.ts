// Weapon slot: icon, name and remaining uses (pips, or ∞ for bare wings). The count is combat's own
// RiderState.weaponUses (stolen and picked-up weapons keep their wear); '?' if combat never set it.
import { WEAPONS } from '../../data/weapons';
import type { RiderState, WeaponId } from '../../core/types';
import { slam } from './anim';
import { el, w, type W } from './dom';
import { weaponIcon } from './icons';

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
  private usesHost: HTMLDivElement;
  private flashW: W;
  private pips: W[] = [];
  private count: W | null = null;
  private weapon: WeaponId | null = null;
  private uses: number | null = -1;
  private flashT = 9;

  constructor(parent: HTMLElement) {
    this.root = el('div', 'wp', parent);
    this.rootW = w(this.root);
    el('span', 'wp-k', this.root, 'WEAPON');
    const body = el('div', 'wp-body', this.root);
    this.ico = el('div', 'wp-ico', body);
    this.name = w(el('span', 'wp-n', body));
    this.usesHost = el('div', 'wp-u', body);
    this.flashW = w(el('div', 'wp-flash', this.root));
  }

  update(r: RiderState, dt: number): void {
    if (r.weapon !== this.weapon) this.set(r.weapon);
    const uses = usesLeft(r);
    if (uses !== this.uses) {
      this.uses = uses;
      this.renderUses();
    }
    this.flashT += dt;
    const t = this.flashT;
    this.rootW.tf(t < 0.25 ? `skewX(-14deg) scale(${slam(t, 0.2, 1.3).toFixed(3)})` : 'skewX(-14deg)');
    this.flashW.op(t < 0.3 ? 1 - t / 0.3 : 0);
  }

  /** Rebuild the slot for a new weapon: pips sized by the weapon's full uses, or a ×N / ∞ counter. */
  private set(weapon: WeaponId): void {
    const def = WEAPONS[weapon];
    const changed = this.weapon !== null && weapon !== this.weapon;
    this.weapon = weapon;
    this.uses = -1;
    this.ico.innerHTML = weaponIcon(weapon);
    this.name.text(def.name);
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
