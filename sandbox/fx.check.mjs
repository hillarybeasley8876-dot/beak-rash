// fx check script (critics rerun it): particle presets, post looks and the KO cinematic as frame strips.
//   node sandbox/fx.check.mjs [bursts|ko|ult|speed|gallery|closeups|all] [--q "&stub=world"] [--size 1280x720]
//   ko: --variant ko|chain|wrecked, frame strip every 50 ms (3 frames at 60 fps) + cine event log.
//   real: --kind swing|ult — the real combat path (pinned rivals via __br.combat).
//   gallery: sandbox page (no race) — every preset on a grid, day and night, at 3 moments.
//   ride: drift L1→L3 sparks, release boost streaks, hop + landing dust (traffic/rivals out of the way).
//   replay: sandbox page (no race) — the real KoCine on stand-in riders: --variant ko|chain|short|wrecked|ult|lite.
import { BASE, parseArgs, withPage } from '../tools/lib.mjs';

const a = parseArgs(process.argv.slice(2));
const mode = a._[0] ?? 'bursts';
const q = typeof a.q === 'string' ? a.q : '';
const OUT = 'shots/fx';

async function race(h, extra = '') {
  await h.goto(`/?race=coast&seed=3&traffic=0&police=0${q}${extra}`);
  await h.controls({ throttle: 1 });
  await h.step(420);
}

async function bursts(h) {
  await race(h);
  const names = await h.eval(() => window.__br.fx.presets);
  const groups = [
    ['hit', 'hitHeavy', 'crit', 'block'], ['dust', 'grass', 'sand', 'dirt'], ['landing', 'splash', 'oil', 'smoke'],
    ['feathers', 'fur', 'debris', 'poof'], ['confetti', 'coin', 'sparkle', 'crate'], ['driftPop', 'boost', 'koFeathers', 'shockwave'],
  ];
  for (const [gi, group] of groups.entries()) {
    await h.page.evaluate((g) => {
      g.forEach((name, i) => window.__br.fx.burst(name, { level: 2 }, { ahead: 7, lateral: (i - 1.5) * 2.2 }));
    }, group);
    await h.controls({ throttle: 0 });
    await h.step(6);
    await h.shot(`${OUT}/burst-${gi}-a.png`);
    await h.step(18);
    await h.shot(`${OUT}/burst-${gi}-b.png`);
    await h.step(60);
  }
  console.log(JSON.stringify({ names: names.length, stats: await h.eval(() => window.__br.fx.stats()) }));
}

async function strip(h, tag, frames, every = 3) {
  for (let i = 0; i < frames; i += every) {
    await h.step(every);
    await h.shot(`${OUT}/${tag}-${String(i + every).padStart(3, '0')}.png`);
  }
}

async function logCine(h) {
  await h.eval(() => {
    const br = window.__br;
    window.__cineLog = [];
    const t0 = br.app.clock.realTime;
    for (const ev of ['cine:ko', 'cine:ult', 'combat:ko', 'ult:start', 'ult:impact']) {
      br.app.bus.on(ev, (e) => window.__cineLog.push({ ev, t: +(br.app.clock.realTime - t0).toFixed(3), phase: e.phase, chain: e.chain, victim: e.victim, attacker: e.attacker }));
    }
  });
}

async function cineReport(h) {
  return h.eval(() => ({ log: window.__cineLog, scale: window.__br.app.clock.scale, stats: window.__br.fx.stats() }));
}

async function ko(h) {
  const variant = typeof a.variant === 'string' ? a.variant : 'ko';
  await race(h);
  await logCine(h);
  await h.page.evaluate((v) => {
    const fx = window.__br.fx;
    if (v === 'wrecked') fx.testWrecked({});
    else if (v === 'chain') fx.testKo({ chainAfter: 0.3 });
    else fx.testKo({});
  }, variant);
  await strip(h, `ko-${variant}`, Number(a.frames ?? 108), Number(a.every ?? 3));
  console.log(JSON.stringify(await cineReport(h)));
}

async function ult(h) {
  await race(h);
  await logCine(h);
  await h.eval(() => window.__br.fx.testUlt());
  await strip(h, 'ult', Number(a.frames ?? 200), 5);
  console.log(JSON.stringify(await cineReport(h)));
}

/** Real combat path (needs the combat unit): pinned rivals with low HP, a real heavy swing or SHOWTIME. */
async function real(h) {
  const kind = typeof a.kind === 'string' ? a.kind : 'swing';
  await race(h);
  await logCine(h);
  await h.page.evaluate((k) => {
    const br = window.__br;
    const c = br.combat;
    const s = br.session();
    const p = s.player;
    const rivals = s.riders.filter((r) => !r.isPlayer).slice(0, 3);
    if (k === 'ult') {
      for (const r of s.riders) if (!r.isPlayer) c.pin(r.id, -30 - r.id * 3, 0, true);
      rivals.forEach((r, i) => { c.pin(r.id, 8 + i * 6, (i - 1) * 2.2, true); c.set(r.id, { hp: 20 }); });
      window.__swing = () => { c.set(p.id, { sp: 100 }); c.cast(p.id, 4); };
    } else {
      const r = rivals[0];
      c.pin(r.id, 0.4, 1.1, true);
      c.set(r.id, { hp: 4 });
      c.give(p.id, 'pan', 5);
      window.__swing = () => c.swing(p.id, 1, true);
    }
  }, kind);
  await h.step(kind === 'ult' ? 40 : 10);
  await h.page.evaluate(() => window.__swing());
  await strip(h, `real-${kind}`, Number(a.frames ?? 150), Number(a.every ?? 5));
  console.log(JSON.stringify(await cineReport(h)));
}

async function speed(h) {
  await race(h);
  await h.eval(() => { const p = window.__br.session().player; p.boostTime = 2; p.boostPower = 0.35; p.speed = 26; });
  await h.step(20);
  await h.shot(`${OUT}/speed-boost.png`);
}

async function ride(h) {
  await race(h, '&rivals=goose');
  await h.eval(() => {
    const br = window.__br;
    const s = br.session();
    window.__rideLog = [];
    for (const ev of ['rider:drift', 'rider:boost', 'rider:hop', 'rider:land']) {
      br.app.bus.on(ev, (e) => { if (e.riderId === s.player.id) window.__rideLog.push({ ev, f: br.frames, ...e }); });
    }
    for (const r of s.riders) if (!r.isPlayer) br.teleport(r.id, s.player.s - 60, 0);
    br.teleport(s.player.id, s.player.s, 3.2);
  });
  await h.step(30);
  await h.controls({ throttle: 1, steer: -0.32, drift: true });
  for (const [tag, frames] of [['drift-a', 36], ['drift-l1', 30], ['drift-l2', 50], ['drift-l3', 40]]) {
    await h.step(frames);
    await h.shot(`${OUT}/ride-${tag}.png`);
  }
  await h.controls({ throttle: 1, steer: 0.1, drift: false });
  for (const [tag, frames] of [['boost-a', 6], ['boost-b', 14], ['boost-c', 30]]) {
    await h.step(frames);
    await h.shot(`${OUT}/ride-${tag}.png`);
  }
  await h.controls({ throttle: 1, steer: 0 });
  await h.press('hop');
  for (const [tag, frames] of [['hop-a', 4], ['hop-air', 12], ['land-a', 10], ['land-b', 8], ['land-c', 14]]) {
    await h.step(frames);
    await h.shot(`${OUT}/ride-${tag}.png`);
  }
  console.log(JSON.stringify(await h.eval(() => window.__rideLog)));
}

async function gallery(h) {
  for (const night of [0, 1]) {
    await h.page.goto(`${BASE}/sandbox/fx.html?manual=1&panel=0&night=${night}`, { waitUntil: 'load' });
    await h.page.waitForFunction(() => window.fxSandbox?.ready === true);
    await h.page.evaluate(() => window.fxSandbox.gallery());
    for (const [i, frames] of [4, 10, 24].entries()) {
      await h.page.evaluate((n) => window.fxSandbox.step(n), frames);
      await h.shot(`${OUT}/gallery-${night ? 'night' : 'day'}-${i}.png`);
    }
  }
}

async function replay(h) {
  const variant = typeof a.variant === 'string' ? a.variant : 'ko';
  await h.page.goto(`${BASE}/sandbox/fx.html?manual=1&panel=0`, { waitUntil: 'load' });
  await h.page.waitForFunction(() => window.fxSandbox?.ready === true);
  await h.page.evaluate((v) => window.fxSandbox.replay(v), variant);
  const frames = Number(a.frames ?? 120);
  const every = Number(a.every ?? 6);
  for (let i = 0; i < frames; i += every) {
    await h.page.evaluate((n) => window.fxSandbox.step(n), every);
    await h.shot(`${OUT}/replay-${variant}-${String(i + every).padStart(3, '0')}.png`);
  }
  console.log(JSON.stringify(await h.page.evaluate(() => window.fxSandbox.replayInfo())));
}

const CLOSEUPS = [
  ['hit', 'hitHeavy', 'crit', 'block'], ['dust', 'grass', 'sand', 'dirt'], ['landing', 'splash', 'oil', 'smoke'],
  ['feathers', 'fur', 'debris', 'poof'], ['confetti', 'coin', 'sparkle', 'crate'], ['driftPop', 'boost', 'koFeathers', 'dizzy'],
  ['scales', 'crumbs', 'leaves', 'keys'], ['fries', 'heal', 'sparks', 'hopDust'],
];

async function closeups(h) {
  const only = typeof a.group === 'string' ? Number(a.group) : -1;
  await h.page.goto(`${BASE}/sandbox/fx.html?manual=1&panel=0`, { waitUntil: 'load' });
  await h.page.waitForFunction(() => window.fxSandbox?.ready === true);
  for (const [gi, names] of CLOSEUPS.entries()) {
    if (only >= 0 && gi !== only) continue;
    await h.page.evaluate((n) => window.fxSandbox.closeup(n), names);
    for (const [i, frames] of [3, 9, 30].entries()) {
      await h.page.evaluate((n) => window.fxSandbox.step(n), frames);
      await h.shot(`${OUT}/close-${gi}-${i}.png`);
    }
    await h.page.evaluate(() => window.fxSandbox.step(240));
  }
}

await withPage(async (page, h) => {
  h.page = page;
  const run = { bursts, ko, ult, speed, gallery, closeups, real, replay, ride };
  if (mode === 'all') for (const fn of Object.values(run)) await fn(h);
  else await run[mode](h);
  const errors = ['gallery', 'closeups', 'replay'].includes(mode) ? [] : await h.errors();
  console.log(JSON.stringify({ errors, logs: h.logs.slice(0, 12) }, null, 1));
}, { size: a.size ?? '1280x720' });
