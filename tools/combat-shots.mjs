#!/usr/bin/env node
// Screenshot every combat visual from the chase camera: pickups, weapon drops, projectiles and skill effects.
//   node tools/combat-shots.mjs [--only name] [--stub actors] [--out shots/combat]
import { installHelpers } from './combat-check/page.mjs';
import { parseArgs, withPage } from './lib.mjs';

const a = parseArgs(process.argv.slice(2));
const OUT = a.out ?? 'shots/combat';
const LINEUP = 'goose,cat,capybara,shiba,pigeon,penguin,seagull,sloth,corgi';
const stub = typeof a.stub === 'string' ? `&stub=${a.stub}` : '';
const url = `/?race=coast&seed=${a.seed ?? 7}&traffic=0&police=0&manual=1&rivals=${LINEUP}${stub}`;

// [name, setup(page-side), frames to step before the shot]
const SHOTS = [
  ['gallery', () => {
    const cc = window.__cc, c = cc.C(), p = cc.P(), app = window.__br.app, tr = cc.S().track;
    const s0 = p.s + 30;
    ['coin', 'fish', 'crate', 'can'].forEach((k, i) => c.spawn(k, s0 + i * 2.2, -4.5));
    ['saltfish', 'baguette', 'pan', 'leek', 'umbrella', 'selfie', 'slipper', 'keyboard'].forEach((w, i) => c.spawn('weapon', s0 + i * 1.6, -1.2, w));
    const eye = tr.toWorld(s0 + 6, 3.2, 2.6, app.camera.position.clone());
    const at = tr.toWorld(s0 + 5.5, -2.8, 0.6, app.camera.position.clone());
    app.rig.override((cam) => { cam.position.copy(eye); cam.lookAt(at); cam.fov = 50; cam.updateProjectionMatrix(); return true; });
    cc.ctl({ throttle: 0 });
  }, 30],
  ['pickups', () => {
    const cc = window.__cc, c = cc.C(), p = cc.P();
    const kinds = ['coin', 'coin', 'coin', 'fish', 'coin', 'crate', 'coin', 'can', 'coin', 'coin'];
    kinds.forEach((k, i) => c.spawn(k, p.s + 9 + i * 3, p.x - 2 + i * 0.45));
    c.spawn('weapon', p.s + 13, p.x + 2.6, 'pan'); c.spawn('weapon', p.s + 17, p.x - 3.2, 'baguette');
    c.spawn('weapon', p.s + 21, p.x + 3.4, 'keyboard');
  }, 4],
  ['torpedo', () => { const cc = window.__cc; cc.C().pin(1, 24, 2.5); cc.step(2); cc.press('skill1'); }, 16],
  ['honk', () => { const cc = window.__cc; cc.C().pin(1, 7, 1.2); cc.step(2); cc.C().cast(1, 1); }, 12],
  ['whistle', () => { const cc = window.__cc; cc.C().pin(9, 6, -1.2); cc.step(2); cc.C().cast(9, 1); }, 10],
  ['chill', () => { const cc = window.__cc; cc.C().pin(3, 6, 1.5); cc.step(2); cc.C().cast(3, 1); }, 40],
  ['doge', () => { const cc = window.__cc; cc.C().pin(4, 5, 1.6); cc.step(2); cc.C().cast(4, 1); }, 30],
  ['doge-bounce', () => {
    const cc = window.__cc, c = cc.C(); c.force({ crit: false, block: false, loose: false });
    c.pin(4, 3.2, 1.3); cc.step(2); c.cast(4, 1); cc.step(20); c.pin(4, 0.3, 1.2); cc.step(2); cc.press('attackR');
    cc.until(() => cc.of('combat:hit').length > 0, 60);
  }, 3],
  ['spin', () => { const cc = window.__cc; cc.C().pin(2, 4.5, 1.2); cc.step(2); cc.C().cast(2, 1); }, 18],
  ['flash', () => { const cc = window.__cc; cc.C().pin(8, 5, 1.4); cc.step(2); cc.C().cast(8, 1); }, 20],
  ['steal', () => { const cc = window.__cc; cc.C().give(0, 'leek'); cc.C().pin(7, 3.5, 1.6); cc.step(2); cc.C().cast(7, 1); }, 8],
  ['slide', () => { const cc = window.__cc; cc.C().pin(6, 6, 1); cc.step(2); cc.C().unpin(6); cc.C().cast(6, 1); }, 40],
  ['ghost', () => { const cc = window.__cc; cc.C().pin(5, 6, 1); cc.step(2); cc.C().cast(5, 1); }, 6],
  ['gulp', () => { const cc = window.__cc; cc.press('skill2'); }, 20],
  ['wing', () => { const cc = window.__cc; cc.ctl({ throttle: 1 }); cc.press('skill3'); }, 50],
  ['ult-apex', () => { const cc = window.__cc; const c = cc.C(); c.pin(1, 18, -2); c.pin(2, 30, 2); c.pin(3, 10, 3); cc.P().sp = 100; cc.press('ult'); }, 40],
  ['ult-impact', () => {
    const cc = window.__cc; const c = cc.C(); c.pin(1, 18, -2); c.pin(2, 30, 2); c.pin(3, 10, 3); cc.P().sp = 100; cc.press('ult');
    cc.until(() => cc.of('ult:impact').length > 0, 900);
  }, 14],
  ['ult-homing', () => { // a lone pack 90 m ahead: the leap travels onto it (ult-aim.ts)
    const cc = window.__cc; const c = cc.C(); c.pin(1, 90, 1.6); c.pin(2, 96, -1.6); cc.step(2); c.unpin(); cc.P().sp = 100; cc.press('ult');
  }, 70],
  ['ult-wave', () => {
    const cc = window.__cc; const c = cc.C(); c.pin(1, 18, -2); c.pin(2, 30, 2); c.pin(3, 10, 3); cc.P().sp = 100; cc.press('ult');
    cc.until(() => cc.of('ult:impact').length > 0, 900);
  }, 40],
];

await withPage(async (page, h) => {
  await h.goto(url);
  await page.evaluate(installHelpers);
  await page.evaluate(() => { const cc = window.__cc; cc.until(() => cc.S().phase === 'racing', 3000); cc.ctl({ throttle: 1 }); cc.step(150); });
  for (const [name, setup, frames] of SHOTS) {
    if (a.only && !name.includes(String(a.only))) continue;
    await page.evaluate(() => { window.__cc.reset(); window.__cc.ctl({ throttle: 0.9 }); window.__cc.step(20); });
    await page.evaluate(setup);
    await page.evaluate((n) => window.__cc.step(n), frames);
    await h.shot(`${OUT}/fx-${name}.png`);
    await page.evaluate(() => window.__br.app.rig.override(null, 0));
    console.log(`shot ${OUT}/fx-${name}.png`);
  }
  const errors = (await h.errors()).filter((e) => /combat/i.test(e));
  console.log(errors.length ? `combat errors:\n${errors.slice(0, 5).join('\n')}` : 'no combat errors');
});
