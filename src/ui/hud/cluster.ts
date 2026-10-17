// P5 battle-style cluster (bottom-right): tilted portrait card with mood swaps, name plate, HP bar
// with a trailing damage chunk, SP bar that glows "SHOWTIME READY [P]", skill diamonds, weapon slot.
import './css/cluster.css';
import { approach, clamp01 } from '../../core/math';
import { ROSTER } from '../../data/roster';
import type { CharacterId, RiderState } from '../../core/types';
import { shake } from './anim';
import { PortraitCard } from './badge';
import { el, w, type W } from './dom';
import { setRansom } from './ransom';
import { SkillRow } from './skills';
import { WeaponSlot } from './weapon';

interface Bar { row: HTMLDivElement; fill: W; chunk: W | null; val: W; max: W | null }

export class Cluster {
  readonly root: HTMLDivElement;
  readonly skills: SkillRow;
  readonly weapon: WeaponSlot;
  private rootW: W;
  private card: PortraitCard;
  private cardWrap: W;
  private hurtW: W;
  private hp: Bar;
  private sp: Bar;
  private hpShown = 1;
  private chunkShown = 1;
  private chunkHold = 0;
  private hitT = 9;
  private smugT = 9;
  private lastHp = -1;
  private lastMax = -1;
  private lastSp = -1;

  constructor(parent: HTMLElement, character: CharacterId) {
    const def = ROSTER[character];
    this.root = el('div', 'cl', parent);
    this.rootW = w(this.root);
    this.skills = new SkillRow(this.root, character);
    const bars = el('div', 'cl-bars', this.root);
    this.hp = this.makeBar(bars, 'cl-hp', 'HP', true);
    this.sp = this.makeBar(bars, 'cl-sp', 'SP', false);
    const ready = el('div', 'cl-ready', this.sp.row);
    setRansom(el('span', '', ready), 'SHOWTIME READY', { seed: 5, scheme: 'mix', tilt: 7 });
    el('kbd', '', ready, 'P');
    this.weapon = new WeaponSlot(this.root);
    const wrap = el('div', 'cl-pc-wrap', this.root);
    this.cardWrap = w(wrap);
    el('div', 'cl-pc-shadow', wrap);
    const frame = el('div', 'cl-pc-frame', wrap);
    this.card = new PortraitCard(character, '', ['main', 'smug', 'hurt']);
    frame.append(this.card.node);
    this.hurtW = w(el('div', 'cl-hurt', frame));
    const name = el('div', 'cl-name', this.root);
    el('b', '', name, def.name);
    el('i', '', name, def.codename);
  }

  /** HP gets a max readout and a trailing damage chunk drawn under the fill. */
  private makeBar(parent: HTMLElement, cls: string, label: string, isHp: boolean): Bar {
    const row = el('div', `cl-row ${cls}`, parent);
    el('span', 'cl-k', row, label);
    const bar = el('div', 'cl-bar', row);
    const chunk = isHp ? w(el('div', 'cl-chunk', bar)) : null;
    const fill = w(el('div', 'cl-fill', bar));
    const v = el('span', 'cl-v', row);
    const val = w(el('span', '', v, '0'));
    const max = isHp ? w(el('small', '', v)) : null;
    return { row, fill, chunk, val, max };
  }

  /** The player took damage. */
  hurt(): void {
    this.hitT = 0;
    this.chunkHold = 0.45;
  }

  /** The player knocked someone out. */
  scored(): void {
    this.smugT = 0;
  }

  update(r: RiderState, dt: number): void {
    this.hitT += dt;
    this.smugT += dt;
    const frac = clamp01(r.hp / Math.max(1, r.maxHp));
    this.hpShown = frac < this.hpShown ? frac : approach(this.hpShown, frac, dt * 1.2);
    if (this.chunkHold > 0) this.chunkHold -= dt;
    else this.chunkShown = approach(this.chunkShown, this.hpShown, dt * 0.9);
    if (this.chunkShown < this.hpShown) this.chunkShown = this.hpShown;
    this.hp.fill.tf(`scaleX(${this.hpShown.toFixed(3)})`);
    this.hp.chunk?.tf(`scaleX(${this.chunkShown.toFixed(3)})`);
    const hpInt = Math.max(0, Math.ceil(r.hp));
    if (hpInt !== this.lastHp || r.maxHp !== this.lastMax) {
      this.lastHp = hpInt;
      this.lastMax = r.maxHp;
      this.hp.val.text(String(hpInt));
      this.hp.max?.text(`/${Math.round(r.maxHp)}`);
    }
    const spInt = Math.floor(clamp01(r.sp / 100) * 100);
    if (spInt !== this.lastSp) {
      this.lastSp = spInt;
      this.sp.val.text(String(spInt));
      this.sp.fill.tf(`scaleX(${(spInt / 100).toFixed(3)})`);
    }
    this.rootW.cls('is-full', r.sp >= this.skills.ultCostSp);
    this.rootW.cls('is-low', frac < 0.3 && r.mode !== 'crashed');
    const down = r.mode === 'crashed' || r.mode === 'busted';
    this.card.setMood(down || this.hitT < 0.7 || frac < 0.25 ? 'hurt' : this.smugT < 1.6 ? 'smug' : 'main');
    const sx = shake(this.hitT, 0.4, 10);
    this.cardWrap.tf(sx !== 0 ? `translateX(${sx.toFixed(1)}px)` : 'none');
    this.hurtW.op(this.hitT < 0.3 ? 0.55 * (1 - this.hitT / 0.3) : down ? 0.35 : 0);
    this.skills.update(r, dt);
    this.weapon.update(r, dt);
  }
}
