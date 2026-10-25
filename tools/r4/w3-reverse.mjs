#!/usr/bin/env node
// r4 acceptance: w3-world-reverse (SPEC §20 reverse direction). Lead-owned, read-only for workers.
//   node tools/r4/w3-reverse.mjs [--tracks coast,mountain,city]
import fs from 'node:fs';
import { parseArgs } from '../lib.mjs';
import { expect, finish, noErrors, withPage } from './accept-lib.mjs';

const a = parseArgs(process.argv.slice(2));
const tracks = String(a.tracks ?? 'coast,mountain,city').split(',');
fs.mkdirSync('shots/r4-accept-reverse', { recursive: true });

/** Sampled geometry of one build: positions, tangents and curvature at fractions of the length. */
const sample = (page) => page.evaluate(() => {
  const b = window.__br;
  b.manual(true);
  for (let i = 0; i < 40 && b.session()?.phase !== 'racing'; i++) b.step(30);
  const t = b.session().track, L = t.length;
  const at = [0.2, 0.35, 0.5, 0.65, 0.8].map((f) => { const fr = t.frameAt(f * L); return { f, p: { ...fr.pos }, t: { ...fr.tangent }, k: fr.curvature }; });
  const ramps = t.features.filter((f) => f.kind === 'ramp' || f.kind === 'jumpCrest').map((f) => ({ kind: f.kind, s0: f.s0, s1: f.s1, x: (f.x0 + f.x1) / 2 }));
  return { L, reverse: t.reverse ?? null, at, ramps, errors: b.errors.slice() };
});

for (const id of tracks) {
  await withPage(async (page, h) => {
    await h.goto(`/?race=${id}&seed=3&manual=1&traffic=0&police=0`, { timeout: 120000 });
    const fwd = await sample(page);
    await h.goto(`/?race=${id}&seed=3&manual=1&traffic=0&police=0&reverse=1`, { timeout: 120000 });
    const rev = await sample(page);
    expect(rev.reverse === true && fwd.reverse !== true, `${id}: Track.reverse (${fwd.reverse} / ${rev.reverse})`);
    expect(Math.abs(rev.L - fwd.L) / fwd.L < 0.03, `${id}: same length within 3 % (${Math.round(fwd.L)} / ${Math.round(rev.L)})`);
    // the same road driven the other way: point at f matches the forward point at 1 − f, tangents opposite, curvature flipped
    let worst = 0, dots = 1, kerr = 0;
    for (const r of rev.at) {
      const twin = fwd.at.find((x) => Math.abs(x.f - (1 - r.f)) < 1e-6);
      if (!twin) continue;
      worst = Math.max(worst, Math.hypot(r.p.x - twin.p.x, r.p.z - twin.p.z));
      dots = Math.min(dots, -(r.t.x * twin.t.x + r.t.y * twin.t.y + r.t.z * twin.t.z));
      kerr = Math.max(kerr, Math.abs(r.k + twin.k));
    }
    expect(worst < 25, `${id}: the reversed road lies on the forward road (worst offset ${worst.toFixed(1)} m)`);
    expect(dots > 0.9, `${id}: tangents point the other way (min −dot ${dots.toFixed(2)})`);
    expect(kerr < 0.004, `${id}: curvature mirrored (worst |k_rev + k_fwd| ${kerr.toFixed(4)})`);
    expect(rev.ramps.length === fwd.ramps.length, `${id}: every ramp / crest kept (${fwd.ramps.length} → ${rev.ramps.length})`);
    expect(rev.errors.length === 0, `${id}: reversed build without console errors (${rev.errors.slice(0, 1).join('')})`);
    // a reversed ramp still launches
    const ramp = rev.ramps.find((r) => r.kind === 'ramp') ?? rev.ramps[0];
    if (ramp) {
      const air = await page.evaluate((r) => {
        const b = window.__br, p = b.session().player;
        b.teleport(0, r.s0 - 25, r.x);
        p.speed = 19;
        b.setControls({ throttle: 1 });
        let best = 0;
        for (let i = 0; i < 150; i++) { b.step(1); best = Math.max(best, p.y); }
        return best;
      }, ramp);
      expect(air > 0.4, `${id}: the reversed ${ramp.kind} at s ${Math.round(ramp.s0)} still launches (peak y ${air.toFixed(2)} m)`);
    }
    // stills for the lead + a full autopilot race in reverse
    await page.addStyleTag({ content: '.br-ui, #ui { display: none !important; }' });
    for (const f of [0.15, 0.5, 0.85]) {
      await page.evaluate((x) => { const b = window.__br, s = b.session(); b.teleport(0, s.track.length * x, 1); s.player.speed = 15; b.step(40); }, f);
      await h.shot(`shots/r4-accept-reverse/${id}-${Math.round(f * 100)}.png`);
    }
    await h.goto(`/?race=${id}&seed=4&manual=1&traffic=1&police=0&autopilot=1&reverse=1`, { timeout: 120000 });
    const run = await page.evaluate(async () => {
      const b = window.__br;
      b.manual(true);
      let ended = null;
      b.app.bus.on('race:end', (p) => { ended = p.results; });
      for (let i = 0; i < 420 && !ended; i++) { b.step(60); await new Promise((r) => setTimeout(r, 0)); }
      return { ended: !!ended, finished: ended ? ended.filter((r) => r.time !== null).length : 0 };
    });
    expect(run.ended && run.finished >= 6, `${id}: a reversed autopilot race reaches race:end with ≥ 6 finishers (${run.finished})`);
    await noErrors(h, `${id} reverse`);
  }, { size: '1280x720' });
}

finish('w3-reverse');
