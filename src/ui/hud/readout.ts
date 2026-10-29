// What the caster learns from a cast (r7, SPEC §29). Beside the skill cluster the player's own casts read
// 「命中 ×N」 while they land and 「落空」 when the skill ended without touching anybody, and every skill:result
// of the player (a rival's never shows). The rear callout at the bottom edge covers what happens behind the
// caster, where the chase camera shows nothing: the trap they just dropped back there (the audit found the
// peel invisible), and who rides over it — first the chaser, then the catch.
import './css/status.css';
import { Vector3 } from 'three';
import type { Session } from '../../core/contracts';
import type { GameEvents } from '../../core/events-map';
import type { RiderState } from '../../core/types';
import { ROSTER } from '../../data/roster';
import { SKILLS, type SkillCategory } from '../../data/skills';
import { fadeOut, slam } from './anim';
import { el, w, type W } from './dom';
import { newPoint, type Projector } from './world/project';

/** s a readout stays on screen. */
const LIFE = 2.2;
/** Readouts on screen at once (pooled; the oldest is reused). */
const MAX = 3;
/** s a rear callout stays on screen, and how many may show at once. */
const REAR_LIFE = 1.5;
const REAR_MAX = 2;
/** The categories whose casts report 命中 ×N / 落空 (move and defense skills speak for themselves). */
const COUNTED: ReadonlySet<SkillCategory> = new Set<SkillCategory>(['attack', 'control', 'summon', 'trap', 'gag']);
/** How a rear callout names what happened (a trap is stepped on, anything else is simply landed on). */
const REAR_VERB: Partial<Record<SkillCategory, string>> = { trap: '踩中' };
/** Top band of the frame (fraction of its height) a victim may be drawn in without a rear callout: the road
 *  ahead is above it, and a rider behind the player sits under the bike / the cluster or off the frame. */
const VIEW_BAND = 0.55;
/** m: how close behind the caster a rider must be to count as the chaser a trap is laid for. */
const BEHIND = 2;
const CHASE = 25;

/** One line on screen (the HUD debug surface). */
export interface ReadoutLine { text: string; age: number }

interface Line {
  root: W; text: W;
  /** What this line reports (one line per skill, one per result); '' = free. */
  key: string; label: string;
  t: number; active: boolean;
}

/** A pool of lines that show for LIFE s: same key refreshes its line instead of stacking a new one. */
class Lines {
  private pool: Line[] = [];

  constructor(parent: HTMLElement, cls: string, n: number, private life = LIFE) {
    const host = el('div', `${cls}-host`, parent);
    for (let i = 0; i < n; i++) {
      const root = el('div', cls, host);
      const line: Line = { root: w(root), text: w(el('b', '', root, '')), key: '', label: '', t: 0, active: false };
      line.root.show(false);
      this.pool.push(line);
    }
  }

  list(): ReadoutLine[] {
    return this.pool.filter((x) => x.active).map((x) => ({ text: x.label, age: x.t }));
  }

  clear(): void {
    for (const line of this.pool) {
      line.active = false;
      line.key = '';
      line.root.show(false);
    }
  }

  show(key: string, label: string, style: '' | 'is-good' | 'is-miss'): void {
    const line = this.pool.find((x) => x.key === key)
      ?? this.pool.find((x) => !x.active)
      ?? this.pool.reduce((a, x) => (x.t > a.t ? x : a));
    line.active = true;
    line.key = key;
    line.label = label;
    line.t = 0;
    line.text.text(label);
    line.root.cls('is-good', style === 'is-good');
    line.root.cls('is-miss', style === 'is-miss');
    line.root.show(true);
  }

  update(dt: number): void {
    for (const line of this.pool) {
      if (!line.active) continue;
      line.t += dt;
      if (line.t >= this.life) {
        line.active = false;
        line.key = '';
        line.root.show(false);
        continue;
      }
      const s = slam(line.t, 0.16, 1.3);
      line.root.op(fadeOut(line.t, this.life, 0.4));
      line.root.tf(s === 1 ? 'none' : `scale(${s.toFixed(3)})`);
    }
  }
}

/** The player's cast results beside the skill cluster. */
export class CasterReadout {
  private lines: Lines;
  /** skillId → the victims its running cast has hit so far. */
  private running = new Map<string, number>();
  private off: (() => void) | null = null;
  private session: Session | null = null;

  constructor(parent: HTMLElement) {
    this.lines = new Lines(parent, 'st-readout', MAX);
  }

  attach(session: Session | null): void {
    this.off?.();
    this.off = null;
    this.session = session;
    this.running.clear();
    this.lines.clear();
    if (!session) return;
    const bus = session.app.bus;
    const offs = [
      bus.on('skill:cast', (e) => this.onCast(e)),
      bus.on('skill:hit', (e) => this.onHit(e)),
      bus.on('skill:end', (e) => this.onEnd(e)),
      bus.on('skill:result', (e) => this.onResult(e)),
    ];
    this.off = () => {
      for (const off of offs) off();
    };
  }

  list(): ReadoutLine[] {
    return this.lines.list();
  }

  update(dt: number): void {
    this.lines.update(dt);
  }

  private counted(skillId: string): boolean {
    const def = SKILLS[skillId];
    return def !== undefined && COUNTED.has(def.category);
  }

  private onCast(e: GameEvents['skill:cast']): void {
    if (!this.mine(e.riderId) || !this.counted(e.skillId)) return;
    this.running.set(e.skillId, 0);
  }

  /** A victim: the running cast's count goes up (a hit after the skill ended reopens the count). */
  private onHit(e: GameEvents['skill:hit']): void {
    if (!this.mine(e.riderId) || !this.counted(e.skillId)) return;
    const n = (this.running.get(e.skillId) ?? 0) + 1;
    this.running.set(e.skillId, n);
    this.lines.show(`skill:${e.skillId}`, `命中 ×${n}`, 'is-good');
  }

  private onEnd(e: GameEvents['skill:end']): void {
    if (!this.mine(e.riderId) || !this.counted(e.skillId)) return;
    const n = this.running.get(e.skillId);
    this.running.delete(e.skillId);
    if (n === undefined || n > 0) return;
    this.lines.show(`skill:${e.skillId}`, '落空', 'is-miss');
  }

  /** The skill's own words (+30 HP, 偷到 15 SP…): the player's only. */
  private onResult(e: GameEvents['skill:result']): void {
    if (!this.mine(e.riderId)) return;
    this.lines.show(`result:${e.text}`, e.text, e.good ? 'is-good' : '');
  }

  private mine(riderId: number): boolean {
    return this.session !== null && this.session.player.id === riderId;
  }
}

/** What happens behind the caster, called out at the bottom edge: the trap they dropped back there and the
 *  rider chasing into it, then — same line — who actually rode over it. */
export class RearCallout {
  private lines: Lines;
  private off: (() => void) | null = null;
  private session: Session | null = null;
  private v = new Vector3();
  private pt = newPoint();

  constructor(parent: HTMLElement, private proj: Projector) {
    this.lines = new Lines(parent, 'st-rear', REAR_MAX, REAR_LIFE);
  }

  attach(session: Session | null): void {
    this.off?.();
    this.off = null;
    this.session = session;
    this.lines.clear();
    if (!session) return;
    const bus = session.app.bus;
    const offs = [
      bus.on('skill:cast', (e) => this.onCast(e)),
      bus.on('skill:hit', (e) => this.onHit(e)),
    ];
    this.off = () => {
      for (const off of offs) off();
    };
  }

  list(): ReadoutLine[] {
    return this.lines.list();
  }

  update(dt: number): void {
    this.lines.update(dt);
  }

  /** A trap lands behind the caster, where neither it nor the rider about to hit it is in frame: name both.
   *  A catch of the same skill rewrites this line (same key), so it reads as one story. */
  private onCast(e: GameEvents['skill:cast']): void {
    const s = this.session;
    const def = SKILLS[e.skillId];
    if (!s || e.riderId !== s.player.id || def?.category !== 'trap') return;
    const chaser = this.chaser(s);
    if (!chaser) return;
    this.lines.show(`skill:${e.skillId}`, `身后 · ${def.name} · ${ROSTER[chaser.character].name}在后面`, '');
  }

  private onHit(e: GameEvents['skill:hit']): void {
    const s = this.session;
    if (!s || e.riderId !== s.player.id) return;
    const victim = s.rider(e.victim);
    // Behind the player (never level or ahead) and not in the band of road the player is watching.
    if (!victim || victim.isPlayer || victim.s > s.player.s - 1.5) return;
    if (this.seenAhead(s, victim)) return;
    const def = SKILLS[e.skillId];
    const verb = REAR_VERB[def?.category ?? 'attack'] ?? '中了';
    this.lines.show(`skill:${e.skillId}`, `身后 · ${ROSTER[victim.character].name} ${verb}${def?.name ?? '一击'}！`, '');
  }

  /** The nearest rider chasing the player from behind, out of the watched band (null = nobody back there). */
  private chaser(s: Session): RiderState | null {
    let best: RiderState | null = null;
    for (const r of s.riders) {
      if (r.isPlayer || r.mode === 'crashed' || r.mode === 'busted') continue;
      const ds = r.s - s.player.s;
      if (ds > -BEHIND || ds < -CHASE) continue;
      if (this.seenAhead(s, r)) continue;
      if (!best || ds > best.s - s.player.s) best = r;
    }
    return best;
  }

  /** True when the victim is drawn in the upper band of the frame — the road ahead, where the player sees it.
   *  A rider behind the player sits between the camera and the bike (bottom of the frame, under the cluster),
   *  so the band, not the whole frame, is what "the caster saw it" means. */
  private seenAhead(s: Session, victim: RiderState): boolean {
    this.proj.project(this.proj.riderHead(s, victim, 0.6, this.v), this.pt, 0);
    return this.pt.onScreen && this.pt.y < this.proj.height * VIEW_BAND;
  }
}
