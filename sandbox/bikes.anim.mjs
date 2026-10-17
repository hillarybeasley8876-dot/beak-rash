#!/usr/bin/env node
// Automated animation checks for every bike in the sandbox (run with the dev server up):
//   node sandbox/bikes.anim.mjs
// Wheels roll at speed/R, cranks follow the gearing, pedals stay level, the bars pivot about the head-tube
// axis (front hub keeps its distance to the axis and swings the right way), the balance bike paddles while
// accelerating and glides on its pegs at steady speed.
import { BASE, withPage } from '../tools/lib.mjs';

const GEAR = { roadbike: 5, erba: 3, shared: 3.2, fixie: 3.4, mtb: 4.2, tandem: 4.4 };
const wrap = (a) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
const near = (a, b, tol) => Math.abs(a - b) <= tol;

await withPage(async (page, h) => {
  await page.goto(`${BASE}/sandbox/bikes.html?manual=1&spin=0`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__bikes?.ready === true, null, { timeout: 60000 });
  const call = (fn, arg) => page.evaluate(fn, arg);
  const results = [];
  for (const bike of [...Object.keys(GEAR), 'kidbike']) {
    await call((b) => window.__bikes.set({ bike: b, view: 'side', speed: 10, steer: 0, markers: false }), bike);
    await call(() => window.__bikes.step(60, 1 / 60));
    const p0 = await call(() => window.__bikes.probe());
    const st = await call(() => window.__bikes.stats());
    await call(() => window.__bikes.step(12, 1 / 60));
    const p1 = await call(() => window.__bikes.probe());
    const roll = (10 * 12) / 60 / st.wheelRadius;
    const r = { bike, wheelOk: near(wrap(p1.wheelAngle - p0.wheelAngle), wrap(roll), 0.02) };
    if (bike !== 'kidbike') {
      r.crankOk = near(wrap(p1.crank - p0.crank), wrap(roll / GEAR[bike]), 0.02);
      r.pedalsLevel = Math.max(p1.pedalTiltL, p1.pedalTiltR) < 1e-3;
    }
    await call(() => window.__bikes.set({ steer: 0.4 }));
    await call(() => window.__bikes.step(1, 1 / 60));
    const p2 = await call(() => window.__bikes.probe());
    r.axisKept = near(p2.hubFromAxis, p1.hubFromAxis, 1e-4);
    r.turnsRight = p2.hubF[0] > p1.hubF[0] + 0.005 && p2.gripR[2] > p1.gripR[2];
    await call(() => window.__bikes.set({ steer: 0 }));
    results.push(r);
  }
  // Balance bike: launch 0 → 6 m/s over 3 s, then hold.
  await call(() => { window.__bikes.set({ bike: 'kidbike', speed: 6 }); window.__bikes.launch(); });
  const track = [];
  for (let i = 0; i < 60; i++) {
    await call(() => window.__bikes.step(6, 1 / 60));
    const p = await call(() => window.__bikes.probe());
    track.push({ t: +((i + 1) * 0.1).toFixed(1), y: +p.pedalR[1].toFixed(3), z: +p.pedalR[2].toFixed(3), x: +p.pedalR[0].toFixed(3) });
  }
  const accel = track.filter((s) => s.t > 0.6 && s.t < 2.8);
  const glide = track.filter((s) => s.t > 5.2);
  const paddle = {
    touchesGround: accel.some((s) => s.y < 0.06),
    strides: new Set(accel.map((s) => Math.round(s.z * 20))).size > 4,
    glidesOnPeg: glide.every((s) => near(s.y, 0.205, 0.01) && near(s.x, 0.09, 0.01)),
  };
  console.log(JSON.stringify({ results, paddle, sample: track.filter((_, i) => i % 6 === 0) }, null, 1));
  if (h.logs.length) console.log('console:', h.logs.slice(0, 10).join('\n'));
});
