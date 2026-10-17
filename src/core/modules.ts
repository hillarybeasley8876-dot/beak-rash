// Loads every unit through dynamic import. A unit that fails to load (or is listed in ?stub=a,b)
// falls back to its core-owned stub, with a console.error so tests notice.
import type { AppContext, AudioSystem, CameraRig, CombatSystem, FxSystem, PhysicsSystem, RaceLogic, RiderView, Session, Track, Ui } from './contracts';
import type { Rng } from './rng';
import type { BikeId, CharacterId, Quality, TrackId } from './types';

export interface Modules {
  createTrack(app: AppContext, id: TrackId, rng: Rng): Promise<Track>;
  createPhysics(session: Session): PhysicsSystem;
  createCameraRig(app: AppContext): CameraRig;
  createRiderView(app: AppContext, character: CharacterId, bike: BikeId, opts: { isPlayer: boolean; quality: Quality }): RiderView;
  createCombat(session: Session): CombatSystem;
  createRaceLogic(session: Session): RaceLogic;
  createFx(app: AppContext): FxSystem;
  createUi(app: AppContext): Ui;
  createAudio(app: AppContext): AudioSystem;
  /** Optional warm-up hooks (model/texture/audio preloading). */
  preload: Array<(app: AppContext) => Promise<void>>;
  stubbed: string[];
}

type Loader<T> = () => Promise<T>;

async function pick<T>(name: string, stubs: Set<string>, real: Loader<T>, stub: Loader<T>, used: string[]): Promise<T> {
  if (stubs.has(name) || stubs.has('all')) {
    used.push(name);
    return stub();
  }
  try {
    return await real();
  } catch (err) {
    console.error(`[modules] unit "${name}" failed to load, using its stub`, err);
    used.push(name);
    return stub();
  }
}

export async function loadModules(params: URLSearchParams): Promise<Modules> {
  const stubs = new Set((params.get('stub') ?? '').split(',').filter(Boolean));
  const used: string[] = [];
  const [world, sim, camera, actors, combat, race, fx, ui, audio] = await Promise.all([
    pick('world', stubs, () => import('../world'), () => import('../world/stub'), used),
    pick('sim', stubs, () => import('../sim'), () => import('../sim/stub'), used),
    pick('camera', stubs, () => import('../camera'), () => import('../camera/stub'), used),
    pick('actors', stubs, () => import('../actors'), () => import('../actors/stub'), used),
    pick('combat', stubs, () => import('../gameplay/combat'), () => import('../gameplay/combat/stub'), used),
    pick('race', stubs, () => import('../gameplay/race'), () => import('../gameplay/race/stub'), used),
    pick('fx', stubs, () => import('../fx'), () => import('../fx/stub'), used),
    pick('ui', stubs, () => import('../ui'), () => import('../ui/stub'), used),
    pick('audio', stubs, () => import('../audio'), () => import('../audio/stub'), used),
  ]);
  const preload: Modules['preload'] = [];
  for (const m of [world, actors, fx, ui, audio] as Array<{ preload?: (app: AppContext) => Promise<void> }>) {
    if (typeof m.preload === 'function') preload.push(m.preload);
  }
  return {
    createTrack: world.createTrack,
    createPhysics: sim.createPhysics,
    createCameraRig: camera.createCameraRig,
    createRiderView: actors.createRiderView,
    createCombat: combat.createCombat,
    createRaceLogic: race.createRaceLogic,
    createFx: fx.createFx,
    createUi: ui.createUi,
    createAudio: audio.createAudio,
    preload,
    stubbed: used,
  };
}
