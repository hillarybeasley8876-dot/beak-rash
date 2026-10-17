// The in-race HUD: static corner modules, world-anchored overlays and every in-race cut-in.
// ui-screens creates one full-screen layer and calls createHud(app, layer) once (hud/contract.ts).
import './css/base.css';
import { approach } from '../../core/math';
import type { AppContext, Session } from '../../core/contracts';
import type { Hud } from './contract';
import { Cluster } from './cluster';
import { CutinLayer } from './cutins/layer';
import { el, w } from './dom';
import { wireHudEvents } from './events';
import { preloadHudFonts } from './fonts';
import { Counters, PlaceBlock } from './place';
import { ProgressStrip } from './progress';
import { Speedo } from './speedo';
import { WorldOverlay } from './world/overlay';
import { Projector } from './world/project';

/** Reference layout is 1920×1080; everything scales by k = min(w/1920, h/1080). */
export const REF_W = 1920;
export const REF_H = 1080;

export function createHud(app: AppContext, layer: HTMLElement): Hud {
  void preloadHudFonts();
  const root = el('div', 'brh is-off', layer);
  const rootW = w(root);
  const proj = new Projector(app.camera);
  const worldHost = el('div', 'brh-layer', root);
  const hudLayer = el('div', 'brh-hud', root);
  const edgesHost = el('div', 'brh-layer brh-edges-host', root);
  const corner = (cls: string): HTMLDivElement => el('div', `brh-corner ${cls}`, hudLayer);
  const place = new PlaceBlock(corner('tl'));
  const progress = new ProgressStrip(corner('top'));
  const counters = new Counters(corner('tr'));
  const speedo = new Speedo(corner('bl'));
  const brCorner = corner('br');
  const world = new WorldOverlay(app, proj, worldHost, edgesHost);
  const cutins = new CutinLayer(root, hudLayer);
  let cluster: Cluster | null = null;
  let session: Session | null = null;
  let visible = false;
  let k = -1;
  let penalty = 0;
  /** Static HUD + world overlays fade out (160 ms, real time) for the intro flyover and cinematics. */
  let alpha = 0;
  const fadeW = [w(hudLayer), w(worldHost), w(edgesHost)];

  const unwire = wireHudEvents(app.bus, {
    session: () => session,
    place, speedo, world, cutins,
    cluster: () => cluster,
    addPenalty: (sec) => (penalty += sec),
  });

  const resize = (): void => {
    const nk = Math.min(app.size.width / REF_W, app.size.height / REF_H);
    if (Math.abs(nk - k) < 1e-4) return;
    k = nk;
    rootW.style('--k', k.toFixed(4));
  };

  return {
    attach(s) {
      session = s;
      penalty = 0;
      cluster?.root.remove();
      cluster = s ? new Cluster(brCorner, s.player.character) : null;
      progress.setRiders(s?.riders ?? []);
      alpha = 0;
      world.attach(s);
      cutins.attach(s);
    },
    setVisible(v) {
      visible = v;
    },
    update(dtReal) {
      const on = visible && session !== null;
      rootW.cls('is-off', !on);
      if (!on || !session) return;
      resize();
      const p = session.player;
      const quiet = session.phase === 'intro' || cutins.cinematic;
      alpha = approach(alpha, quiet ? 0 : 1, dtReal / 0.16);
      for (const f of fadeW) f.op(alpha);
      proj.begin(app.size.width, app.size.height);
      place.update(p.place, session.riders.length, p.finishTime ?? session.time, penalty, dtReal);
      progress.update(session.track.length);
      counters.update(p.kos, p.coins, dtReal);
      speedo.update(p, dtReal);
      cluster?.update(p, dtReal);
      world.update(dtReal, k);
      cutins.update(dtReal, k, proj);
    },
    dispose() {
      unwire();
      root.remove();
      session = null;
      cluster = null;
    },
  };
}
