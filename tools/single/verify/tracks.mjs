#!/usr/bin/env node
// Every-track check through the real menus: title → track select (keyboard) → race on each track
// the menu offers, driven with the keyboard for --seconds; fresh page per track. Reports stubbed
// units, game errors, console problems, failed requests, images and voice decode per track.
//   node tools/single/verify/tracks.mjs <url> [--browser chromium|webkit] [--tag name] [--seconds 15]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, withPage } from '../../lib.mjs';
import { audioReport, imageReport, snapshot } from './probes.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const shots = path.resolve(here, '../../../shots');
const args = parseArgs(process.argv.slice(2));
const tag = args.tag ?? args.browser ?? 'chromium';
const seconds = Number(args.seconds ?? 15);
const DRIVE_KEYS = ['ArrowLeft', 'KeyJ', 'ArrowRight', 'KeyL', 'KeyK', 'Space'];

async function boot(page, h) {
  await page.goto(args._[0], { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => window.__br?.ready === true, null, { timeout: 120000 });
  await h.sleep(1200);
  await h.key('Enter', 120); // first gesture: unlocks audio, title → menu
  await h.sleep(1200);
  await page.evaluate(() => window.__br.show('trackSelect'));
  await h.sleep(1200);
  return page.evaluate(() => [...document.querySelectorAll('.br-tc')].map((c) => c.className.replace(/.*is-(\w+).*/, '$1')));
}

async function driveTrack(page, h, index, failed) {
  for (let k = 0; k < 4; k++) await h.key('ArrowLeft', 60);
  for (let k = 0; k < index; k++) await h.key('ArrowRight', 60);
  await h.sleep(600);
  await h.shot(path.join(shots, `tracks-${tag}-${index}-select.png`));
  const t0 = Date.now();
  await h.key('Enter', 100);
  await page.waitForFunction(() => window.__br.snapshot().screen === 'race', null, { timeout: 150000 });
  const loadS = +((Date.now() - t0) / 1000).toFixed(1);
  const trackId = await page.evaluate(() => window.__br.session()?.config?.trackId ?? null);
  await h.sleep(1500);
  await h.shot(path.join(shots, `tracks-${tag}-${index}-${trackId}-intro.png`));
  await page.waitForFunction(() => window.__br.snapshot().phase === 'racing', null, { timeout: 60000 });
  const drive = [];
  await page.keyboard.down('ArrowUp');
  const start = Date.now();
  for (let i = 0; Date.now() - start < seconds * 1000; i++) {
    const key = DRIVE_KEYS[i % DRIVE_KEYS.length];
    await h.key(key, key.startsWith('Arrow') ? 380 : 90);
    await h.sleep(500);
    if (i % 4 === 3) drive.push(await snapshot(page));
    if (i === 5) await h.shot(path.join(shots, `tracks-${tag}-${index}-${trackId}-race1.png`));
  }
  await page.keyboard.up('ArrowUp');
  await h.shot(path.join(shots, `tracks-${tag}-${index}-${trackId}-race2.png`));
  const state = await page.evaluate(() => ({
    stubbed: window.__br.app.modules.stubbed.slice(),
    errors: window.__br.errors.slice(),
    riders: window.__br.snapshot().riders.map((r) => `${r.c}:${r.mode}`),
  }));
  return {
    index, trackId, loadS, drive, ...state,
    images: await imageReport(page), audio: await audioReport(page, 1),
    console: h.logs.splice(0).slice(0, 30), failed: failed.splice(0).slice(0, 20),
  };
}

const result = { tag, url: args._[0].slice(0, 160), tracks: [] };
const count = Number(args.count ?? 3);
for (let index = 0; index < count; index++) {
  await withPage(async (page, h) => {
    const failed = [];
    page.on('requestfailed', (r) => failed.push(`${r.failure()?.errorText} ${r.url().slice(0, 120)}`));
    const cards = await boot(page, h);
    if (index === 0) result.menuTracks = cards;
    if (index >= cards.length) return;
    try {
      result.tracks.push(await driveTrack(page, h, index, failed));
    } catch (err) {
      await h.shot(path.join(shots, `tracks-${tag}-${index}-FAILED.png`)).catch(() => undefined);
      result.tracks.push({ index, failedWith: String(err).slice(0, 300), errors: await page.evaluate(() => window.__br?.errors.slice()), console: h.logs.slice(0, 30) });
    }
  }, { browser: args.browser ?? 'chromium' });
}
fs.mkdirSync(shots, { recursive: true });
fs.writeFileSync(path.join(shots, `tracks-${tag}-report.json`), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 1));
