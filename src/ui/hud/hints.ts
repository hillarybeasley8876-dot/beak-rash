// First-race control prompts: contextual key chips at the bottom centre during a profile's first races —
// hold throttle for the launch during the countdown, swing / heavy when a rival is in reach, drift before
// the first sharp bend, hop before the first crest or ramp, SHOWTIME once SP is full and someone is in
// reach (never while a cast would be denied). Glyphs follow the device in use (glyphs.ts). A prompt the
// player has already acted on never shows; each shows at most MAX_SHOWS times per app session and leaves
// as soon as the player does it. While a cut-in, cinematic or warning owns the screen the prompt waits
// (hidden, its clock frozen).
import './css/hints.css';
import type { Session } from '../../core/contracts';
import type { RiderState, TrackFrame } from '../../core/types';
import { enter, exit, slam } from './anim';
import { el, w, type W } from './dom';
import { keyGlyphs, type HudKey } from './glyphs';

export type HintId = 'launch' | 'swing' | 'drift' | 'hop' | 'ult';

interface Part { key: HudKey; label: string; pre?: string }
interface HintDef { en: string; cn: string; parts: Part[]; life: number }

const HINTS: Record<HintId, HintDef> = {
  launch: { en: 'LAUNCH', cn: '起步', parts: [{ pre: '按住', key: 'up', label: '起步加速' }], life: 8 },
  swing: { en: 'ATTACK', cn: '开打', parts: [{ key: 'attackL', label: '◀ 扇' }, { key: 'attackR', label: '扇 ▶' }, { key: 'heavy', label: '重击' }], life: 4.5 },
  drift: { en: 'DRIFT', cn: '弯道', parts: [{ key: 'drift', label: '+ 转向 = 漂移' }], life: 4 },
  hop: { en: 'HOP', cn: '前方坡道', parts: [{ key: 'hop', label: '跳！' }], life: 3.5 },
  ult: { en: 'SHOWTIME', cn: 'SP 满了', parts: [{ key: 'ult', label: '放大招！' }], life: 5 },
};

/** Prompts run while the save has fewer finished races than this (the profile's first two races). */
const FIRST_RACES = 2;
const MAX_SHOWS = 2;
const OUT = 0.14;
const COOLDOWN = 8;        // s before the same prompt may come back
const SCAN = 0.25;         // s between track look-ahead scans
const BEND_CURV = 1 / 90;  // 1/m: a bend that wants a drift (radius < 90 m)
const BEND_AHEAD = [30, 50, 70];
const CREST_NEAR = 12;     // m: a crest or ramp this close ahead (and no further than CREST_FAR) wants a hop
const CREST_FAR = 55;
const SETTLE = 3;          // s after GO before the riding prompts (the pack is still bunched on the grid)
const REACH = 2.2;         // m in s and x: a rival close enough to swing at
const MAX_WAIT = 1.5;      // s a prompt may wait hidden before its moment counts as gone

/** `wait`: s spent hidden behind a cut-in / cinematic / warning; `hidden`: hidden this frame. */
interface Live { id: HintId; t: number; life: number; wait: number; hidden: boolean }

export class Hints {
  private root: HTMLDivElement;
  private rootW: W;
  private card: HTMLDivElement;
  private live: Live | null = null;
  private shows = new Map<HintId, number>();
  private learned = new Set<HintId>();
  private lastEnd = new Map<HintId, number>();
  private on = false;
  private clock = 0;
  private scanT = 0;
  private bendAhead = false;
  private crests: number[] = [];
  private frame: TrackFrame | undefined;

  /** `ultReady`: SP is full and a SHOWTIME cast would find victims (the cluster's debounced ultTarget). */
  constructor(parent: HTMLElement, private ultReady: () => boolean) {
    this.root = el('div', 'ht', parent);
    this.rootW = w(this.root);
    this.card = el('div', 'ht-card', this.root);
    this.rootW.show(false);
  }

  /** A new race: prompts run only during the profile's first races (`racesDone` = save stats.races). */
  attach(session: Session | null, racesDone: number): void {
    this.on = session !== null && racesDone < FIRST_RACES;
    this.live = null;
    this.rootW.show(false);
    this.lastEnd.clear();
    this.crests = session
      ? session.track.features.filter((f) => f.kind === 'jumpCrest' || f.kind === 'ramp').map((f) => f.s0).sort((a, b) => a - b)
      : [];
  }

  /** The player did it (swing, hop, drift, SHOWTIME): that prompt leaves and is never needed again. */
  done(id: HintId): void {
    this.learned.add(id);
    const l = this.live;
    if (!l || l.id !== id) return;
    if (l.hidden) this.end(l);
    else l.life = Math.min(l.life, l.t + OUT);
  }

  /** `blocked`: a cut-in, cinematic or warning owns the screen (the prompt hides, its clock stops). */
  update(s: Session, dt: number, blocked: boolean): void {
    if (!this.on) return;
    this.clock += dt;
    this.scanT -= dt;
    if (this.scanT <= 0) {
      this.scanT = SCAN;
      this.bendAhead = this.scanBend(s, s.player);
    }
    const l = this.live;
    if (l) {
      if (this.stale(l.id, s)) l.life = Math.min(l.life, l.t + OUT);
      if (blocked) l.wait += dt;
      else l.t += dt;
      if (l.t >= l.life || l.wait > MAX_WAIT) this.end(l);
      else this.draw(l, blocked);
      return;
    }
    if (blocked) return;
    const next = this.trigger(s, s.player);
    if (next) this.show(next);
  }

  /** The moment a prompt belongs to is over: GO for the launch, the player went down for the others, and
   *  SHOWTIME once a cast would be denied (nobody in reach any more). */
  private stale(id: HintId, s: Session): boolean {
    if (id === 'launch') return s.phase !== 'countdown';
    if (id === 'ult' && !this.ultReady()) return true;
    return s.phase !== 'racing' || s.player.mode !== 'racing';
  }

  private trigger(s: Session, p: RiderState): HintId | null {
    if (s.phase === 'countdown') return this.ready('launch') ? 'launch' : null;
    if (s.phase !== 'racing' || p.mode !== 'racing' || s.time < SETTLE) return null;
    if (this.ready('ult') && this.ultReady()) return 'ult';
    if (this.ready('swing') && this.rivalInReach(s, p)) return 'swing';
    if (this.ready('hop') && p.speed > 6 && this.crests.some((c) => c - p.s > CREST_NEAR && c - p.s < CREST_FAR)) return 'hop';
    if (this.ready('drift') && this.bendAhead) return 'drift';
    return null;
  }

  private ready(id: HintId): boolean {
    return !this.learned.has(id) && (this.shows.get(id) ?? 0) < MAX_SHOWS && this.clock - (this.lastEnd.get(id) ?? -COOLDOWN) >= COOLDOWN;
  }

  private rivalInReach(s: Session, p: RiderState): boolean {
    return s.riders.some((r) => !r.isPlayer && r.mode === 'racing' && !r.mods.invisible &&
      Math.abs(r.s - p.s) < REACH && Math.abs(r.x - p.x) < REACH);
  }

  private scanBend(s: Session, p: RiderState): boolean {
    if (!this.on || s.phase !== 'racing' || p.speed < 9) return false;
    for (const d of BEND_AHEAD) {
      this.frame = s.track.frameAt(p.s + d, this.frame);
      if (Math.abs(this.frame.curvature) > BEND_CURV) return true;
    }
    return false;
  }

  private show(id: HintId): void {
    const def = HINTS[id];
    this.shows.set(id, (this.shows.get(id) ?? 0) + 1);
    this.card.textContent = '';
    const head = el('div', 'ht-head', this.card);
    el('b', '', head, def.en);
    el('i', '', head, def.cn);
    for (const part of def.parts) {
      const row = el('div', 'ht-part', this.card);
      if (part.pre) el('span', 'ht-pre', row, part.pre);
      keyGlyphs(el('kbd', 'ht-key', row), part.key);
      el('span', 'ht-lbl', row, part.label);
    }
    this.root.dataset.hint = id;
    this.live = { id, t: 0, life: def.life, wait: 0, hidden: false };
  }

  private draw(l: Live, blocked: boolean): void {
    l.hidden = blocked;
    this.rootW.show(!blocked);
    if (blocked) return;
    const y = (1 - enter(l.t, 0.14)) * 80 + exit(l.t, l.life, OUT) * 80;
    this.rootW.tf(`translate(-50%, ${y.toFixed(0)}px) scale(${slam(l.t, 0.16, 1.25).toFixed(3)})`);
    this.rootW.op(Math.min(1, (l.life - l.t) / OUT));
  }

  private end(l: Live): void {
    this.live = null;
    this.lastEnd.set(l.id, this.clock);
    this.rootW.show(false);
  }
}

/** Every Chinese string the prompts can show (fonts.ts warms the CJK subsets up). */
export const HINT_CN = Object.values(HINTS).map((d) => d.cn + d.parts.map((p) => (p.pre ?? '') + p.label).join('')).join('');
