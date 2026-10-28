// SfxPlayer: the registry of every synthesized sound plus playback policy — per-id and global
// voice limits, same-frame de-duplication, natural pitch variation, placement routing (gain /
// pan / air absorption) and the tunnel reverb send. In a realtime context sounds are replayed
// from rendered takes after their first play (sfx/cache.ts): one buffer source instead of a graph.
import { Rng } from '../../core/rng';
import { filter, holdAt } from '../dsp/env';
import { ANIMAL_SFX } from './animals';
import { SfxCache } from './cache';
import { COMBAT_SFX } from './combat';
import { R4_SFX } from './r4';
import { SKILL_SFX } from './skills';
import { REACT_SFX, SKILL_R6_SFX } from './skills-r6';
import { BIKE_SFX, UI_SFX } from './ui-bike';
import { WORLD_SFX } from './world';
import type { Engine } from '../engine';
import type { SfxFn } from './kit';

export const SFX: Record<string, SfxFn> = {
  ...UI_SFX, ...BIKE_SFX, ...COMBAT_SFX, ...SKILL_SFX, ...SKILL_R6_SFX, ...REACT_SFX, ...ANIMAL_SFX, ...WORLD_SFX, ...R4_SFX,
};

export interface PlayOpts {
  volume?: number;
  pitch?: number;
  pan?: number;
  lowpass?: number;
  /** Cut the low end (Hz): e.g. crashes during a KO cinematic, where the impact owns the sub. */
  highpass?: number;
  /** Route past the glue compressor (a KO boom must punch through the whole mix). */
  impact?: boolean;
}

/** Rendered ahead (sfx/cache.ts): UI sounds at unlock, the frequent race sounds at race start. */
export const PREWARM_UI = ['ui.move', 'ui.confirm', 'ui.back', 'ui.cutin', 'ui.slash', 'ui.coin', 'ui.count'];
export const PREWARM_RACE = [
  'bike.passby', 'traffic.whoosh', 'bike.bump', 'swing.light', 'swing.heavy', 'hit.none', 'hit.saltfish', 'hit.baguette',
  'hit.pan', 'hit.leek', 'hit.umbrella', 'hit.selfie', 'hit.slipper', 'hit.keyboard', 'hit.baton', 'hit.crit', 'hit.block', 'bike.hop',
  'bike.land', 'bike.nearmiss', 'bike.crash', 'bike.drift.start', 'bike.drift.level', 'bike.miniturbo', 'bike.boost',
  'pickup.coin', 'pickup.fish', 'obstacle.hit', 'traffic.horn.car', 'traffic.horn.van', 'skill.cast', 'skill.hit',
  // The r4 cues that repeat during a race (the rest are rare and rendered on their first play).
  'police.windup', 'police.swing', 'police.wanted', 'combat.parry', 'combat.throw', 'trick.start', 'trick.land',
  'style.chain', 'style.bank', 'race.event.warn', 'race.event.geese', 'secret.quack',
];

/**
 * Everything a race can play, rendered ahead (a first play would synthesize a whole graph live on the
 * audio thread): the common set first, then the session's characters' skills and calls, then every
 * other world / combat / bike sound.
 */
export function raceSounds(characters: readonly string[]): string[] {
  const ids = Object.keys(SFX);
  const own = characters.flatMap((c) => [...ids.filter((id) => id.startsWith(`skill.${c}.`)), `animal.${c}`]);
  const rest = ids.filter((id) => !/^(ui|skill|animal)\./.test(id));
  return [...new Set([...PREWARM_RACE, ...own.filter((id) => id in SFX), 'skill.cast', 'skill.hit', 'ui.incoming', 'ui.deny', 'ui.unlock', ...rest])];
}

/** Concurrent one-shots (a busy pack is capped here: the quietest sound gives way; every voice is
 *  two nodes the realtime thread renders, ≈ 0.06 % of it, and a dozen overlapping hits already mask
 *  each other). */
const MAX_ACTIVE = 12;
const PER_ID_DEFAULT = 3;
/** Pitches asked for often enough to get their own pre-rendered takes (heavy hits). */
const BAKED_PITCHES = new Set([0.9]);
const PER_ID: Record<string, number> = { 'ui.count': 2, 'ui.move': 2, 'bike.bump': 2, 'swing.light': 2, 'ko.boom': 2 };

interface Active {
  id: string;
  end: number;
  vol: number;
  out: GainNode;
}

export class SfxPlayer {
  private active: Active[] = [];
  private last = new Map<string, number>();
  private warned = new Set<string>();
  private rng = new Rng(0x5f5);
  /** Shared panners by position (a sound plays through one instead of owning a panner node). */
  private panners = new Map<number, StereoPannerNode>();
  /** Realtime only: offline renders (audio-check, lab analysis) always synthesize. */
  private cache: SfxCache | null;

  constructor(private engine: Engine) {
    const ctx = engine.ctx;
    this.cache = typeof AudioContext !== 'undefined' && ctx instanceof AudioContext ? new SfxCache(ctx.sampleRate, new Rng(0xcac4e)) : null;
  }

  /** Render these sounds ahead of their first play (race start: rival hits, pass-bys, bumps…). */
  prewarm(ids: readonly string[]): void {
    for (const id of ids) {
      const fn = SFX[id];
      if (fn) this.cache?.request(id, fn, null);
    }
  }

  /** The cache's state: how many sounds are ready and how many are still being rendered. */
  cacheState(): { takes: number; pending: number; seconds: number } {
    return this.cache?.state() ?? { takes: 0, pending: 0, seconds: 0 };
  }

  /** Play a sound now; returns its length (0 if unknown, culled or voice-limited). */
  play(id: string, opts: PlayOpts = {}): number {
    const fn = SFX[id];
    if (!fn) {
      if (!this.warned.has(id)) {
        this.warned.add(id);
        console.warn(`[audio] unknown sfx "${id}"`);
      }
      return 0;
    }
    const vol = opts.volume ?? 1;
    if (vol < 0.01) return 0;
    const t = this.engine.now;
    this.active = this.active.filter((a) => a.end > t);
    const prev = this.last.get(id);
    if (prev !== undefined && Math.abs(t - prev) < 0.025) return 0;
    const same = this.active.filter((a) => a.id === id);
    if (same.length >= (PER_ID[id] ?? PER_ID_DEFAULT) && !this.steal(same, vol, t)) return 0;
    if (this.active.length >= MAX_ACTIVE && !this.steal(this.active, vol, t)) return 0;
    const ctx = this.engine.ctx;
    // Cached takes play at rate 1 (resampling costs the audio thread ≈ 2×): a common pitch has
    // its own baked variant; any other pitch resamples the plain take.
    const asked = Math.max(0.25, opts.pitch ?? 1);
    const variant = asked === 1 ? id : BAKED_PITCHES.has(asked) ? `${id}@${asked}` : null;
    const baked = variant !== null ? this.cache?.get(variant) ?? null : null;
    const take = baked ?? this.cache?.get(id) ?? null;
    const out = new GainNode(ctx, { gain: take ? vol : 1 });
    let head: AudioNode = out;
    if (opts.lowpass !== undefined && opts.lowpass < 14000) head = head.connect(filter(ctx, { type: 'lowpass', frequency: opts.lowpass, Q: 0.7 }));
    if (opts.highpass !== undefined && opts.highpass > 30) head = head.connect(filter(ctx, { type: 'highpass', frequency: opts.highpass, Q: 0.7 }));
    this.route(head, opts);
    // Live world sounds vary ±3 % so repeats never machine-gun (cached takes bake that variation
    // in); UI sounds stay exact.
    const vary = take || id.startsWith('ui.') ? 1 : 1 + (this.rng.next() - 0.5) * 0.06;
    const pitch = asked * vary;
    let dur: number;
    if (take) {
      const rate = baked ? 1 : asked;
      const src = new AudioBufferSourceNode(ctx, { buffer: take, playbackRate: rate });
      src.connect(out);
      src.start(t);
      dur = take.duration / rate;
      if (!baked && variant !== null) this.cache?.request(variant, fn, take.duration, asked);
    } else {
      dur = fn({ ctx, out, t, vol, pitch, rng: this.rng });
      this.cache?.request(id, fn, dur * pitch);
    }
    this.active.push({ id, end: t + dur, vol, out });
    this.last.set(id, t);
    return dur;
  }

  /** To the sfx bus + reverb send through a shared panner (0.1 steps), or past the glue comp. */
  private route(head: AudioNode, opts: PlayOpts): void {
    const pan = Math.round(Math.max(-1, Math.min(1, opts.pan ?? 0)) * 10) / 10;
    if (opts.impact) {
      // KO booms are rare: their own panner.
      (pan ? head.connect(new StereoPannerNode(this.engine.ctx, { pan })) : head).connect(this.engine.impactIn);
      return;
    }
    if (pan === 0) {
      head.connect(this.engine.sfxIn);
      head.connect(this.engine.sfxVerb);
      return;
    }
    let p = this.panners.get(pan);
    if (!p) {
      p = new StereoPannerNode(this.engine.ctx, { pan });
      p.connect(this.engine.sfxIn);
      p.connect(this.engine.sfxVerb);
      this.panners.set(pan, p);
    }
    head.connect(p);
  }

  /**
   * Voice stealing: fade out (30 ms) the quietest of `pool` if it is quieter than the new sound,
   * so a busy pack of far-away rivals never mutes the player's own hits, then unplug it so its
   * nodes stop rendering (realtime only; offline renders keep the fade). False = drop the new one.
   */
  private steal(pool: Active[], vol: number, t: number): boolean {
    let victim: Active | null = null;
    for (const a of pool) if (!victim || a.vol < victim.vol) victim = a;
    if (!victim || victim.vol >= vol) return false;
    holdAt(victim.out.gain, t);
    victim.out.gain.linearRampToValueAtTime(0, t + 0.03);
    const gone = victim;
    this.active = this.active.filter((a) => a !== gone);
    if (this.engine.ctx instanceof AudioContext) setTimeout(() => gone.out.disconnect(), 80);
    return true;
  }
}
