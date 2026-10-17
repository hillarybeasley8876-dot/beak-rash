#!/usr/bin/env node
// Real-time frame rate of the full game on the coast (all units, 1920×1080), sampled at several s.
//   node sandbox/track.fps.mjs [--q "&stub=audio"]
import { parseArgs, withPage } from '../tools/lib.mjs';

const a = parseArgs(process.argv.slice(2));
await withPage(async (page, h) => {
  await h.goto(`/?race=coast&seed=2&autopilot=1&traffic=1${a.q ?? ''}`);
  await h.realtime();
  await page.waitForFunction(() => window.__br.session()?.phase === 'racing', null, { timeout: 30000 });
  const out = [];
  for (const s of [80, 600, 1300, 1950, 2200, 2850, 3200]) {
    await h.eval(`window.__br.teleport(0, ${s}, 1.5)`);
    await h.sleep(2500);
    const snap = await h.snapshot();
    out.push({ s, at: snap.riders?.[0]?.s, phase: snap.phase, fps: snap.fps });
  }
  console.log(JSON.stringify({ out, errors: (await h.errors()).slice(0, 3) }));
}, { size: '1920x1080' });
