// Rival name tags for riders up to 25 m ahead, anchored above the head and fading with distance. Level of
// detail (taglayout.ts): up to three relevant rivals get the full plate (species dot, name, place, HP bar,
// one status chip: cast / angry / stunned / shield / weapon); the rest show a compact place pip. Plates
// leave the keep-clear area above the vanishing point sideways, with a leader line back to the rider.
// A rival casting a skill in view flashes its plate (hot outline + skill glyph) instead of an edge chevron.
import { Vector3 } from 'three';
import { approach, clamp, clamp01 } from '../../../core/math';
import { ROSTER } from '../../../data/roster';
import { WEAPONS } from '../../../data/weapons';
import type { Session } from '../../../core/contracts';
import type { RiderId, RiderState } from '../../../core/types';
import { reducedMotion, slam } from '../anim';
import { SPECIES_GLYPH } from '../badge';
import { el, px, w, type W } from '../dom';
import type { Rect } from './avoid';
import { newPoint, type Projector } from './project';
import { layoutTags, MAX_FULL, relevance, type TagLayoutItem } from './taglayout';
import type { HudZones } from './zones';

const AHEAD = 25;
const BEHIND = 8;
/** Fallback unscaled sizes (px) until the tag has been measured. */
const TAG_W = 160;
const TAG_H = 54;
const PIP_W = 58;
const PIP_H = 30;
/** The status chip pokes out above and to the right of the plate (world.css .nt-chip). */
const CHIP_OUT = 16;
const CAST_TIME = 1.1;
/** s a tag keeps its form (plate / pip) before it may switch back (no flicker at the 12 m line). */
const MODE_HOLD = 0.5;
/** A plate slid this far (px) from its rider draws a leader line and rides a little higher. */
const LEAD_MIN = 10;
/** A layout target moving more than this (px at 1080p) in one frame is a jump: eased, not followed. */
const JUMP = 8;
const CHIP_KINDS = ['cast', 'angry', 'stun', 'shield', 'weapon'] as const;

type ChipKind = (typeof CHIP_KINDS)[number] | '';

interface Tag {
  r: RiderState;
  root: W; inner: W; pip: W; pipPl: W; lead: W; end: W; tip: W;
  hp: W; pl: W; chip: W;
  vis: number; x: number; y: number; scale: number; depth: number;
  /** Full plate (true) or compact pip, and seconds since the form last changed. */
  full: boolean; modeT: number;
  /** Offset (px) of the drawn label's bottom-centre from the anchor (the layout target), and seconds since
   *  the label last jumped (it re-slams in place). */
  ox: number; oy: number; slamT: number;
  /** Drawn label position last frame (px). */
  lx: number; ly: number;
  /** Unscaled sizes of the plate and the pip (measured once laid out; 0 = not yet). */
  fw: number; fh: number; pw: number; ph: number;
  item: TagLayoutItem;
  box: TagBox;
  /** Seconds left of the skill-cast flash, and the skill's glyph. */
  cast: number; castGlyph: string;
}

/** A drawn tag's screen rectangle (chip overhang included), for overlays that must not cover it. */
export interface TagBox extends Rect { id: RiderId; cx: number }

function chipFor(r: RiderState, playerId: number): { kind: ChipKind; text: string } {
  const has = (id: string, src?: number): boolean => r.statuses.some((s) => s.id === id && (src === undefined || s.source === src));
  if (has('angry', playerId)) return { kind: 'angry', text: '怒' };
  if (has('stun') || r.mods.steerMul === 0) return { kind: 'stun', text: '晕' };
  if (r.mods.shield || has('shield')) return { kind: 'shield', text: '盾' };
  if (r.weapon !== 'none') return { kind: 'weapon', text: WEAPONS[r.weapon].name };
  return { kind: '', text: '' };
}

function build(r: RiderState, host: HTMLElement): Tag {
  const def = ROSTER[r.character];
  const root = el('div', 'wa nt', host);
  root.style.setProperty('--c1', def.colors.primary);
  root.style.setProperty('--c3', def.colors.accent === '#222222' ? '#E5191C' : def.colors.accent);
  const lead = el('div', 'nt-lead', root);
  const end = el('div', 'nt-end', root);
  const pip = el('div', 'nt-pip', root);
  el('span', 'nt-dot', pip, SPECIES_GLYPH[r.character]);
  const pipPl = el('span', 'nt-pl', pip);
  const inner = el('div', 'nt-in', root);
  const plate = el('div', 'nt-plate', inner);
  el('span', 'nt-dot', plate, SPECIES_GLYPH[r.character]);
  el('span', 'nt-name', plate, r.name);
  const pl = el('span', 'nt-pl', plate);
  const hpBox = el('div', 'nt-hp', inner);
  const hp = el('div', 'nt-hp-f', hpBox);
  const chip = el('span', 'nt-chip', inner);
  const tip = el('div', 'nt-tip', inner);
  return {
    r, root: w(root), inner: w(inner), pip: w(pip), pipPl: w(pipPl), lead: w(lead), end: w(end), tip: w(tip),
    hp: w(hp), pl: w(pl), chip: w(chip),
    vis: 0, x: 0, y: 0, scale: 1, depth: 0, full: false, modeT: MODE_HOLD, ox: 0, oy: 0, slamT: 9, lx: 0, ly: 0,
    fw: 0, fh: 0, pw: 0, ph: 0,
    item: { x: 0, y: 0, depth: 0, w: 0, h: 0, full: false, side: 0, tx: 0, ty: 0 },
    box: { id: r.id, cx: 0, l: 0, r: 0, t: 0, b: 0 },
    cast: 0, castGlyph: '',
  };
}

export class NameTags {
  private host: HTMLDivElement;
  private tags: Tag[] = [];
  private pt = newPoint();
  private v = new Vector3();
  private boxList: TagBox[] = [];
  private items: TagLayoutItem[] = [];
  private blocked: Rect[] = [];
  private unmeasured = true;

  /** Web fonts change the drawn sizes: measure again once they are in. */
  private onFonts = (): void => {
    this.unmeasured = true;
  };

  constructor(parent: HTMLElement) {
    this.host = el('div', 'brh-layer nt-host', parent);
    document.fonts?.addEventListener('loadingdone', this.onFonts);
  }

  dispose(): void {
    document.fonts?.removeEventListener('loadingdone', this.onFonts);
  }

  setRiders(riders: readonly RiderState[]): void {
    this.host.textContent = '';
    this.tags = riders.filter((r) => !r.isPlayer).map((r) => build(r, this.host));
    this.unmeasured = true;
  }

  /** Read the plate / pip sizes. Call at the start of the HUD frame, before any DOM writes (one layout
   *  per race or font load, never per frame); no-op while measured or while the HUD is not displayed. */
  measure(): void {
    if (!this.unmeasured || !this.tags.length) return;
    // A form that is not displayed reads 0 and keeps its last size (both forms show until first drawn).
    const read = (n: HTMLElement, old: [number, number]): [number, number] => (n.offsetWidth > 0 ? [n.offsetWidth, n.offsetHeight] : old);
    for (const t of this.tags) {
      [t.fw, t.fh] = read(t.inner.node as HTMLElement, [t.fw, t.fh]);
      [t.pw, t.ph] = read(t.pip.node as HTMLElement, [t.pw, t.ph]);
    }
    this.unmeasured = this.tags.some((t) => t.fw === 0 || t.pw === 0);
  }

  /** A rival in view cast a skill: flash its tag with the skill glyph. */
  castFlash(rider: RiderId, glyph: string): void {
    const t = this.tags.find((x) => x.r.id === rider);
    if (!t) return;
    t.cast = CAST_TIME;
    t.castGlyph = glyph;
  }

  /** `callouts` = the callout stack's rect while it shows (plates keep clear of it). */
  update(session: Session, proj: Projector, zones: HudZones, callouts: Rect | null, k: number, dt: number): void {
    const me = session.player;
    const shown: Tag[] = [];
    for (const t of this.tags) {
      t.cast = Math.max(0, t.cast - dt);
      t.modeT += dt;
      if (this.place(t, session, proj, k, dt)) shown.push(t);
      else {
        t.full = false;
        t.item.side = 0;
      }
    }
    this.chooseForms(shown, me);
    this.items.length = 0;
    for (const t of shown) {
      const it = t.item;
      it.x = t.x;
      it.y = t.y;
      it.depth = t.depth;
      it.full = t.full;
      it.w = (t.full ? t.fw || TAG_W : t.pw || PIP_W) * t.scale;
      it.h = (t.full ? t.fh || TAG_H : t.ph || PIP_H) * t.scale;
      this.items.push(it);
    }
    const pad = 8 * k;
    this.blocked.length = 0;
    if (callouts) this.blocked.push(callouts);
    layoutTags(this.items, zones.centre, this.blocked, proj.width, zones.progress.b, pad);
    this.boxList.length = 0;
    for (const t of shown) {
      const it = t.item;
      // A slid plate rides a little higher (ramped with the slide, so it never jumps).
      const slide = t.full ? clamp01((Math.hypot(it.tx - t.x, it.ty - t.y) - LEAD_MIN) / 30) : 0;
      const tx = it.tx - t.x;
      const ty = t.y - it.ty + slide * 14 * t.scale;
      // A layout jump (form switch, side change, new blocker) re-slams the label at its new spot, P5 style,
      // instead of sliding it across other labels or the keep-clear zone. It is a jump only when the label
      // neither rode along with its anchor nor stayed put (a plate held at the zone edge stays put).
      const lx = t.x + tx;
      const ly = t.y - ty;
      const j = JUMP * k;
      const moved = Math.abs(lx - t.lx) > j || Math.abs(ly - t.ly) > j;
      const offMoved = Math.abs(tx - t.ox) > j || Math.abs(ty - t.oy) > j;
      t.slamT = moved && offMoved ? 0 : t.slamT + dt;
      t.ox = tx;
      t.oy = ty;
      t.lx = lx;
      t.ly = ly;
      this.draw(t, me.id);
      if (t.vis > 0.2) this.boxList.push(this.boxOf(t));
    }
  }

  /** Screen rectangles of the tags drawn this frame (call after update). */
  boxes(): readonly TagBox[] {
    return this.boxList;
  }

  /** Up to MAX_FULL most relevant rivals get the plate; forms hold MODE_HOLD s (casts switch at once). */
  private chooseForms(shown: Tag[], me: RiderState): void {
    const scored = shown
      .map((t) => ({ t, score: relevance(t.r, me, t.cast > 0, t.full) }))
      .sort((a, b) => b.score - a.score);
    scored.forEach(({ t, score }, i) => {
      const want = score > 0 && i < MAX_FULL;
      if (want === t.full || (t.modeT < MODE_HOLD && t.cast <= 0)) return;
      t.full = want;
      t.modeT = 0;
    });
    // Holds never let more than MAX_FULL plates up: the least relevant extra ones fold at once.
    let full = 0;
    for (const { t } of scored) {
      if (!t.full || ++full <= MAX_FULL) continue;
      t.full = false;
      t.modeT = 0;
    }
  }

  private boxOf(t: Tag): TagBox {
    const it = t.item;
    const out = t.full ? CHIP_OUT * t.scale : 0;
    const box = t.box;
    box.cx = t.x + t.ox;
    box.l = box.cx - it.w / 2;
    box.r = box.cx + it.w / 2 + out;
    box.b = t.y - t.oy;
    box.t = box.b - it.h - out;
    return box;
  }

  /** Anchor, scale (k included) and visibility for one tag; true when it is drawn this frame. */
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
    const casting = t.cast > 0;
    const pulse = (casting && !reducedMotion() ? 1 + 0.08 * Math.sin(t.cast * 30) : 1) * slam(t.slamT, 0.1, 1.12);
    const lx = t.x + t.ox;
    const ly = t.y - t.oy;
    t.root.tf(`translate(${px(lx)}, ${px(ly)})`);
    t.root.op(t.vis);
    t.root.cls('is-cast', casting);
    t.root.cls('is-pip', !t.full);
    // The idle form is not displayed at all (no stale box for anything that measures the page).
    t.inner.style('display', t.full ? '' : 'none');
    t.pip.style('display', t.full ? 'none' : '');
    t.pipPl.text(String(r.place));
    // Leader from under the slid plate back to the rider's anchor, with a dot on the anchor.
    const dx = t.x - lx;
    const dy = t.y - ly;
    const len = Math.hypot(dx, dy);
    const lead = t.full && len > LEAD_MIN;
    t.lead.show(lead);
    t.end.show(lead);
    t.tip.show(!lead);
    if (lead) {
      t.lead.tf(`rotate(${Math.atan2(dy, dx).toFixed(3)}rad) scaleX(${len.toFixed(1)})`);
      t.end.tf(`translate(${px(dx)}, ${px(dy)}) scale(${t.scale.toFixed(3)})`);
    }
    (t.full ? t.inner : t.pip).tf(`scale(${(t.scale * pulse).toFixed(3)})`);
    // The plate's values stay current in pip form too (cached writes), so it is right the moment it unfolds.
    const f = clamp01(r.hp / Math.max(1, r.maxHp));
    t.hp.tf(`scaleX(${f.toFixed(3)})`);
    t.hp.cls('low', f < 0.3);
    t.pl.text(String(r.place));
    const chip = casting ? { kind: 'cast' as const, text: `${t.castGlyph}!` } : chipFor(r, playerId);
    t.chip.cls('on', chip.kind !== '');
    for (const kind of CHIP_KINDS) t.chip.cls(kind, chip.kind === kind);
    if (chip.text) t.chip.text(chip.text);
  }
}
