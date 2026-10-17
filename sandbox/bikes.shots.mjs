#!/usr/bin/env node
// Screenshot the bikes sandbox. Usage:
//   node sandbox/bikes.shots.mjs --bikes roadbike,erba --views side,turntable,chase [--markers 1] [--quality high]
//        [--tint "#d9534f"] [--speed 8] [--steer 0.3] [--angle 35] [--frames 30] [--size 1280x720] [--tag x]
//        [--focus x,y,z --dist 0.9] (orbit close-up) [--clean] (hide the control panel)
// Writes shots/bikes/<bike>-<view>[-tag].png and prints the sandbox stats per shot.
import { BASE, parseArgs, withPage } from '../tools/lib.mjs';

const a = parseArgs(process.argv.slice(2));
const bikes = String(a.bikes ?? 'roadbike').split(',');
const views = String(a.views ?? 'turntable').split(',');
const tag = a.tag ? `-${a.tag}` : '';
await withPage(async (page, h) => {
  await page.goto(`${BASE}/sandbox/bikes.html?manual=1&spin=0`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__bikes?.ready === true, null, { timeout: 60000 });
  if (a.clean) await page.evaluate(() => { document.getElementById('panel').style.display = 'none'; });
  for (const bike of bikes) {
    for (const view of views) {
      await page.evaluate((p) => window.__bikes.set(p), {
        bike, view, markers: a.markers === '1', quality: a.quality ?? 'high', tint: a.tint ?? '',
        speed: Number(a.speed ?? 6), steer: Number(a.steer ?? 0), angle: Number(a.angle ?? 35), spin: false,
        focus: a.focus ? String(a.focus).split(',').map(Number) : null, dist: Number(a.dist ?? 1.2),
      });
      await page.evaluate((n) => window.__bikes.step(n, 1 / 60), Number(a.frames ?? 30));
      const file = `shots/bikes/${view === 'lineup' ? 'lineup' : bike}-${view}${tag}.png`;
      await h.shot(file);
      const stats = await page.evaluate(() => window.__bikes.stats());
      console.log(JSON.stringify({ file, ...stats }));
    }
  }
  if (h.logs.length) console.log('console:', h.logs.slice(0, 10).join('\n'));
}, { size: a.size ?? '1280x720' });
