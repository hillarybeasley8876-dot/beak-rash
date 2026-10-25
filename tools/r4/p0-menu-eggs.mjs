#!/usr/bin/env node
// r4 pilot acceptance (lead-owned, read-only for workers): two easter eggs.
// 1. Main menu: typing P-E-L-I-C-A-N (in order, < 4 s) shows a `.br-egg-bubble` with 嘴大吃四方！ for ~2.5 s, calls
//    app.audio.voice('pelican_taunt_0'), stays on the menu, works again; a wrong order shows nothing.
// 2. Credits: 30 s without input shows a `.br-egg-thanks` plate with 特别鸣谢：每一只被画歪的鹈鹕。 inside the viewport;
//    any input restarts the 30 s.
//   node tools/r4/p0-menu-eggs.mjs        (prints PASS/FAIL lines, exit 1 on any failure)
import { withPage } from '../lib.mjs';

const failures = [];
const expect = (ok, msg) => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`);
  if (!ok) failures.push(msg);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** An element matching `sel` (optionally containing `text`) is rendered, opaque enough and inside the viewport. */
const visible = (page, sel, text = '') => page.evaluate(([s, t]) => [...document.querySelectorAll(s)].some((e) => {
  const r = e.getBoundingClientRect();
  const cs = getComputedStyle(e);
  return r.width > 2 && r.height > 2 && cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05 &&
    r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth && (e.textContent ?? '').includes(t);
}), [sel, text]);

const typeKeys = async (page, letters, gap = 120) => {
  for (const ch of letters) {
    await page.keyboard.press(`Key${ch}`);
    await sleep(gap);
  }
};

await withPage(async (page, h) => {
  await h.goto('/?screen=menu');
  await page.evaluate(() => {
    const audio = window.__br.app.audio;
    const voice = audio.voice.bind(audio);
    window.__voices = [];
    audio.voice = (id) => { window.__voices.push(id); voice(id); };
  });
  await sleep(1500);
  await typeKeys(page, 'PELCIAN');
  await sleep(500);
  expect(!(await visible(page, '.br-egg-bubble')), 'menu: a wrong order (P-E-L-C-I-A-N) shows no bubble');
  await sleep(4500);
  await typeKeys(page, 'PELICAN');
  await sleep(500);
  expect(await visible(page, '.br-egg-bubble', '嘴大吃四方'), 'menu: P-E-L-I-C-A-N shows the 嘴大吃四方！ bubble');
  const voices = await page.evaluate(() => window.__voices.slice());
  expect(voices.includes('pelican_taunt_0'), `menu: the egg plays voice pelican_taunt_0 (${JSON.stringify(voices)})`);
  const screen = await page.evaluate(() => window.__br.app.ui.screen);
  expect(screen === 'menu', `menu: still on the menu after typing (${screen})`);
  await sleep(3300);
  expect(!(await visible(page, '.br-egg-bubble')), 'menu: the bubble is gone ~3.8 s later');
  await typeKeys(page, 'PELICAN');
  await sleep(500);
  expect(await visible(page, '.br-egg-bubble', '嘴大吃四方'), 'menu: the egg works a second time');
  await sleep(1500);
  await typeKeys(page, 'PELICAN', 900);
  await sleep(3500);
  const slow = await visible(page, '.br-egg-bubble');
  expect(!slow, 'menu: typing too slowly (> 4 s for the word) shows no bubble');
  const errs = await h.errors();
  expect(errs.length === 0, `menu: no console errors (${errs.slice(0, 2).join(' | ')})`);
}, { size: '1920x1080' });

await withPage(async (page, h) => {
  await h.goto('/?screen=credits');
  await sleep(24000);
  expect(!(await visible(page, '.br-egg-thanks')), 'credits: no hidden line after 24 s');
  await sleep(8500);
  expect(await visible(page, '.br-egg-thanks', '特别鸣谢：每一只被画歪的鹈鹕。'), 'credits: the hidden thanks line after 30 s idle');
  await h.goto('/?screen=credits');
  await sleep(20000);
  await page.keyboard.press('ArrowDown');
  await sleep(13000);
  expect(!(await visible(page, '.br-egg-thanks')), 'credits: a key press restarts the 30 s idle timer');
  const errs = await h.errors();
  expect(errs.length === 0, `credits: no console errors (${errs.slice(0, 2).join(' | ')})`);
}, { size: '1280x720' });

console.log(failures.length ? `\np0-menu-eggs FAILED (${failures.length})` : '\np0-menu-eggs OK');
process.exit(failures.length ? 1 : 0);
