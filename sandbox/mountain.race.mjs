#!/usr/bin/env node
// Sunset Pass race soak: autopilot race on the mountain, stepped deterministically in chunks.
// Logs every rider's progress per chunk, counts crashes (mode changes to 'crashed'), and reports
// when everyone finished (or the frame budget ran out). Exit code 1 if the player did not finish.
//   node sandbox/mountain.race.mjs [--seed 3] [--frames 16000] [--q "&traffic=0"] [--shot shots/env-mountain/race]
import { parseArgs, withPage } from '../tools/lib.mjs';

const a = parseArgs(process.argv.slice(2));
const budget = Number(a.frames ?? 16000), chunk = 600;
const result = await withPage(async (page, h) => {
  await h.goto(`/?race=mountain&seed=${a.seed ?? 3}&autopilot=1${a.q ?? ''}`);
  const crashes = new Map();
  const lastMode = new Map();
  const log = [];
  let frames = 0, snap = await h.snapshot();
  while (frames < budget) {
    await h.step(chunk);
    frames += chunk;
    snap = await h.snapshot();
    for (const r of snap.riders) {
      if (r.mode === 'crashed' && lastMode.get(r.id) !== 'crashed') {
        crashes.set(r.id, (crashes.get(r.id) ?? 0) + 1);
        log.push(`f${frames} ${r.c} crashed at s=${r.s} x=${r.x}`);
      }
      lastMode.set(r.id, r.mode);
    }
    const p = snap.riders[0];
    console.log(`f=${frames} phase=${snap.phase} t=${snap.time.toFixed(1)} player s=${p?.s} v=${p?.v} place=${p?.place} mode=${p?.mode} | ${snap.riders.map((r) => `${r.c}:${Math.round(r.s)}`).join(' ')}`);
    if (a.shot && frames % 3000 === 0) await h.shot(`${a.shot}_${frames}.png`);
    if (snap.riders.every((r) => r.mode === 'finished') || snap.phase === 'results' || snap.phase === 'ended') break;
  }
  return { frames, phase: snap.phase, riders: snap.riders, crashes: Object.fromEntries(crashes), log: log.slice(0, 40), errors: (await h.errors()).slice(0, 10) };
});
console.log(JSON.stringify(result, null, 1));
const player = result.riders?.[0];
process.exit(player && player.mode === 'finished' ? 0 : 1);
