import { captureErrors, installDebug } from './core/debug';
import { Game } from './core/game';
import { raceParam } from './core/race-config';
import { SCREEN_IDS, type ScreenId } from './core/contracts';

const canvas = document.getElementById('game') as HTMLCanvasElement | null;
const uiRoot = document.getElementById('ui') as HTMLElement | null;
if (!canvas || !uiRoot) throw new Error('index.html is missing #game or #ui');

const errors = captureErrors();
const params = new URLSearchParams(location.search);

async function boot(game: Game): Promise<void> {
  const debug = installDebug(game, errors);
  game.start();
  await Promise.all(game.app.modules.preload.map((fn) => fn(game.app).catch((err: unknown) => console.error('[main] preload failed', err))));
  const race = raceParam(params);
  const screen = screenParam(params);
  if (params.get('manual') === '1') game.manual = true;
  if (race) await game.startRace({ trackId: race });
  else if (screen) await game.app.ui.show(screen);
  else {
    await game.app.ui.show('boot');
    await game.app.ui.show('title');
  }
  debug.ready = true;
}

function screenParam(p: URLSearchParams): ScreenId | null {
  const raw = p.get('screen');
  const id = SCREEN_IDS.find((s) => s === raw) ?? null;
  if (raw !== null && !id) console.warn(`[main] unknown ?screen=${raw}, booting normally`);
  return id;
}

Game.create(canvas, uiRoot, params)
  .then(boot)
  .catch((err: unknown) => console.error('[main] boot failed', err));
