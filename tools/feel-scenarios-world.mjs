// Feel scenarios: walls, rider contacts, slipstream, crashes (see feel-scenarios.mjs for the handling set).
import { crossTime, jitter, maxOf } from './feel-lib.mjs';
import { events, prep, r3, run, stripEnd, stripStart } from './feel-steps.mjs';

const wall = {
  name: 'wall',
  async run({ page, strips }) {
    await prep(page, { v: 20, wall: 6, x: 3.5 });
    const scrape = await run(page, [{ time: 2, controls: { throttle: 1, steer: 0.35 } }]);
    const scrapeEv = await events(page);
    await prep(page, { v: 20, wall: 6 });
    if (strips) await stripStart(page);
    const slam = await run(page, [{ time: 2, controls: { throttle: 1, steer: 1 }, grabEvery: 9 }]);
    const strip = strips ? await stripEnd(page) : null;
    const slamEv = await events(page);
    return {
      metrics: {
        scrapeHits: scrapeEv.filter((e) => e.type === 'rider:obstacleHit').length,
        scrapeSpeedEnd: r3(scrape[scrape.length - 1].v), scrapeMaxX: r3(maxOf(scrape, 'x')),
        scrapeCrashed: scrapeEv.some((e) => e.type === 'rider:crash'),
        slamCrashed: slamEv.some((e) => e.type === 'rider:crash'),
        slamCause: slamEv.find((e) => e.type === 'rider:crash')?.cause ?? null,
        slamMaxX: r3(maxOf(slam, 'x')),
      },
      rows: scrape, strip,
    };
  },
};

const bump = {
  name: 'bump',
  async run({ page, strips }) {
    await prep(page, { v: 18, x: -1.4, rival: { id: 1, s: 60.4, x: 0, v: 18 } });
    if (strips) await stripStart(page);
    const rows = await run(page, [{ time: 1.2, controls: { throttle: 1, steer: 0.7 }, grabEvery: 6 }]);
    const strip = strips ? await stripEnd(page) : null;
    const dump = await page.evaluate(() => window.__br.sim.riders().slice(0, 2));
    const ev = await events(page);
    const b = ev.filter((e) => e.type === 'rider:bump');
    return {
      metrics: {
        bumps: b.length, firstStrength: r3(b[0]?.strength), playerHp: rows[rows.length - 1].hp,
        minGap: r3(Math.min(...rows.filter((r) => Math.abs(r.r1s - r.s) < 1.7).map((r) => Math.abs(r.r1x - r.x)))),
        rivalX: dump[1].x, playerX: dump[0].x, rivalVx: dump[1].vx,
      },
      rows, strip,
    };
  },
};

const slipstream = {
  name: 'slipstream',
  async run({ page }) {
    await prep(page, { v: 19, x: 0, rival: { id: 1, s: 67, x: 0, v: 19 } });
    const rows = await run(page, [
      { time: 1.6, controls: { throttle: 1 }, tag: 'draft' },
      { time: 0.5, controls: { throttle: 1, steer: 0.7 }, tag: 'out' },
      { time: 0.8, controls: { throttle: 1 }, tag: 'after' },
    ]);
    const ev = await events(page);
    const d = rows.filter((r) => r.tag === 'draft');
    const sling = ev.find((e) => e.type === 'rider:boost' && e.kind === 'draft');
    await prep(page, { v: 20, x: -1.05, rival: { id: 1, s: 64, x: 0, v: 10 } });
    await run(page, [{ time: 2.5, controls: { throttle: 1 } }]);
    const passEv = (await events(page)).filter((e) => e.type === 'rider:nearMiss' && e.kind === 'rider');
    return {
      metrics: {
        draftRise: crossTime(d, 'draft', 0.99, 0), draftMax: r3(maxOf(d, 'draft')),
        slingshot: !!sling, slingPower: sling?.power ?? null, slingTime: sling?.time ?? null,
        speedGainWhileDrafting: r3(d[d.length - 1].v - d[0].v),
        riderNearMiss: passEv.length, riderNearMissBy: passEv[0]?.riderId ?? null,
      },
    };
  },
};

const crash = {
  name: 'crash',
  async run({ page, strips }) {
    await prep(page, { v: 20, x: 0 });
    await page.evaluate(() => window.__feel.addObstacle({ id: 901, kind: 'car', s: 95, x: 0, speed: 6, halfWidth: 0.95, halfLength: 2.2 }));
    if (strips) await stripStart(page);
    const rows = await run(page, [{ time: 5, controls: { throttle: 1 }, grabEvery: 18 }]);
    const strip = strips ? await stripEnd(page) : null;
    const ev = await events(page);
    const c = ev.find((e) => e.type === 'rider:crash');
    const rs = ev.find((e) => e.type === 'rider:respawn');
    const back = rows.find((r) => rs && r.t > rs.t && r.mode === 'racing');
    const after = rows.filter((r) => r.mode === 'racing' && rs && r.t > rs.t);
    return {
      metrics: {
        crashed: !!c, cause: c?.cause ?? null, crashAt: r3(c?.t), respawnAfter: r3(rs && c ? rs.t - c.t : null),
        racingAfter: r3(back && rs ? back.t - rs.t : null), respawnX: r3(after[0]?.x), hpAfter: r3(after[0]?.hp),
        recrashed: ev.filter((e) => e.type === 'rider:crash').length > 1,
      },
      rows, strip,
    };
  },
};

/** Sustained shoulder pressing and a dead-centre rear-end: pushes must be smooth, never teleports. */
const press = {
  name: 'press',
  async run({ page }) {
    await prep(page, { v: 18, x: -0.8, rival: { id: 1, s: 60, x: 0, v: 18 } });
    const side = await run(page, [{ time: 2, controls: { throttle: 1, steer: 0.4 } }]);
    const sideEv = (await events(page)).filter((e) => e.type === 'rider:bump').length;
    await prep(page, { v: 20, x: 0, rival: { id: 1, s: 62.5, x: 0, v: 12 } });
    const rear = await run(page, [{ time: 1.2, controls: { throttle: 1 } }]);
    const step = (rows, k) => Math.max(...rows.slice(1).map((r, i) => Math.abs(r[k] - rows[i][k])));
    const sStep = Math.max(...rear.slice(1).map((r, i) => Math.abs(r.s - rear[i].s - r.v / 60)));
    return {
      metrics: {
        sideMaxStepX: r3(step(side, 'x')), sideRivalMaxStepX: r3(step(side, 'r1x')),
        sideJitterX: r3(jitter(side.slice(20), 'x')), sideBumps: sideEv,
        sideGapMin: r3(Math.min(...side.map((r) => Math.abs(r.r1x - r.x)))),
        rearMaxSJump: r3(sStep), rearMinDs: r3(Math.min(...rear.map((r) => r.r1s - r.s))),
        rearPlayerV: r3(rear[rear.length - 1].v), rearRivalV: r3(rear[rear.length - 1].r1v),
      },
    };
  },
};


export const WORLD = [wall, bump, press, slipstream, crash];
