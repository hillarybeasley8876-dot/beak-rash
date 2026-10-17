// Page-driving helpers shared by the feel scenario files (tools/feel-scenarios*.mjs).
import { r3 } from './feel-lib.mjs';

export { r3 };
export const DEG = 180 / Math.PI;

/** Patch the track, park the rival far away, put the player at (s, x) with speed v. */
export async function prep(page, { kappa = 0, flat = true, wall = 0, s = 60, x = 0, v = 0, rival = null } = {}) {
  await page.evaluate((o) => {
    const f = window.__feel;
    f.patch({ kappa: o.kappa, flatSlope: o.flat, wall: o.wall });
    f.clearFeatures();
    f.clearObstacles();
    const ses = window.__br.session();
    for (const r of ses.riders) if (!r.isPlayer) f.place(r.id, 2800 - r.id * 20, 0, 0);
    f.place(ses.player.id, o.s, o.x, o.v);
    if (o.rival) f.place(o.rival.id, o.rival.s, o.rival.x, o.rival.v);
    window.__br.setScale('ko', 1);
    f.kb = 0;
    f.reset();
  }, { kappa, flat, wall, s, x, v, rival });
}

export async function run(page, segs, dt = 1 / 60) {
  return page.evaluate(([sg, d]) => {
    window.__feel.run(sg, d, true);
    return window.__feel.rec;
  }, [segs, dt]);
}

export const events = (page) => page.evaluate(() => window.__feel.events);
export const stripStart = (page, w) => page.evaluate((ww) => window.__feel.stripStart(ww), w ?? 320);
export const stripEnd = (page) => page.evaluate(() => window.__feel.stripEnd());
