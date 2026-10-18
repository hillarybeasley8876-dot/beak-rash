#!/usr/bin/env node
// Core regressions: the game must boot and race even when a unit's system cannot be created.
//   node tools/core-check.mjs   (exit 1 on failure)
// 1. Broken WebAudio (AudioContext constructor throws, as on some locked-down machines) → title + race still run.
// 2. Normal boot → race runs 720 frames with no console errors.
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

if (failures.length) { console.log(`\n${failures.length} failure(s)`); process.exit(1); }
console.log('\ncore-check OK');
