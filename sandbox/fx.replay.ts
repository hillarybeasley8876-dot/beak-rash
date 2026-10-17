// fx sandbox: replays the REAL KO cinematic (KoCine + shots + look timelines) on the sandbox stage,
// with a real core Clock and EventBus, a tiny camera rig and stand-in riders that tumble in sim time.
//   kinds: ko · chain (DOUBLE) · short (repeat variant) · wrecked · ult (impact + 2 KOs) · lite (slowmo off)
import { Group, PerspectiveCamera, Quaternion, Vector3 } from 'three';
import { Clock } from '../src/core/clock';
import { EventBus } from '../src/core/events';
import { shotFor } from '../src/fx/ko/camera';
import { KoCine, type CineHost } from '../src/fx/ko/cine';
import { FULL, LITE, shortVariant, ULT_IMPACT, WRECKED, type CineKind, type Timeline } from '../src/fx/ko/look';
import type { CameraOverride } from '../src/core/contracts';
import type { GameEvents } from '../src/core/events-map';
import type { BurstOpts } from '../src/fx/presets/kit';
import type { PostState } from '../src/fx/state';

export type ReplayKind = 'ko' | 'chain' | 'short' | 'wrecked' | 'ult' | 'lite';
export const REPLAY_KINDS: ReplayKind[] = ['ko', 'chain', 'short', 'wrecked', 'ult', 'lite'];

type Burst = (name: string, pos: Vector3, opts?: BurstOpts) => void;

/** A stage rider that can be knocked off and tumble (stand-in for the actors' crash animation). */
class Dummy {
  readonly body = new Vector3();
  ground = 0;
  private readonly base = new Vector3();
  private readonly baseQuat = new Quaternion();
  private readonly vel = new Vector3();
  private readonly spin = new Vector3();
  private down = false;

  constructor(readonly group: Group) {
    this.base.copy(group.position);
    this.baseQuat.copy(group.quaternion);
    this.sync();
  }

  reset(): void {
    this.down = false;
    this.group.position.copy(this.base);
    this.group.quaternion.copy(this.baseQuat);
    this.sync();
  }

  knock(side: number): void {
    this.down = true;
    this.vel.set(2.6 * side, 5.2, -2.2);
    this.spin.set(-6.5, 1.5, -4 * side);
  }

  update(dtSim: number): void {
    if (this.down && dtSim > 0) {
      const g = this.group;
      this.vel.y -= 14 * dtSim;
      g.position.addScaledVector(this.vel, dtSim);
      if (g.position.y < 0) {
        g.position.y = 0;
        this.vel.set(this.vel.x * 0.6, Math.abs(this.vel.y) * 0.3, this.vel.z * 0.6);
        this.spin.multiplyScalar(0.6);
      }
      g.rotateX(this.spin.x * dtSim);
      g.rotateY(this.spin.y * dtSim);
      g.rotateZ(this.spin.z * dtSim);
    }
    this.sync();
  }

  private sync(): void {
    this.group.updateMatrixWorld();
    this.group.localToWorld(this.body.set(0, 1.35, 0));
  }
}

/** Minimal CameraRig.override: runs the cinematic, cuts back to the saved stage pose when it ends. */
class MiniRig {
  private fn: CameraOverride | null = null;
  private readonly pos = new Vector3();
  private readonly quat = new Quaternion();
  private fov = 62;

  constructor(private readonly camera: PerspectiveCamera) {}

  get busy(): boolean {
    return this.fn !== null;
  }

  saveHome(): void {
    this.pos.copy(this.camera.position);
    this.quat.copy(this.camera.quaternion);
    this.fov = this.camera.fov;
  }

  override(fn: CameraOverride | null): void {
    this.fn = fn;
    if (!fn) this.restore();
  }

  update(dtReal: number): void {
    if (this.fn && !this.fn(this.camera, dtReal)) this.override(null);
  }

  private restore(): void {
    this.camera.position.copy(this.pos);
    this.camera.quaternion.copy(this.quat);
    this.camera.fov = this.fov;
    this.camera.updateProjectionMatrix();
  }
}

/** What flies off each stage rider: [preset, colour, colour2] (white bird, white bird, brown mammal). */
const KO_BITS: Array<[string, string, string]> = [
  ['koFeathers', '#ffffff', '#c9ced6'], ['koFeathers', '#ffffff', '#e8e4dc'], ['koFur', '#a8754a', '#7a5233'],
];
const CHASE_POS = new Vector3(-2.3, 2.15, -0.7);
const CHASE_LOOK = new Vector3(-2.4, 1.0, -14);
const IMPACT = new Vector3(0.2, 0, -8);

export class Replay {
  readonly clock = new Clock();
  readonly bus = new EventBus<GameEvents>();
  readonly log: string[] = [];
  private readonly rig: MiniRig;
  private readonly dummies: Dummy[];
  private readonly cine: KoCine;
  private pending: Array<{ at: number; run: () => void }> = [];
  private t = 0;

  constructor(private readonly camera: PerspectiveCamera, riders: Group[], post: PostState, private readonly burst: Burst) {
    this.rig = new MiniRig(camera);
    this.dummies = riders.map((g) => new Dummy(g));
    const host: CineHost = {
      rig: this.rig, clock: this.clock, bus: this.bus, camera, post,
      subject: (id) => this.dummies[id],
    };
    this.cine = new KoCine(host, (kind) => this.note(`window closed (${kind})`));
    this.bus.on('cine:ko', (e) => this.note(`cine:ko ${e.phase} chain=${e.chain}`));
    this.bus.on('hitstop', (e) => this.note(`hitstop ${e.seconds.toFixed(3)} s`));
  }

  get active(): boolean {
    return this.cine.active || this.rig.busy;
  }

  play(kind: ReplayKind): void {
    this.cine.abort();
    if (this.rig.busy) this.rig.override(null);
    this.clock.clearScale('ko');
    this.pending = [];
    this.t = 0;
    this.log.length = 0;
    for (const d of this.dummies) d.reset();
    this.camera.position.copy(CHASE_POS);
    this.camera.lookAt(CHASE_LOOK);
    this.camera.fov = 66;
    this.camera.updateProjectionMatrix();
    this.rig.saveHome();
    const wrecked = kind === 'wrecked';
    const victim = wrecked ? 0 : 1;
    const attacker = wrecked ? 1 : 0;
    const tl: Timeline = wrecked ? WRECKED : kind === 'ult' ? ULT_IMPACT : kind === 'short' ? shortVariant(FULL) : kind === 'lite' ? LITE : FULL;
    const cineKind: CineKind = wrecked ? 'wrecked' : kind === 'ult' ? 'ult' : 'ko';
    const cameraLeft = (this.dummies[attacker]?.body.x ?? 0) > (this.dummies[victim]?.body.x ?? 0);
    const shot = kind === 'lite' ? null : shotFor(cineKind, new Vector3(0, 0, -1), cameraLeft, tl.releaseAt + 0.3);
    if (kind === 'ult') {
      this.burst('shockwave', IMPACT, { ground: 0 });
      const focus = IMPACT.clone().setY(1);
      this.cine.start({ kind: 'ult', tl, victim, attacker, ko: false, lite: false, shot, point: focus, cutNow: true });
      this.knock(1, 0);
      this.knock(2, 0);
      return;
    }
    this.knock(victim, attacker, () => this.cine.start({ kind: cineKind, tl, victim, attacker, ko: true, lite: kind === 'lite', shot }));
    if (kind === 'chain') this.later(0.3, () => this.knock(2, 0));
  }

  /** Advance one frame (game order: views → rig → fx); returns the sim delta for the particles. */
  update(dtReal: number): number {
    const { dtSim } = this.clock.advance(dtReal);
    this.t += dtReal;
    const due = this.pending.filter((p) => p.at <= this.t);
    this.pending = this.pending.filter((p) => p.at > this.t);
    for (const p of due) p.run();
    for (const d of this.dummies) d.update(dtSim);
    this.rig.update(dtReal);
    this.cine.update(dtReal);
    return dtSim;
  }

  info(): Record<string, number | boolean> {
    return { t: +this.t.toFixed(3), scale: +this.clock.scale.toFixed(3), frozen: this.clock.frozen, active: this.active, chain: this.cine.chain };
  }

  /** Knock a stage rider off: bursts like the game's combat:ko reaction, then the cinematic hook. */
  private knock(id: number, attacker: number, start?: () => void): void {
    const d = this.dummies[id];
    const a = this.dummies[attacker];
    if (!d) return;
    const side = a && a.body.x > d.body.x ? -1 : 1;
    const [preset, color, color2] = KO_BITS[id] ?? KO_BITS[0]!;
    this.burst('hitHeavy', d.body, { ground: 0, dir: { x: side, y: 0.35, z: 0 } });
    if (start) start();
    else if (!this.cine.addKo(id, attacker)) this.note('late KO: window closing');
    this.burst(preset, d.body, { ground: 0, color, color2 });
    d.knock(side);
  }

  private later(seconds: number, run: () => void): void {
    this.pending.push({ at: this.t + seconds, run });
  }

  private note(msg: string): void {
    this.log.push(`${this.t.toFixed(2)}  ${msg}`);
    if (this.log.length > 14) this.log.shift();
  }
}
