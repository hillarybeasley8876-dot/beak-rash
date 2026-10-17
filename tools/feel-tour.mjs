#!/usr/bin/env node
// Visual tour of the handling on the REAL coast track: frame strips (4×4 grids) for the feel critic.
//   node tools/feel-tour.mjs [--only sbend,crest] [--out shots/sim/tour] [--main]
// Default page: /sandbox/sim.html?…&realtrack=1 (track unit builder even before world/index.ts is live);
// --main uses the game page (/?race=coast…) instead. Prints the key numbers of every stop.
import path from 'node:path';
import { parseArgs, withPage } from './lib.mjs';
import { installFeel, saveDataUrl } from './feel-lib.mjs';

const a = parseArgs(process.argv.slice(2));
const OUT = a.out ?? 'shots/sim/tour';
const only = a.only ? new Set(String(a.only).split(',')) : null;
const q = 'race=coast&seed=1&traffic=0&police=0&rivals=goose';
const url = a.main ? `/?${q}&manual=1` : `/sandbox/sim.html?${q}&realtrack=1`;

const T = { throttle: 1 };
const STOPS = [
  { name: 'sbend', s: 960, x: 0, v: 20, segs: [{ time: 7.5, controls: T, steerHold: { x: 0 }, grabEvery: 28 }] },
  { name: 'drift', s: 985, x: 2, v: 20, segs: [
    { time: 0.25, controls: { ...T, steer: -0.5 }, grabEvery: 9 },
    { time: 2.4, controls: { ...T, drift: true }, steerHold: { x: -1.5 }, grabEvery: 14 },
    { time: 1.2, controls: T, steerHold: { x: -1.5 }, grabEvery: 14 }] },
  { name: 'crest', s: 1600, x: 0, v: 20, segs: [{ time: 3.6, controls: T, grabEvery: 13 }] },
  { name: 'ramp', s: 1785, x: 3.1, v: 20, segs: [{ time: 3.0, controls: T, grabEvery: 11 }] },
  { name: 'cliffwall', s: 1200, x: 3, v: 20, segs: [{ time: 3.5, controls: { ...T, steer: 0.45 }, grabEvery: 13 }] },
  { name: 'lookback', s: 700, x: 0, v: 20, rival: { s: 690, x: 1.5, v: 19 }, segs: [
    { time: 0.5, controls: T, grabEvery: 10 }, { time: 1.4, controls: { ...T, lookBack: true }, grabEvery: 10 },
    { time: 0.6, controls: T, grabEvery: 10 }] },
  { name: 'crash', s: 400, x: 0, v: 20, car: { s: 436, x: 0, speed: 4 }, segs: [
    { time: 1.6, controls: T, grabEvery: 8 }, { time: 3.4, controls: T, grabEvery: 22 }] },
  { name: 'ko', s: 400, x: -1.5, v: 19, rival: { s: 401, x: 1.2, v: 19 }, ko: true, segs: [{ time: 3.2, controls: T, grabEvery: 12 }] },
  { name: 'slowmo', s: 1000, x: 0, v: 20, slow: true, segs: [{ time: 3.2, controls: T, steerSin: 0.4, amp: 0.5, grabEvery: 12 }] },
];

await withPage(async (page, h) => {
  await h.goto(url, { timeout: 90000 });
  await installFeel(page);
  const phase = await page.evaluate(() => window.__feel.waitRacing());
  if (phase !== 'racing') throw new Error(`[tour] race never started (${phase})`);
  for (const st of STOPS) {
    if (only && !only.has(st.name)) continue;
    const res = await page.evaluate((o) => {
      const f = window.__feel;
      const br = window.__br;
      const ses = br.session();
      ses.obstacles.length = 0;
      for (const r of ses.riders) if (!r.isPlayer) f.place(r.id, 3000 - r.id * 20, 0, 0);
      f.place(ses.player.id, o.s, o.x, o.v);
      if (o.rival) f.place(1, o.rival.s, o.rival.x, o.rival.v);
      if (o.car) ses.obstacles.push({ id: 990, kind: 'car', active: true, solid: true, height: 1.6, halfWidth: 0.95, halfLength: 2.2, ...o.car });
      br.setScale('bench', o.slow ? 0.1 : 1);
      f.kb = 0;
      f.run([{ time: 0.25, controls: { throttle: 1 } }], 1 / 60, false); // settle the camera springs
      f.reset();
      f.stripStart(320, 4);
      if (o.ko) br.ko(1, 0);
      f.run(o.segs, 1 / 60, true);
      br.setScale('bench', 1);
      const rows = f.rec;
      return {
        strip: f.stripEnd(),
        events: f.events.filter((e) => e.riderId === ses.player.id || e.type.startsWith('cam:')).map((e) => `${e.t.toFixed(2)} ${e.type} ${e.kind ?? e.cause ?? e.phase ?? ''}${e.level ? ` L${e.level}` : ''}`),
        maxSteer: Math.max(...rows.map((r) => Math.abs(r.steer))), maxLean: Math.max(...rows.map((r) => Math.abs(r.lean))) * 57.3,
        maxYaw: Math.max(...rows.map((r) => Math.abs(r.yaw))) * 57.3, maxY: Math.max(...rows.map((r) => r.y)),
        v: [rows[0].v, rows[rows.length - 1].v], x: [Math.min(...rows.map((r) => r.x)), Math.max(...rows.map((r) => r.x))],
      };
    }, st);
    saveDataUrl(path.join(OUT, `${st.name}.png`), res.strip);
    const f1 = (v) => v.toFixed(1);
    console.log(`[tour] ${st.name}: steer≤${res.maxSteer.toFixed(2)} lean≤${f1(res.maxLean)}° yaw≤${f1(res.maxYaw)}° y≤${res.maxY.toFixed(2)} v ${res.v.map(f1).join('→')} x ${res.x.map(f1).join('..')}`);
    if (res.events.length) console.log(`        ${res.events.slice(0, 14).join(' | ')}`);
  }
  const errs = await h.errors();
  if (errs.length) console.log('[tour] page errors:', errs.slice(0, 5));
});
