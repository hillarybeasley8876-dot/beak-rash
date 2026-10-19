#!/usr/bin/env node
// Core regressions: the game must boot and race even when a unit's system cannot be created.
//   node tools/core-check.mjs   (exit 1 on failure)
// 1. Broken WebAudio (AudioContext constructor throws, as on some locked-down machines) → title + race still run.
// 2. Normal boot → race runs 720 frames with no console errors.
// 3. A stickless gamepad steers with the d-pad.
import { withPage } from './lib.mjs';

const failures = [];
const expect = (ok, msg) => { if (!ok) failures.push(msg); console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`); };

await withPage(async (page, h) => {
  await page.addInitScript(() => {
    const broken = function () { throw new Error('AudioContext disabled (core-check)'); };
    window.AudioContext = broken;
    window.webkitAudioContext = broken;
    window.OfflineAudioContext = broken;
  });
  await h.goto('/');
  const screen = await page.evaluate(() => window.__br.app.ui.screen);
  expect(screen === 'title', `broken audio: boots to the title (screen=${screen})`);
  await page.evaluate(() => window.__br.start({ trackId: 'coast', seed: 3 }));
  await h.controls({ throttle: 1 });
  await h.step(720);
  const snap = await h.snapshot();
  expect(snap.phase === 'racing' && snap.riders[0].s > 40, `broken audio: race runs (phase=${snap.phase}, s=${snap.riders[0]?.s})`);
  const fatal = (await h.errors()).filter((e) => !/AudioContext disabled|\[modules\]|\[audio\]/.test(e));
  expect(fatal.length === 0, `broken audio: no unexpected errors (${fatal.slice(0, 2).join(' | ')})`);
});

await withPage(async (page, h) => {
  await h.goto('/?race=coast&seed=5');
  await h.controls({ throttle: 1, steer: 0.15 });
  await h.step(720);
  const snap = await h.snapshot();
  expect(snap.phase === 'racing', `normal: race running (phase=${snap.phase})`);
  const errs = await h.errors();
  expect(errs.length === 0, `normal: no console errors (${errs.slice(0, 2).join(' | ')})`);
});

// 3. Gamepad without a stick: the d-pad steers in a race (HOW TO promises it), RT pedals.
await withPage(async (page, h) => {
  await page.addInitScript(() => {
    const buttons = Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 }));
    const pad = { id: 'core-check pad', index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons, timestamp: 0 };
    window.__pad = (i, on) => { buttons[i] = { pressed: on, touched: on, value: on ? 1 : 0 }; };
    navigator.getGamepads = () => [pad, null, null, null];
  });
  await h.goto('/?race=coast&seed=4&traffic=0&police=0&manual=1');
  await page.evaluate(() => window.__pad(7, true));
  await h.step(600);
  const hold = (button, frames) => page.evaluate(([b, n]) => {
    const br = window.__br, p = br.session().player, x0 = p.x;
    window.__pad(b, true);
    br.step(n);
    const steer = br.app.input.steer;
    window.__pad(b, false);
    br.step(30);
    return { dx: p.x - x0, steer, v: p.speed, phase: br.session().phase };
  }, [button, frames]);
  const right = await hold(15, 54);
  const left = await hold(14, 54);
  expect(right.phase === 'racing' && right.v > 8, `pad: RT pedals (phase=${right.phase}, v=${right.v.toFixed(1)})`);
  expect(right.steer > 0.9 && right.dx > 1, `pad: d-pad right steers right (steer=${right.steer.toFixed(2)}, dx=${right.dx.toFixed(2)})`);
  expect(left.steer < -0.9 && left.dx < -1, `pad: d-pad left steers left (steer=${left.steer.toFixed(2)}, dx=${left.dx.toFixed(2)})`);
});

if (failures.length) { console.log(`\n${failures.length} failure(s)`); process.exit(1); }
console.log('\ncore-check OK');
