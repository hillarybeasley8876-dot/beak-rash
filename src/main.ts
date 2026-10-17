import { captureErrors, installDebug } from './core/debug';
import { Game } from './core/game';
import type { ScreenId } from './core/contracts';

const canvas = document.getElementById('game') as HTMLCanvasElement | null;
const uiRoot = document.getElementById('ui') as HTMLElement | null;
if (!canvas || !uiRoot) throw new Error('index.html is missing #game or #ui');

const errors = captureErrors();
const params = new URLSearchParams(location.search);

async function boot(game: Game): Promise<void> {
  const debug = installDebug(game, errors);
  game.start();
  await Promise.all(game.app.modules.preload.map((fn) => fn(game.app).catch((err: unknown) => console.error('[main] preload failed', err))));
  const race = params.get('race');
  const screen = params.get('screen') as ScreenId | null;
  if (params.get('manual') === '1') game.manual = true;
  if (race) await game.startRace({ trackId: race as never });
  else if (screen) await game.app.ui.show(screen);
  else {
    await game.app.ui.show('boot');
    await game.app.ui.show('title');
  }
  debug.ready = true;
}

Game.create(canvas, uiRoot, params)
  .then(boot)
  .catch((err: unknown) => console.error('[main] boot failed', err));
