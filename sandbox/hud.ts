// HUD sandbox: boots the real game shell (stub units by default, ?live=1 for the real ones), hides
// the game's own UI layer, and mounts this unit's HUD on its own layer. `window.__hud` (hud.driver.ts)
// poses the player and fires every cut-in so each state can be screenshot without playing.
import { captureErrors, installDebug } from '../src/core/debug';
import { Game } from '../src/core/game';
import type { TrackId } from '../src/core/types';
import { createHud } from '../src/ui/hud/hud';
import type { Session } from '../src/core/contracts';
import { installDriver } from './hud.driver';

const errors = captureErrors();
const params = new URLSearchParams(location.search);
if (params.get('live') !== '1' && !params.has('stub')) params.set('stub', 'all');

const canvas = document.getElementById('game') as HTMLCanvasElement | null;
const uiRoot = document.getElementById('ui') as HTMLElement | null;
const hudRoot = document.getElementById('hud') as HTMLElement | null;
if (!canvas || !uiRoot || !hudRoot) throw new Error('[hud-sandbox] page is missing #game, #ui or #hud');

async function boot(): Promise<void> {
  const game = await Game.create(canvas as HTMLCanvasElement, uiRoot as HTMLElement, params);
  const debug = installDebug(game, errors);
  const hud = createHud(game.app, hudRoot as HTMLElement);
  let attached: Session | null = null;
  const ui = game.app.ui;
  const baseUpdate = ui.update.bind(ui);
  ui.update = (dt: number): void => {
    baseUpdate(dt);
    if (game.session !== attached) {
      attached = game.session;
      hud.attach(attached);
    }
    hud.setVisible(attached !== null && (ui.screen === 'race' || ui.screen === 'intro'));
    hud.update(dt);
  };
  game.start();
  await Promise.all(game.app.modules.preload.map((fn) => fn(game.app).catch((err: unknown) => console.error('[hud-sandbox] preload failed', err))));
  if (params.get('manual') === '1') game.manual = true;
  await game.startRace({ trackId: (params.get('race') ?? 'coast') as TrackId });
  installDriver(game, {
    reattach: () => hud.attach(game.session),
    dispose: () => {
      hud.dispose();
      return (hudRoot as HTMLElement).childElementCount;
    },
  });
  debug.ready = true;
}

boot().catch((err: unknown) => console.error('[hud-sandbox] boot failed', err));
