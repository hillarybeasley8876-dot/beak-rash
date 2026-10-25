// One race: owns the track, riders, views and the gameplay systems, and steps them in a fixed order.
//   per substep: controls → logic.preStep → combat.preStep → physics.step → combat.postStep → logic.postStep
//   per frame:   views (pose from physics) → track scenery
import { Group, Quaternion, Vector3 } from 'three';
import { BIKES } from '../data/bikes';
import { ROSTER } from '../data/roster';
import { Clock } from './clock';
import { createRiderState } from './rider';
import { Rng } from './rng';
import { emptyControls } from './types';
import { nextFrame } from './warmup';
import type { AppContext, CombatSystem, PhysicsSystem, RaceConfig, RaceLogic, RiderView, Session, Track } from './contracts';
import type { Controls, Obstacle, RiderId, RiderState } from './types';

/** Main-thread budget (ms) of one loading-screen frame while the race is built: a rider view takes 5–50 ms
 *  (cold templates), so the eight of them no longer block the loading screen for 0.2–0.3 s in one task. */
const BUILD_SLICE_MS = 12;

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
    const lineup = [
      { character: config.playerCharacter, bike: config.playerBike, isPlayer: true },
      ...config.rivals.map((character, i) => ({
        character, bike: config.rivalBikes[i] ?? ROSTER[character].defaultBike, isPlayer: false,
      })),
    ];
    // Default grid: rows of three, 7 m apart; the player starts mid-pack. Race logic may re-grid.
    const order = this.rng.shuffle(lineup.map((_, i) => i));
    const playerSlot = Math.min(4, lineup.length - 1);
    order.splice(order.indexOf(0), 1);
    order.splice(playerSlot, 0, 0);
    for (const [id, entry] of lineup.entries()) {
      const r = createRiderState(id, entry.character, entry.bike, entry.isPlayer);
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
    if (!BIKES[player.bike]) throw new Error(`session: unknown bike ${player.bike}`);
  }

  /** Advance one rendered frame. */
  step(dtSim: number, dtReal: number): void {
    if (this.stopped) return;
    const { count, dt } = Clock.substeps(dtSim);
    const input = this.app.input;
    const playerControls = this.controls.get(this.player.id) ?? emptyControls();
    for (let i = 0; i < count; i++) {
      input.peek(playerControls);
      if (this.phase !== 'racing') clearEdges(playerControls);
      this.logic.preStep(dt);
      this.combat.preStep(dt);
      this.physics.step(dt);
      this.combat.postStep(dt);
      this.logic.postStep(dt);
      if (this.phase === 'racing') this.time += dt;
      input.consumeEdges();
      for (const c of this.controls.values()) clearEdges(c);
    }
    for (const r of this.riders) {
      const view = this.views.get(r.id);
      if (!view) continue;
      this.physics.pose(r, this.pos, this.quat);
      view.update(r, this.pos, this.quat, dtSim, dtReal);
    }
    this.combat.frame?.(dtReal);
    this.track.update(dtSim, dtReal, this.app.camera);
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
