#!/usr/bin/env node
// Race unit spot check: loads a race, steps deterministic frames and prints standings / AI state,
// screenshots along the way.
//   node tools/race-check.mjs [--url "/?race=coast&seed=3"] [--frames 1800] [--every 600]
//        [--out shots/race/check] [--controls '{"throttle":1}'] [--ai] [--eval "js"]
import { parseArgs, withPage } from './lib.mjs';

const a = parseArgs(process.argv.slice(2));
const url = a.url ?? '/?race=coast&seed=3';
const frames = Number(a.frames ?? 1800);
const every = Number(a.every ?? 600);
const out = a.out ?? 'shots/race/check';

await withPage(async (page, h) => {
  await h.goto(url);
  await h.step(1);
  if (a.controls) await h.controls(JSON.parse(a.controls));
  if (a.eval) await h.eval(a.eval);
  for (let f = 0; f < frames; f += every) {
    await h.step(Math.min(every, frames - f));
    const snap = await h.snapshot();
    const t = f + Math.min(every, frames - f);
    await h.shot(`${out}-${String(t).padStart(5, '0')}.png`);
    const riders = snap.riders.map((r) => `${r.place}.${r.c}@${r.s}/${r.x} v${r.v} ${r.mode}`).join(' | ');
    console.log(`f${t} phase=${snap.phase} t=${snap.time.toFixed(1)} fps=${snap.fps} :: ${riders}`);
    if (a.ai) console.log(JSON.stringify(await h.eval(() => window.__br.race?.ai()), null, 0));
  }
  const errs = await h.errors();
  const mine = errs.filter((e) => e.includes('race') || e.includes('gameplay/race'));
  console.log(JSON.stringify({ errors: errs.length, raceErrors: mine.slice(0, 5).map((e) => e.slice(0, 600)) }, null, 1));
}, { size: a.size ?? '1280x720' });
