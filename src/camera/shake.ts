// Trauma-style camera shake (smooth multi-sine noise in real time), a separate high-frequency buzz for
// continuous sources (curbs, scraping, rough ground, speed) and FOV kicks.
// Overlapping shakes combine with max(), so a duplicate cam:shake from another unit never stacks.
import { Vector3 } from 'three';
import { clamp, smoothstep } from '../core/math';

interface Pulse { amp: number; dur: number; t: number }

export const SHAKE = {
  maxMove: 0.3,     // m at trauma 1 (camera-local)
  maxRot: 0.055,    // rad at trauma 1
  exponent: 1.25,   // amplitude = trauma^exponent
  kickAttack: 0.08, // s
  kickCap: 16,      // deg
  buzzRot: 0.0036,  // rad at buzz 1 (≈ 2 px at 720p): curb rumble / scrape / gravel stay visible
};

/** 15–19 Hz texture for the buzz channel (trauma noise is 4–11 Hz). */
function buzzNoise(t: number, seed: number): number {
  return (Math.sin(t * 94 + seed) + 0.5 * Math.sin(t * 121.7 + seed * 1.9)) / 1.5;
}

function noise(t: number, seed: number): number {
  return (Math.sin(t * 29 + seed) + 0.6 * Math.sin(t * 47.3 + seed * 2.1) + 0.35 * Math.sin(t * 71.9 + seed * 3.7)) / 1.95;
}

export class ShakeKick {
  /** Continuous trauma floor, set every frame. */
  rumble = 0;
  /** Continuous high-frequency buzz 0..1, set every frame (curb, wall scrape, rough ground, speed). */
  buzz = 0;
  /** User setting 0..1 (settings.shake). */
  strength = 1;
  private shakes: Pulse[] = [];
  private kicks: Pulse[] = [];
  private time = 0;

  shake(amp: number, dur: number): void {
    if (!(amp > 0) || !(dur > 0)) return;
    if (this.shakes.length >= 16) this.shakes.shift();
    this.shakes.push({ amp: Math.min(1, amp), dur, t: 0 });
  }

  kick(fov: number, dur: number): void {
    if (!Number.isFinite(fov) || fov === 0) return;
    if (this.kicks.length >= 8) this.kicks.shift();
    this.kicks.push({ amp: fov, dur: Math.max(0.12, dur), t: 0 });
  }

  clear(): void {
    this.shakes.length = 0;
    this.kicks.length = 0;
    this.rumble = 0;
    this.buzz = 0;
  }

  update(dtReal: number): void {
    this.time += dtReal;
    for (const list of [this.shakes, this.kicks]) {
      for (const p of list) p.t += dtReal;
      for (let i = list.length - 1; i >= 0; i--) if ((list[i]?.t ?? 0) >= (list[i]?.dur ?? 0)) list.splice(i, 1);
    }
  }

  get trauma(): number {
    let tr = this.rumble;
    for (const p of this.shakes) tr = Math.max(tr, p.amp * (1 - p.t / p.dur) ** 2);
    return clamp(tr, 0, 1);
  }

  /** Sum of kick envelopes: fast ease-out attack, short hold, smooth release over the back half. */
  get fov(): number {
    let sum = 0;
    for (const p of this.kicks) {
      const attack = smoothstep(0, Math.min(SHAKE.kickAttack, p.dur * 0.3), p.t);
      const release = 1 - smoothstep(p.dur * 0.45, p.dur, p.t);
      sum += p.amp * attack * release;
    }
    return clamp(sum, -SHAKE.kickCap, SHAKE.kickCap);
  }

  /** Camera-local translation and (pitch, yaw, roll) offsets for this frame. */
  offsets(outMove: Vector3, outRot: Vector3): void {
    const a = Math.pow(this.trauma, SHAKE.exponent) * this.strength;
    const t = this.time;
    outMove.set(noise(t, 1.3) * SHAKE.maxMove * a, noise(t, 7.1) * SHAKE.maxMove * 0.8 * a, 0);
    const b = Math.min(1, this.buzz) * SHAKE.buzzRot * this.strength;
    outRot.set(
      noise(t, 3.9) * SHAKE.maxRot * a + buzzNoise(t, 0.7) * b,
      noise(t, 5.2) * SHAKE.maxRot * a + buzzNoise(t, 2.3) * b * 0.4,
      noise(t, 9.4) * SHAKE.maxRot * 1.2 * a + buzzNoise(t, 4.1) * b * 0.7,
    );
  }
}
