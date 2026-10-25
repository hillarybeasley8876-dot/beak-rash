#!/usr/bin/env node
// r4 acceptance: w2-events (SPEC §19 track events). Lead-owned, read-only for workers. Uses the events module's debug
// hook `window.__br.events = { list(), force(kind, s) }` (required by the brief).   node tools/r4/w2-events.mjs
import { capture, clearEvents, events, expect, finish, hold, noErrors, race, withPage } from './accept-lib.mjs';

const C = { throttle: 0.8 };
const obs = (page, kind) => page.evaluate((k) => window.__br.session().obstacles.filter((o) => o.kind === k && o.active).map((o) => ({ id: o.id, s: o.s, x: o.x, solid: o.solid, hw: o.halfWidth })), kind);

await withPage(async (page, h) => {
  // 0. scheduling on a normal race: 1–2 events at 25–80 %, ≥ 600 m apart, none near the finish or in a tunnel / on a bridge
  for (const track of ['coast', 'mountain']) {
    await race(page, h, { track, seed: 7, extra: '&traffic=1&police=0' });
    const plan = await page.evaluate(() => {
      const s = window.__br.session(), L = s.track.length;
      const list = window.__br.events?.list() ?? null;
      const covered = (x) => s.track.features.some((f) => (f.kind === 'tunnel' || f.kind === 'bridge') && x >= f.s0 - 20 && x <= f.s1 + 20);
      return { L, list, bad: (list ?? []).filter((e) => e.s < 0.25 * L || e.s > 0.8 * L || e.s > L - 150 || covered(e.s)).length };
    });
    const n = plan.list?.length ?? 0;
    const spaced = (plan.list ?? []).every((e, i, a) => i === 0 || Math.abs(e.s - a[i - 1].s) >= 600);
    expect(n >= 1 && n <= 2 && plan.bad === 0 && spaced, `${track}: 1–2 seeded events inside the rules (${JSON.stringify(plan.list)})`);
  }

  // forced events, coast, no traffic
  await race(page, h, { track: 'coast', seed: 3, extra: '&traffic=0&police=0' });
  if (!expect(await page.evaluate(() => typeof window.__br.events?.force === 'function'), 'the events module exposes window.__br.events.force(kind, s)')) return;
  await page.evaluate(() => { const b = window.__br, s = b.session(); for (const r of s.riders) if (!r.isPlayer) b.teleport(r.id, s.player.s + 900 + r.id * 12, 0); });
  await capture(page, ['race:event', 'pickup:spawn', 'npc:say', 'rider:crash']);
  const force = (kind, ahead) => page.evaluate(([k, a]) => window.__br.events.force(k, window.__br.session().player.s + a), [kind, ahead]);

  // 1. fish truck spill: warn → start; a tipped truck blocks a lane; coins + fish spawn behind it; 3 slick patches
  await force('fishSpill', 230);
  let ev = await (async () => { for (let i = 0; i < 40; i++) { await hold(page, C, 15); const e = await events(page, 'race:event'); if (e.some((x) => x.e.kind === 'fishSpill' && x.e.phase === 'start')) return e; } return events(page, 'race:event'); })();
  expect(ev.some((x) => x.e.kind === 'fishSpill' && x.e.phase === 'warn') && ev.some((x) => x.e.kind === 'fishSpill' && x.e.phase === 'start'), `fishSpill: warn then start (${JSON.stringify(ev.map((x) => [x.e.kind, x.e.phase]))})`);
  const sp = (await events(page, 'pickup:spawn')).map((x) => x.e.kind);
  expect(sp.filter((k) => k === 'coin').length >= 18 && sp.filter((k) => k === 'fish').length >= 3, `fishSpill: ≥ 18 coins and ≥ 3 fish requested (${sp.length} pickups)`);
  const trucks = (await obs(page, 'truck')).filter((o) => o.solid);
  const slicks = await obs(page, 'oil');
  expect(trucks.length >= 1 && slicks.length >= 3, `fishSpill: a solid tipped truck + ≥ 3 slick patches (${trucks.length} trucks, ${slicks.length} slicks)`);
  await hold(page, C, 600);

  // 2. geese cross: 7 non-solid geese whose x changes; riding into one costs speed
  await clearEvents(page);
  await force('geese', 120);
  for (let i = 0; i < 40 && !(await obs(page, 'goose')).length; i++) await hold(page, C, 10);
  const g0 = await obs(page, 'goose');
  await hold(page, C, 90);
  const g1 = await obs(page, 'goose');
  const moved = g0.filter((a) => g1.some((b) => b.id === a.id && Math.abs(b.x - a.x) > 0.8)).length;
  expect(g0.length === 7 && g0.every((o) => !o.solid), `geese: a flock of 7 non-solid geese (${g0.length})`);
  expect(moved >= 5, `geese: they waddle across (${moved} of ${g0.length} moved > 0.8 m in 1.5 s)`);
  if (g1.length) {
    const hit = await page.evaluate((g) => { const b = window.__br, p = b.session().player; b.teleport(0, g.s - 2.5, g.x); p.speed = 15; return p.speed; }, g1[0]);
    await hold(page, { throttle: 0 }, 20);
    const v = await page.evaluate(() => window.__br.session().player.speed);
    expect(v < hit * 0.85, `geese: riding into one costs speed (${hit} → ${v.toFixed(1)} m/s)`);
  }
  await hold(page, C, 400);

  // 3. roadworks: solid barriers leave one lane, switching side halfway (a chicane)
  await clearEvents(page);
  await force('roadworks', 220);
  for (let i = 0; i < 40 && !(await events(page, 'race:event')).some((x) => x.e.kind === 'roadworks' && x.e.phase === 'start'); i++) await hold(page, C, 15);
  const rw = (await events(page, 'race:event')).find((x) => x.e.kind === 'roadworks');
  if (rw) {
    const sides = await page.evaluate((s0) => {
      const ss = window.__br.session(), bars = ss.obstacles.filter((o) => o.kind === 'barrier' && o.active && o.solid);
      const gapAt = (s) => {
        const b = ss.track.bounds(s);
        const iv = bars.filter((o) => Math.abs(o.s - s) <= o.halfLength + 1).map((o) => [o.x - o.halfWidth, o.x + o.halfWidth]).sort((a, c) => a[0] - c[0]);
        let best = { w: 0, mid: 0 }, x = -b.left;
        for (const [x0, x1] of iv) { if (x0 - x > best.w) best = { w: x0 - x, mid: (x0 + x) / 2 }; x = Math.max(x, x1); }
        if (b.right - x > best.w) best = { w: b.right - x, mid: (b.right + x) / 2 };
        return best;
      };
      const near = bars.map((o) => o.s).filter((s) => Math.abs(s - s0) < 200).sort((a, c) => a - c);
      if (!near.length) return null;
      return { first: gapAt(near[0] + 15), second: gapAt(near[near.length - 1] - 15), n: near.length };
    }, rw.e.s);
    expect(!!sides && sides.n >= 4 && sides.first.w >= 3 && sides.first.w <= 6.5 && sides.second.w >= 3 && sides.second.w <= 6.5 && Math.sign(sides.first.mid) !== Math.sign(sides.second.mid),
      `roadworks: one open lane, switching sides halfway (${JSON.stringify(sides)})`);
  } else expect(false, 'roadworks: the event starts');
  await hold(page, C, 600);

  // 4. stalls: non-solid stalls at the edge; riding into one smashes it: speed −15 %, coins, it goes inactive
  await clearEvents(page);
  await force('stalls', 120);
  for (let i = 0; i < 40 && !(await obs(page, 'stall')).length; i++) await hold(page, C, 10);
  const st = await obs(page, 'stall');
  expect(st.length >= 3 && st.length <= 4 && st.every((o) => !o.solid), `stalls: 3–4 non-solid market stalls (${st.length})`);
  if (st.length) {
    const v0 = await page.evaluate((o) => { const b = window.__br, p = b.session().player; b.teleport(0, o.s - 3, o.x); p.speed = 14; return p.speed; }, st[0]);
    await hold(page, { throttle: 0 }, 20);
    const after = await page.evaluate((id) => { const p = window.__br.session().player; const o = window.__br.session().obstacles.find((x) => x.id === id); return { v: p.speed, active: !!o?.active }; }, st[0].id);
    const coins = (await events(page, 'pickup:spawn')).filter((x) => x.e.kind === 'coin').length;
    expect(after.v < v0 * 0.9 && !after.active && coins >= 2, `stalls: smashed at 14 m/s → speed ${after.v.toFixed(1)}, gone, ${coins} coins`);
    expect((await events(page, 'npc:say')).some((x) => /西瓜/.test(x.e.text)), 'stalls: the owner shouts 我的西瓜！');
  }
  expect(!(await events(page, 'rider:crash')).some((x) => x.e.riderId === 0), 'no event crashed the player in these runs');
  await noErrors(h, 'events');
}, { size: '1280x720' });

finish('w2-events');
