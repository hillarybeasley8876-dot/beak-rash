#!/usr/bin/env node
// In-game chase read of the player's bike (and one rival placed just ahead), at full HD:
//   node sandbox/bikes.chase.mjs --bikes tandem,roadbike,fixie [--rival sloth] [--ahead 7] [--frames 360]
//        [--track coast] [--size 1920x1080] [--tag x] [--stub combat] [--out shots/bikes]
// Writes <out>/chase-<bike>[-tag].png and prints rider positions + errors per shot.
import { parseArgs, withPage } from '../tools/lib.mjs';

const a = parseArgs(process.argv.slice(2));
const bikes = String(a.bikes ?? 'tandem').split(',');
const rival = a.rival ?? 'sloth';
const tag = a.tag ? `-${a.tag}` : '';
const stub = a.stub ? `&stub=${a.stub}` : '';
await withPage(async (page, h) => {
  for (const bike of bikes) {
    await h.goto(`/?race=${a.track ?? 'coast'}&seed=3&traffic=0&police=0&bike=${bike}&rivals=${rival}${stub}`);
    await h.controls({ throttle: 1 });
    await h.step(Number(a.frames ?? 360));
    const snap = await h.snapshot();
    const me = snap.riders.find((r) => r.id === 0);
    const other = snap.riders.find((r) => r.id !== 0);
    if (me && other) await page.evaluate(([id, s, x]) => window.__br.teleport(id, s, x), [other.id, me.s + Number(a.ahead ?? 7), me.x + 0.6]);
    await h.step(4);
    const file = `${a.out ?? 'shots/bikes'}/chase-${bike}${tag}.png`;
    await h.shot(file);
    const after = await h.snapshot();
    console.log(JSON.stringify({ file, riders: after.riders.map((r) => `${r.c}@${r.s}/${r.x} v${r.v}`), errors: (await h.errors()).slice(0, 3) }));
  }
  if (h.logs.length) console.log('console:', h.logs.slice(0, 8).join('\n'));
}, { size: a.size ?? '1920x1080' });
