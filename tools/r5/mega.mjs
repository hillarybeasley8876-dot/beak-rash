#!/usr/bin/env node
// r5 acceptance: mega (one landmark mega jump per track where a three-trick chain fits: achievement 花活三连).
// Lead-owned, read-only for workers. A three-trick chain needs ≈ 1.9 s of air (0.25 s before the first trick, a 0.55 s
// spin, another, and 85 % of the third + margin). Per track: the jump with the most air (player 60 m before it,
// centred, 22 m/s, throttle) must give ≥ 1.9 s; then a scripted rider spins three times on it (a fresh drift press +
// steer as soon as the previous spin ends) and must land the chain (rider:trick land, count ≥ 3) without crashing.
//   node tools/r5/mega.mjs [--tracks coast,city,mountain,watertown,gobi]
import { parseArgs } from '../lib.mjs';
import { expect, finish, noErrors, withPage } from '../r4/accept-lib.mjs';

const a = parseArgs(process.argv.slice(2));
const TRACKS = String(a.tracks ?? 'coast,city,mountain,watertown,gobi').split(',').filter(Boolean);

for (const id of TRACKS) {
  await withPage(async (page, h) => {
    await h.goto(`/?race=${id}&seed=3&manual=1&traffic=0&police=0&rivals=goose`, { timeout: 120000 });
    const out = await page.evaluate(async () => {
      const b = window.__br;
      b.manual(true);
      for (let i = 0; i < 40 && b.session()?.phase !== 'racing'; i++) b.step(30);
      const s = b.session(), p = s.player, t = s.track;
      for (const r of s.riders) if (!r.isPlayer) b.teleport(r.id, Math.min(t.length - 5, p.s + 900), 0);
      const jumps = t.features.filter((f) => (f.kind === 'ramp' || f.kind === 'jumpCrest') && f.s0 > 70 && f.s1 < t.length - 40);
      let air = 0, crashed = false, land = null;
      const offL = b.app.bus.on('rider:land', (e) => { if (e.riderId === p.id) air = Math.max(air, e.airTime); });
      const offC = b.app.bus.on('rider:crash', (e) => { if (e.riderId === p.id) crashed = true; });
      const offT = b.app.bus.on('rider:trick', (e) => { if (e.riderId === p.id && e.phase !== 'start') land = { phase: e.phase, count: e.count }; });
      const run = (f, tricks) => {
        b.teleport(p.id, f.s0 - 60, (f.x0 + f.x1) / 2);
        p.speed = 22; p.vy = 0; p.hp = Math.max(p.hp, 80);
        air = 0; crashed = false; land = null;
        b.setControls({ throttle: 1, steer: 0, brake: 0, drift: false });
        let released = 0;
        for (let k = 0; k < 900 && p.s < f.s1 + 120; k++) {
          if (tricks && p.airborne) {
            if (!p.trick && released >= 2) { b.setControls({ throttle: 1, drift: true, steer: 1 }); released = 0; }
            else if (!p.trick) { b.setControls({ throttle: 1, drift: false, steer: 0 }); released++; }
            else b.setControls({ throttle: 1, drift: true, steer: 1 });
          } else if (tricks) { b.setControls({ throttle: 1, drift: false, steer: 0 }); released = 2; }
          b.step(1);
        }
        b.setControls({ throttle: 1, drift: false, steer: 0 });
        return { air: +air.toFixed(2), crashed, land };
      };
      const res = jumps.map((f) => ({ kind: f.kind, s: Math.round(f.s0), ...run(f, false) }));
      const best = res.filter((r) => !r.crashed).sort((x, y) => y.air - x.air)[0] ?? null;
      let chain = null;
      if (best) chain = run(jumps.find((f) => Math.round(f.s0) === best.s), true);
      offL(); offC(); offT();
      return { best, chain, all: res.map((r) => `${r.kind[0]}@${r.s}:${r.air}`).join(' ') };
    });
    expect(!!out.best && out.best.air >= 1.9, `${id}: a mega jump gives ≥ 1.9 s of air (best ${out.best ? `${out.best.kind}@${out.best.s} ${out.best.air} s` : 'none'}; ${out.all})`);
    const c = out.chain;
    expect(!!c && !c.crashed && c.land?.phase === 'land' && c.land.count >= 3, `${id}: three spins chained on it land clean (${JSON.stringify(c)})`);
    await noErrors(h, `${id} mega`);
  }, { size: '960x540' });
}

finish('r5-mega');
