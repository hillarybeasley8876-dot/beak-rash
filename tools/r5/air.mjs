#!/usr/bin/env node
// r5 acceptance: r5-air (more air on every track, so the SPEC §16 tricks and their chains are playable).
// Lead-owned, read-only for workers. For every jump feature (ramp, jumpCrest) the player is set 60 m before it, in the
// middle of its width, at 22 m/s, throttle on, and its air time is measured (rider:land). Before r5 the tracks gave
// 1–4 airs per race of 0.7–1.2 s: a three-trick chain was impossible.
//   node tools/r5/air.mjs [--tracks coast,city,mountain,watertown,gobi] [--reverse coast,gobi]
import { parseArgs } from '../lib.mjs';
import { expect, finish, noErrors, withPage } from '../r4/accept-lib.mjs';

const a = parseArgs(process.argv.slice(2));
const TRACKS = String(a.tracks ?? 'coast,city,mountain,watertown,gobi').split(',').filter(Boolean);
const REVERSE = String(a.reverse ?? 'coast,gobi').split(',').filter(Boolean);
const SPEED = 22;

async function measure(page, h, id, extra) {
  await h.goto(`/?race=${id}&seed=3&manual=1&traffic=0&police=0&rivals=${extra.includes('reverse') ? 'goose' : 'goose'}${extra}`, { timeout: 120000 });
  return page.evaluate(async (speed) => {
    const b = window.__br;
    b.manual(true);
    for (let i = 0; i < 40 && b.session()?.phase !== 'racing'; i++) b.step(30);
    const s = b.session(), p = s.player, t = s.track;
    for (const r of s.riders) if (!r.isPlayer) b.teleport(r.id, Math.min(t.length - 5, p.s + 900), 0);
    const jumps = t.features.filter((f) => f.kind === 'ramp' || f.kind === 'jumpCrest').sort((x, y) => x.s0 - y.s0);
    const out = [];
    let air = 0, crashed = false;
    const offL = b.app.bus.on('rider:land', (e) => { if (e.riderId === p.id) air = Math.max(air, e.airTime); });
    const offC = b.app.bus.on('rider:crash', (e) => { if (e.riderId === p.id) crashed = true; });
    for (const f of jumps) {
      if (f.s0 < 70 || f.s1 > t.length - 40) { out.push({ kind: f.kind, s: Math.round(f.s0), air: null, skipped: true }); continue; }
      const x = (f.x0 + f.x1) / 2;
      b.teleport(p.id, f.s0 - 60, x);
      p.speed = speed; p.vy = 0; p.hp = Math.max(p.hp, 50);
      air = 0; crashed = false;
      b.setControls({ throttle: 1, steer: 0, brake: 0 });
      for (let k = 0; k < 120 && p.s < f.s1 + 90; k++) b.step(6);
      out.push({ kind: f.kind, s: Math.round(f.s0), x: +x.toFixed(1), air: +air.toFixed(2), crashed });
    }
    offL(); offC();
    return out;
  }, SPEED);
}

for (const id of TRACKS) {
  await withPage(async (page, h) => {
    const js = await measure(page, h, id, '');
    const got = js.filter((j) => j.air !== null);
    const ok7 = got.filter((j) => j.air >= 0.7 && !j.crashed).length;
    const ok13 = got.filter((j) => j.air >= 1.3 && !j.crashed).length;
    const list = got.map((j) => `${j.kind[0]}@${j.s}:${j.air}${j.crashed ? '!' : ''}`).join(' ');
    expect(ok7 >= 6, `${id}: at least 6 jumps give ≥ 0.7 s of air at ${SPEED} m/s (${ok7}; ${list})`);
    expect(ok13 >= 2, `${id}: at least 2 big jumps give ≥ 1.3 s (a trick chain) (${ok13})`);
    expect(got.every((j) => !j.crashed), `${id}: landing a jump straight never crashes (${got.filter((j) => j.crashed).map((j) => j.s).join(',') || 'none'})`);
    await noErrors(h, `${id} jumps`);
  }, { size: '960x540' });
}

for (const id of REVERSE) {
  await withPage(async (page, h) => {
    const js = await measure(page, h, id, '&reverse=1');
    const got = js.filter((j) => j.air !== null);
    const ok7 = got.filter((j) => j.air >= 0.7 && !j.crashed).length;
    expect(ok7 >= 5, `${id} reversed: the jumps still launch (≥ 5 with ≥ 0.7 s: ${ok7}; ${got.map((j) => `${j.s}:${j.air}`).join(' ')})`);
    await noErrors(h, `${id} reversed jumps`);
  }, { size: '960x540' });
}

finish('r5-air');
