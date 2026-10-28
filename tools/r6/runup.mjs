#!/usr/bin/env node
// r6 acceptance: a jump's run-up and flight stay clear of the track events' props (SPEC §12 / §16). Lead-owned,
// read-only for workers. A rider lines up for a ramp or a crest over the last 60 m and flies ~45 m past it: an event
// prop in that lane (a roadworks barrier, a fish crate, a stall, a goose) means a crash at full speed (r6: mountain
// seed 3, the work zone's barriers ended 20 m before the ramp at s=1453 — r5-air crashed into them).
// For every track × seed: start every planned event (the player is put 195 m before its spot, so the director builds
// its props), then every event prop that stands in a jump's lane between 60 m before it and 45 m after it is a fail.
//   node tools/r6/runup.mjs [--tracks coast,city,mountain,watertown,gobi] [--seeds 1,2,3,4]
import { parseArgs } from '../lib.mjs';
import { expect, finish, noErrors, withPage } from '../r4/accept-lib.mjs';

const a = parseArgs(process.argv.slice(2));
const TRACKS = String(a.tracks ?? 'coast,city,mountain,watertown,gobi').split(',').filter(Boolean);
const SEEDS = String(a.seeds ?? '1,2,3,4').split(',').map(Number);
const RUNUP = 60;
const FLIGHT = 45;

for (const id of TRACKS) {
  for (const seed of SEEDS) {
    await withPage(async (page, h) => {
      await h.goto(`/?race=${id}&seed=${seed}&manual=1&traffic=0&police=0&rivals=goose&intro=0`, { timeout: 120000 });
      const out = await page.evaluate(async ([RUNUP, FLIGHT]) => {
        const b = window.__br;
        b.manual(true);
        for (let i = 0; i < 40 && b.session()?.phase !== 'racing'; i++) b.step(30);
        const s = b.session(), p = s.player, t = s.track;
        for (const r of s.riders) if (!r.isPlayer) b.teleport(r.id, Math.min(t.length - 5, p.s + 50), 0);
        const jumps = t.features.filter((f) => f.kind === 'ramp' || f.kind === 'jumpCrest');
        const events = b.events.list().slice().sort((x, y) => x.s - y.s);
        const bad = [];
        const seen = new Set();
        for (const e of events) {
          b.teleport(p.id, Math.max(5, e.s - 195), 0);
          p.speed = 0;
          b.setControls({ throttle: 0, brake: 1, steer: 0 });
          b.step(90);
          for (const o of s.obstacles) {
            if (!o.active || o.id < 5000 || seen.has(o.id)) continue;
            seen.add(o.id);
            for (const f of jumps) {
              const cx = ((f.x0 ?? 0) + (f.x1 ?? 0)) / 2, hw = Math.abs((f.x1 ?? 0) - (f.x0 ?? 0)) / 2 + 1.5;
              if (o.s > f.s0 - RUNUP && o.s < f.s1 + FLIGHT && Math.abs(o.x - cx) < hw + (o.halfWidth ?? 0)) {
                bad.push(`${e.kind}:${o.kind}#${o.id}@s${o.s.toFixed(0)},x${o.x.toFixed(1)} in ${f.kind}@${Math.round(f.s0)}`);
                break;
              }
            }
          }
        }
        return { events: events.map((e) => `${e.kind}@${Math.round(e.s)}`), props: seen.size, bad };
      }, [RUNUP, FLIGHT]);
      expect(out.bad.length === 0, `${id} seed ${seed}: no event prop in a jump's run-up or flight (${out.props} props of ${out.events.join(' ') || 'no events'}${out.bad.length ? '; ' + out.bad.slice(0, 4).join(' | ') : ''})`);
      await noErrors(h, `${id} seed ${seed}`);
    }, { size: '960x540' });
  }
}
finish('r6-runup');
