// Cinematic telemetry + key frames for the KO director (fix round checks; critics may rerun it).
//   node sandbox/fx.cine.mjs --track coast|city|mountain --variant ko|edge|wrecked|ult|chain [--q "&stub=ui"]
// ko: real heavy swing on a pinned low-HP rival · edge: same with the victim 0.5 m inside the right
// bound (camera must stay inside) · wrecked: __br.fx.testWrecked · chain: testKo({chainAfter: .3})
// · ult: real SHOWTIME on 3 pinned low-HP rivals · ultko: the same plus a far rival KO'd by the player
// 0.45 s into the rise (the rise must survive; cine:ult start -> impact -> end in order).
// Prints a JSON summary (timeline, sim seconds to the release, victim displacement, eye bounds margin,
// victim NDC) with checks: headClear (KO head top below NDC y 0.70 in every hold frame), heroFrac (ult:
// nearest victim >= 25 % of the frame height), barsMin (ult: letterbox >= 0.95 impact -> release),
// protocol (ultko), subjectKod / namesKod (ult: the shot's subject and every cine:ko victim are riders combat KO'd). Key frames: shots/fx/cine-<track>-<variant>-<ms>.png (FX_OUT=<dir> moves them; sheet: sandbox/fx.grid.py).
import { parseArgs, withPage } from '../tools/lib.mjs';

const a = parseArgs(process.argv.slice(2));
const track = typeof a.track === 'string' ? a.track : 'coast';
const variant = typeof a.variant === 'string' ? a.variant : 'ko';
const q = typeof a.q === 'string' ? a.q : '&stub=ui';
const ULT = variant === 'ult' || variant === 'ultko';
const SHOTS = String(a.shots ?? (ULT ? '1000,1300,1600,1800,1950,2250,2700,3100' : '40,150,300,500,800,1100,1350,1600'))
  .split(',').map(Number);
const FRAMES = Number(a.frames ?? (ULT ? 240 : 120));
const OUT = process.env.FX_OUT ?? 'shots/fx';

function stage(v) {
  const br = window.__br;
  const s = br.session();
  const c = br.combat;
  const p = s.player;
  const log = (window.__cineLog = []);
  window.__t0 = br.app.clock.realTime;
  for (const ev of ['cine:ko', 'cine:ult', 'combat:ko', 'ult:impact']) {
    br.app.bus.on(ev, (e) => {
      log.push({ ev, t: +(br.app.clock.realTime - window.__t0).toFixed(3), phase: e.phase, chain: e.chain, victim: e.victim });
      if (ev === 'combat:ko' && c) c.unpin(e.victim);
      if (ev === 'ult:impact') window.__victims = e.victims;
    });
  }
  const rivals = s.riders.filter((r) => !r.isPlayer);
  if (v === 'wrecked') {
    window.__go = () => window.__br.fx.testWrecked({});
    return p.id;
  }
  if (v === 'chain') {
    window.__go = () => window.__br.fx.testKo({ chainAfter: 0.3 });
    return rivals.slice().sort((x, y) => Math.abs(x.s - p.s - 4) - Math.abs(y.s - p.s - 4))[0].id;
  }
  if (v === 'ult' || v === 'ultko') {
    for (const r of rivals) c.pin(r.id, -30 - r.id * 3, 0, true);
    rivals.slice(0, 3).forEach((r, i) => { c.pin(r.id, 8 + i * 6, (i - 1) * 2.2, true); c.set(r.id, { hp: 20 }); });
    const far = rivals[4];
    if (v === 'ultko') { c.unpin(far.id); br.teleport(far.id, p.s + 30, 3); }
    window.__go = () => {
      c.set(p.id, { sp: 100 });
      c.cast(p.id, 4);
      if (v === 'ultko') window.__koAt = br.app.clock.realTime + 0.45;
    };
    window.__far = far.id;
    return rivals[0].id;
  }
  const r = rivals[0];
  for (const o of rivals.slice(1)) c.pin(o.id, -40 - o.id * 3, 0, true);
  if (v === 'edge') {
    const b = s.track.bounds(p.s);
    br.teleport(p.id, p.s, b.right - 2.1);
    c.pin(r.id, 0.4, 1.1, true);
  } else c.pin(r.id, 0.4, 1.1, true);
  c.set(r.id, { hp: 4 });
  c.give(p.id, 'pan', 5);
  window.__go = () => c.swing(p.id, 1, true);
  return r.id;
}

function telemetry([victim, variant]) {
  const br = window.__br;
  const app = br.app;
  const s = br.session();
  const cam = app.camera;
  const V = cam.position.constructor;
  // Follow the latest KO'd rider (chains re-target the camera), or the first SHOWTIME victim.
  const lastKo = window.__cineLog.filter((e) => e.ev === 'combat:ko').pop();
  const id = (window.__victims && window.__victims[0]) ?? (variant === 'chain' && lastKo ? lastKo.victim : victim);
  const v = s.rider(id);
  const view = s.views.get(id);
  if (window.__koAt !== undefined && app.clock.realTime >= window.__koAt) { delete window.__koAt; br.ko(window.__far, s.player.id); }
  const ndc = (p) => { const k = p.clone().project(cam); return [+k.x.toFixed(2), +k.y.toFixed(2), k.z < 1]; };
  const body = view ? view.anchor('body', new V()) : null;
  const bike = view ? view.anchor('bike', new V()) : null;
  const head = view ? view.anchor('head', new V()) : null;
  // Projected height (fraction of the frame) of a rider: head top (+0.25 m) to the bike.
  const size = (vw) => {
    const ys = ['head', 'body', 'bike'].map((n) => vw.anchor(n, new V()));
    ys.push(ys[0].clone().setY(ys[0].y + 0.25));
    const p = ys.map((q) => q.project(cam).y);
    return +((Math.max(...p) - Math.min(...p)) / 2).toFixed(3);
  };
  const e = s.track.project(cam.position, v.s);
  const b = s.track.bounds(e.s);
  const all = (window.__victims ?? []).map((vid) => { const vw = s.views.get(vid); return vw ? ndc(vw.anchor('body', new V())) : null; });
  const sizes = (window.__victims ?? []).map((vid) => { const vw = s.views.get(vid); return vw ? size(vw) : 0; });
  // Key-frame clock: from the first cine:ko start, or from cine:ult start (rise + impact) for SHOTS.
  const k0 = (window.__cineLog.find((e) => (e.ev === 'cine:ko' && e.phase === 'start') || (e.ev === 'cine:ult' && e.phase === 'start')) ?? {}).t;
  const t = app.clock.realTime - window.__t0;
  return {
    t: +t.toFixed(3), kt: k0 === undefined ? null : +(t - k0).toFixed(3), sim: app.clock.simTime, scale: +app.clock.scale.toFixed(3),
    ko: br.fx.stats().cine.ko, pulse: { chroma: +br.fx.post.pulse.chroma.toFixed(4), flash: +br.fx.post.pulse.flash.toFixed(2), rush: +br.fx.post.speed.rush.toFixed(2), lines: +br.fx.post.speed.lines.toFixed(2) }, margin: +Math.min(b.right - e.x, e.x + b.left).toFixed(2),
    body: body && body.toArray(), bodyNdc: body && ndc(body), bikeNdc: bike && ndc(bike), all, sizes, mode: v.mode,
    headTop: head && ndc(head.clone().setY(head.y + 0.25)), bars: +br.fx.post.cine.letterbox.toFixed(2), cam: app.rig.mode,
  };
}

await withPage(async (page, h) => {
  await h.goto(`/?race=${track}&seed=3&traffic=0&police=0${q}`);
  await h.controls({ throttle: 1 });
  await h.step(420);
  const victim = await page.evaluate(stage, variant);
  await h.step(variant === 'ult' ? 40 : 10);
  await page.evaluate(() => { window.__t0 = window.__br.app.clock.realTime; if (window.__go) window.__go(); });
  const tel = [];
  const shots = [...SHOTS];
  for (let f = 0; f < FRAMES; f++) {
    await h.step(1);
    const row = await page.evaluate(telemetry, [victim, variant]);
    tel.push(row);
    if (shots.length && row.kt !== null && row.kt * 1000 >= shots[0]) await h.shot(`${OUT}/cine-${track}-${variant}-${String(shots.shift()).padStart(4, '0')}.png`);
  }
  const log = await page.evaluate(() => window.__cineLog);
  if (a.trace === 'size') for (const r of tel) if (r.kt !== null && r.cam === 'cinematic') console.log(r.kt, r.scale, JSON.stringify(r.sizes), JSON.stringify(r.all), JSON.stringify(r.headTop), r.bars);
  if (a.trace && a.trace !== 'size') for (const r of tel) if (r.kt !== null && r.kt < 2) console.log(r.kt, r.scale, JSON.stringify(r.bodyNdc), JSON.stringify(r.bikeNdc), r.margin, r.ko?.framing ?? '', a.trace === 'pulse' ? JSON.stringify(r.pulse) : r.ko?.scores ?? '');
  console.log(JSON.stringify(summary(tel, log)));
  console.log(JSON.stringify({ errors: await h.errors() }));
}, { size: a.size ?? '1280x720' });

function summary(tel, log) {
  const first = (ev, phase) => log.find((e) => e.ev === ev && (!phase || e.phase === phase))?.t ?? null;
  const start = first('cine:ult', 'impact') ?? first('cine:ko', 'start');
  const koEnd = log.find((e) => e.ev === 'cine:ko' && e.phase === 'end' && (start === null || e.t >= start))?.t;
  const release = koEnd ?? (ULT ? log.find((e) => e.ev === 'cine:ult' && e.phase === 'end')?.t : null) ?? null;
  const at = (t) => tel.find((r) => r.t >= t) ?? tel[tel.length - 1];
  const hold = tel.filter((r) => start !== null && release !== null && r.t >= start + 0.12 && r.t < release && r.cam === 'cinematic');
  const inFrame = (n) => n && n[2] && Math.abs(n[0]) < 0.8 && Math.abs(n[1]) < 0.8;
  const dist = (p, q2) => (p && q2 ? Math.hypot(p[0] - q2[0], p[1] - q2[1], p[2] - q2[2]) : null);
  const frac = (f) => (hold.length ? +(hold.filter(f).length / hold.length).toFixed(2) : null);
  const cut = hold[0];
  const last = hold[hold.length - 1];
  const ultPhases = log.filter((e) => e.ev === 'cine:ult').map((e) => e.phase).join(',');
  const kos = log.filter((e) => e.ev === 'combat:ko').map((e) => e.victim);
  const impactTo = tel.filter((r) => start !== null && release !== null && r.t >= start && r.t < release);
  return {
    track, variant, events: log, start, release,
    framing: tel.find((r) => r.ko)?.ko?.framing ?? null,
    simToRelease: start !== null && release !== null ? +(at(release).sim - at(start).sim).toFixed(3) : null,
    displacement: cut && last ? +dist(cut.body, last.body).toFixed(2) : null,
    minEyeMargin: hold.length ? Math.min(...hold.map((r) => r.margin)) : null,
    bodyInFrame: frac((r) => inFrame(r.bodyNdc)),
    bikeInFrame: frac((r) => inFrame(r.bikeNdc)),
    headClear: ULT ? undefined : frac((r) => !r.headTop || !r.headTop[2] || r.headTop[1] < 0.7),
    headTopMax: ULT || !hold.length ? undefined : Math.max(...hold.map((r) => (r.headTop ? r.headTop[1] : -1))),
    victimsInFrame: ULT && hold.length ? +(hold.reduce((n, r) => n + r.all.filter(inFrame).length, 0) / hold.length).toFixed(2) : undefined,
    heroFrac: ULT && hold.length ? Math.min(...hold.map((r) => Math.max(0, ...r.sizes))) : undefined,
    barsMin: ULT && impactTo.length ? Math.min(...impactTo.map((r) => r.bars)) : undefined,
    protocol: ULT ? ultPhases : undefined,
    protocolOk: ULT ? ultPhases === 'start,impact,end' : undefined,
    subjectKod: ULT && hold.length && kos.length ? frac((r) => kos.includes(r.ko?.subject)) : undefined,
    namesKod: ULT ? log.filter((e) => e.ev === 'cine:ko').every((e) => kos.includes(e.victim)) : undefined,
    scales: [0.1, 0.3, 0.5, 0.8, 1.1, 1.3, 1.5].map((t) => [t, start === null ? null : at(start + t).scale]),
  };
}
