// The in-race HUD: static corner modules, world-anchored overlays and every in-race cut-in.
// ui-screens creates one full-screen layer and calls createHud(app, layer) once (hud/contract.ts).
import './css/base.css';
import { approach } from '../../core/math';
import type { AppContext, Session } from '../../core/contracts';
import { reducedMotion } from './anim';
import type { Hud } from './contract';
import { Cluster } from './cluster';
import { preloadPortraits } from './badge';
import { CutinLayer } from './cutins/layer';
import { el, w } from './dom';
import { TICKET_HOLD, wireHudEvents } from './events';
import { preloadHudFonts } from './fonts';
import { Hints } from './hints';
import { Counters, PlaceBlock } from './place';
import { hudSfx } from './sfx';
import { ProgressStrip } from './progress';
import { Quip } from './quip';
import { Speedo } from './speedo';
import { WorldOverlay } from './world/overlay';
import type { BubbleObstacles } from './world/bubbles';
import { Projector } from './world/project';

/** Reference layout is 1920×1080; everything scales by k = min(w/1920, h/1080). */
export const REF_W = 1920;
export const REF_H = 1080;

export function createHud(app: AppContext, layer: HTMLElement): Hud {
  void preloadHudFonts();
  const sfx = hudSfx(app.audio);
  const root = el('div', 'brh is-off', layer);
  const rootW = w(root);
  const proj = new Projector(app.camera);
  const worldHost = el('div', 'brh-layer', root);
  const hudLayer = el('div', 'brh-hud', root);
  const edgesHost = el('div', 'brh-layer brh-edges-host', root);
  const corner = (cls: string): HTMLDivElement => el('div', `brh-corner ${cls}`, hudLayer);
  const place = new PlaceBlock(corner('tl'), (n) => sfx('ui.count', { volume: 0.9, pitch: n === 1 ? 1.25 : 1 }));
  const progress = new ProgressStrip(corner('top'));
  const counters = new Counters(corner('tr'));
  const speedo = new Speedo(corner('bl'));
  const brCorner = corner('br');
  const hints = new Hints(corner('bc'), () => cluster?.skills.ultState === 'ready');
  const quip = new Quip(brCorner);
  const world = new WorldOverlay(proj, worldHost, edgesHost);
  const cutins = new CutinLayer(root, hudLayer, sfx);
  let cluster: Cluster | null = null;
  let session: Session | null = null;
  let visible = false;
  let k = -1;
  /** Sim time of the player's last BUSTED (ticket-stop countdown), null = none this race. */
  let bustAt: number | null = null;
  /** Static HUD + world overlays fade out (160 ms, real time) for the intro flyover and cinematics. */
  let alpha = 0;
  const fadeW = [w(hudLayer), w(worldHost), w(edgesHost)];
  /** This frame's quip and chip-column rects (taunt bubbles keep clear of them). */
  const dyn: BubbleObstacles = { quip: null, chips: null, callouts: null };
  const quipRect = { l: 0, r: 0, t: 0, b: 0 };
  const chipsRect = { l: 0, r: 0, t: 0, b: 0 };
  const calloutsRect = { l: 0, r: 0, t: 0, b: 0 };

  const unwire = wireHudEvents(app.bus, {
    session: () => session,
    place, speedo, world, cutins, quip, hints,
    cluster: () => cluster,
    busted: () => (bustAt = session?.time ?? null),
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
      bustAt = null;
      if (s) preloadPortraits(s.player.character, s.riders.filter((r) => !r.isPlayer).map((r) => r.character));
      cluster?.root.remove();
      cluster = s ? new Cluster(brCorner, s.player.character) : null;
      quip.reset(s?.player.character ?? null);
      hints.attach(s, app.save.data.stats.races);
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
      rootW.cls('is-pad', app.input.lastDevice === 'gamepad'); // key badges follow the device in use
      rootW.cls('is-reduced', reducedMotion()); // CSS loops calm down with 设置 › 动态效果 (switchable mid-race)
      world.measure(); // layout reads first, before this frame's writes
      resize();
      const p = session.player;
      const quiet = session.phase === 'intro' || cutins.cinematic || cutins.holdHud;
      alpha = approach(alpha, quiet ? 0 : 1, dtReal / 0.16);
      for (const f of fadeW) f.op(alpha);
      proj.begin(app.size.width, app.size.height);
      const held = bustAt !== null ? session.time - bustAt : p.modeTime;
      const ticket = p.mode === 'busted' ? Math.max(0, TICKET_HOLD - held) : 0;
      place.update(p.place, session.riders.length, p.finishTime ?? session.time, ticket, dtReal);
      progress.update(session.track.length, dtReal);
      counters.update(p.kos, p.coins, dtReal);
      speedo.update(p, dtReal);
      cluster?.update(p, dtReal);
      quip.update(dtReal, alpha);
      dyn.quip = quip.rect(app.size.width, app.size.height, k, quipRect);
      dyn.chips = cutins.chipsRect(app.size.width, k, chipsRect);
      dyn.callouts = cutins.calloutsRect(app.size.width, app.size.height, k, calloutsRect);
      world.update(dtReal, k, dyn);
      cluster?.occlude(world.gaugesCovered, dtReal);
      cutins.update(dtReal, k, proj);
      hints.update(session, dtReal, quiet || alpha < 0.99 || cutins.screenBusy || world.bottomBusy);
    },
    dispose() {
      unwire();
      world.dispose();
      root.remove();
      session = null;
      cluster = null;
    },
  };
}
