#!/usr/bin/env node
// r4 acceptance: w3-fx (effects for the r4 mechanics + weather particles). Lead-owned, read-only for workers.
//   node tools/r4/w3-fx.mjs
import { expect, finish, hold, noErrors, race, withPage } from './accept-lib.mjs';

const C = { throttle: 0.6 };
const NEED = ['trickTrail', 'trickLand', 'parry', 'throwTrail', 'policeDown', 'fishSplash', 'truckDust', 'gooseFeathers', 'fruit', 'quack'];

await withPage(async (page, h) => {
  await race(page, h, { track: 'coast', seed: 3, extra: '&traffic=0&police=0' });
  await page.evaluate(() => { const b = window.__br, s = b.session(); for (const r of s.riders) if (!r.isPlayer) b.teleport(r.id, s.player.s + 700 + r.id * 12, 0); });
  const presets = await page.evaluate(() => window.__br.fx.presets);
  const missing = NEED.filter((n) => !presets.includes(n));
  expect(missing.length === 0, `new fx presets exist (missing: ${missing.join(', ') || 'none'})`);
  const P = await page.evaluate(() => { const s = window.__br.session(); const p = s.track.toWorld(s.player.s + 4, s.player.x, 1, new (window.__br.app.camera.position.constructor)()); return { x: p.x, y: p.y, z: p.z }; });
  /** Particles alive after emitting an event (vs before), stepping a few frames. */
  const bump = async (name, payload, frames = 4) => {
    await hold(page, C, 90); // let older particles die
    const n0 = await page.evaluate(() => (({ solid, add }) => solid + add)(window.__br.fx.stats().particles));
    await page.evaluate(([n, p]) => window.__br.app.bus.emit(n, p), [name, payload]);
    await hold(page, C, frames);
    const n1 = await page.evaluate(() => (({ solid, add }) => solid + add)(window.__br.fx.stats().particles));
    return n1 - n0;
  };
  const checks = [
    ['rider:trick land', 'rider:trick', { riderId: 0, phase: 'land', kind: 'backflip', count: 2, points: 290 }],
    ['combat:parry', 'combat:parry', { riderId: 0, attacker: null, obstacleId: 900, weapon: 'pan', pos: P }],
    ['police:down', 'police:down', { obstacleId: 900, attacker: 0, pos: P }],
    ['race:event fishSpill start', 'race:event', { kind: 'fishSpill', phase: 'start', s: 400, pos: P }],
    ['race:event geese start', 'race:event', { kind: 'geese', phase: 'start', s: 400, pos: P }],
    ['secret:found', 'secret:found', { id: 'duck_coast', riderId: 0, pos: P, first: true }],
  ];
  for (const [label, name, payload] of checks) {
    const d = await bump(name, payload);
    expect(d >= 8, `${label} → a burst of particles (+${d})`);
  }
  // trick trails while a trick runs (the sim announces it: rider:trick phase 'start')
  const trail = await page.evaluate(() => {
    const b = window.__br, p = b.session().player;
    b.step(90);
    const n0 = (({ solid, add }) => solid + add)(b.fx.stats().particles);
    b.app.bus.emit('rider:trick', { riderId: p.id, phase: 'start', kind: 'spin', count: 1, points: 0 });
    b.step(8);
    return (({ solid, add }) => solid + add)(b.fx.stats().particles) - n0;
  });
  expect(trail >= 6, `a running trick leaves a trail (+${trail})`);
  await noErrors(h, 'fx events');
}, { size: '1280x720' });

// weather particles: a 'fx:weather' layer, visible with rain / snow, absent or hidden when clear
for (const [w, track] of [['clear', 'coast'], ['rain', 'coast'], ['snow', 'mountain'], ['fog', 'coast']]) {
  await withPage(async (page, h) => {
    await race(page, h, { track, seed: 3, extra: `&traffic=0&police=0&weather=${w}` });
    await hold(page, C, 60);
    const layer = await page.evaluate(() => { const o = window.__br.app.scene.getObjectByName('fx:weather'); return o ? { visible: o.visible && (o.parent?.visible ?? true), kind: o.userData.kind ?? null } : null; });
    if (w === 'rain' || w === 'snow') expect(!!layer && layer.visible && layer.kind === w, `${track} ${w}: an fx:weather layer of kind ${w} (${JSON.stringify(layer)})`);
    else expect(!layer || !layer.visible, `${track} ${w}: no falling weather particles (${JSON.stringify(layer)})`);
    await noErrors(h, `weather ${w}`);
  }, { size: '960x540' });
}

finish('w3-fx');
