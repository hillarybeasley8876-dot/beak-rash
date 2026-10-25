// Shader warm-up check: which programs link after GO (launch boost), at the first KO, WRECKED and SHOWTIME?
//   node sandbox/fx.warm.mjs [track] [quality]   -> per phase: new programs (+ the objects using them)
// Expected: everything (fx.particles.*, the subject mask fx.subjectMask, shadow-depth variants) links behind the
// loading screen; any program linked after GO is reported as `late` and the script exits with code 1.
import { withPage } from '../tools/lib.mjs';

const [track = 'coast', quality = 'high'] = process.argv.slice(2);

function instrument() {
  const br = window.__br, g = br.game, r = br.app.renderer;
  const W = { seen: new Set((r.info.programs ?? []).map((p) => p.id)), log: [], tag: 'boot' };
  const orig = g.frame.bind(g);
  g.frame = (raw) => {
    const a = performance.now();
    orig(raw);
    const ms = performance.now() - a;
    const progs = r.info.programs ?? [];
    const fresh = progs.filter((p) => !W.seen.has(p.id));
    for (const p of fresh) W.seen.add(p.id);
    if (fresh.length) W.log.push({ tag: W.tag, phase: br.session()?.phase ?? '-', ms: +ms.toFixed(1), progs: fresh });
  };
  window.__warm = W;
}

function report() {
  const W = window.__warm, r = window.__br.app.renderer, names = new Map();
  window.__br.app.scene.traverse((o) => {
    for (const m of o.material ? [o.material].flat() : []) {
      const pr = r.properties.get(m).currentProgram;
      if (pr && !names.has(pr)) names.set(pr, `${o.name || o.type}|${m.name || m.type}`);
    }
  });
  return W.log.map((e) => ({ ...e, progs: e.progs.map((p) => names.get(p) ?? `?${p.name}`) }));
}

await withPage(async (page, h) => {
  await h.goto(`/?race=${track}&seed=3&quality=${quality}&manual=1`);
  await page.evaluate(instrument);
  await h.controls({ throttle: 1 });
  await page.evaluate(() => { window.__warm.tag = 'intro'; });
  for (let i = 0; i < 80; i++) {
    const s = await h.snapshot();
    if (s.phase === 'racing') break;
    await h.step(15);
  }
  await page.evaluate(() => { window.__warm.tag = 'go'; });
  await h.step(150);
  await page.evaluate(() => { window.__warm.tag = 'ko'; window.__br.fx.testKo(); });
  await h.step(120);
  await page.evaluate(() => { window.__warm.tag = 'wrecked'; window.__br.fx.testWrecked(); });
  await h.step(400);
  // A real SHOWTIME on three pinned low-HP rivals (rise look, impact window, chain KOs).
  await page.evaluate(() => {
    const br = window.__br;
    const c = br.combat;
    window.__warm.tag = 'ult';
    if (!c) return;
    const rivals = br.session().riders.filter((r) => !r.isPlayer && r.mode === 'racing').slice(0, 3);
    rivals.forEach((r, i) => { c.pin(r.id, 8 + i * 6, (i - 1) * 2.2, true); c.set(r.id, { hp: 20 }); });
    c.set(0, { sp: 100 });
    c.cast(0, 4);
  });
  await h.step(10);
  await page.evaluate(() => window.__br.combat?.unpin());
  await h.step(230);
  const log = await page.evaluate(report);
  for (const e of log) console.log(`${e.tag.padEnd(8)} ${e.phase.padEnd(9)} ${String(e.ms).padStart(6)}ms ${e.progs.join(', ').slice(0, 300)}`);
  const late = log.filter((e) => e.tag !== 'intro');
  const fxLate = late.filter((e) => e.progs.some((p) => /fx\.|\?ShaderMaterial/.test(p)));
  console.log(JSON.stringify({ track, quality, late: late.reduce((n, e) => n + e.progs.length, 0), fxLate: fxLate.length, errors: await h.errors() }));
  if (late.length) process.exitCode = 1;
}, { size: '1280x720' });
