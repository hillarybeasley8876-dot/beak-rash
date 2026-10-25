// Loads every unit through dynamic import. A unit that fails to load (or is listed in ?stub=a,b)
// falls back to its core-owned stub, with a console.error so tests notice.
import type {
  AppContext, AudioSystem, CameraRig, CombatSystem, FxSystem, PhysicsSystem, RaceLogic, RiderView, RiderViewOpts, Session, Track, TrackOptions, Ui,
} from './contracts';
import type { Rng } from './rng';
import type { BikeId, CharacterId, TrackId } from './types';
import type { AchievementSystemLike } from '../gameplay/achievements-stub';

export interface Modules {
  createTrack(app: AppContext, id: TrackId, rng: Rng, opts?: TrackOptions): Promise<Track>;
  createPhysics(session: Session): PhysicsSystem;
  createCameraRig(app: AppContext): CameraRig;
  createRiderView(app: AppContext, character: CharacterId, bike: BikeId, opts: RiderViewOpts): RiderView;
  createCombat(session: Session): CombatSystem;
  createRaceLogic(session: Session): RaceLogic;
  createFx(app: AppContext): FxSystem;
  createUi(app: AppContext): Ui;
  createAudio(app: AppContext): AudioSystem;
  createAchievements(app: AppContext): AchievementSystemLike;
  /** Optional warm-up hooks (model/texture/audio preloading). */
  preload: Array<(app: AppContext) => Promise<void>>;
  stubbed: string[];
}

import { guard, guardAsync } from './guard';
import * as worldStub from '../world/stub';
import * as simStub from '../sim/stub';
import * as cameraStub from '../camera/stub';
import * as actorsStub from '../actors/stub';
import * as combatStub from '../gameplay/combat/stub';
import * as raceStub from '../gameplay/race/stub';
import * as fxStub from '../fx/stub';
import * as uiStub from '../ui/stub';
import * as audioStub from '../audio/stub';
import * as achievementsStub from '../gameplay/achievements-stub';

type Loader<T> = () => Promise<T>;

async function pick<T>(name: string, stubs: Set<string>, real: Loader<T>, stub: T, used: string[]): Promise<T> {
  if (stubs.has(name) || stubs.has('all')) {
    used.push(name);
    return stub;
  }
  try {
    return await real();
  } catch (err) {
    console.error(`[modules] unit "${name}" failed to load, using its stub`, err);
    used.push(name);
    return stub;
  }
}

export async function loadModules(params: URLSearchParams): Promise<Modules> {
  const stubs = new Set((params.get('stub') ?? '').split(',').filter(Boolean));
  const used: string[] = [];
  const [world, sim, camera, actors, combat, race, fx, ui, audio, achievements] = await Promise.all([
    pick('world', stubs, () => import('../world'), worldStub, used),
    pick('sim', stubs, () => import('../sim'), simStub, used),
    pick('camera', stubs, () => import('../camera'), cameraStub, used),
    pick('actors', stubs, () => import('../actors'), actorsStub, used),
    pick('combat', stubs, () => import('../gameplay/combat'), combatStub, used),
    pick('race', stubs, () => import('../gameplay/race'), raceStub, used),
    pick('fx', stubs, () => import('../fx'), fxStub, used),
    pick('ui', stubs, () => import('../ui'), uiStub, used),
    pick('audio', stubs, () => import('../audio'), audioStub, used),
    pick('achievements', stubs, () => import('../gameplay/achievements'), achievementsStub, used),
  ]);
  const preload: Modules['preload'] = [];
  for (const m of [world, actors, fx, ui, audio] as Array<{ preload?: (app: AppContext) => Promise<void> }>) {
    if (typeof m.preload === 'function') preload.push(m.preload);
  }
  return {
    createTrack: guardAsync('world', world.createTrack, worldStub.createTrack, used),
    createPhysics: guard('sim', sim.createPhysics, simStub.createPhysics, used),
    createCameraRig: guard('camera', camera.createCameraRig, cameraStub.createCameraRig, used),
    createRiderView: guard('actors', actors.createRiderView, actorsStub.createRiderView, used),
    createCombat: guard('combat', combat.createCombat, combatStub.createCombat, used),
    createRaceLogic: guard('race', race.createRaceLogic, raceStub.createRaceLogic, used),
    createFx: guard('fx', fx.createFx, fxStub.createFx, used),
    createUi: guard('ui', ui.createUi, uiStub.createUi, used),
    createAudio: guard('audio', audio.createAudio, audioStub.createAudio, used),
    createAchievements: guard('achievements', achievements.createAchievements, achievementsStub.createAchievements, used),
    preload,
    stubbed: used,
  };
}
