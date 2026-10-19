// Intro flyover: the camera swoops down from high in front of the grid, dollies back down the middle of the
// staggered two-wide grid (grid.ts: every rider on its own s, sides alternating) presenting each rival in turn with
// an eased stop from ~3.6 m ahead (a 3/4 front view, each one large in frame once), then swings up onto the chase
// pose behind the player and hands back to the rig (blend 0.35 s). The HUD's calling cards follow the s of the
// look point (ui/hud/cutins/intro.ts mirrors lookY), so each card lands on the rival the camera holds.
import { Vector3 } from 'three';
import { easeInOutCubic, lerp, smoothstep } from '../../core/math';
import type { RiderId } from '../../core/types';
import type { RaceCtx } from './ctx';
import type { Flow } from './flow';

interface TS { s: number; x: number; y: number }
interface Key { cam: TS; look: TS }

const LANE_X = 0, LANE_Y = 1.55;     // camera line down the middle of the grid (between its two columns)
const AHEAD = 3;                     // m the camera sits ahead of the rival it presents (a 3/4 front view)
const TOUR = [0.14, 0.8] as const;   // share of the flyover spent presenting the rivals
const LOOK_HOP = [0.4, 0.75] as const; // part of each rival's slot where the look pans on to the next one…
const CAM_HOP = [0.5, 1] as const;     // …and where the camera follows (pan first, then dolly: the card leads)
const CREEP = 0.15;                  // share of the hop crept during the stop, so the shot never freezes
const FACE_PLAYER = [0.5, 0.8] as const; // final swing: turned to the player (its card comes last), then ahead
const CRANE = 1.4;                   // m the camera rises mid-swing, so it turns around over the grid
const FOCUS_RANGE = 4.5;             // m in s around the look point (same as the HUD's cards)
const PLAYER_FROM = 0.8;             // share of the flyover after which the player may be presented

/** Look-target height over the eased flyover: 1.0 → 1.1 → 1.0 m (the HUD's intro cards mirror it). */
const lookY = (e: number): number => 1 + 0.4 * e * (1 - e);

const mix = (a: TS, b: TS, t: number): TS => ({ s: lerp(a.s, b.s, t), x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });
const mixKey = (a: Key, b: Key, t: number): Key => ({ cam: mix(a.cam, b.cam, t), look: mix(a.look, b.look, t) });
/** Progress of a hop over a rival's slot: a slow creep plus an eased move within [from, to]. */
const hop = (q: number, [from, to]: readonly [number, number]): number => CREEP * q + (1 - CREEP) * smoothstep(from, to, q);

interface Keys { start: Key; tour: Key[]; player: TS; end: Key }

export interface IntroCamera {
  /** Rider the camera is currently presenting (for intro name cards), null when none. */
  focus(): RiderId | null;
}

/** Camera/look keys: the establishing shot, one stop per rival (front to back), the player, the chase pose. */
function buildKeys(ctx: RaceCtx): Keys {
  const { riders, player: p } = ctx.session;
  const front = Math.max(...riders.map((r) => r.s));
  const rivals = riders.filter((r) => !r.isPlayer).sort((a, b) => b.s - a.s);
  return {
    start: { cam: { s: front + 14, x: -2, y: 5.5 }, look: { s: front - 4, x: 0, y: 1 } },
    tour: rivals.map((r) => ({ cam: { s: r.s + AHEAD, x: LANE_X, y: LANE_Y }, look: { s: r.s, x: r.x, y: 1 } })),
    player: { s: p.s, x: p.x, y: 1 },
    end: { cam: { s: p.s - 5, x: p.x * 0.9, y: 2.1 }, look: { s: p.s + 8, x: p.x * 0.7, y: 1 } },
  };
}

/** Swing onto the chase pose, craning up over the grid: turn to the player first (its card comes last), then look
 * ahead like the chase rig. */
function finale(k: Keys, last: Key, u: number): Key {
  const [face, hold] = FACE_PLAYER;
  const look = u < face ? mix(last.look, k.player, easeInOutCubic(u / face))
    : mix(k.player, k.end.look, easeInOutCubic(Math.max(0, u - hold) / (1 - hold)));
  const cam = mix(last.cam, k.end.cam, easeInOutCubic(u));
  cam.y += CRANE * Math.sin(Math.PI * u);
  return { cam, look };
}

/** Where the flyover is at linear progress `t` (0..1). */
function sample(k: Keys, t: number): Key {
  const n = k.tour.length;
  const first = k.tour[0], last = k.tour[n - 1];
  if (!first || !last) return mixKey(k.start, k.end, easeInOutCubic(t));
  if (t < TOUR[0]) return mixKey(k.start, first, easeInOutCubic(t / TOUR[0]));
  if (t >= TOUR[1]) return finale(k, last, (t - TOUR[1]) / (1 - TOUR[1]));
  const slot = (t - TOUR[0]) / ((TOUR[1] - TOUR[0]) / n);
  const i = Math.min(n - 1, Math.floor(slot));
  const q = slot - i;
  const here = k.tour[i] ?? last;
  const next = k.tour[i + 1] ?? here;
  return { cam: mix(here.cam, next.cam, hop(q, CAM_HOP)), look: mix(here.look, next.look, hop(q, LOOK_HOP)) };
}

export function startIntroCamera(ctx: RaceCtx, flow: Flow, alive: () => boolean): IntroCamera {
  const { session } = ctx;
  const { track, riders } = session;
  const keys = buildKeys(ctx);
  const pos = new Vector3();
  const target = new Vector3();
  let focusId: RiderId | null = null;
  let lookS = keys.start.look.s;

  session.app.rig.override((cam) => {
    if (!alive() || session.phase !== 'intro') return false;
    const t = flow.introProgress;
    const k = sample(keys, t);
    track.toWorld(k.cam.s, k.cam.x, k.cam.y, pos);
    track.toWorld(k.look.s, k.look.x, lookY(easeInOutCubic(t)), target);
    cam.position.copy(pos);
    cam.lookAt(target);
    lookS = k.look.s;
    return true;
  }, 0.35);

  return {
    focus() {
      if (session.phase !== 'intro') return null;
      let best: RiderId | null = null;
      let bestD = FOCUS_RANGE;
      for (const r of riders) {
        if (r.isPlayer && flow.introProgress < PLAYER_FROM) continue;
        const d = Math.abs(r.s - lookS);
        if (d < bestD) { bestD = d; best = r.id; }
      }
      focusId = best ?? focusId;
      return focusId;
    },
  };
}
