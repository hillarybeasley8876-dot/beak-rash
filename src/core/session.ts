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
import type { AppContext, CombatSystem, PhysicsSystem, RaceConfig, RaceLogic, RiderView, Session, Track } from './contracts';
import type { Controls, Obstacle, RiderId, RiderState } from './types';

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
  private disposed = false;

  private constructor(readonly app: AppContext, readonly config: RaceConfig, readonly track: Track) {
    this.rng = new Rng(config.seed);
    this.world.name = 'session';
  }

  static async create(app: AppContext, config: RaceConfig): Promise<RaceSession> {
    const rng = new Rng(config.seed ^ 0x5eed);
    const track = await app.modules.createTrack(app, config.trackId, rng);
    const session = new RaceSession(app, config, track);
    session.world.add(track.group);
    session.spawnRiders();
    session.physics = app.modules.createPhysics(session);
    session.combat = app.modules.createCombat(session);
    session.logic = app.modules.createRaceLogic(session);
    app.scene.add(session.world);
    return session;
  }

  rider(id: RiderId): RiderState | undefined {
    return this.riders[id];
  }

  private spawnRiders(): void {
    const { config } = this;
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
    lineup.forEach((entry, id) => {
      const r = createRiderState(id, entry.character, entry.bike, entry.isPlayer);
      const slot = order.indexOf(id);
      r.s = 40 - Math.floor(slot / 3) * 7;
      r.x = ((slot % 3) - 1) * 3.2;
      this.riders.push(r);
      this.controls.set(id, emptyControls());
      const view = this.app.modules.createRiderView(this.app, entry.character, entry.bike, { isPlayer: entry.isPlayer, quality: this.app.quality });
      this.views.set(id, view);
      this.world.add(view.root);
    });
    const player = this.riders.find((r) => r.isPlayer);
    if (!player) throw new Error('session: no player rider');
    this.player = player;
    if (!BIKES[player.bike]) throw new Error(`session: unknown bike ${player.bike}`);
  }

  /** Advance one rendered frame. */
  step(dtSim: number, dtReal: number): void {
    if (this.disposed) return;
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
    this.track.update(dtSim, dtReal, this.app.camera);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.logic.dispose();
    this.combat.dispose();
    this.physics.dispose();
    for (const v of this.views.values()) v.dispose();
    this.track.dispose();
    this.app.scene.remove(this.world);
  }
}

function clearEdges(c: Controls): void {
  c.hop = c.attackL = c.attackR = c.heavy = c.skill1 = c.skill2 = c.skill3 = c.ult = c.bell = false;
}
