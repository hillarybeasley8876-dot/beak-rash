// Cue layer: transient clips (from view.cue) and state-driven poses (state.action timing from combat,
// stun status) written additively into CueOut. Arm targets are relative to the rest shoulder.
import { Vector3 } from 'three';
import { clamp01, damp, easeOutBack, smoothstep } from '../../core/math';
import type { ViewCue } from '../../core/contracts';
import type { RiderAction, RiderState, Side } from '../../core/types';
import type { SpeciesDef, SkillPose } from '../species/types';
import { env, keys, spline } from './cue-math';
import { skillPose, type PoseCtx } from './cue-skills';
import { clearCue, makeCue, mergeArm, mixCue, type ArmCue, type CueOut } from './cue-types';
import { mirror } from './skeleton';

/** Clips nobody calls view.cue() for (StateCues derives them from the rider's state). */
export type LocalCue = 'takeoff';
type ClipKind = ViewCue | LocalCue;
/** `hold` = seconds a skill pose is sustained at HOLD_U while its effect runs (part of `dur`). */
export interface Clip { kind: ClipKind; t: number; dur: number; side: Side; k: number; skill: SkillPose | null; hold: number }

const DUR: Record<ClipKind, number> = {
  attack: 0.32, heavy: 0.52, hit: 0.42, stun: 0.5, ko: 0.35, respawn: 0.45, taunt: 1.1, bell: 0.55,
  victory: 2.4, defeat: 2.4, skill: 0.8, ult: 1.6, land: 0.3, boost: 0.45, takeoff: 0.3,
};
const SKILL_DUR: Partial<Record<SkillPose, number>> = {
  spit: 0.55, gulp: 1.25, wingspread: 2.2, honk: 0.85, chill: 2.0, spin: 0.8, doge: 1.2, ghost: 0.6,
  slide: 2.5, grab: 0.6, flash: 1.0, whistle: 0.9,
};
/** Effect time of the sustained non-lockout skills (SPEC §7): combat's cast action lasts only 0.35 s, so the clip
 *  owns the timing and holds the pose at HOLD_U until the effect ends (see sustained()). */
const SKILL_HOLD: Partial<Record<SkillPose, number>> = { chill: 4, doge: 3, flash: 3, ghost: 1.5 };
const HOLD_U = 0.5;

const tv = new Vector3(), tv2 = new Vector3();

export class CueSystem implements PoseCtx {
  private clips: Clip[] = [];
  /** Set during the striking part of a swing (for the smear trail and weapon hand). */
  readonly strikeState = { side: 1 as Side, active: false, weight: 0, heavy: false };
  private readonly shoulderL: Vector3;
  private readonly shoulderR: Vector3;
  /** Last frame's action (copy) and a cancelled action that fades out instead of vanishing. */
  private last: RiderAction | null = null;
  private ghost: { act: RiderAction; fade: number } | null = null;
  private readonly ghostOut = makeCue();
  /** Smoothed air-pose weight (long jumps). */
  private air = 0;
  t = 0;

  constructor(private readonly def: SpeciesDef) {
    const s = def.joints.shoulder;
    this.shoulderL = new Vector3(s[0], s[1], s[2]);
    const r = mirror(s);
    this.shoulderR = new Vector3(r[0], r[1], r[2]);
  }

  trigger(kind: ClipKind, side: Side = 1, intensity = 1, skillId: string | null = null): void {
    const skill = kind === 'skill' ? skillPoseOf(skillId) ?? this.def.meta.skillPose : null;
    const dur = (skill ? SKILL_DUR[skill] : undefined) ?? DUR[kind];
    const hold = skill ? Math.max(0, (SKILL_HOLD[skill] ?? 0) - dur) : 0;
    if (kind === 'victory' || kind === 'defeat') this.clips = this.clips.filter((c) => c.kind !== 'victory' && c.kind !== 'defeat');
    this.clips.push({ kind, t: 0, dur: dur + hold, side, k: intensity, skill, hold });
    if (this.clips.length > 8) this.clips.shift();
  }

  /** Is a looping end-of-race pose active (victory/defeat hold their last frame)? */
  holding(kind: 'victory' | 'defeat'): boolean {
    return this.clips.some((c) => c.kind === kind);
  }

  clear(): void {
    this.clips = [];
    this.ghost = null;
    this.last = null;
  }

  private arm(side: Side, out: CueOut): ArmCue {
    return side === -1 ? out.armL : out.armR;
  }

  /** Point an arm at shoulder + (x·side, y, z) with weight w (blended with other requests, see mergeArm). */
  reach(out: CueOut, side: Side, x: number, y: number, z: number, w: number, pole: Vector3, wrist = 0): void {
    const sh = side === -1 ? this.shoulderL : this.shoulderR;
    mergeArm(this.arm(side, out), tv.copy(sh).add(tv2.set(x * side, y, z)), pole, wrist, clamp01(w));
  }

  update(state: RiderState | null, out: CueOut, dt: number): void {
    this.t += dt;
    const act = state?.action ?? null;
    this.trackAction(act);
    this.strikeState.active = false;
    this.strikeState.weight = 0;
    if (this.ghost) this.playGhost(out, dt);
    if (act && !this.owned(act)) this.fromAction(act, out);
    for (const c of this.clips) {
      c.t += dt;
      if (act && this.covers(act, c.kind)) continue;
      if (c.kind === 'skill') this.playSkill(c, state, out);
      else this.play(c, clamp01(c.t / c.dur), out);
    }
    this.clips = this.clips.filter((c) => c.t < c.dur || c.kind === 'victory' || c.kind === 'defeat');
    if (state) this.statusPoses(state, out, dt);
  }

  /** A cut-short action (hit cancels a swing, spam swaps sides) fades out over 0.15 s instead of popping. */
  private trackAction(act: RiderAction | null): void {
    const prev = this.last;
    const changed = prev && (!act || act.kind !== prev.kind || act.side !== prev.side || act.skillId !== prev.skillId || act.t < prev.t);
    if (prev && changed && !this.owned(prev)) {
      this.clips = this.clips.filter((c) => c.t === 0 || !this.covers(prev, c.kind));
      if (prev.t < prev.dur - 0.03) this.ghost = { act: { ...prev }, fade: 1 };
    }
    this.last = act ? Object.assign(this.last ?? { ...act }, act) : null;
  }

  private playGhost(out: CueOut, dt: number): void {
    const g = this.ghost as { act: RiderAction; fade: number };
    g.fade -= dt / 0.15;
    if (g.fade <= 0) {
      this.ghost = null;
      return;
    }
    g.act.t += dt;
    clearCue(this.ghostOut);
    this.fromAction(g.act, this.ghostOut);
    this.strikeState.active = false;
    this.strikeState.weight = 0;
    mixCue(out, this.ghostOut, smoothstep(0, 1, g.fade));
  }

  private fromAction(a: RiderAction, out: CueOut): void {
    const u = clamp01(a.t / Math.max(a.dur, 1e-3));
    if (a.kind === 'attack') this.swing(out, a.side, u, 1);
    else if (a.kind === 'heavy') this.heavy(out, a.side, u);
    else if (a.kind === 'hit') this.hit(out, a.side, u, 1);
    else if (a.kind === 'bell') this.bell(out, u);
    else if (a.kind === 'ult') this.ult(out, u);
    else if (a.kind === 'skill') skillPose(this, out, skillPoseOf(a.skillId) ?? this.def.meta.skillPose, u, a.side);
  }

  /** Skill clips: the designed clip (dur − hold) with its pose frozen at HOLD_U while the effect runs; the sustain
   *  weight (0..1) lets a pose relax into a hold variant and fades out over the first 0.25 s of the outro. */
  private playSkill(c: Clip, state: RiderState | null, out: CueOut): void {
    const base = c.dur - c.hold, tin = base * HOLD_U;
    const pose = c.skill ?? this.def.meta.skillPose;
    if (c.hold > 0 && c.t > tin && c.t < tin + c.hold && !sustained(pose, state)) {
      c.hold = c.t - tin;
      c.dur = base + c.hold;
    }
    const u = c.t < tin ? c.t / base : c.t < tin + c.hold ? HOLD_U : clamp01((c.t - c.hold) / base);
    const hold = c.hold > 0 ? smoothstep(tin, tin + 0.3, c.t) * (1 - smoothstep(tin + c.hold, tin + c.hold + 0.25, c.t)) : 0;
    skillPose(this, out, pose, u, c.side, hold);
  }

  /** Non-lockout skills: combat's cast action (≤ 0.35 s) is shorter than the clip, so the clip owns the timing. */
  private owned(a: RiderAction): boolean {
    if (a.kind !== 'skill') return false;
    const pose = skillPoseOf(a.skillId) ?? this.def.meta.skillPose;
    return (SKILL_DUR[pose] ?? DUR.skill) + (SKILL_HOLD[pose] ?? 0) > a.dur + 0.1;
  }

  /** True when a live combat action already drives this cue kind. */
  private covers(a: RiderAction, kind: ClipKind): boolean {
    return (kind === 'attack' && a.kind === 'attack') || (kind === 'heavy' && a.kind === 'heavy') || (kind === 'ult' && a.kind === 'ult')
      || (kind === 'skill' && a.kind === 'skill' && !this.owned(a)) || (kind === 'bell' && a.kind === 'bell') || (kind === 'hit' && a.kind === 'hit');
  }

  private play(c: Clip, u: number, out: CueOut): void {
    const s = c.side, k = c.k;
    switch (c.kind) {
      case 'attack': this.swing(out, s, u, k); break;
      case 'heavy': this.heavy(out, s, u); break;
      case 'hit': this.hit(out, s, u, k); break;
      case 'ko': out.wide += 1; out.jaw += 0.7; out.squash += 0.2 * (1 - u); break;
      case 'stun': out.headRoll += Math.sin(u * 20) * 0.3 * (1 - u); out.wide += 0.6 * (1 - u); break;
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
      case 'takeoff':
        // Hop: compress for ~0.06 s, then pop up tall with the chest pulled back (arms tug the bars), head up.
        out.squash += keys(u, [[0, 0], [0.2, 0.16 * k], [0.45, -0.12 * k], [1, 0]]);
        out.lift += keys(u, [[0, 0], [0.2, -0.03 * k], [0.5, 0.02 * k], [1, 0]]);
        out.spinePitch -= 0.18 * k * env(u, 0.15, 0.35, 0.6, 1);
        out.headPitch += 0.2 * k * env(u, 0.15, 0.35, 0.7, 1);
        out.wide += 0.4 * env(u, 0.15, 0.3, 0.6, 1);
        break;
    }
  }

  /** Light swing (combat: windup .06 / active .10 / recover .16 s): the blend weight pulls the paw back to the wind-up
   *  (the target already sits there, so the first frame moves little), a short anticipation hold, a whip out into the
   *  rival lane through contact (u ≈ 0.38) and an eased follow-through. */
  private swing(out: CueOut, s: Side, u: number, k: number): void {
    const w = smoothstep(0, 0.19, u) * (1 - smoothstep(0.62, 1, u));
    const x = spline(u, [[0, 0.17], [0.19, 0.2], [0.26, 0.24], [0.38, 0.72], [0.5, 0.64], [1, 0.3]]);
    const y = spline(u, [[0, -0.04], [0.19, 0.0], [0.26, 0.03], [0.38, 0.02], [0.5, -0.1], [1, -0.25]]);
    const z = spline(u, [[0, -0.02], [0.19, 0.02], [0.26, 0.05], [0.38, -0.18], [0.5, -0.4], [1, -0.4]]);
    const wr = spline(u, [[0, 0], [0.19, -0.6], [0.26, -0.7], [0.38, 0.6], [0.5, 1.0], [1, 0]]);
    const pole = tv.set(s * 0.4, 0.7, 0.5).lerp(new Vector3(0, 0.2, 1), smoothstep(0.15, 0.35, u)).clone();
    this.reach(out, s, x, y, z, w * k, pole, wr);
    this.strike(s, u, 0.14, 0.6);
    this.strikeState.heavy = false;
    out.spineYaw += keys(u, [[0, 0], [0.19, 0.22 * s], [0.4, -0.38 * s], [1, 0]]);
    out.spineRoll += -s * 0.12 * w;
    const e = env(u, 0, 0.1, 0.6, 1);
    out.squint += e;
    out.brow += 0.8 * e;
    out.jaw += 0.35 * env(u, 0.15, 0.3, 0.5, 0.8);
  }

  /** Heavy (windup .16 / active .12 / recover .24 s): the blend weight raises the paw into a big overhead wind-up
   *  that eases into a hold, then a chop that carries through contact (u ≈ 0.42) into the follow-through. */
  private heavy(out: CueOut, s: Side, u: number): void {
    const w = smoothstep(0, 0.29, u) * (1 - smoothstep(0.66, 1, u));
    const x = spline(u, [[0, 0.1], [0.27, 0.12], [0.33, 0.14], [0.42, 0.68], [0.54, 0.64], [1, 0.3]]);
    const y = spline(u, [[0, 0.5], [0.27, 0.56], [0.33, 0.6], [0.42, 0.12], [0.54, -0.28], [1, -0.25]]);
    const z = spline(u, [[0, 0.12], [0.27, 0.16], [0.33, 0.18], [0.42, -0.15], [0.54, -0.32], [1, -0.4]]);
    const wr = spline(u, [[0, 0], [0.27, -0.9], [0.33, -1.0], [0.45, 0.8], [0.54, 1.1], [1, 0]]);
    const pole = tv.set(s * 0.2, 0.9, 0.4).lerp(new Vector3(s * 0.2, 0.2, 1), smoothstep(0.3, 0.45, u)).clone();
    this.reach(out, s, x, y, z, w, pole, wr);
    this.strike(s, u, 0.3, 0.62);
    this.strikeState.heavy = true;
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
    this.reach(out, s, 0.45, 0.35, 0.12, 0.75 * env(u, 0, 0.26, 0.4, 1) * k, new Vector3(s, 0.6, 0.3), -0.5);
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

  /** 叮叮叮: right paw on the bike's bell (ride.ts), a flick + open beak per ding, head turned back over the shoulder. */
  private bell(out: CueOut, u: number): void {
    const e = env(u, 0, 0.12, 0.75, 1), ding = Math.max(0, Math.sin(u * Math.PI * 6)) * e;
    out.bellReach += e;
    out.armR.wrist += 0.7 * ding;
    out.headYaw -= 0.95 * e;
    out.headPitch += 0.1 * e;
    out.spineYaw -= 0.15 * e;
    out.jaw += 0.6 * ding;
    out.squint += 0.45 * e;
    out.brow -= 0.3 * e;
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

  /** Slumped from the chase cam: arms dangling off the bars, shoulders dropped, body sunk, head hanging with a slow
   *  shake, one sigh puff. */
  private defeat(out: CueOut, u: number): void {
    const e = smoothstep(0, 0.3, u);
    out.spinePitch += 0.36 * e;
    out.spineRoll += 0.05 * Math.sin(this.t * 0.9) * e;
    out.headPitch -= 0.6 * e;
    out.headYaw += 0.28 * Math.sin(this.t * 1.7) * e;
    out.lift -= 0.03 * e;
    out.squash += 0.07 * e;
    out.blink += 0.55 * e;
    out.brow -= e;
    out.steam += env(u, 0.14, 0.17, 0.25, 0.3);
    for (const side of [-1, 1] as const) this.reach(out, side, 0.1, -0.36, 0.06, 0.9 * e, new Vector3(side, -0.1, 0.5), 0.3);
  }

  /** Continuous poses from statuses (stun wobble, hit wobble) and the air flare of a long jump. */
  private statusPoses(st: RiderState, out: CueOut, dt: number): void {
    this.air = damp(this.air, st.airborne ? smoothstep(0.25, 0.45, st.airTime) : 0, 10, dt);
    if (this.air > 1e-3) {
      out.wings += (this.def.meta.wings ? 0.3 : 0) * this.air;
      out.headPitch += 0.12 * this.air;
      out.wide += 0.5 * this.air;
      out.jaw += 0.25 * this.air;
    }
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

/** Does the skill's effect still run (the sustained pose holds while it does)? */
function sustained(pose: SkillPose, st: RiderState | null): boolean {
  if (!st || st.mode !== 'racing') return false;
  if (pose === 'doge') return st.statuses.some((s) => s.id === 'shield' && s.time > 0);
  if (pose === 'flash') return st.statuses.some((s) => s.id === 'boost' && s.time > 0);
  if (pose === 'ghost') return st.mods.invisible;
  return true;
}

const POSES: Record<string, SkillPose> = {
  'pelican.torpedo': 'spit', 'pelican.gulp': 'gulp', 'pelican.wing': 'wingspread', 'goose.honk': 'honk',
  'capybara.chill': 'chill', 'cat.spin': 'spin', 'shiba.doge': 'doge', 'pigeon.ghost': 'ghost', 'penguin.slide': 'slide',
  'seagull.steal': 'grab', 'sloth.flash': 'flash', 'corgi.whistle': 'whistle',
};

export function skillPoseOf(skillId: string | null | undefined): SkillPose | null {
  return skillId ? POSES[skillId] ?? null : null;
}
