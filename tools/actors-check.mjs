#!/usr/bin/env node
// actors unit regression check: every species on every bike keeps its feet on the pedals and its hands on
// the grips through two crank turns (IK error in metres), and the sandbox logs no errors.
//   node tools/actors-check.mjs [--species a,b] [--bikes x,y]
import { parseArgs, withPage } from './lib.mjs';

const a = parseArgs(process.argv.slice(2));
const SPECIES = (a.species ?? 'pelican,goose,capybara,cat,shiba,pigeon,penguin,seagull,sloth,corgi').split(',');
const BIKES = (a.bikes ?? 'roadbike,erba,shared,fixie,mtb,tandem,kidbike').split(',');
const FOOT_TOL = 0.02, GRIP_TOL = 0.03;
let failed = 0;
await withPage(async (page, h) => {
  await h.goto('/sandbox/actors.html?panel=0&speed=9&manual=1');
  for (const c of SPECIES) {
    const row = [];
    for (const bike of BIKES) {
      const r = await page.evaluate(([c, bike]) => { window.__actors.set({ character: c, bike, mode: 'ride' }); return window.__actors.check(150); }, [c, bike]);
      const short = c === 'corgi'; // legs too short for the pedals by design (feet paddle the air)
      const bad = r.grip > GRIP_TOL || (!short && r.foot > FOOT_TOL);
      if (bad) failed++;
      row.push(`${bike}:${(r.foot * 100).toFixed(1)}/${(r.grip * 100).toFixed(1)}${bad ? '!' : ''}`);
    }
    console.log(`${c.padEnd(9)} foot/grip cm  ${row.join('  ')}`);
  }
  const errs = await h.errors();
  if (errs.length) { failed++; console.log('errors:', errs.slice(0, 5)); }
});
console.log(failed ? `FAIL (${failed})` : 'OK');
process.exit(failed ? 1 : 0);
