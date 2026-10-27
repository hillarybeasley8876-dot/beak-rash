// First-race control prompts: contextual key chips at the bottom centre during a profile's first races —
// hold throttle for the launch during the countdown, swing / heavy when a rival is in reach, drift before
// the first sharp bend, hop before the first crest or ramp, SHOWTIME once SP is full and someone is in
// reach (never while a cast would be denied). Glyphs follow the device in use (glyphs.ts). A prompt the
// player has already acted on never shows; each shows at most MAX_SHOWS times per app session and leaves
// as soon as the player does it. While a cut-in, cinematic or warning owns the screen the prompt waits
// (hidden, its clock frozen).
// r5 (teach): the r4 mechanics get their own prompts — the air trick, the baton tell and the 「V我50」
// bribe. Those run in EVERY race, not only the first two, at most PROFILE_MAX times per profile each; the
// counters live in localStorage (like the throw chip's beak-rash.hint.throw).
import './css/hints.css';
import type { Session } from '../../core/contracts';
import type { EventBus } from '../../core/events';
import type { GameEvents } from '../../core/events-map';
import type { RiderState, TrackFrame } from '../../core/types';
import { enter, exit, slam } from './anim';
import { el, w, type W } from './dom';
import { keyGlyphs, type HudKey } from './glyphs';

export type HintId = 'launch' | 'swing' | 'drift' | 'hop' | 'ult' | 'trick' | 'baton' | 'bribe';

interface Part { key: HudKey; label: string; pre?: string }
interface HintDef { en: string; cn: string; parts: Part[]; life: number }

/** The classic prompts: they only run during the profile's first races. */
const CLASSIC: ReadonlySet<HintId> = new Set(['launch', 'swing', 'drift', 'hop', 'ult']);
/** The r4 prompts: every race, every profile, at most PROFILE_MAX times each (remembered per profile). */
const R4: ReadonlySet<HintId> = new Set(['trick', 'baton', 'bribe']);

const HINTS: Record<HintId, HintDef> = {
  launch: { en: 'LAUNCH', cn: '起步', parts: [{ pre: '按住', key: 'up', label: '起步加速' }], life: 8 },
  swing: { en: 'ATTACK', cn: '开打', parts: [{ key: 'attackL', label: '◀ 扇' }, { key: 'attackR', label: '扇 ▶' }, { key: 'heavy', label: '重击' }], life: 4.5 },
  drift: { en: 'DRIFT', cn: '弯道', parts: [{ key: 'drift', label: '+ 转向 = 漂移' }], life: 4 },
  hop: { en: 'HOP', cn: '前方坡道', parts: [{ key: 'hop', label: '跳！' }], life: 3.5 },
  ult: { en: 'SHOWTIME', cn: 'SP 满了', parts: [{ key: 'ult', label: '放大招！' }], life: 5 },
  trick: { en: 'AIR TRICK', cn: '空中！', parts: [
    { pre: '按住', key: 'drift', label: '+' },
    { key: 'steer', label: '转体' },
    { key: 'brake', label: '后空翻' },
    { key: 'hop', label: '前空翻' },
  ], life: 4 },
  baton: { en: 'BATON', cn: '警棍！', parts: [
    { key: 'brake', label: '刹车' },
    { key: 'steer', label: '闪开' },
    { key: 'attackL', label: '出手 = 平底锅弹反' },
  ], life: 4.5 },
  bribe: { en: 'BRIBE', cn: 'V我50', parts: [
    { key: 'bell', label: '靠近柯基打铃' },
  ], life: 6 },
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
// --- r5 (teach): the r4 prompts (SPEC §14–§16) ---
const PROFILE_MAX = 2;     // times per profile (the counters live in localStorage)
const R4_COOLDOWN = 8;     // s before the same r4 prompt may come back
const STORE = 'beak-rash.hints';
const TRICK_AIR = 0.55;    // s: a spin takes 0.55 s (SPEC §16) — the prompt waits for that much air
const AIR_G = 17;          // the launched-air gravity (sim/tuning.ts airGravity)
const BRIBE_COST = 50;     // 小鱼干 the corgi asks for (SPEC §14)

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
  // --- r5 (teach) ---
  private session: Session | null = null;
  private counts = new Map<HintId, number>();   // the r4 prompts, remembered per profile
  private lastShow = new Map<HintId, number>(); // the r4 cooldown clock
  private wanted = 0;                           // the wanted stars (police:wanted)
  private batonPending = false;                 // a baton wind-up is aimed at the player
  private offs: Array<() => void> = [];

  /** `ultReady`: SP is full and a SHOWTIME cast would find victims (the cluster's debounced ultTarget). */
  constructor(parent: HTMLElement, private ultReady: () => boolean, bus: EventBus<GameEvents>) {
    this.root = el('div', 'ht', parent);
    this.rootW = w(this.root);
    this.card = el('div', 'ht-card', this.root);
    this.rootW.show(false);
    this.wire(bus);
  }

  /** The police tells the prompts what to teach (SPEC §14): a wind-up is a baton, a wanted level is a
   *  bribe window. */
  private wire(bus: EventBus<GameEvents>): void {
    this.offs.push(bus.on('police:windup', (e) => {
      if (this.isPlayer(e.riderId)) this.batonPending = true;
    }));
    this.offs.push(bus.on('police:wanted', (e) => {
      if (this.isPlayer(e.riderId)) this.wanted = e.level;
    }));
  }

  private isPlayer(id: number): boolean {
    return this.session !== null && this.session.player.id === id;
  }

  /** A new race: the classic prompts run only during the profile's first races (`racesDone` = save stats.races);
   *  the r4 prompts run in every race, but only PROFILE_MAX times per profile. */
  attach(session: Session | null, racesDone: number): void {
    this.session = session;
    this.on = session !== null && racesDone < FIRST_RACES;
    this.live = null;
    this.rootW.show(false);
    this.lastEnd.clear();
    this.wanted = 0;
    this.batonPending = false;
    this.loadCounts();
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
    this.clock += dt;
    this.scanT -= dt;
    if (this.scanT <= 0) {
      this.scanT = SCAN;
      this.bendAhead = this.scanBend(s, s.player);
      this.loadCounts();
    }
    // The r4 prompts jump the queue: a baton tell or an open trick window must not wait for a classic one.
    if (!blocked) {
      const urgent = this.batonPending ? 'baton' : this.r4Trigger(s, s.player);
      if (urgent) {
        this.batonPending = false;
        if (this.r4Ready(urgent)) this.forceShow(urgent);
      }
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
    if (!this.on) return;
    const next = this.trigger(s, s.player);
    if (next) this.show(next);
  }

  /** The r4 prompt that belongs to this moment: a wanted player who can pay the bribe, or an air with
   *  enough room for a spin (SPEC §14, §16). */
  private r4Trigger(s: Session, p: RiderState): HintId | null {
    if (s.phase !== 'racing' || p.mode !== 'racing') return null;
    if (this.wanted >= 1 && this.wanted <= 2 && p.coins >= BRIBE_COST) return 'bribe';
    if (p.airborne && this.airLeft(p) >= TRICK_AIR) return 'trick';
    return null;
  }

  /** Seconds of air left over flat road (the sim's own estimate, sim/tricks.ts airLeft). */
  private airLeft(p: RiderState): number {
    return (p.vy + Math.sqrt(Math.max(0, p.vy * p.vy + 2 * AIR_G * Math.max(0, p.y)))) / AIR_G;
  }

  /** An r4 prompt shows at most PROFILE_MAX times per profile, and not again right away. */
  private r4Ready(id: HintId): boolean {
    if ((this.counts.get(id) ?? 0) >= PROFILE_MAX) return false;
    return this.clock - (this.lastShow.get(id) ?? -R4_COOLDOWN) >= R4_COOLDOWN;
  }

  /** The moment a prompt belongs to is over: GO for the launch, the player went down for the others,
   *  SHOWTIME once a cast would be denied (nobody in reach any more), and the air trick the moment
   *  the wheels touch the road again (r6: the key card leaves with the landing). */
  private stale(id: HintId, s: Session): boolean {
    if (id === 'launch') return s.phase !== 'countdown';
    if (id === 'ult' && !this.ultReady()) return true;
    if (id === 'trick' && !s.player.airborne) return true;
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
    if (!CLASSIC.has(id)) return false;
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
    if (R4.has(id)) {
      this.counts.set(id, (this.counts.get(id) ?? 0) + 1);
      this.lastShow.set(id, this.clock);
      this.saveCounts();
    }
    this.card.textContent = '';
    this.card.classList.toggle('is-alarm', id === 'baton');
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

  /** A prompt that cannot wait (the baton tell, an open trick window) replaces the one on screen. */
  private forceShow(id: HintId): void {
    if (this.live) this.end(this.live);
    this.show(id);
  }

  /** The r4 prompt counters live in localStorage: a profile remembers them across its races. */
  private loadCounts(): void {
    let raw: string | null = null;
    try {
      raw = globalThis.localStorage?.getItem(STORE) ?? null;
    } catch (err) {
      console.warn('[ui-hud] the hint counters are unreadable', err);
      return;
    }
    this.counts.clear();
    if (!raw) return;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed === null || typeof parsed !== 'object') return;
      for (const [k, v] of Object.entries(parsed)) {
        if (R4.has(k as HintId) && typeof v === 'number' && Number.isFinite(v)) this.counts.set(k as HintId, v);
      }
    } catch (err) {
      console.warn('[ui-hud] the hint counters are unreadable', err);
    }
  }

  private saveCounts(): void {
    try {
      globalThis.localStorage?.setItem(STORE, JSON.stringify(Object.fromEntries(this.counts)));
    } catch (err) {
      console.warn('[ui-hud] the hint counters are not saved', err);
    }
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

  /** The bus listeners go with the HUD. */
  dispose(): void {
    for (const off of this.offs) off();
    this.offs = [];
  }
}

/** Every Chinese string the prompts can show (fonts.ts warms the CJK subsets up). */
export const HINT_CN = Object.values(HINTS).map((d) => d.cn + d.parts.map((p) => (p.pre ?? '') + p.label).join('')).join('');
