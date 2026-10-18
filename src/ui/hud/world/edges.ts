// Edge warnings: chevrons at the bottom/side edges for rivals closing in from behind (angry ones and
// skill casts flash hot with the skill glyph), plus the police siren glow and chip. A caster the camera
// can see gets no side chevron: its name tag flashes instead (tags.ts castFlash).
import { Vector3 } from 'three';
import { approach, clamp, clamp01 } from '../../../core/math';
import { ROSTER } from '../../../data/roster';
import type { Session } from '../../../core/contracts';
import type { RiderId, RiderState } from '../../../core/types';
import { SPECIES_GLYPH } from '../badge';
import { el, px, w, type W } from '../dom';
import { newPoint, type Projector } from './project';
import '../css/edges.css';

const REAR = 14;
const HOT_TIME = 1.1;

interface Chev { r: RiderState; root: W; inner: W; glyph: W; bang: W; vis: number; hot: number; hotGlyph: string }

export class EdgeWarnings {
  private chevHost: HTMLDivElement;
  private chevs: Chev[] = [];
  private police: W;
  private chip: W;
  /** police:alert is state-based (race unit): 0 = gone, 1 = chasing, 2 = alongside / closing in. */
  private alertLevel = 0;
  private policeVis = 0;
  private pt = newPoint();
  private v = new Vector3();

  constructor(parent: HTMLElement) {
    const root = el('div', 'brh-edges', parent);
    this.police = w(el('div', 'eg-police', root));
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
      this.chevs.push({ r, root: w(root), inner: w(inner), glyph: w(glyph), bang: w(bang), vis: 0, hot: 0, hotGlyph: '' });
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

  update(session: Session, proj: Projector, k: number, dt: number): void {
    // Only the race's police:alert says an officer is actually on the road (heat alone is not a chase).
    this.policeVis = approach(this.policeVis, this.alertLevel, dt * 2.5);
    this.police.op(this.policeVis * 0.85);
    this.chip.op(clamp01((this.policeVis - 0.25) * 3));
    for (const c of this.chevs) this.updateChev(c, session, proj, k, dt);
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
    c.root.show(c.vis > 0.02);
    if (c.vis <= 0.02) return;
    const side = clamp(dx / 5, -1, 1);
    let x: number;
    let y: number;
    let rot: number;
    if (ds < -0.8) {
      // Bottom band between the speedometer (left ~17 %) and the battle cluster (right from ~62 %).
      x = clamp(width / 2 + side * width * 0.3, width * 0.2, width * 0.6);
      y = height - 92 * k;
      rot = side * 22;
    } else {
      x = dx < 0 ? 70 * k : width - 70 * k;
      y = height * 0.56;
      rot = dx < 0 ? -90 : 90;
    }
    const hot = c.hot > 0;
    c.root.cls('is-hot', hot);
    c.glyph.text(hot ? c.hotGlyph : SPECIES_GLYPH[r.character]);
    c.glyph.tf(`rotate(${(-rot).toFixed(1)}deg)`);
    const pulse = hot ? 1 + 0.12 * Math.sin(c.hot * 30) : 1;
    const sc = k * (0.7 + 0.35 * c.vis) * pulse;
    c.root.tf(`translate(${px(x)}, ${px(y)})`);
    c.inner.tf(`rotate(${rot.toFixed(1)}deg) scale(${sc.toFixed(3)})`);
    // The "!" badge stays upright: above bottom chevrons, inward of side chevrons.
    const bx = ds < -0.8 ? 0 : (dx < 0 ? 62 : -62) * sc;
    const by = ds < -0.8 ? -78 * sc : -44 * sc;
    c.bang.tf(`translate(${px(bx)}, ${px(by)}) scale(${sc.toFixed(3)})`);
    c.root.op(c.vis);
  }
}
