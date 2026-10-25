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
  /** Barks: how long (s) the line may wait for the channel instead of being dropped (one waits at a time). */
  wait?: number;
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
const PREFETCH = 4;       // clips fetched / decoded at once
const FADE = 0.07;        // s: a cut line's fade-out

export class VoicePlayer {
  private clips = new Map<string, Clip>();
  private loading = new Map<string, Promise<Clip>>();
  private byText = new Map<string, string>();
  /** When each channel's line ends (or ended, when it was cut). */
  private busy: Record<VoiceChannel, number> = { announcer: 0, bark: 0 };
  /** Earliest start of the next bark: the gap after the last bark (only for lines that do not outrank
   *  it), and the end of a loud announcer line. */
  private barkUntil = 0;
  private barkPriority = 0;
  private loudUntil = 0;
  private current: Record<VoiceChannel, Playing | null> = { announcer: null, bark: null };
  private pending: { id: string; opts: VoiceOpts; at: number } | null = null;
  private pendingBark: { id: string; opts: VoiceOpts; at: number } | null = null;
  private warned = false;
  private paused = false;

  constructor(private engine: Engine, private base: URL, private onStart: OnVoiceStart = () => undefined) {
    for (const line of Object.values(VOICE)) this.byText.set(line.text, line.id);
  }

  /** Voice id for an on-screen line (taunt / KO / hurt bubble), if one was generated. */
  idFor(text: string): string | null {
    return this.byText.get(text) ?? null;
  }

  /** Load clips in the background, four at a time: the announcer first, then the pelican, then the rivals. */
  prefetch(ids: string[] = Object.keys(VOICE)): void {
    const rank = (id: string): number => (VOICE[id]?.speaker === 'announcer' ? 0 : VOICE[id]?.speaker === 'pelican' ? 1 : 2);
    const queue = ids.filter((id) => !this.clips.has(id) && !this.loading.has(id)).sort((a, b) => rank(a) - rank(b));
    const next = (): void => {
      const id = queue.shift();
      if (id) void this.load(id).then(next);
    };
    for (let k = 0; k < PREFETCH; k++) next();
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
    if (channel === 'bark' && !this.paused && now < this.barkUntil && now >= this.loudUntil && this.outranks(opts)) this.cut('bark');
    if (channel === 'bark' && (this.paused || now < this.barkGate(opts.priority ?? 1))) return this.waitForBark(id, opts);
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

  /** When a bark of `priority` may start: a more important line (the pelican's own) skips the gap
   *  after a lesser one (a rival's taunt that just ended must not make the player's KO quip expire). */
  private barkGate(priority: number): number {
    return priority > this.barkPriority ? this.loudUntil : Math.max(this.barkUntil, this.loudUntil);
  }

  /** A more important bark (the player's own line) cuts the rival line that is playing. */
  private outranks(opts: VoiceOpts): boolean {
    const cur = this.current.bark;
    return cur !== null && (opts.priority ?? 1) > cur.priority;
  }

  /** A bark that may wait (a KO line held for the cinematic's end) takes the one waiting slot; a more
   *  important line (the pelican's own) takes it over from a rival's. */
  private waitForBark(id: string, opts: VoiceOpts): VoiceResult {
    const wait = opts.wait ?? 0;
    const held = this.pendingBark;
    if (this.paused || wait <= 0 || (held && (opts.priority ?? 1) <= (held.opts.priority ?? 1))) return 'dropped';
    this.pendingBark = { id, opts, at: this.engine.now };
    void this.load(id);
    return 'queued';
  }

  /** Game paused: barks fade out, queued lines are dropped, nothing new starts until resumed. */
  setPaused(paused: boolean): void {
    if (paused === this.paused) return;
    this.paused = paused;
    if (!paused) return;
    this.pending = null;
    this.pendingBark = null;
    this.cut('bark');
  }

  private start(id: string, clip: AudioBuffer, opts: VoiceOpts, channel: VoiceChannel): void {
    const ctx = this.engine.ctx;
    const now = this.engine.now;
    // A bark that waited: placed where its speaker is now (gone = silent).
    const where = channel === 'bark' && opts.follow ? opts.follow() : undefined;
    if (where === null) return;
    const level = where?.gain ?? opts.gain ?? 1;
    const src = new AudioBufferSourceNode(ctx, { buffer: clip });
    const gain = new GainNode(ctx, { gain: level });
    let head: AudioNode = src.connect(gain);
    let pan: StereoPannerNode | null = null;
    if (channel === 'bark') {
      pan = new StereoPannerNode(ctx, { pan: Math.max(-1, Math.min(1, where?.pan ?? opts.pan ?? 0)) });
      head = head.connect(pan);
      this.barkUntil = now + clip.duration + BARK_GAP;
      this.barkPriority = opts.priority ?? 1;
    }
    head.connect(this.engine.voiceIn);
    src.start(now);
    const priority = opts.priority ?? 1;
    this.busy[channel] = now + clip.duration;
    this.current[channel] = { src, gain, pan, follow: opts.follow, priority };
    this.onStart(id, channel, level);
    if (channel === 'announcer') {
      this.engine.setVoiceDuck(1);
      if (priority >= LOUD) {
        // A big call (countdown, KO, SHOWTIME, finish): character lines step aside until it ends.
        this.cut('bark');
        this.loudUntil = Math.max(this.loudUntil, now + clip.duration + 0.25);
      }
    }
  }

  /** Fade out the line playing on `channel` (a more important line interrupts it). */
  private cut(channel: VoiceChannel): void {
    const cur = this.current[channel];
    if (!cur) return;
    const now = this.engine.now;
    holdAt(cur.gain.gain, now);
    cur.gain.gain.linearRampToValueAtTime(0, now + FADE - 0.01);
    cur.src.stop(now + FADE);
    this.current[channel] = null;
    // The line stopped now: its remaining length (and a bark's gap after it) no longer blocks anything.
    this.busy[channel] = Math.min(this.busy[channel], now + FADE);
    if (channel === 'bark') this.barkUntil = Math.min(this.barkUntil, now + FADE);
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
    const waiting = this.pendingBark;
    if (waiting && now - waiting.at > (waiting.opts.wait ?? 0)) this.pendingBark = null;
    else if (waiting && !this.paused && now >= this.barkGate(waiting.opts.priority ?? 1)) {
      this.pendingBark = null;
      const clip = this.clips.get(waiting.id);
      if (clip && clip !== 'missing') this.start(waiting.id, clip, waiting.opts, 'bark');
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
