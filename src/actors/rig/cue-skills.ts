// Signature skill poses (cue layer), written additively into CueOut. u = 0..1 through the skill, s = side.
// Each pose must read at 0.5× from the chase cam: big silhouettes (arms, wings, neck), plus face beats.
import { Vector3 } from 'three';
import { easeInOutCubic, lerp } from '../../core/math';
import type { Side } from '../../core/types';
import type { SkillPose } from '../species/types';
import type { CueOut } from './cue-types';
import { env, keys } from './cue-math';

export interface PoseCtx {
  /** Cue clock (s) for flaps and jiggles. */
  readonly t: number;
  /** Point an arm at shoulder + (x·side, y, z) with weight w (pole = elbow direction). */
  reach(out: CueOut, side: Side, x: number, y: number, z: number, w: number, pole: Vector3, wrist?: number): void;
}

const P = (x: number, y: number, z: number): Vector3 => new Vector3(x, y, z);
/** A short sparkle every ~2.4 s (glint beats during a sustained pose). */
const pulse = (t: number): number => Math.max(0, Math.sin(t * 2.6) - 0.85) / 0.15;

/** `hold` (0..1) = sustained phase of a long effect (doge shield, sloth flash, chill aura, pigeon ghost): u stays at
 *  0.5 meanwhile, and poses use it to relax into a hold variant with some life. */
export function skillPose(ctx: PoseCtx, out: CueOut, pose: SkillPose, u: number, s: Side, hold = 0): void {
  const e = env(u, 0, 0.1, 0.85, 1);
  switch (pose) {
    case 'spit':
      out.neck += env(u, 0, 0.2, 0.55, 1);
      out.jaw += env(u, 0.12, 0.24, 0.5, 0.8);
      out.headPitch += keys(u, [[0, 0], [0.15, 0.25], [0.3, -0.25], [0.6, 0], [1, 0]]);
      out.pouch += keys(u, [[0, 0], [0.15, 0.6], [0.3, -0.15], [0.6, 0], [1, 0]]);
      out.squash += keys(u, [[0, 0], [0.15, 0.06], [0.3, -0.08], [0.6, 0], [1, 0]]);
      out.squint += e;
      break;
    case 'gulp': {
      // Big Gulp: beak up, pouch balloons sideways past the cheeks (visible from behind) and jiggles.
      const hold = env(u, 0.15, 0.25, 0.75, 0.9);
      out.jaw += env(u, 0, 0.1, 0.78, 0.92);
      out.pouch += keys(u, [[0, 0], [0.15, 1.25], [0.78, 1.35], [0.92, 0.5], [1, 0]]) + 0.1 * Math.sin(ctx.t * 23) * hold;
      out.headPitch += keys(u, [[0, 0], [0.12, 0.32], [0.8, 0.28], [0.92, 0.42], [1, 0]]);
      out.squash += 0.04 * Math.sin(ctx.t * 23 + 1) * hold;
      out.neck += 0.3 * e;
      out.wide += 0.6 * e;
      break;
    }
    case 'wingspread': {
      // Wing dash: wings swept back with fanned primaries (ride.ts), slow flap, body tucked low, beak forward.
      const w = env(u, 0, 0.08, 0.9, 1);
      out.wings += w;
      out.flap += Math.sin(ctx.t * 7) * w;
      out.spinePitch += 0.36 * e;
      out.neck += 0.35 * e;
      out.headPitch -= 0.08 * e;
      out.squint += 0.6 * e;
      out.jaw += 0.25 * e;
      break;
    }
    case 'honk':
      out.neck += env(u, 0, 0.15, 0.6, 1);
      out.jaw += env(u, 0.05, 0.15, 0.6, 0.9);
      out.wings += 0.6 * e;
      out.flap += 0.6 * Math.sin(ctx.t * 14) * e;
      out.headPitch -= 0.1 * e;
      out.brow += e;
      out.squash -= 0.1 * e;
      break;
    case 'chill': {
      // Zen: paws laced behind the head, leaning back, eyes shut.
      const a = env(u, 0, 0.15, 0.8, 0.95);
      out.spinePitch -= 0.3 * e;
      out.headPitch += 0.2 * e;
      out.blink += e;
      out.squash -= 0.04 * e - 0.025 * Math.sin(ctx.t * 2.2) * hold;
      out.steam += env(u, 0.12, 0.25, 0.8, 0.92);
      out.headRoll += 0.08 * Math.sin(ctx.t * 1.3) * hold;
      for (const side of [-1, 1] as const) ctx.reach(out, side, -0.05, 0.4, 0.1, a, P(side, 0.25, -0.45), 0.4);
      break;
    }
    case 'spin':
      out.spin += easeInOutCubic(u) * Math.PI * 4;
      out.legTuck += env(u, 0, 0.1, 0.85, 1);
      out.wings += env(u, 0, 0.2, 0.8, 1);
      out.squint += e;
      break;
    case 'doge': {
      // Shield: the near paw pushes the pixel shades up (elbow out and down, glint), chin up, smug lean back. While the
      // shield lasts the paw rests akimbo on the hip (elbow out: reads from behind) and the shades glint now and then.
      ctx.reach(out, s, lerp(0, 0.07, hold), lerp(0.22, -0.2, hold), lerp(-0.17, 0.18, hold), env(u, 0, 0.12, 0.85, 1),
        P(s, lerp(-0.6, 0.1, hold), lerp(0.1, 0.4, hold)), lerp(-0.5, 0.3, hold));
      out.headYaw += -s * 0.25 * e;
      out.headPitch += 0.18 * e;
      out.headRoll += s * 0.12 * e;
      out.spinePitch -= 0.15 * e;
      out.squint += 0.55 * e;
      out.brow -= 0.2 * e;
      out.glint += env(u, 0.16, 0.24, 0.42, 0.58) * (1 - hold) + pulse(ctx.t) * hold;
      break;
    }
    case 'ghost':
      out.wings += lerp(0.6 * Math.abs(Math.sin(u * Math.PI * 3)), 0.35 + 0.15 * Math.sin(ctx.t * 6), hold);
      out.blink += 0.5 * e;
      break;
    case 'slide':
      out.lie += env(u, 0, 0.12, 0.9, 1);
      out.squint += 0.4 * e;
      break;
    case 'grab':
      ctx.reach(out, s, 0.75, 0.05, -0.2, env(u, 0, 0.25, 0.6, 1), P(s * 0.3, 0.4, 1), 0.6 + 0.6 * env(u, 0.2, 0.4, 0.6, 0.9));
      out.jaw += 0.6 * e;
      out.spineYaw += -s * 0.3 * e;
      break;
    case 'flash': {
      // Lightning: deep sprinter crouch, one paw thrust forward, the other swept back, eyes blazing.
      const a = env(u, 0, 0.14, 0.8, 1), b = env(u, 0, 0.22, 0.78, 1);
      out.spinePitch += 0.5 * e;
      out.lift -= 0.03 * e;
      out.headPitch -= 0.1 * e;
      out.wide += e;
      out.brow += 0.6 * e;
      out.jaw += 0.3 * e;
      ctx.reach(out, 1, 0.08, 0.02, -0.62, a, P(0.4, 0.5, 0.6), 0.2);
      ctx.reach(out, -1, 0.3, 0.12, 0.5, b, P(-0.6, 0.4, -0.3), -0.4);
      out.glint += env(u, 0.05, 0.12, 0.3, 0.45) * (1 - hold) + pulse(ctx.t + 1) * hold;
      out.squash += 0.03 * Math.sin(ctx.t * 9) * hold;
      break;
    }
    case 'whistle': {
      const a = env(u, 0, 0.2, 0.8, 1);
      out.jaw += 0.2 * e;
      out.headPitch += 0.25 * e;
      out.brow += 0.8 * e;
      ctx.reach(out, 1, 0.25, 0.35, -0.55, a, P(0.5, 0.5, 0.6), 0.4);
      ctx.reach(out, -1, 0.15, 0.4, -0.38, a, P(-1, -0.2, 0.3), lerp(-0.2, 0.2, Math.sin(ctx.t * 9) * 0.5 + 0.5));
      break;
    }
  }
}
