// One verification pass over a build: boot → title → menu (keyboard) → loading → race on the
// coast track driven with the keyboard → checks: fonts, images (HUD portraits), voice decode and
// the audio mix level, game-captured errors, console errors/warnings, failed requests.
import path from 'node:path';
import { audioReport, fontReport, gameErrors, imageReport, snapshot } from './probes.mjs';

const DRIVE_KEYS = ['ArrowLeft', 'KeyJ', 'ArrowRight', 'KeyL', 'KeyK', 'Space'];

export async function runFlow(page, h, { url, tag, shotsDir, driveSeconds = 20 }) {
  const failed = [];
  page.on('requestfailed', (r) => failed.push(`${r.failure()?.errorText ?? 'failed'} ${r.url().slice(0, 140)}`));
  page.on('response', (r) => {
    if (r.status() >= 400) failed.push(`HTTP ${r.status()} ${r.url().slice(0, 140)}`);
  });
  const shot = (name) => h.shot(path.join(shotsDir, `${tag}-${name}.png`));
  const report = { tag, url: url.slice(0, 160) };

  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'load', timeout: 120000 });
  report.loadMs = Date.now() - t0;
  await page.waitForFunction(() => window.__br?.ready === true, null, { timeout: 120000 });
  report.readyMs = Date.now() - t0;
  await h.sleep(2500);
  report.title = { snap: await snapshot(page), fonts: await fontReport(page) };
  await shot('1-title');

  await h.key('Enter', 120); // also the first user gesture: unlocks audio
  await h.sleep(2500);
  report.menu = { snap: await snapshot(page), images: await imageReport(page) };
  await shot('2-menu');

  await page.evaluate(() => { void window.__br.start({ trackId: 'coast', mode: 'quick' }); });
  await h.sleep(400);
  await shot('3-loading');
  await page.waitForFunction(() => window.__br.snapshot().screen === 'race', null, { timeout: 120000 });
  report.raceReadyMs = Date.now() - t0;
  await h.sleep(1200);
  await shot('4-countdown');
  await page.waitForFunction(() => window.__br.snapshot().phase === 'racing', null, { timeout: 60000 });

  report.drive = [];
  await page.keyboard.down('ArrowUp');
  const start = Date.now();
  for (let i = 0; Date.now() - start < driveSeconds * 1000; i++) {
    const key = DRIVE_KEYS[i % DRIVE_KEYS.length];
    await h.key(key, key.startsWith('Arrow') ? 450 : 90);
    await h.sleep(550);
    if (i % 5 === 4) report.drive.push(await snapshot(page));
    if (i === 6) await shot('5-race-early');
  }
  await page.keyboard.up('ArrowUp');
  report.drivenS = +((Date.now() - start) / 1000).toFixed(1);
  await shot('6-race-end');

  report.images = await imageReport(page);
  report.fonts = await fontReport(page);
  report.audio = await audioReport(page);
  report.gameErrors = await gameErrors(page);
  report.consoleLogs = h.logs.slice(0, 40);
  report.failedRequests = failed.slice(0, 40);
  return report;
}
