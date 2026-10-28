// One race: owns the track, riders, views and the gameplay systems, and steps them in a fixed order.
//   per substep: controls → logic.preStep → combat.preStep → physics.step → combat.postStep → logic.postStep
//   per frame:   views (pose from physics) → track scenery
// Offline the frame's sim time is split into substeps and the player's controls come from the local input; an online
// race (SPEC §28) advances only by relay ticks (tick(): TICK_SUBSTEPS fixed substeps, every human's controls from
// the tick message), so every client computes the same race.
import { Group, Quaternion, Vector3 } from 'three';
import { BIKES } from '../data/bikes';
import { defaultLoadout, rivalLoadout } from '../data/loadouts';
import { ROSTER } from '../data/roster';
import { Clock } from './clock';
import { createRiderState } from './rider';
import { Rng } from './rng';
import { emptyControls } from './types';
import { nextFrame } from './warmup';
import { TICK_DT, TICK_SUBSTEPS } from '../net/protocol';
import type { AppContext, CombatSystem, PhysicsSystem, RaceConfig, RaceLogic, RiderView, Session, Track } from './contracts';
import type { Controls, Obstacle, RiderId, RiderState } from './types';

/** Main-thread budget (ms) of one loading-screen frame while the race is built: a rider view takes 5–50 ms
 *  (cold templates), so the eight of them no longer block the loading screen for 0.2–0.3 s in one task. */
const BUILD_SLICE_MS = 12;

// Scratch words for hash().
const HF = new Float64Array(1);
const HU = new Uint32Array(HF.buffer);

export class RaceSession implements Session {
  readonly riders: RiderState[] = [];
  readonly controls = new Map<RiderId, Controls>();
  readonly obstacles: Obstacle[] = [];
  readonly views = new Map<RiderId, RiderView>();
  readonly world = new Group();
  readonly rng: Rng;
  phase: Session['phase'] = 'intro';
  time = 0;
  physics!: PhysicsSystem;
  combat!: CombatSystem;
  logic!: RaceLogic;
  player!: RiderState;
  /** The riders a human rides, in id order (SPEC §28); a human who leaves an online race drops out. */
  readonly humans: RiderState[] = [];
  private pos = new Vector3();
  private quat = new Quaternion();
  private stopped = false;
  private disposed = false;

  private constructor(readonly app: AppContext, readonly config: RaceConfig, readonly track: Track) {
    this.rng = new Rng(config.seed);
    this.world.name = 'session';
  }

  static async create(app: AppContext, config: RaceConfig): Promise<RaceSession> {
    const rng = new Rng(config.seed ^ 0x5eed);
    const track = await app.modules.createTrack(app, config.trackId, rng, { weather: config.weather, reverse: config.reverse, route: config.route });
    const session = new RaceSession(app, config, track);
    session.world.add(track.group);
    // Built in slices, yielding a frame whenever one has used its budget (the loading screen keeps moving).
    let slice = performance.now();
    const breathe = async (): Promise<void> => {
      if (performance.now() - slice < BUILD_SLICE_MS) return;
      await nextFrame();
      slice = performance.now();
    };
    await session.spawnRiders(breathe);
    session.physics = app.modules.createPhysics(session);
    session.combat = app.modules.createCombat(session);
    await breathe();
    session.logic = app.modules.createRaceLogic(session);
    app.scene.add(session.world);
    return session;
  }

  rider(id: RiderId): RiderState | undefined {
    return this.riders[id];
  }

  private async spawnRiders(breathe: () => Promise<void>): Promise<void> {
    const { app, config } = this;
    const online = config.online;
    const rivals = config.rivals.map((character, i) => ({
      character, bike: config.rivalBikes[i] ?? ROSTER[character].defaultBike, isPlayer: false, human: false, name: null,
      loadout: config.rivalLoadouts?.[i] ?? rivalLoadout(character, character === config.nemesis),
    }));
    const lineup = online
      ? [...online.humans.map((h) => ({ character: h.character, bike: h.bike, isPlayer: h.slot === online.local, human: true,
        name: h.name, loadout: h.loadout })), ...rivals]
      : [{ character: config.playerCharacter, bike: config.playerBike, isPlayer: true, human: true, name: null,
        loadout: config.loadout ?? defaultLoadout(config.playerCharacter) }, ...rivals];
    // Default grid: rows of three, 7 m apart; the player starts mid-pack (online: the humans take the middle slots,
    // in slot order). Race logic may re-grid.
    const order = this.rng.shuffle(lineup.map((_, i) => i));
    if (online) {
      const humans = online.humans.map((h) => h.slot);
      const rest = order.filter((i) => !humans.includes(i));
      const first = Math.max(0, Math.min(3, lineup.length - humans.length));
      order.splice(0, order.length, ...rest.slice(0, first), ...humans, ...rest.slice(first));
    } else {
      const playerSlot = Math.min(4, lineup.length - 1);
      order.splice(order.indexOf(0), 1);
      order.splice(playerSlot, 0, 0);
    }
    for (const [id, entry] of lineup.entries()) {
      const r = createRiderState(id, entry.character, entry.bike, entry.isPlayer);
      r.human = entry.human;
      if (entry.name) r.name = entry.name;
      r.loadout = { slots: [entry.loadout.slots[0], entry.loadout.slots[1], entry.loadout.slots[2]], ult: entry.loadout.ult };
      const slot = order.indexOf(id);
      r.s = 40 - Math.floor(slot / 3) * 7;
      r.x = ((slot % 3) - 1) * 3.2;
      this.riders.push(r);
      this.controls.set(id, emptyControls());
      const view = app.modules.createRiderView(app, entry.character, entry.bike, {
        isPlayer: entry.isPlayer, quality: app.quality, track: this.track,
      });
      this.views.set(id, view);
      this.world.add(view.root);
      // The bar creeps through the track's READY stage (0.9) toward the warm-up (0.92) as the riders line up.
      app.bus.emit('flow:loading', { progress: 0.9 + (0.02 * (id + 1)) / lineup.length, label: '' });
      await breathe();
    }
    const player = this.riders.find((r) => r.isPlayer);
    if (!player) throw new Error('session: no player rider');
    this.player = player;
    this.humans.push(...this.riders.filter((r) => r.human));
    if (!BIKES[player.bike]) throw new Error(`session: unknown bike ${player.bike}`);
  }

  /** Advance one rendered frame (offline races): the frame's sim time in substeps, the player on the local input. */
  step(dtSim: number, dtReal: number): void {
    if (this.stopped) return;
    const { count, dt } = Clock.substeps(dtSim);
    const input = this.app.input;
    const playerControls = this.controls.get(this.player.id) ?? emptyControls();
    for (let i = 0; i < count; i++) {
      input.peek(playerControls);
      if (this.phase !== 'racing') clearEdges(playerControls);
      this.substep(dt);
      input.consumeEdges();
      for (const c of this.controls.values()) clearEdges(c);
    }
    this.present(dtSim, dtReal);
  }

  /** One relay tick of an online race (SPEC §28): every human's controls from the tick, TICK_SUBSTEPS fixed substeps.
   *  The local input is not read here (the net unit sends it to the relay; it comes back in a tick). */
  tick(inputs: ReadonlyArray<Controls>, left: readonly RiderId[] = []): void {
    if (this.stopped) return;
    for (const id of left) {
      const r = this.riders[id];
      if (!r || !r.human) continue;
      r.human = false;
      this.humans.splice(this.humans.indexOf(r), 1);
      this.logic.takeover?.(id);
    }
    for (const r of this.humans) {
      const c = this.controls.get(r.id);
      const src = inputs[r.id];
      if (c && src) Object.assign(c, src);
    }
    const dt = TICK_DT / TICK_SUBSTEPS;
    for (let i = 0; i < TICK_SUBSTEPS; i++) {
      if (this.phase !== 'racing') for (const r of this.humans) clearEdges(this.controls.get(r.id) ?? emptyControls());
      this.substep(dt);
      for (const c of this.controls.values()) clearEdges(c);
    }
  }

  /** The rider views (pose from physics) and the scenery, once per rendered frame. */
  present(dtSim: number, dtReal: number): void {
    if (this.stopped) return;
    for (const r of this.riders) {
      const view = this.views.get(r.id);
      if (!view) continue;
      this.physics.pose(r, this.pos, this.quat);
      view.update(r, this.pos, this.quat, dtSim, dtReal);
    }
    this.combat.frame?.(dtReal);
    this.track.update(dtSim, dtReal, this.app.camera);
  }

  private substep(dt: number): void {
    this.logic.preStep(dt);
    this.combat.preStep(dt);
    this.physics.step(dt);
    this.combat.postStep(dt);
    this.logic.postStep(dt);
    if (this.phase === 'racing') this.time += dt;
  }

  /** FNV-1a over the sim state: time, phase, the session rng, every rider and obstacle (SPEC §28 desync check). */
  hash(): string {
    let h = 0x811c9dc5;
    const word = (v: number): void => { h = Math.imul(h ^ v, 0x01000193); };
    const num = (v: number): void => { HF[0] = v; word(HU[0] ?? 0); word(HU[1] ?? 0); };
    const str = (v: string): void => { for (let i = 0; i < v.length; i++) word(v.charCodeAt(i)); };
    num(this.time);
    str(this.phase);
    word(this.rng.stateValue | 0);
    for (const r of this.riders) {
      num(r.s); num(r.x); num(r.y); num(r.speed); num(r.vx); num(r.vy); num(r.hp); num(r.sp);
      str(r.mode); word(r.place); word(r.statuses.length); word(r.human ? 1 : 0);
      for (const c of r.cooldowns) num(c);
    }
    for (const o of this.obstacles) {
      word(o.id); num(o.s); num(o.x); num(o.speed); word(o.active ? 1 : 0);
    }
    return (h >>> 0).toString(16).padStart(8, '0');
  }

  /** Stop the gameplay systems (AI, combat, physics). The world (track + rider views) stays until dispose(),
   *  so the next race can share its shader programs (core/game.ts hands races over this way). */
  stopSystems(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.logic.dispose();
    this.combat.dispose();
    this.physics.dispose();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stopSystems();
    for (const v of this.views.values()) v.dispose();
    this.track.dispose();
    this.app.scene.remove(this.world);
  }
}

function clearEdges(c: Controls): void {
  c.hop = c.attackL = c.attackR = c.heavy = c.skill1 = c.skill2 = c.skill3 = c.ult = c.bell = false;
}
