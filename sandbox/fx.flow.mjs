// Cinematic flow checks (fix round 2): settings.slowmo per kind and the race-ended latch.
//   node sandbox/fx.flow.mjs  -> one JSON line per case with pass/fail
// short/off: real SHOWTIME (impact time, 'ult' layer) + a real KO (release time); ended: race:end 0.5 s into
// a real SHOWTIME rise -> the late dive impact must not open an impact window (no cine:ult impact, no KO window).
import { withPage } from '../tools/lib.mjs';

function stage(mode) {
  const br = window.__br;
  const s = br.session();
  const c = br.combat;
  br.app.save.data.settings.slowmo = mode;
  const rivals = s.riders.filter((r) => !r.isPlayer);
  for (const r of rivals) c.pin(r.id, -30 - r.id * 3, 0, true);
  rivals.slice(0, 3).forEach((r, i) => { c.pin(r.id, 8 + i * 6, (i - 1) * 2.2, true); c.set(r.id, { hp: 20 }); });
  const log = (window.__flow = []);
  window.__t0 = br.app.clock.realTime;
  for (const ev of ['cine:ko', 'cine:ult', 'ult:impact']) {
    br.app.bus.on(ev, (e) => log.push(`${ev.split(':')[1]}${e.phase ? '/' + e.phase : ''}@${Math.round((br.app.clock.realTime - window.__t0) * 1000)}`));
  }
  c.set(s.player.id, { sp: 100 });
  c.cast(s.player.id, 4);
}

async function run(h, mode, endAt) {
  await h.goto('/?race=coast&seed=3&traffic=0&police=0&stub=ui');
  await h.controls({ throttle: 1 });
  await h.step(420);
  await h.eval(`(${stage})(${JSON.stringify(mode)})`);
  let ultMin = 1;
  let ultMax = 1;
  let windows = 0;
  for (let f = 0; f < 240; f++) {
    await h.step(1);
    const st = await h.eval('(() => { const b = window.__br; return { t: b.app.clock.realTime - window.__t0, ult: b.app.clock.getScale("ult"), ko: b.fx.stats().cine.ko }; })()');
    ultMin = Math.min(ultMin, st.ult);
    ultMax = Math.max(ultMax, st.ult);
    if (st.ko) windows++;
    if (endAt !== null && st.t >= endAt) {
      endAt = null;
      await h.eval('window.__br.app.bus.emit("race:end", { results: [] })');
    }
  }
  return { log: await h.eval('window.__flow'), ultMin: +ultMin.toFixed(2), ultMax: +ultMax.toFixed(2), koWindowFrames: windows, errors: await h.errors() };
}

const at = (log, key) => Number((log.find((e) => e.startsWith(key)) ?? '@NaN').split('@')[1]);

await withPage(async (page, h) => {
  const full = await run(h, 'full', null);
  const short = await run(h, 'short', null);
  const off = await run(h, 'off', null);
  const ended = await run(h, 'full', 0.5);
  const cases = {
    // Full: deep slow-mo under the cut-in, then the static top rushes by (acceptance r1: apex hang <= 0.3 s).
    full: { impact: at(full.log, 'ult/impact'), ultMax: full.ultMax, pass: at(full.log, 'ult/impact') > 1350 && at(full.log, 'ult/impact') < 1700 && full.ultMin < 0.3 && full.ultMax > 1.2 },
    short: { impact: at(short.log, 'ult/impact'), pass: at(short.log, 'ult/impact') < 1350 && short.ultMin >= 0.7 },
    off: { impact: at(off.log, 'ult/impact'), ultMin: off.ultMin, pass: at(off.log, 'ult/impact') < 1000 && off.ultMin === 1 },
    ended: { log: ended.log.join(' '), koWindowFrames: ended.koWindowFrames, pass: !ended.log.some((e) => e.startsWith('ult/impact')) && ended.koWindowFrames === 0 },
  };
  for (const [k, v] of Object.entries(cases)) console.log(JSON.stringify({ case: k, ...v }));
  const errors = [full, short, off, ended].flatMap((r) => r.errors);
  console.log(JSON.stringify({ errors: errors.slice(0, 5) }));
}, { size: '960x540' });
