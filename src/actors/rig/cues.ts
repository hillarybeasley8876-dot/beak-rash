// Cue layer: transient clips (from view.cue) and state-driven poses (state.action timing from combat,
// stun status) written additively into CueOut. Arm targets are relative to the rest shoulder.
import { Vector3 } from 'three';
import { clamp01, easeInOutCubic, easeOutBack, lerp, smoothstep } from '../../core/math';
import type { ViewCue } from '../../core/contracts';
import type { RiderAction, RiderState, Side } from '../../core/types';
import type { SpeciesDef, SkillPose } from '../species/types';
import type { ArmCue, CueOut } from './cue-types';
import { mirror } from './skeleton';

export interface Clip { kind: ViewCue; t: number; dur: number; side: Side; k: number; skill: SkillPose | null }

const DUR: Record<ViewCue, number> = {
  attack: 0.32, heavy: 0.52, hit: 0.42, stun: 0.5, ko: 0.35, respawn: 0.45, taunt: 1.1, bell: 0.55,
  victory: 2.4, defeat: 2.4, skill: 0.8, ult: 1.6, land: 0.3, boost: 0.45,
};
const SKILL_DUR: Partial<Record<SkillPose, number>> = {
  spit: 0.55, gulp: 1.25, wingspread: 2.2, honk: 0.8, chill: 2.0, spin: 0.8, doge: 1.2, ghost: 0.5,
  slide: 2.5, grab: 0.45, flash: 1.0, whistle: 0.7,
};

/** Rise over [a, b], hold, fall over [c, d] (normalised time). */
export function env(t: number, a: number, b: number, c: number, d: number): number {
  return smoothstep(a, b, t) * (1 - smoothstep(c, d, t));
}

/** Piecewise-linear keyframes with eased segments: keys = [[t, value], ...]. */
function keys(t: number, k: ReadonlyArray<readonly [number, number]>): number {
  const first = k[0];
  if (!first || t <= first[0]) return first ? first[1] : 0;
  for (let i = 1; i < k.length; i++) {
    const a = k[i - 1] as readonly [number, number], b = k[i] as readonly [number, number];
    if (t <= b[0]) return lerp(a[1], b[1], easeInOutCubic((t - a[0]) / (b[0] - a[0])));
  }
  return (k[k.length - 1] as readonly [number, number])[1];
}

const tv = new Vector3();

export class CueSystem {
  private clips: Clip[] = [];
  /** Set during the striking part of a swing (for the smear trail and weapon hand). */
  readonly strikeState = { side: 1 as Side, active: false, weight: 0 };
  private readonly shoulderL: Vector3;
  private readonly shoulderR: Vector3;
  t = 0;

  constructor(private readonly def: SpeciesDef) {
    const s = def.joints.shoulder;
    this.shoulderL = new Vector3(s[0], s[1], s[2]);
    const r = mirror(s);
    this.shoulderR = new Vector3(r[0], r[1], r[2]);
  }

  trigger(kind: ViewCue, side: Side = 1, intensity = 1, skillId: string | null = null): void {
    const skill = kind === 'skill' ? skillPoseOf(skillId) ?? this.def.meta.skillPose : null;
    const dur = (skill ? SKILL_DUR[skill] : undefined) ?? DUR[kind];
    if (kind === 'victory' || kind === 'defeat') this.clips = this.clips.filter((c) => c.kind !== 'victory' && c.kind !== 'defeat');
    this.clips.push({ kind, t: 0, dur, side, k: intensity, skill });
    if (this.clips.length > 8) this.clips.shift();
  }

  /** Is a looping end-of-race pose active (victory/defeat hold their last frame)? */
  holding(kind: 'victory' | 'defeat'): boolean {
    return this.clips.some((c) => c.kind === kind);
  }

  clear(): void {
    this.clips = [];
  }

  private arm(side: Side, out: CueOut): ArmCue {
    return side === -1 ? out.armL : out.armR;
  }

  /** Point an arm at shoulder + (x·side, y, z) with weight w (keeps the strongest request). */
  private reach(out: CueOut, side: Side, x: number, y: number, z: number, w: number, pole: Vector3, wrist = 0): void {
    const a = this.arm(side, out);
    if (w <= a.blend) return;
    const sh = side === -1 ? this.shoulderL : this.shoulderR;
    a.target.copy(sh).add(tv.set(x * side, y, z));
    a.pole.copy(pole);
    a.blend = clamp01(w);
    a.wrist = wrist;
  }

  update(state: RiderState | null, out: CueOut, dt: number): void {
    this.t += dt;
    this.strikeState.active = false;
    this.strikeState.weight = 0;
    const act = state?.action ?? null;
    if (act) this.fromAction(act, out);
    for (const c of this.clips) {
      c.t += dt;
      if (act && covers(act, c.kind)) continue;
      this.play(c, clamp01(c.t / c.dur), out);
    }
    this.clips = this.clips.filter((c) => c.t < c.dur || c.kind === 'victory' || c.kind === 'defeat');
    if (state) this.statusPoses(state, out);
  }

  private fromAction(a: RiderAction, out: CueOut): void {
    const u = clamp01(a.t / Math.max(a.dur, 1e-3));
    if (a.kind === 'attack') this.swing(out, a.side, u, 1);
    else if (a.kind === 'heavy') this.heavy(out, a.side, u);
    else if (a.kind === 'hit') this.hit(out, a.side, u, 1);
    else if (a.kind === 'bell') this.bell(out, u);
    else if (a.kind === 'ult') this.ult(out, u);
    else if (a.kind === 'skill') this.skill(out, skillPoseOf(a.skillId) ?? this.def.meta.skillPose, u, a.side);
  }

  private play(c: Clip, u: number, out: CueOut): void {
    const s = c.side, k = c.k;
    switch (c.kind) {
      case 'attack': this.swing(out, s, u, k); break;
      case 'heavy': this.heavy(out, s, u); break;
      case 'hit': this.hit(out, s, u, k); break;
      case 'ko': out.wide += 1; out.jaw += 0.7; out.squash += 0.2 * (1 - u); break;
      case 'stun': out.headRoll += Math.sin(u * 20) * 0.3 * (1 - u); out.wide += 0.6 * (1 - u); break;
      case 'skill': this.skill(out, c.skill ?? this.def.meta.skillPose, u, s); break;
      case 'ult': this.ult(out, u); break;
      case 'bell': this.bell(out, u); break;
      case 'taunt': this.taunt(out, s, u); break;
      case 'victory': this.victory(out, u); break;
      case 'defeat': this.defeat(out, u); break;
      case 'land':
        out.squash += keys(u, [[0, 0], [0.14, 0.26 * k], [0.5, -0.05 * k], [1, 0]]);
        out.lift -= 0.045 * k * env(u, 0, 0.12, 0.4, 1);
        break;
      case 'boost':
        out.squash += keys(u, [[0, 0], [0.2, -0.13], [0.6, 0.03], [1, 0]]);
        out.squint += 0.5 * env(u, 0, 0.1, 0.7, 1);
        out.jaw += 0.3 * env(u, 0, 0.1, 0.6, 1);
        break;
      case 'respawn':
        out.squash += keys(u, [[0, 0.3], [0.3, -0.15], [0.6, 0.05], [1, 0]]);
        out.wide += 0.5 * (1 - u);
        break;
    }
  }

  private swing(out: CueOut, s: Side, u: number, k: number): void {
    const w = smoothstep(0, 0.12, u) * (1 - smoothstep(0.62, 1, u));
    const x = keys(u, [[0, 0.1], [0.19, 0.28], [0.35, 0.74], [0.5, 0.6], [1, 0.3]]);
    const y = keys(u, [[0, -0.2], [0.19, 0.24], [0.35, 0.05], [0.5, -0.08], [1, -0.25]]);
    const z = keys(u, [[0, -0.3], [0.19, 0.2], [0.35, -0.12], [0.5, -0.42], [1, -0.4]]);
    const wr = keys(u, [[0, 0], [0.19, -0.7], [0.35, 0.6], [0.5, 1.0], [1, 0]]);
    const pole = tv.set(s * 0.4, 0.7, 0.5).lerp(new Vector3(0, 0.2, 1), smoothstep(0.15, 0.35, u)).clone();
    this.reach(out, s, x, y, z, w * k, pole, wr);
    this.strike(s, u, 0.14, 0.6);
    out.spineYaw += keys(u, [[0, 0], [0.19, 0.22 * s], [0.4, -0.38 * s], [1, 0]]);
    out.spineRoll += -s * 0.12 * w;
    const e = env(u, 0, 0.1, 0.6, 1);
    out.squint += e;
    out.brow += 0.8 * e;
    out.jaw += 0.35 * env(u, 0.15, 0.3, 0.5, 0.8);
  }

  private heavy(out: CueOut, s: Side, u: number): void {
    const w = smoothstep(0, 0.12, u) * (1 - smoothstep(0.66, 1, u));
    const x = keys(u, [[0, 0.1], [0.31, 0.12], [0.42, 0.7], [0.54, 0.62], [1, 0.3]]);
    const y = keys(u, [[0, -0.2], [0.31, 0.62], [0.42, 0.1], [0.54, -0.3], [1, -0.25]]);
    const z = keys(u, [[0, -0.3], [0.31, 0.18], [0.42, -0.15], [0.54, -0.3], [1, -0.4]]);
    const wr = keys(u, [[0, 0], [0.31, -1.0], [0.45, 0.8], [0.54, 1.1], [1, 0]]);
    const pole = tv.set(s * 0.2, 0.9, 0.4).lerp(new Vector3(s * 0.2, 0.2, 1), smoothstep(0.3, 0.45, u)).clone();
    this.reach(out, s, x, y, z, w, pole, wr);
    this.strike(s, u, 0.3, 0.62);
    out.spinePitch += keys(u, [[0, 0], [0.31, -0.22], [0.45, 0.28], [0.6, 0.15], [1, 0]]);
    out.spineRoll += -s * 0.25 * env(u, 0.35, 0.45, 0.6, 1);
    out.squash += keys(u, [[0, 0], [0.31, -0.08], [0.45, 0.16], [0.6, 0], [1, 0]]);
    const e = env(u, 0, 0.1, 0.65, 1);
    out.squint += e;
    out.brow += e;
    out.jaw += 0.6 * env(u, 0.38, 0.45, 0.6, 0.8);
  }

  private strike(s: Side, u: number, a: number, b: number): void {
    this.strikeState.side = s;
    if (u > 0 && u < 1) this.strikeState.weight = 1;
    if (u >= a && u <= b) this.strikeState.active = true;
  }

  private hit(out: CueOut, s: Side, u: number, k: number): void {
    const e = env(u, 0, 0.06, 0.35, 1) * k;
    out.spineRoll += s * 0.35 * e;
    out.headRoll += s * 0.45 * e;
    out.headYaw += s * 0.35 * e;
    out.squash += keys(u, [[0, 0], [0.08, 0.2 * k], [0.25, -0.08 * k], [0.5, 0], [1, 0]]);
    out.wide += e;
    out.brow -= 0.8 * e;
    out.jaw += 0.5 * e;
    this.reach(out, s, 0.45, 0.35, 0.12, 0.75 * e, tv.set(s, 0.6, 0.3).clone(), -0.5);
  }

  private skill(out: CueOut, pose: SkillPose, u: number, s: Side): void {
    const e = env(u, 0, 0.1, 0.85, 1);
    const P = (x: number, y: number, z: number): Vector3 => new Vector3(x, y, z);
    switch (pose) {
      case 'spit':
        out.neck += env(u, 0, 0.2, 0.55, 1);
        out.jaw += env(u, 0.12, 0.24, 0.5, 0.8);
        out.headPitch += keys(u, [[0, 0], [0.15, 0.25], [0.3, -0.25], [0.6, 0], [1, 0]]);
        out.pouch += keys(u, [[0, 0], [0.15, 0.6], [0.3, -0.15], [0.6, 0], [1, 0]]);
        out.squash += keys(u, [[0, 0], [0.15, 0.06], [0.3, -0.08], [0.6, 0], [1, 0]]);
        out.squint += e;
        break;
      case 'gulp':
        out.jaw += env(u, 0, 0.1, 0.78, 0.92);
        out.pouch += keys(u, [[0, 0], [0.15, 1.25], [0.78, 1.35], [0.92, 0.5], [1, 0]]);
        out.headPitch += keys(u, [[0, 0], [0.12, 0.1], [0.8, 0.05], [0.92, 0.35], [1, 0]]);
        out.neck += 0.3 * e;
        out.wide += 0.6 * e;
        break;
      case 'wingspread':
        out.wings += env(u, 0, 0.08, 0.9, 1);
        out.spinePitch += 0.22 * e;
        out.squint += 0.6 * e;
        out.jaw += 0.25 * e;
        break;
      case 'honk':
        out.neck += env(u, 0, 0.15, 0.6, 1);
        out.jaw += env(u, 0.05, 0.15, 0.6, 0.9);
        out.wings += 0.5 * e;
        out.headPitch -= 0.1 * e;
        out.brow += e;
        out.squash -= 0.1 * e;
        break;
      case 'chill':
        out.spinePitch -= 0.25 * e;
        out.blink += 0.85 * e;
        for (const side of [-1, 1] as const) this.reach(out, side, 0.05, 0.42, 0.18, 0.9 * env(u, 0, 0.15, 0.75, 0.95), P(side, 0.6, 0.2));
        break;
      case 'spin':
        out.spin += easeInOutCubic(u) * Math.PI * 4;
        out.wings += 0.7 * e;
        out.squint += e;
        break;
      case 'doge':
        out.headYaw += -s * 0.5 * e;
        out.squint += 0.55 * e;
        out.brow -= 0.2 * e;
        out.spinePitch -= 0.12 * e;
        break;
      case 'ghost':
        out.wings += 0.6 * Math.abs(Math.sin(u * Math.PI * 3));
        out.blink += 0.5 * e;
        break;
      case 'slide':
        out.lie += env(u, 0, 0.12, 0.9, 1);
        out.squint += 0.4 * e;
        break;
      case 'grab':
        this.reach(out, s, 0.75, 0.05, -0.2, env(u, 0, 0.2, 0.6, 1), P(s * 0.3, 0.4, 1), 0.6);
        out.jaw += 0.6 * e;
        out.spineYaw += -s * 0.3 * e;
        break;
      case 'flash':
        out.spinePitch += 0.38 * e;
        out.wide += e;
        out.headPitch -= 0.2 * e;
        break;
      case 'whistle':
        out.jaw += 0.2 * e;
        out.headPitch += 0.25 * e;
        this.reach(out, 1, 0.25, 0.35, -0.55, e, P(0.5, 0.5, 0.6), 0.4);
        break;
    }
  }

  private ult(out: CueOut, u: number): void {
    const rise = env(u, 0.1, 0.25, 0.55, 0.65), dive = env(u, 0.58, 0.68, 0.9, 0.97);
    out.lift += keys(u, [[0, 0], [0.12, -0.06], [0.3, 0.1], [0.6, 0.06], [0.92, -0.05], [1, 0]]);
    out.squash += keys(u, [[0, 0], [0.12, 0.15], [0.3, -0.15], [0.6, 0], [0.92, 0.3], [1, 0]]);
    out.wings += rise + dive * 0.4;
    out.headPitch += 0.3 * rise - 0.35 * dive;
    out.jaw += 0.5 * rise;
    out.spinePitch += 0.2 * env(u, 0, 0.06, 0.1, 0.2) + 0.45 * dive;
    out.neck += dive;
    out.squint += dive;
    for (const side of [-1, 1] as const) this.reach(out, side, 0.35, 0.1, 0.45, dive * 0.8, new Vector3(0, 0.4, 1));
  }

  private bell(out: CueOut, u: number): void {
    out.armR.wrist += 0.6 * Math.max(0, Math.sin(u * Math.PI * 4)) * (1 - u);
    const e = env(u, 0, 0.15, 0.7, 1);
    out.squint += 0.45 * e;
    out.brow -= 0.3 * e;
    out.headRoll += 0.15 * e;
  }

  private taunt(out: CueOut, s: Side, u: number): void {
    const e = env(u, 0, 0.15, 0.8, 1);
    this.reach(out, s, 0.35, 0.45, 0.1, e, new Vector3(s, 0.5, 0.5), Math.sin(u * 40) * 0.5);
    out.headYaw += -s * 0.6 * e;
    out.jaw += 0.5 * e * (0.6 + 0.4 * Math.sin(u * 30));
    out.squint += 0.6 * e;
  }

  private victory(out: CueOut, u: number): void {
    const e = easeOutBack(clamp01(u * 4));
    for (const side of [-1, 1] as const) this.reach(out, side, 0.25, 0.55, 0.05, clamp01(e), new Vector3(side, 0.3, 0.6), Math.sin(this.t * 9) * 0.3);
    out.wings += 0.3 * clamp01(e);
    out.headPitch += 0.3;
    out.jaw += 0.4 + 0.3 * Math.abs(Math.sin(this.t * 7));
    out.squint += 0.4;
  }

  private defeat(out: CueOut, u: number): void {
    const e = smoothstep(0, 0.3, u);
    out.spinePitch += 0.3 * e;
    out.headPitch -= 0.45 * e;
    out.blink += 0.55 * e;
    out.brow -= e;
  }

  /** Continuous poses from statuses (stun wobble, hit wobble) and the boost grin. */
  private statusPoses(st: RiderState, out: CueOut): void {
    for (const s of st.statuses) {
      if (s.id === 'stun') {
        out.headRoll += Math.sin(this.t * 7) * 0.25;
        out.headPitch += Math.cos(this.t * 7) * 0.12;
        out.spineRoll += Math.sin(this.t * 3.5) * 0.08;
        out.jaw += 0.25;
      } else if (s.id === 'wobble') {
        out.spineRoll += Math.sin(this.t * 18) * 0.12 * Math.min(1, s.strength || 1);
      }
    }
  }
}

/** True when a live combat action already drives this cue kind. */
function covers(a: RiderAction, kind: ViewCue): boolean {
  return (kind === 'attack' && a.kind === 'attack') || (kind === 'heavy' && a.kind === 'heavy') || (kind === 'skill' && a.kind === 'skill')
    || (kind === 'ult' && a.kind === 'ult') || (kind === 'bell' && a.kind === 'bell') || (kind === 'hit' && a.kind === 'hit');
}

const POSES: Record<string, SkillPose> = {
  'pelican.torpedo': 'spit', 'pelican.gulp': 'gulp', 'pelican.wing': 'wingspread', 'goose.honk': 'honk',
  'capybara.chill': 'chill', 'cat.spin': 'spin', 'shiba.doge': 'doge', 'pigeon.ghost': 'ghost', 'penguin.slide': 'slide',
  'seagull.steal': 'grab', 'sloth.flash': 'flash', 'corgi.whistle': 'whistle',
};

export function skillPoseOf(skillId: string | null | undefined): SkillPose | null {
  return skillId ? POSES[skillId] ?? null : null;
}
