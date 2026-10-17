// Intro flyover: the camera swoops from high in front of the grid, low along its left flank and
// settles exactly on the chase pose behind the player, then hands back to the rig (blend 0.35 s).
import { Vector3 } from 'three';
import { easeInOutCubic } from '../../core/math';
import type { RiderId } from '../../core/types';
import type { RaceCtx } from './ctx';
import type { Flow } from './flow';

interface TS { s: number; x: number; y: number }

const bezier = (a: TS, c: TS, b: TS, t: number): TS => {
  const u = 1 - t;
  return {
    s: u * u * a.s + 2 * u * t * c.s + t * t * b.s,
    x: u * u * a.x + 2 * u * t * c.x + t * t * b.x,
    y: u * u * a.y + 2 * u * t * c.y + t * t * b.y,
  };
};

/** Control point so the quadratic curve passes through `mid` at t = 0.5. */
const through = (a: TS, mid: TS, b: TS): TS => ({
  s: 2 * mid.s - (a.s + b.s) / 2, x: 2 * mid.x - (a.x + b.x) / 2, y: 2 * mid.y - (a.y + b.y) / 2,
});

export interface IntroCamera {
  /** Rider the camera is currently presenting (for intro name cards), null when none. */
  focus(): RiderId | null;
}

export function startIntroCamera(ctx: RaceCtx, flow: Flow, alive: () => boolean): IntroCamera {
  const { session } = ctx;
  const { track } = session;
  const riders = session.riders;
  const front = Math.max(...riders.map((r) => r.s));
  const back = Math.min(...riders.map((r) => r.s));
  const mid = (front + back) / 2;
  const p = session.player;
  const camA: TS = { s: front + 18, x: 7.5, y: 6.2 };
  const camM: TS = { s: mid + 2, x: -7.8, y: 2.6 };
  const camB: TS = { s: p.s - 5, x: p.x * 0.9, y: 2.1 };
  const lookA: TS = { s: front - 1, x: 0, y: 1.0 };
  const lookM: TS = { s: mid, x: -1, y: 1.1 };
  const lookB: TS = { s: p.s + 8, x: p.x * 0.7, y: 1.0 };
  const camC = through(camA, camM, camB);
  const lookC = through(lookA, lookM, lookB);
  const pos = new Vector3();
  const target = new Vector3();
  let focusId: RiderId | null = null;
  let lookS = lookA.s;

  session.app.rig.override((cam) => {
    if (!alive() || session.phase !== 'intro') return false;
    const t = easeInOutCubic(flow.introProgress);
    const c = bezier(camA, camC, camB, t);
    const l = bezier(lookA, lookC, lookB, t);
    track.toWorld(c.s, c.x, c.y, pos);
    track.toWorld(l.s, l.x, l.y, target);
    cam.position.copy(pos);
    cam.lookAt(target);
    lookS = l.s;
    return true;
  }, 0.35);

  return {
    focus() {
      if (session.phase !== 'intro') return null;
      let best: RiderId | null = null;
      let bestD = 4.5;
      for (const r of riders) {
        if (r.isPlayer && flow.introProgress < 0.8) continue;
        const d = Math.abs(r.s - lookS);
        if (d < bestD) { bestD = d; best = r.id; }
      }
      focusId = best ?? focusId;
      return focusId;
    },
  };
}
