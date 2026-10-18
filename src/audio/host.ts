// What the event reactor and the session watcher need from the audio runtime (system.ts).
import type { AppContext, Session } from '../core/contracts';
import type { RiderId, Vec3Like } from '../core/types';
import type { StingerId } from './music/stingers';
import type { PlayOpts } from './sfx/bank';
import type { Placement } from './sfx/spatial';

/** Where a sound comes from: a rider (player = centred), a world position, or nowhere (UI). */
export type Where = RiderId | Vec3Like | null;

export type BarkKind = 'taunt' | 'ko' | 'hurt';

export interface Host {
  readonly app: AppContext;
  /** Unlocked and running: nothing may play before this. */
  readonly live: boolean;
  session(): Session | null;
  /** The attached session's player (false for null / other riders / no session). */
  isPlayer(id: RiderId | null): boolean;
  /** 'race-<trackId>' for the attached session, else null. */
  raceSong(): string | null;
  /** Gain / pan / air absorption of `where` as heard from the camera (the player = centred). */
  place(where: Where): Placement;
  play(id: string, where?: Where, opts?: PlayOpts): void;
  /** A sub-heavy impact: only one owns the low end at a time (a second within 0.4 s is high-passed). */
  boom(id: string, where?: Where, opts?: PlayOpts): void;
  announce(id: string, priority?: number): void;
  /** A rival's voice line (or its animal call when no clip exists), only near the player. */
  bark(riderId: RiderId, kind: BarkKind, text?: string): void;
  stinger(id: StingerId): void;
  song(id: string | null, fade?: number): void;
  /** Race countdown n = 3, 2, 1 (count-in; the song waits), 0 = GO (bar 1 of section A). */
  countdown(n: number): void;
  /** Cinematic muffle (KO / SHOWTIME slow-mo), 0..1. */
  setCine(amount: number): void;
  /** High-pass the music's low end (0 = full range); `tau` = response time constant (s). */
  dropBass(amount: number, tau?: number): void;
  /** Duck the music to `depthDb` within 5 ms, for `hold` s (impacts). */
  duckMusic(depthDb: number, hold: number): void;
  /** True at most once per `seconds` for `key` (rate limiting). */
  cooldown(key: string, seconds: number): boolean;
}
