#!/usr/bin/env node
// actors unit regression check: every species on every bike keeps its feet on the pedals and its hands on
// the grips (WORLD-space rendered bones, squash included) through crank turns and the land/boost/respawn/ko/
// hit/heavy/ult cues (hands only where they stay on the bars), and the sandbox logs no errors.
//   node tools/actors-check.mjs [--species a,b] [--bikes x,y]
import { parseArgs, withPage } from './lib.mjs';

const a = parseArgs(process.argv.slice(2));
const SPECIES = (a.species ?? 'pelican,goose,capybara,cat,shiba,pigeon,penguin,seagull,sloth,corgi').split(',');
const BIKES = (a.bikes ?? 'roadbike,erba,shared,fixie,mtb,tandem,kidbike').split(',');
const FOOT_TOL = 0.01, GRIP_TOL = 0.01;
let failed = 0;
await withPage(async (page, h) => {
  await h.goto('/sandbox/actors.html?panel=0&speed=9&manual=1');
  for (const c of SPECIES) {
    const row = [];
    for (const bike of BIKES) {
      const r = await page.evaluate(([c, bike]) => {
        window.__actors.set({ character: c, bike, mode: 'ride' });
        return { ...window.__actors.check(320, true), short: !!window.__actors.riders[0].view.inst.def.meta.shortLegs };
      }, [c, bike]);
      const short = r.short; // legs too short for the pedals by design (feet on toy pedal extenders)
      const bad = r.grip > GRIP_TOL || (!short && r.foot > FOOT_TOL);
      if (bad) failed++;
      row.push(`${bike}:${(r.foot * 100).toFixed(1)}/${(r.grip * 100).toFixed(1)}${bad ? '!' : ''}`);
    }
    console.log(`${c.padEnd(9)} foot/grip cm  ${row.join('  ')}`);
  }
  const clear = [];
  for (const c of ['pelican', 'goose', 'penguin', 'corgi']) {
    const d = await page.evaluate((c) => { window.__actors.set({ character: c, bike: 'roadbike', mode: 'ride' }); return window.__actors.weaponClearance(); }, c);
    const bad = d.head < 0.25 || d.grip > 0.32;
    if (bad) failed++;
    clear.push(`${c} ${(d.head * 100).toFixed(0)}/${(d.grip * 100).toFixed(0)}/${(d.pop * 100).toFixed(0)}${bad ? '!' : ''}`);
  }
  // Grip (hand) moves are the teleport test (one-frame hand swaps were 85–132 cm); a heavy wind-up with the penguin's
  // long flippers moves ~30 cm/frame, and a long weapon's tip sweeps faster through it (reported, not asserted).
  console.log(`weapon tip ↔ head (cm, min 25) / grip move per non-strike frame (cm, max 32) / tip move: ${clear.join('  ')}`);
  // Skills cast exactly like combat (cue + ≤ 0.35 s cast action): the pose must read for its effect time, hands ≤ 15 cm/frame.
  const sk = await page.evaluate(() => window.__actors.skillCheck());
  for (const r of sk) if (!r.ok) failed++;
  console.log(`skills shown s (need) / hand cm per frame: ${sk.map((r) => `${r.id} ${r.shown}(${r.need})/${r.handCm}${r.ok ? '' : '!'}`).join('  ')}`);
  const errs = await h.errors();
  if (errs.length) { failed++; console.log('errors:', errs.slice(0, 5)); }
});
console.log(failed ? `FAIL (${failed})` : 'OK');
process.exit(failed ? 1 : 0);
