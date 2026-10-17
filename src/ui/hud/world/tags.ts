// Rival name tags: species dot, name, current place, HP bar and one status chip (angry / stunned /
// shield / weapon), anchored above the head for riders up to 25 m ahead, fading with distance.
import { Vector3 } from 'three';
import { approach, clamp, clamp01, damp } from '../../../core/math';
import { ROSTER } from '../../../data/roster';
import { WEAPONS } from '../../../data/weapons';
import type { Session } from '../../../core/contracts';
import type { RiderState } from '../../../core/types';
import { SPECIES_GLYPH } from '../badge';
import { el, px, w, type W } from '../dom';
import { newPoint, type Projector } from './project';

const AHEAD = 25;
const BEHIND = 8;

interface Tag {
  r: RiderState;
  root: W;
  inner: W;
  hp: W;
  pl: W;
  chip: W;
  vis: number;
  x: number;
  y: number;
  scale: number;
  depth: number;
  /** Smoothed upward offset that keeps overlapping tags readable (px). */
  lift: number;
}

const TAG_W = 160;
const TAG_H = 54;

type ChipKind = 'angry' | 'stun' | 'shield' | 'weapon' | '';

function chipFor(r: RiderState, playerId: number): { kind: ChipKind; text: string } {
  const has = (id: string, src?: number): boolean => r.statuses.some((s) => s.id === id && (src === undefined || s.source === src));
  if (has('angry', playerId)) return { kind: 'angry', text: '怒' };
  if (has('stun') || r.mods.steerMul === 0) return { kind: 'stun', text: '晕' };
  if (r.mods.shield || has('shield')) return { kind: 'shield', text: '盾' };
  if (r.weapon !== 'none') return { kind: 'weapon', text: WEAPONS[r.weapon].name };
  return { kind: '', text: '' };
}

export class NameTags {
  private host: HTMLDivElement;
  private tags: Tag[] = [];
  private pt = newPoint();
  private v = new Vector3();

  constructor(parent: HTMLElement) {
    this.host = el('div', 'brh-layer nt-host', parent);
  }

  setRiders(riders: readonly RiderState[]): void {
    this.host.textContent = '';
    this.tags = [];
    for (const r of riders) {
      if (r.isPlayer) continue;
      const def = ROSTER[r.character];
      const root = el('div', 'wa nt', this.host);
      root.style.setProperty('--c1', def.colors.primary);
      root.style.setProperty('--c3', def.colors.accent === '#222222' ? '#E5191C' : def.colors.accent);
      const inner = el('div', 'nt-in', root);
      const plate = el('div', 'nt-plate', inner);
      el('span', 'nt-dot', plate, SPECIES_GLYPH[r.character]);
      el('span', 'nt-name', plate, r.name);
      const pl = el('span', 'nt-pl', plate);
      const hpBox = el('div', 'nt-hp', inner);
      const hp = el('div', 'nt-hp-f', hpBox);
      const chip = el('span', 'nt-chip', inner);
      el('div', 'nt-tip', inner);
      this.tags.push({ r, root: w(root), inner: w(inner), hp: w(hp), pl: w(pl), chip: w(chip), vis: 0, x: 0, y: 0, scale: 1, depth: 0, lift: 0 });
    }
  }

  update(session: Session, proj: Projector, k: number, dt: number): void {
    const me = session.player;
    const shown: Tag[] = [];
    for (const t of this.tags) {
      if (this.place(t, session, proj, k, dt)) shown.push(t);
    }
    // Nearest tags keep their spot; farther ones that overlap are pushed up above them.
    shown.sort((a, b) => a.depth - b.depth);
    shown.forEach((t, i) => {
      let y = t.y;
      for (let j = 0; j < i; j++) {
        const o = shown[j];
        if (!o) continue;
        const h = TAG_H * Math.max(t.scale, o.scale);
        const wd = (TAG_W * (t.scale + o.scale)) / 2;
        if (Math.abs(t.x - o.x) < wd && Math.abs(y - (o.y - o.lift)) < h) y = o.y - o.lift - h;
      }
      t.lift = damp(t.lift, t.y - y, 14, dt);
      this.draw(t, me.id);
    });
  }

  /** Position, scale (k included) and visibility for one tag; true when it is drawn this frame. */
  private place(t: Tag, session: Session, proj: Projector, k: number, dt: number): boolean {
    const r = t.r;
    const ds = r.s - session.player.s;
    let want = 0;
    if (r.mode !== 'crashed' && r.mode !== 'busted' && !r.mods.invisible && ds > -BEHIND && ds < AHEAD) {
      proj.project(proj.riderHead(session, r, 0.45, this.v), this.pt, 60);
      if (this.pt.onScreen) {
        want = clamp01(1 - (ds - 15) / (AHEAD - 15)) * clamp01((this.pt.depth - 1.6) / 1.4);
        if (r.mode === 'respawning') want *= 0.5;
        t.x = this.pt.x;
        t.y = this.pt.y;
        t.depth = this.pt.depth;
        // Never below ~0.6 effective scale (13 px names) so tags stay legible at 1280×720.
        t.scale = Math.max(0.6, k * clamp(1.12 - this.pt.depth / 45, 0.62, 1.05));
      }
    }
    t.vis = approach(t.vis, want, dt * 7);
    t.root.show(t.vis > 0.01);
    return t.vis > 0.01;
  }

  private draw(t: Tag, playerId: number): void {
    const r = t.r;
    t.root.tf(`translate(${px(t.x)}, ${px(t.y - t.lift)})`);
    t.inner.tf(`scale(${t.scale.toFixed(3)})`);
    t.root.op(t.vis);
    const f = clamp01(r.hp / Math.max(1, r.maxHp));
    t.hp.tf(`scaleX(${f.toFixed(3)})`);
    t.hp.cls('low', f < 0.3);
    t.pl.text(String(r.place));
    const chip = chipFor(r, playerId);
    t.chip.cls('on', chip.kind !== '');
    for (const kind of ['angry', 'stun', 'shield', 'weapon'] as const) t.chip.cls(kind, chip.kind === kind);
    if (chip.text) t.chip.text(chip.text);
  }
}
