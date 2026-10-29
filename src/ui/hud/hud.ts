// The in-race HUD: static corner modules, world-anchored overlays and every in-race cut-in.
// ui-screens creates one full-screen layer and calls createHud(app, layer) once (hud/contract.ts).
import './css/base.css';
import { approach } from '../../core/math';
import type { AppContext, Session } from '../../core/contracts';
import type { StatusId } from '../../core/types';
import { reducedMotion } from './anim';
import type { Hud } from './contract';
import { Cluster } from './cluster';
import { preloadPortraits } from './badge';
import { CutinLayer } from './cutins/layer';
import { el, w } from './dom';
import { TICKET_HOLD, wireHudEvents } from './events';
import { Hints } from './hints';
import { Counters, PlaceBlock } from './place';
import { hudSfx } from './sfx';
import { ProgressStrip } from './progress';
import { Quip } from './quip';
import { CasterReadout, RearCallout, type ReadoutLine } from './readout';
import { R4Hud } from './r4';
import { NetHud } from './net';
import { Speedo } from './speedo';
import { StatusBanner, type BannerState } from './statusbanner';
import { WorldOverlay } from './world/overlay';
import type { BubbleObstacles } from './world/bubbles';
import { Projector } from './world/project';
import type { StatusWordPop } from './world/statuswords';

/** Reference layout is 1920×1080; everything scales by k = min(w/1920, h/1080). */
export const REF_W = 1920;
export const REF_H = 1080;

/** r7 (SPEC §29): what the status layer of the HUD shows right now — `window.__br.hud.status()`. */
export interface HudStatus {
  words: StatusWordPop[];
  chips: Record<number, StatusId[]>;
  banner: BannerState | null;
  cue: StatusId | null;
  slotsLocked: boolean;
  readouts: ReadoutLine[];
  rear: ReadoutLine[];
}

interface HudDebug { status(): HudStatus }
type WithHud = { __br?: { hud?: HudDebug } };

export function createHud(app: AppContext, layer: HTMLElement): Hud {
  // The race fonts (the CJK subsets the HUD shouts in) load with the race, not at boot: the title and
  // the menu only pay for the glyphs they draw. screens/loading.ts warms them while the track builds.
  const sfx = hudSfx(app.audio);
  const root = el('div', 'brh is-off', layer);
  const rootW = w(root);
  const proj = new Projector(app.camera);
  const worldHost = el('div', 'brh-layer', root);
  const hudLayer = el('div', 'brh-hud', root);
  const edgesHost = el('div', 'brh-layer brh-edges-host', root);
  const corner = (cls: string): HTMLDivElement => el('div', `brh-corner ${cls}`, hudLayer);
  const place = new PlaceBlock(corner('tl'), (n) => sfx('ui.count', { volume: 0.9, pitch: n === 1 ? 1.25 : 1 }));
  // r7 (SPEC §29): the player's own control status — a banner under the place block and its screen cue.
  const statusBanner = new StatusBanner(corner('tl'), hudLayer);
  const progress = new ProgressStrip(corner('top'));
  const counters = new Counters(corner('tr'));
  const speedo = new Speedo(corner('bl'));
  const brCorner = corner('br');
  // r7: what the player's casts achieved (命中 ×N / 落空 / the skill's own words) and the rear callout.
  const readout = new CasterReadout(brCorner);
  const rear = new RearCallout(hudLayer, proj);
  const hints = new Hints(corner('bc'), () => cluster?.skills.ultState === 'ready', app.bus);
  const quip = new Quip(brCorner);
  const world = new WorldOverlay(proj, worldHost, edgesHost);
  const cutins = new CutinLayer(root, hudLayer, sfx);
  // r6 (SPEC §28): the online race's waiting cover and the relay's ping, over everything else.
  const netHud = new NetHud(app, root);
  let cluster: Cluster | null = null;
  let session: Session | null = null;
  // r4 (§14–§19): the wanted stars, the police warnings, the STYLE meter, the trick / parry pops and
  // the rival and track-event banners. Its corner pieces sit in a tl corner next to the place badge.
  const r4Corner = corner('tl brh-r4-corners');
  // The r4 world-anchored pops sit above the world overlays but below the cut-in stage.
  const r4Host = el('div', 'brh-layer brh-r4-host');
  root.insertBefore(r4Host, hudLayer);
  const r4 = new R4Hud(app.bus, { session: () => session, world, cutins, cluster: () => cluster }, r4Corner, r4Host, cutins.stage);
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

  /** window.__br.hud.status(): what the r7 status layer shows this frame (tools/r7/status-hud.mjs). */
  const debug: HudDebug = {
    status: () => ({
      words: world.statusWords(),
      chips: world.statusChips(),
      banner: statusBanner.banner(),
      cue: statusBanner.cue(),
      slotsLocked: cluster?.skills.slotsLocked ?? false,
      readouts: readout.list(),
      rear: rear.list(),
    }),
  };
  let installed = false;
  /** The debug API is built after the systems: hook on once it is there (as fx/debug.ts does). */
  const installDebug = (): void => {
    const br = (window as unknown as WithHud).__br;
    if (installed || !br) return;
    br.hud = debug;
    installed = true;
  };

  return {
    attach(s) {
      session = s;
      bustAt = null;
      if (s) preloadPortraits(s.player.character, s.riders.filter((r) => !r.isPlayer).map((r) => r.character));
      cluster?.root.remove();
      cluster = s ? new Cluster(brCorner, s.player.character, s.player.loadout) : null;
      quip.reset(s?.player.character ?? null);
      hints.attach(s, app.save.data.stats.races);
      progress.setRiders(s?.riders ?? []);
      alpha = 0;
      world.attach(s);
      cutins.attach(s);
      r4.attach();
      statusBanner.reset();
      readout.attach(s);
      rear.attach(s);
      installDebug();
    },
    setVisible(v) {
      visible = v;
    },
    update(dtReal) {
      const on = visible && session !== null;
      rootW.cls('is-off', !on);
      netHud.update(session);
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
      statusBanner.update(p);
      readout.update(dtReal);
      rear.update(dtReal);
      cluster?.occlude(world.gaugesCovered, dtReal);
      cutins.update(dtReal, k, proj);
      r4.update(dtReal, k, proj);
      hints.update(session, dtReal, quiet || alpha < 0.99 || cutins.screenBusy || world.bottomBusy);
      installDebug();
    },
    dispose() {
      unwire();
      r4.dispose();
      hints.dispose();
      world.dispose();
      netHud.dispose();
      readout.attach(null);
      rear.attach(null);
      root.remove();
      session = null;
      cluster = null;
    },
  };
}
