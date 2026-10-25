// Character barks: which line a rival says (the bubble's own clip, else a random voiced line of
// that kind, else the species call), only near the player, placed by the camera and faded with
// track distance (re-placed every frame while it plays). The bell taunt (叮) is the bike bell.
// Speakers that are not session riders (the police corgi, a stall owner) ride an Obstacle: their
// line is placed where that obstacle is, and it fades out when the obstacle is gone.
import { Vector3 } from 'three';
import { Rng } from '../../core/rng';
import { ROSTER } from '../../data/roster';
import type { RiderId } from '../../core/types';
import type { BarkKind, Host } from '../host';
import type { VoicePlayer } from './player';

/** Barks fade out between these track distances (m) from the player. */
const NEAR = 30;
const FAR = 45;

export class Barks {
  private rng = new Rng(0xa0d10);
  private v = new Vector3();

  constructor(private h: Host, private voices: VoicePlayer) {}

  say(riderId: RiderId, kind: BarkKind, text?: string, wait?: number): void {
    const s = this.h.session();
    const r = s?.rider(riderId);
    if (!s || !r) return;
    if (text?.includes('叮')) {
      if (this.h.cooldown(`bell${riderId}`, 0.6)) this.h.play('bike.bell', riderId);
      return;
    }
    if (Math.abs(r.s - s.player.s) > NEAR) return;
    const def = ROSTER[r.character];
    const lines = kind === 'ko' ? def.koLines : kind === 'hurt' ? def.hurtLines : def.taunts;
    const voiced = lines.map((l) => this.voices.idFor(l)).filter((x): x is string => x !== null);
    const id = text !== undefined ? this.voices.idFor(text) : voiced.length ? this.rng.pick(voiced) : null;
    const follow = (): { gain: number; pan: number } | null => this.place(riderId);
    const at = follow();
    // The pelican's own lines outrank the rivals' (they cut a rival line that is playing).
    const priority = this.h.isPlayer(riderId) ? 2 : 1;
    if (id && at && this.voices.play(id, { channel: 'bark', pan: at.pan, gain: at.gain, follow, wait, priority }) !== 'none') return;
    if (this.h.cooldown(`call${riderId}`, 2)) this.h.play(`animal.${r.character}`, riderId, { volume: 0.85 });
  }

  /** A speaking rival's gain / pan now: camera placement, faded out with track distance. */
  private place(riderId: RiderId): { gain: number; pan: number } | null {
    const s = this.h.session();
    const r = s?.rider(riderId);
    if (!s || !r) return null;
    const d = Math.abs(r.s - s.player.s);
    const fade = d <= NEAR ? 1 : d >= FAR ? 0 : 1 - (d - NEAR) / (FAR - NEAR);
    const p = this.h.place(riderId);
    return { gain: Math.min(1, p.gain * 1.15) * fade, pan: p.pan };
  }

  /**
   * A line from a speaker that rides an Obstacle (the police corgi, a market-stall owner): its
   * own clip if one was generated, else the species call. The line is placed where the obstacle
   * is and fades out when the obstacle is gone.
   */
  sayObstacle(obstacleId: number, text: string, character: string): void {
    const s = this.h.session();
    if (!s) return;
    const follow = (): { gain: number; pan: number } | null => this.placeObstacle(obstacleId);
    const at = follow();
    if (!at || at.gain < 0.04) return;
    const id = this.voices.idFor(text);
    if (id && this.voices.play(id, { channel: 'bark', pan: at.pan, gain: at.gain, follow, priority: 1 }) !== 'none') return;
    if (this.h.cooldown(`call${obstacleId}`, 2)) this.h.play(`animal.${character}`, null, { volume: 0.8 });
  }

  /** Where an obstacle-riding speaker is now (null = gone or out of range). */
  private placeObstacle(obstacleId: number): { gain: number; pan: number } | null {
    const s = this.h.session();
    const o = s?.obstacles.find((x) => x.id === obstacleId);
    if (!s || !o) return null;
    s.track.toWorld(o.s, o.x, 1.2, this.v);
    const p = this.h.place({ x: this.v.x, y: this.v.y, z: this.v.z });
    return { gain: p.gain, pan: p.pan };
  }
}
