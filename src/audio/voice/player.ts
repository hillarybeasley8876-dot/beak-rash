// Voice lines (pre-generated TTS mp3s listed in src/data/voice.ts). Two channels: the announcer
// (one line at a time, one queued, stale lines dropped; ducks the music) and character barks
// (positional — gain / pan follow the speaker every frame — rate limited, and silenced by
// important announcer lines). Clips load lazily / in the background; a missing file is silent.
// While the game is paused nothing new starts: barks fade, the queued announcer line is dropped.
import { VOICE } from '../../data/voice';
import { holdAt, steer } from '../dsp/env';
import type { Engine } from '../engine';

type Clip = AudioBuffer | 'missing';
export type VoiceChannel = 'announcer' | 'bark';
/** What a request did: sounding now, queued (busy / still loading), dropped (rate limit, pause), or no such clip. */
export type VoiceResult = 'started' | 'queued' | 'dropped' | 'none';
/** Called when a line actually starts sounding (the test trace). */
export type OnVoiceStart = (id: string, channel: VoiceChannel, gain: number) => void;

/** Where a bark's speaker is now (null = gone / out of range). */
export type Follow = () => { gain: number; pan: number } | null;

export interface VoiceOpts {
  channel?: VoiceChannel;
  pan?: number;
  gain?: number;
  priority?: number;
  /** Barks: re-placed every frame while the line plays. */
  follow?: Follow;
}

interface Playing {
  src: AudioBufferSourceNode;
  gain: GainNode;
  pan: StereoPannerNode | null;
  follow?: Follow;
  priority: number;
}

const STALE = 1.4;        // s: queued announcer lines older than this are dropped
const BARK_GAP = 1.3;     // s between character barks
const LOUD = 3;           // announcer priority that silences barks while it speaks

export class VoicePlayer {
  private clips = new Map<string, Clip>();
  private loading = new Map<string, Promise<Clip>>();
  private byText = new Map<string, string>();
  private busy: Record<VoiceChannel, number> = { announcer: 0, bark: 0 };
  private current: Record<VoiceChannel, Playing | null> = { announcer: null, bark: null };
  private pending: { id: string; opts: VoiceOpts; at: number } | null = null;
  private warned = false;
  private paused = false;

  constructor(private engine: Engine, private base: URL, private onStart: OnVoiceStart = () => undefined) {
    for (const line of Object.values(VOICE)) this.byText.set(line.text, line.id);
  }

  /** Voice id for an on-screen line (taunt / KO / hurt bubble), if one was generated. */
  idFor(text: string): string | null {
    return this.byText.get(text) ?? null;
  }

  /** Load clips in the background, two at a time. */
  prefetch(ids: string[] = Object.keys(VOICE)): void {
    const queue = ids.filter((id) => !this.clips.has(id) && !this.loading.has(id));
    const next = (): void => {
      const id = queue.shift();
      if (id) void this.load(id).then(next);
    };
    next();
    next();
  }

  private load(id: string): Promise<Clip> {
    const known = this.clips.get(id);
    if (known) return Promise.resolve(known);
    const inflight = this.loading.get(id);
    if (inflight) return inflight;
    const line = VOICE[id];
    const p = (async (): Promise<Clip> => {
      if (!line) return 'missing';
      try {
        const res = await fetch(new URL(line.file, this.base));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await this.engine.ctx.decodeAudioData(await res.arrayBuffer());
      } catch (err) {
        if (!this.warned) {
          this.warned = true;
          console.warn(`[audio] voice clip unavailable (${id}): ${String(err)} — voices stay silent where missing`);
        }
        return 'missing';
      }
    })().then((clip) => {
      this.clips.set(id, clip);
      this.loading.delete(id);
      return clip;
    });
    this.loading.set(id, p);
    return p;
  }

  /** Request a line ('none' = no such clip: the caller may fall back to an sfx). */
  play(id: string, opts: VoiceOpts = {}): VoiceResult {
    if (!(id in VOICE)) return 'none';
    const now = this.engine.now;
    const channel = opts.channel ?? 'announcer';
    if (channel === 'bark' && (this.paused || now < this.busy.bark + BARK_GAP)) return 'dropped';
    const clip = this.clips.get(id);
    if (clip === 'missing') return 'none';
    if (!clip) {
      const asked = now;
      void this.load(id).then((c) => {
        if (c !== 'missing' && this.engine.now - asked < 0.6) this.play(id, opts);
      });
      return 'queued';
    }
    if (channel === 'announcer' && (this.paused || now < this.busy.announcer)) {
      const pri = opts.priority ?? 1;
      if (!this.paused && pri > (this.current.announcer?.priority ?? 0) + 1) {
        this.cut('announcer');
        this.start(id, clip, opts, channel);
        return 'started';
      }
      if (this.pending && pri < (this.pending.opts.priority ?? 1)) return 'dropped';
      this.pending = { id, opts, at: now };
      return 'queued';
    }
    this.start(id, clip, opts, channel);
    return 'started';
  }

  /** Game paused: barks fade out, the queued announcer line is dropped, nothing new starts until resumed. */
  setPaused(paused: boolean): void {
    if (paused === this.paused) return;
    this.paused = paused;
    if (!paused) return;
    this.pending = null;
    this.cut('bark');
  }

  private start(id: string, clip: AudioBuffer, opts: VoiceOpts, channel: VoiceChannel): void {
    const ctx = this.engine.ctx;
    const now = this.engine.now;
    const src = new AudioBufferSourceNode(ctx, { buffer: clip });
    const gain = new GainNode(ctx, { gain: opts.gain ?? 1 });
    let head: AudioNode = src.connect(gain);
    let pan: StereoPannerNode | null = null;
    if (channel === 'bark') {
      pan = new StereoPannerNode(ctx, { pan: Math.max(-1, Math.min(1, opts.pan ?? 0)) });
      head = head.connect(pan);
    }
    head.connect(this.engine.voiceIn);
    src.start(now);
    const priority = opts.priority ?? 1;
    this.busy[channel] = now + clip.duration;
    this.current[channel] = { src, gain, pan, follow: opts.follow, priority };
    this.onStart(id, channel, opts.gain ?? 1);
    if (channel === 'announcer') {
      this.engine.setVoiceDuck(1);
      if (priority >= LOUD) {
        // A big call (countdown, KO, SHOWTIME, finish): character lines step aside.
        this.cut('bark');
        this.busy.bark = Math.max(this.busy.bark, now + clip.duration + 0.25 - BARK_GAP);
      }
    }
  }

  /** Fade out the line playing on `channel` (a more important line interrupts it). */
  private cut(channel: VoiceChannel): void {
    const cur = this.current[channel];
    if (!cur) return;
    const now = this.engine.now;
    holdAt(cur.gain.gain, now);
    cur.gain.gain.linearRampToValueAtTime(0, now + 0.06);
    cur.src.stop(now + 0.07);
    this.current[channel] = null;
  }

  /** Per frame: play the queued announcer line when free, move barks with their speaker, release the duck. */
  update(): void {
    const now = this.engine.now;
    if (this.pending && !this.paused && now >= this.busy.announcer) {
      const { id, opts, at } = this.pending;
      this.pending = null;
      const clip = this.clips.get(id);
      if (clip && clip !== 'missing' && now - at < STALE) this.start(id, clip, opts, 'announcer');
    }
    const bark = this.current.bark;
    if (bark && now >= this.busy.bark) this.current.bark = null;
    else if (bark?.follow) {
      const p = bark.follow();
      steer(bark.gain.gain, now, p ? p.gain : 0, 0.08);
      if (bark.pan && p) steer(bark.pan.pan, now, Math.max(-1, Math.min(1, p.pan)), 0.08);
    }
    if (now >= this.busy.announcer) {
      this.current.announcer = null;
      this.engine.setVoiceDuck(0);
    }
  }
}
