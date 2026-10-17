// SfxPlayer: the registry of every synthesized sound plus playback policy — per-id and global
// voice limits, same-frame de-duplication, natural pitch variation, placement routing (gain /
// pan / air absorption) and the tunnel reverb send.
import { Rng } from '../../core/rng';
import { filter, holdAt } from '../dsp/env';
import { ANIMAL_SFX } from './animals';
import { COMBAT_SFX } from './combat';
import { SKILL_SFX } from './skills';
import { BIKE_SFX, UI_SFX } from './ui-bike';
import { WORLD_SFX } from './world';
import type { Engine } from '../engine';
import type { SfxFn } from './kit';

export const SFX: Record<string, SfxFn> = {
  ...UI_SFX, ...BIKE_SFX, ...COMBAT_SFX, ...SKILL_SFX, ...ANIMAL_SFX, ...WORLD_SFX,
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

const MAX_ACTIVE = 32;
const PER_ID: Record<string, number> = { 'ui.count': 2, 'ui.move': 2, 'bike.bump': 2, 'swing.light': 3, 'ko.boom': 2 };

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

  constructor(private engine: Engine) {}

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
    if (same.length >= (PER_ID[id] ?? 4) && !this.steal(same, vol, t)) return 0;
    if (this.active.length >= MAX_ACTIVE && !this.steal(this.active, vol, t)) return 0;
    const ctx = this.engine.ctx;
    const out = new GainNode(ctx, { gain: 1 });
    let head: AudioNode = out;
    if (opts.pan) head = head.connect(new StereoPannerNode(ctx, { pan: Math.max(-1, Math.min(1, opts.pan)) }));
    if (opts.lowpass !== undefined && opts.lowpass < 14000) head = head.connect(filter(ctx, { type: 'lowpass', frequency: opts.lowpass, Q: 0.7 }));
    if (opts.highpass !== undefined && opts.highpass > 30) head = head.connect(filter(ctx, { type: 'highpass', frequency: opts.highpass, Q: 0.7 }));
    head.connect(opts.impact ? this.engine.impactIn : this.engine.sfxIn);
    if (!opts.impact) head.connect(this.engine.sfxVerb);
    // UI sounds stay exact; world sounds vary ±3 % so repeats never machine-gun.
    const vary = id.startsWith('ui.') ? 1 : 1 + (this.rng.next() - 0.5) * 0.06;
    const dur = fn({ ctx, out, t, vol, pitch: Math.max(0.25, (opts.pitch ?? 1) * vary), rng: this.rng });
    this.active.push({ id, end: t + dur, vol, out });
    this.last.set(id, t);
    return dur;
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
