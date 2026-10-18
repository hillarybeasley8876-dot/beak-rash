// Cut-in layer: owns the director (splash + skill band), callouts, FINAL STRETCH banner, rival skill
// chips and intro cards, and decides which cut-in each gameplay event deserves.
import { approach } from '../../../core/math';
import { ACHIEVEMENTS } from '../../../data/achievements';
import { SKILLS } from '../../../data/skills';
import type { Session } from '../../../core/contracts';
import type { GameEvents } from '../../../core/events-map';
import type { RiderId } from '../../../core/types';
import { TICKET_HOLD } from '../events';
import { ordinal } from '../place';
import { DRIFT_COLORS } from '../speedo';
import type { Sfx } from '../sfx';
import type { Rect } from '../world/avoid';
import type { Projector } from '../world/project';
import { FinalStretch } from './banner';
import { Callouts, type CalloutSpec } from './callouts';
import { SkillChips } from './chips';
import { countdownCut, skillBand, type BandCut } from './countdown';
import { Director } from './director';
import { IntroCards } from './intro';
import { bustedSplash, finishSplash, koSplash, showtimeCut, wreckedSplash } from './splashes';

const CHIP_RANGE = 30;
const ONE_MORE = 3;         // combo hits per ONE MORE! (SPEC §7)
const KO_FALLBACK = 0.55;   // s to wait for fx's cine:ko before showing the KO splash ourselves
const FALLBACK_CHAIN = 1.5; // s between cinematic-less KOs that still count as a chain
const CINE_SAFETY = 3;      // s: un-hide the HUD even if a cinematic never reports 'end'
const PERFECT_LAUNCH = 0.25; // rider:boost 'launch' power: perfect 0.3, held throttle 0.18 (race flow.ts)
const STAMP_AT = 0.2;       // s: the BUSTED stamp lands (splash.ts slam 0.1 + 0.12)
const PLACE_TICK_GAP = 0.4; // s between place-callout ticks (places flicker in a pack)
const PICKUPS: Record<string, string> = { coin: '小鱼干', coins: '小鱼干', fish: '+HP 鱼', crate: '武器箱', can: '+SP 罐头', sp: '+SP 罐头' };

interface PendingKo { attacker: RiderId | null; victim: RiderId; t: number }
interface Cue { at: number; id: string; volume: number }

export class CutinLayer {
  private director: Director;
  private callouts: Callouts;
  private banner: FinalStretch;
  private chips: SkillChips;
  readonly intro: IntroCards;
  private session: Session | null = null;
  private pendingKo: PendingKo | null = null;
  private cineLeft = 0;
  private koChain = 0;
  private koChainT = 0;
  private lastCineStart = -9;
  private lastShowtime = -9;
  private clock = 0;
  private slipArmed = true;
  private calm = 1;
  /** The player's current skill band (a projectile skill slims it on projectile:spawn). */
  private band: { cut: BandCut; at: number } | null = null;
  /** Delayed UI sounds (real time), e.g. the BUSTED stamp landing. */
  private cues: Cue[] = [];
  private lastPlaceTick = -9;

  /** `sfx`: the HUD's own UI sounds — only for what audio does not already voice (see hud/sfx.ts). */
  constructor(parent: HTMLElement, chipParent: HTMLElement, private sfx: Sfx) {
    this.director = new Director(parent);
    this.callouts = new Callouts(this.director.stage, (spec) => this.calloutSfx(spec));
    this.banner = new FinalStretch(this.director.stage, () => sfx('ui.cutin', { volume: 0.8 }));
    this.intro = new IntroCards(this.director.stage, (what) => {
      if (what === 'banner') sfx('ui.cutin', { volume: 0.6 });
      else sfx('ui.slash', { volume: 0.45 });
    });
    this.chips = new SkillChips(chipParent, () => sfx('ui.unlock'));
  }

  /** Screen rect of the callout stack (stage x 60–720 from y 360, 96 px per callout) while it shows. */
  calloutsRect(width: number, height: number, k: number, out: Rect): Rect | null {
    const n = this.callouts.count;
    if (!n || this.calm < 0.5) return null;
    out.l = width / 2 + (60 - 960) * k;
    out.r = width / 2 + (720 - 960) * k;
    out.t = height / 2 + (360 - 540) * k;
    out.b = height / 2 + (372 + n * 96 - 540) * k;
    return out;
  }

  /** The chip column's screen rect while chips are up (taunt bubbles avoid it). */
  chipsRect(width: number, k: number, out: Rect): Rect | null {
    return this.chips.rect(width, k, out);
  }

  /** A KO / ult cinematic is running: the HUD hides everything but cut-ins. */
  get cinematic(): boolean {
    return this.cineLeft > 0;
  }

  attach(session: Session | null): void {
    this.session = session;
    this.director.clear();
    this.callouts.clear();
    this.banner.clear();
    this.chips.clear();
    this.intro.stop(true);
    this.pendingKo = null;
    this.cineLeft = 0;
    this.koChain = 0;
    this.band = null;
    this.cues = [];
    this.lastPlaceTick = -9;
  }

  private isMe(id: RiderId | null): boolean {
    return id !== null && this.session !== null && id === this.session.player.id;
  }

  countdown(n: number): void {
    this.director.splashIn('countdown', () => countdownCut(n), `cd${n}`);
  }

  skillCast(e: GameEvents['skill:cast']): void {
    const s = this.session;
    const r = s?.rider(e.riderId);
    const def = SKILLS[e.skillId];
    if (!s || !r || !def || def.slot === 'ult') return;
    if (r.isPlayer) {
      const slot = typeof def.slot === 'number' ? def.slot : 1;
      const cut = skillBand(def, r.character, ['U', 'I', 'O'][slot - 1] ?? 'U');
      this.band = { cut, at: this.clock };
      this.director.bandIn(() => cut);
    } else if (Math.abs(r.s - s.player.s) <= CHIP_RANGE) {
      this.chips.push(r.character, def);
    }
  }

  /** projectile:spawn — the player's own shot (FISH TORPEDO) slims its band, so the flight stays in view. */
  projectile(e: GameEvents['projectile:spawn']): void {
    const b = this.band;
    if (b && this.isMe(e.owner) && e.kind === b.cut.skillId && this.clock - b.at < 0.25) b.cut.thin();
  }

  ultStart(riderId: RiderId): void {
    const s = this.session;
    const r = s?.rider(riderId);
    if (!s || !r) return;
    const def = Object.values(SKILLS).find((k) => k.owner === r.character && k.slot === 'ult');
    if (!r.isPlayer) {
      if (def) this.chips.push(r.character, def);
      return;
    }
    if (this.clock - this.lastShowtime < 0.8) return;
    this.lastShowtime = this.clock;
    this.director.splashIn('showtime', () => showtimeCut(r.character, def?.name ?? 'SHOWTIME'));
  }

  cineUlt(e: GameEvents['cine:ult']): void {
    if (e.phase === 'start') {
      this.cineLeft = CINE_SAFETY;
      this.ultStart(e.riderId);
    } else if (e.phase === 'end') this.cineLeft = 0;
  }

  cineKo(e: GameEvents['cine:ko']): void {
    if (e.phase === 'start') {
      this.cineLeft = CINE_SAFETY;
      this.lastCineStart = this.clock;
      this.pendingKo = null;
    } else if (e.phase === 'peak') {
      this.koSplash(e.attacker, e.victim, Math.max(1, e.chain));
    } else {
      this.cineLeft = 0;
      // The splash belongs to the cinematic (the short repeat variant included): leave with it.
      this.director.hurry(['ko', 'wrecked']);
    }
  }

  /** combat:ko — the fallback path when fx does not run a cinematic for this KO. */
  combatKo(e: GameEvents['combat:ko']): void {
    if (!this.isMe(e.attacker) && !this.isMe(e.victim)) return;
    if (this.clock - this.lastCineStart < 0.1) return;
    this.pendingKo = { attacker: e.attacker, victim: e.victim, t: KO_FALLBACK };
  }

  /** `slash`: play the splash's slash ourselves (audio voices it at cine:ko peak, absent on the fallback path). */
  private koSplash(attacker: RiderId | null, victim: RiderId, chain: number, slash = false): void {
    const s = this.session;
    const v = s?.rider(victim);
    if (!s || !v) return;
    const a = attacker !== null ? s.rider(attacker) : undefined;
    if (slash && (v.isPlayer || a?.isPlayer)) this.sfx('ui.slash', { volume: 0.7 });
    const cine = this.cinematic;
    if (v.isPlayer) {
      this.director.splashIn('wrecked', () => wreckedSplash(v.character, 'ko', a?.character ?? null, cine));
      return;
    }
    if (!a?.isPlayer) return;
    this.director.splashIn('ko', () => koSplash(chain, a.character, v.character, cine), `ko${chain}:${victim}`);
  }

  crash(e: GameEvents['rider:crash']): void {
    const s = this.session;
    if (!s || !this.isMe(e.riderId) || e.cause === 'ko') return;
    const by = e.attacker !== null ? s.rider(e.attacker)?.character ?? null : null;
    this.director.splashIn('wrecked', () => wreckedSplash(s.player.character, e.cause, by, this.cinematic));
  }

  busted(e: GameEvents['police:busted']): void {
    if (!this.isMe(e.riderId)) return;
    this.director.splashIn('busted', () => bustedSplash(e.fine, TICKET_HOLD));
    this.cues.push({ at: this.clock + STAMP_AT, id: 'ui.stamp', volume: 0.9 });
  }

  finish(e: GameEvents['race:finishLine']): void {
    const s = this.session;
    if (s && this.isMe(e.riderId)) this.director.splashIn('finish', () => finishSplash(s.player.character, e.place, e.time));
  }

  land(e: GameEvents['rider:land']): void {
    if (this.isMe(e.riderId) && e.perfect) this.callouts.push({ kind: 'perfect', en: 'PERFECT!', cn: '完美落地', count: true });
  }

  drift(e: GameEvents['rider:drift']): void {
    if (!this.isMe(e.riderId) || e.phase !== 'level' || e.level < 1) return;
    const lv = Math.min(3, e.level);
    this.callouts.push({ kind: 'drift', en: `DRIFT L${lv}`, cn: ['', '一段', '二段', '三段!'][lv], color: DRIFT_COLORS[lv] });
  }

  nearMiss(e: GameEvents['rider:nearMiss']): void {
    if (this.isMe(e.riderId)) this.callouts.push({ kind: 'near', en: 'NEAR MISS!', cn: '擦肩而过', count: true });
  }

  boost(e: GameEvents['rider:boost']): void {
    if (!this.isMe(e.riderId)) return;
    if (e.kind === 'draft') this.callouts.push({ kind: 'slip', en: 'SLINGSHOT!', cn: '尾流弹射', key: 'slip' });
    else if (e.kind === 'pad') this.callouts.push({ kind: 'slip', en: 'BOOST!', cn: '加速带', key: 'pad' });
    else if (e.kind === 'launch') this.launch(e.power);
  }

  /** Launch boost on GO: race gives 0.3 for a perfect start (fresh press during "1"), 0.18 for throttle held. */
  private launch(power: number): void {
    const perfect = power >= PERFECT_LAUNCH;
    this.callouts.push(perfect
      ? { kind: 'perfect', en: 'PERFECT START!', cn: '起步完美', key: 'launch', ransom: true, life: 1.4 }
      : { kind: 'slip', en: 'GOOD START!', cn: '起步加速', key: 'launch' });
  }

  /** ONE MORE! fires on every third chained hit — the hits that grant the SP bonus + next-hit crit (SPEC §7). */
  combo(e: GameEvents['combat:combo']): void {
    if (this.isMe(e.riderId) && e.count >= ONE_MORE && e.count % ONE_MORE === 0) {
      this.callouts.push({ kind: 'more', en: 'ONE MORE!', cn: `${e.count} 连击！`, ransom: true, life: 1.3 });
    }
  }

  placeChange(e: GameEvents['race:placeChange']): void {
    const s = this.session;
    if (!s || !this.isMe(e.riderId) || s.phase !== 'racing' || s.time < 1 || e.from === e.to) return;
    const up = e.to < e.from;
    this.callouts.push({ kind: 'place', en: `${up ? '▲' : '▼'} ${e.to}${ordinal(e.to)}`, cn: up ? '超车！' : '被超了', mod: up ? 'up' : 'down', key: 'place' });
  }

  /** achievement:unlock (player achievements only; the system tracks the player). */
  achievement(id: string): void {
    const def = ACHIEVEMENTS.find((a) => a.id === id);
    if (def) this.chips.achievement(def);
  }

  finalStretch(e: GameEvents['race:finalStretch']): void {
    if (this.isMe(e.riderId)) this.banner.show();
  }

  pickup(e: GameEvents['pickup:take']): void {
    if (this.isMe(e.riderId)) this.callouts.push({ kind: 'pick', en: PICKUPS[e.kind] ?? e.kind.toUpperCase(), key: `pick:${e.kind}`, count: true, life: 0.9 });
  }

  /** Place callouts get a short UI tick (audio voices the rest: perfect, drift, near miss, boosts, pickups). */
  private calloutSfx(spec: CalloutSpec): void {
    if (spec.kind !== 'place' || this.clock - this.lastPlaceTick < PLACE_TICK_GAP) return;
    this.lastPlaceTick = this.clock;
    this.sfx(spec.mod === 'down' ? 'ui.back' : 'ui.confirm', { volume: 0.5 });
  }

  private flushCues(): void {
    if (!this.cues.length) return;
    for (const c of this.cues) if (c.at <= this.clock) this.sfx(c.id, { volume: c.volume });
    this.cues = this.cues.filter((c) => c.at > this.clock);
  }

  update(dt: number, k: number, proj: Projector): void {
    this.clock += dt;
    this.flushCues();
    this.cineLeft = Math.max(0, this.cineLeft - dt);
    this.koChainT = Math.max(0, this.koChainT - dt);
    const s = this.session;
    if (this.pendingKo) {
      this.pendingKo.t -= dt;
      if (this.pendingKo.t <= 0) {
        const p = this.pendingKo;
        this.pendingKo = null;
        // No cinematic ran (slow-mo off / fx stub): count chains ourselves.
        const chain = this.koChainT > 0 ? this.koChain + 1 : 1;
        this.koChain = chain;
        this.koChainT = FALLBACK_CHAIN;
        this.koSplash(p.attacker, p.victim, chain, true);
      }
    }
    if (s) {
      const draft = s.player.draft;
      if (draft > 0.8 && this.slipArmed && s.phase === 'racing') {
        this.slipArmed = false;
        this.callouts.push({ kind: 'slip', en: 'SLIPSTREAM', cn: '跟住尾流', key: 'slip' });
      } else if (draft < 0.3) this.slipArmed = true;
      if (s.phase === 'intro' && !this.intro.running) this.intro.start(s);
      else if (s.phase !== 'intro' && this.intro.running) this.intro.stop();
      this.intro.update(s, proj, dt);
    }
    // Callouts and the FINAL STRETCH banner wait (frozen, hidden) while a cinematic, a splash or the player's
    // skill band owns the screen (both bands cross the callout stack and the banner).
    const busy = this.cinematic || this.director.splashKind !== null || this.director.bandUp;
    this.calm = approach(this.calm, busy ? 0 : 1, dt / 0.12);
    this.director.update(dt);
    this.callouts.update(dt, this.calm);
    this.banner.update(dt, this.calm);
    this.chips.update(this.cinematic ? 0 : dt, k, proj.height); // the chip column is hidden with the HUD during cinematics
  }
}
