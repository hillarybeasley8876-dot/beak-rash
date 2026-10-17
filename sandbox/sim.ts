// Feel bench: the full game plus live handling graphs and tuning sliders for the sim unit.
//   /sandbox/sim.html?race=coast&seed=1&traffic=0            (all real units)
//   &stub=world,actors,combat,fx                              isolate sim on core stubs
//   &realtrack=1                                              use the track unit's builder (src/world/track)
// Drive with the keyboard (WASD/arrows, Shift drift, Space hop, C look back). Panel: right; graph: bottom-left.
import { captureErrors, installDebug } from '../src/core/debug';
import { Game } from '../src/core/game';
import { FeelGraph } from './sim-graph';
import { mountFeelPanel } from './sim-panel';
import type { TrackId } from '../src/core/types';

const canvas = document.getElementById('game') as HTMLCanvasElement | null;
const uiRoot = document.getElementById('ui') as HTMLElement | null;
const panel = document.getElementById('feel') as HTMLElement | null;
const graphCanvas = document.getElementById('graph') as HTMLCanvasElement | null;
if (!canvas || !uiRoot || !panel || !graphCanvas) throw new Error('[sim sandbox] sim.html is missing elements');

const errors = captureErrors();
const params = new URLSearchParams(location.search);

async function boot(): Promise<void> {
  if (!canvas || !uiRoot || !panel || !graphCanvas) return;
  const game = await Game.create(canvas, uiRoot, params);
  if (params.get('realtrack') === '1') {
    try {
      const mod = await import('../src/world/track');
      game.app.modules.createTrack = mod.createTrack;
    } catch (err) {
      console.error('[sim sandbox] real track builder failed to load; using the configured one', err);
    }
  }
  const debug = installDebug(game, errors);
  game.start();
  await Promise.all(game.app.modules.preload.map((fn) => fn(game.app).catch((err: unknown) => console.error('[sim sandbox] preload failed', err))));
  await game.startRace({ trackId: (params.get('race') ?? 'coast') as TrackId });
  debug.ready = true;
  const graph = new FeelGraph(graphCanvas);
  mountFeelPanel(panel, game, debug, (row) => {
    const s = game.session;
    const steer = s?.controls.get(s.player.id)?.steer ?? 0;
    const t = game.app.clock.realTime;
    graph.push(t, row, steer);
    graph.draw(t);
  });
}

boot().catch((err: unknown) => console.error('[sim sandbox] boot failed', err));
