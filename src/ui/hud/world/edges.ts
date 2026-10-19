// Edge warnings: chevrons at the bottom/side edges for rivals closing in from behind (angry ones and
// skill casts flash hot with the skill glyph), plus the police siren light bars and chip. A caster the camera
// can see gets no side chevron: its name tag flashes instead (tags.ts castFlash).
import { Vector3 } from 'three';
import { approach, clamp, clamp01 } from '../../../core/math';
import { ROSTER } from '../../../data/roster';
import type { Session } from '../../../core/contracts';
import type { RiderId, RiderState } from '../../../core/types';
import { SPECIES_GLYPH } from '../badge';
import { el, px, w, type W } from '../dom';
import { newPoint, type Projector } from './project';
import type { TagBox } from './tags';
import type { HudZones } from './zones';
import '../css/edges.css';

const REAR = 14;
const HOT_TIME = 1.1;

interface Chev {
  r: RiderState; root: W; inner: W; glyph: W; bang: W; vis: number; hot: number; hotGlyph: string;
  /** This frame: shown, bottom (rear) or side placement, wanted x, and the drawn position / rotation. */
  on: boolean; rear: boolean; want: number; x: number; y: number; rot: number;
}

/** Rear chevrons sit this far apart (px at 1080p): never on top of each other. */
const SPACING = 110;
/** Half the drawn chevron's box (px at 1080p): full size, tilted, pulsing. */
const HALF = 74;

export class EdgeWarnings {
  private chevHost: HTMLDivElement;
  private chevs: Chev[] = [];
  private boxList: TagBox[] = [];
  private police: W;
  private chip: W;
  /** police:alert is state-based (race unit): 0 = gone, 1 = chasing, 2 = alongside / closing in. */
  private alertLevel = 0;
  private policeVis = 0;
  private pt = newPoint();
  private v = new Vector3();

  /** `under`: a layer below the static HUD for the siren light bars (they must not tint the HUD). */
  constructor(parent: HTMLElement, under: HTMLElement) {
    const root = el('div', 'brh-edges', parent);
    const police = el('div', 'eg-police');
    under.prepend(police);
    this.police = w(police);
    const chip = el('div', 'eg-chip', root);
    el('span', 'eg-lamp', chip);
    el('b', '', chip, 'POLICE');
    el('i', '', chip, `${ROSTER.corgi.name}出没`);
    this.chip = w(chip);
    this.chevHost = el('div', 'brh-layer', root);
  }

  setRiders(riders: readonly RiderState[]): void {
    this.chevHost.textContent = '';
    this.chevs = [];
    for (const r of riders) {
      if (r.isPlayer) continue;
      const root = el('div', 'eg-chev', this.chevHost);
      const inner = el('div', 'eg-chev-in', root);
      el('div', 'eg-chev-o', inner);
      el('div', 'eg-chev-a', inner);
      const glyph = el('span', 'eg-chev-g', inner, SPECIES_GLYPH[r.character]);
      const bang = el('span', 'eg-chev-x', root, '!');
      this.chevs.push({
        r, root: w(root), inner: w(inner), glyph: w(glyph), bang: w(bang), vis: 0, hot: 0, hotGlyph: '',
        on: false, rear: false, want: 0, x: 0, y: 0, rot: 0,
      });
    }
  }

  /** A rival cast a skill near the player: flash its chevron with the skill glyph. */
  skillWarn(rider: RiderId, glyph: string): void {
    const c = this.chevs.find((x) => x.r.id === rider);
    if (!c) return;
    c.hot = HOT_TIME;
    c.hotGlyph = glyph;
  }

  policeAlert(level: number): void {
    this.alertLevel = level <= 0 ? 0 : level >= 2 ? 1 : 0.6;
  }

  clear(): void {
    this.alertLevel = 0;
    this.policeVis = 0;
    this.police.op(0);
    this.chip.op(0);
    for (const c of this.chevs) {
      c.vis = 0;
      c.hot = 0;
      c.root.show(false);
    }
  }

  update(session: Session, proj: Projector, zones: HudZones, k: number, dt: number): void {
    // Only the race's police:alert says an officer is actually on the road (heat alone is not a chase).
    this.policeVis = approach(this.policeVis, this.alertLevel, dt * 2.5);
    this.police.op(this.policeVis * 0.85);
    this.chip.op(clamp01((this.policeVis - 0.25) * 3));
    for (const c of this.chevs) this.updateChev(c, session, proj, k, dt);
    this.spreadRear(zones, k);
    this.spreadSide(k);
    this.boxList.length = 0;
    for (const c of this.chevs) {
      if (!c.on) continue;
      this.draw(c, k);
      // Side chevrons share the screen edges with docked taunt bubbles: report them as obstacles.
      if (!c.rear) this.boxList.push({ id: -1, cx: c.x, l: c.x - HALF * k, r: c.x + HALF * k, t: c.y - HALF * k, b: c.y + HALF * k });
    }
  }

  /** A rear chevron is drawn in the bottom band this frame. */
  get rearUp(): boolean {
    return this.chevs.some((c) => c.on && c.rear);
  }

  /** Screen boxes of the side chevrons drawn this frame (call after update). */
  boxes(): readonly TagBox[] {
    return this.boxList;
  }

  /** Rear chevrons in the free bottom band between the speedometer and the cluster's gauges, sorted by
   *  their wanted x and at least SPACING apart (squeezed evenly if the band is too narrow). */
  private spreadRear(zones: HudZones, k: number): void {
    const rear = this.chevs.filter((c) => c.on && c.rear).sort((a, b) => a.want - b.want);
    if (!rear.length) return;
    const lo = zones.speedo.r + HALF * k;
    const hi = zones.gauges.l - HALF * k;
    const gap = Math.min(SPACING * k, rear.length > 1 ? (hi - lo) / (rear.length - 1) : SPACING * k);
    let x = -Infinity;
    for (const c of rear) {
      x = Math.max(clamp(c.want, lo, hi), x + gap);
      c.x = x;
    }
    // Overflow past the right end: slide the row back left.
    const over = x - hi;
    if (over > 0) for (const c of rear) c.x = Math.max(lo, c.x - over);
  }

  /** Side chevrons (off-screen casters) stack upward per screen edge (below them sit the quip and cluster). */
  private spreadSide(k: number): void {
    let left = 0;
    let right = 0;
    for (const c of this.chevs) {
      if (!c.on || c.rear) continue;
      c.y -= (c.rot < 0 ? left++ : right++) * SPACING * k;
    }
  }

  /** True when r's head projects inside the screen (the rider and its tag are in plain view). */
  private inView(session: Session, proj: Projector, r: RiderState): boolean {
    return proj.project(proj.riderHead(session, r, 0.45, this.v), this.pt).onScreen;
  }

  private updateChev(c: Chev, session: Session, proj: Projector, k: number, dt: number): void {
    const r = c.r;
    const me = session.player;
    const width = proj.width;
    const height = proj.height;
    c.hot = Math.max(0, c.hot - dt);
    const ds = r.s - me.s;
    const dx = r.x - me.x;
    const alive = (r.mode === 'racing' || r.mode === 'respawning') && !r.mods.invisible;
    const angry = r.statuses.some((s) => s.id === 'angry' && s.source === me.id);
    const behind = ds < -0.8 && ds > -REAR;
    // Pack riding at equal speed is not a threat: only angry hunters, riders closing in fast
    // right behind, or riders winding up a swing at close range.
    const closing = r.speed - me.speed > 1.2 && ds > -6;
    const swinging = r.action !== null && (r.action.kind === 'attack' || r.action.kind === 'heavy') && ds > -4;
    let threat = 0;
    if (alive && behind && (angry || closing || swinging)) threat = (angry || swinging ? 1 : 0.7) * clamp01(1.15 + ds / REAR);
    if (alive && c.hot > 0 && ds < 4 && (ds < -0.8 || !this.inView(session, proj, r))) threat = 1;
    c.vis = approach(c.vis, threat, dt * 6);
    c.on = c.vis > 0.02;
    c.root.show(c.on);
    if (!c.on) return;
    const side = clamp(dx / 5, -1, 1);
    c.rear = ds < -0.8;
    if (c.rear) {
      c.want = width / 2 + side * width * 0.3;
      c.y = height - 92 * k;
      c.rot = side * 22;
    } else {
      c.x = dx < 0 ? 70 * k : width - 70 * k;
      c.y = height * 0.48; // above the quip / cluster corner
      c.rot = dx < 0 ? -90 : 90;
    }
  }

  private draw(c: Chev, k: number): void {
    const hot = c.hot > 0;
    const rot = c.rot;
    c.root.cls('is-hot', hot);
    c.glyph.text(hot ? c.hotGlyph : SPECIES_GLYPH[c.r.character]);
    c.glyph.tf(`rotate(${(-rot).toFixed(1)}deg)`);
    const pulse = hot ? 1 + 0.12 * Math.sin(c.hot * 30) : 1;
    const sc = k * (0.7 + 0.35 * c.vis) * pulse;
    c.root.tf(`translate(${px(c.x)}, ${px(c.y)})`);
    c.inner.tf(`rotate(${rot.toFixed(1)}deg) scale(${sc.toFixed(3)})`);
    // The "!" badge stays upright: above bottom chevrons, inward of side chevrons.
    const bx = c.rear ? 0 : (rot < 0 ? 62 : -62) * sc;
    const by = c.rear ? -78 * sc : -44 * sc;
    c.bang.tf(`translate(${px(bx)}, ${px(by)}) scale(${sc.toFixed(3)})`);
    c.root.op(c.vis);
  }
}
