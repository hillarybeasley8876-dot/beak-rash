// Weapon slot: icon, name and remaining uses (pips, or ∞ for bare wings). RiderState has no uses
// field yet (core request), so the slot counts the player's landed hits with the current weapon.
import { WEAPONS } from '../../data/weapons';
import type { RiderState, WeaponId } from '../../core/types';
import { slam } from './anim';
import { el, w, type W } from './dom';
import { weaponIcon } from './icons';

const MAX_PIPS = 10;

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
  private uses = Infinity;
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

  /** combat:weaponPick for the player: a fresh (or stolen) weapon. */
  picked(weapon: WeaponId): void {
    this.set(weapon);
  }

  /** combat:hit landed by the player. */
  used(weapon: WeaponId, skillId: string | null): void {
    if (skillId !== null || weapon !== this.weapon || !Number.isFinite(this.uses)) return;
    this.uses = Math.max(0, this.uses - 1);
    this.renderUses();
  }

  update(r: RiderState, dt: number): void {
    if (r.weapon !== this.weapon) this.set(r.weapon);
    this.flashT += dt;
    const t = this.flashT;
    this.rootW.tf(t < 0.25 ? `skewX(-14deg) scale(${slam(t, 0.2, 1.3).toFixed(3)})` : 'skewX(-14deg)');
    this.flashW.op(t < 0.3 ? 1 - t / 0.3 : 0);
  }

  private set(weapon: WeaponId): void {
    const def = WEAPONS[weapon];
    const changed = weapon !== this.weapon;
    this.weapon = weapon;
    this.uses = def.uses;
    this.ico.innerHTML = weaponIcon(weapon);
    this.name.text(def.name);
    this.usesHost.textContent = '';
    this.pips = [];
    this.count = null;
    if (Number.isFinite(def.uses) && def.uses <= MAX_PIPS) {
      for (let i = 0; i < def.uses; i++) this.pips.push(w(el('span', 'wp-pip', this.usesHost)));
    } else {
      this.count = w(el('span', 'wp-x', this.usesHost));
    }
    this.renderUses();
    if (changed && weapon !== 'none') this.flashT = 0;
  }

  private renderUses(): void {
    if (this.count) this.count.text(Number.isFinite(this.uses) ? `×${this.uses}` : '∞');
    this.pips.forEach((p, i) => p.cls('off', i >= this.uses));
    this.rootW.cls('is-last', Number.isFinite(this.uses) && this.uses <= 1);
  }
}
