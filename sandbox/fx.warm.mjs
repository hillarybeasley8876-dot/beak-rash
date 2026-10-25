// Shader warm-up check: which programs link after the loading screen (GO burst), at the first KO, WRECKED
// and SHOWTIME?
//   node sandbox/fx.warm.mjs [track] [quality]   -> per phase: new programs (+ the objects using them)
// Expected: everything (fx.particles.*, the weather layer, the subject mask fx.subjectMask, shadow-depth
// variants) links behind the loading screen; any program linked after the intro is reported as `late` and
// the script exits with code 1.
// The instrument samples the renderer's program list every animation frame, so a program that only compiles
// when it is first drawn cannot slip through; the phase tag is sampled before it changes, so the programs of
// the loading screen are never counted as late.
import { withPage } from '../tools/lib.mjs';

const [track = 'coast', quality = 'high'] = process.argv.slice(2);
/** The r4 presets (SPEC §14-§19): they must not link a program of their own. */
const R4 = ['trickTrail', 'trickLand', 'parry', 'throwTrail', 'policeDown', 'fishSplash', 'truckDust', 'gooseFeathers', 'fruit', 'quack'];

function instrument() {
  const br = window.__br, r = br.app.renderer;
  const W = { seen: new Set((r.info.programs ?? []).map((p) => p.id)), log: [], tag: 'boot' };
  const sample = () => {
    const progs = r.info.programs ?? [];
    const fresh = progs.filter((p) => !W.seen.has(p.id));
    for (const p of fresh) W.seen.add(p.id);
    if (fresh.length) W.log.push({ tag: W.tag, phase: br.session()?.phase ?? '-', progs: fresh });
  };
  // Every animation frame: a program created between two frames is still caught.
  const tick = () => {
    sample();
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  W.setTag = (t) => { sample(); W.tag = t; };
  window.__warm = W;
}

function report() {
  const W = window.__warm, r = window.__br.app.renderer, names = new Map();
  window.__br.app.scene.traverse((o) => {
    for (const m of o.material ? [o.material].flat() : []) {
      const pr = r.properties.get(m)?.currentProgram;
      if (pr && !names.has(pr)) names.set(pr, `${o.name || o.type}|${m.name || m.type}`);
    }
  });
  return W.log.map((e) => ({ ...e, progs: e.progs.map((p) => names.get(p) ?? `?${p.name}`) }));
}

const tag = (page, t) => page.evaluate((x) => window.__warm.setTag(x), t);

await withPage(async (page, h) => {
  await h.goto(`/?race=${track}&seed=3&quality=${quality}&manual=1`);
  await page.evaluate(instrument);
  await h.controls({ throttle: 1 });
  await tag(page, 'intro');
  for (let i = 0; i < 80; i++) {
    const s = await h.snapshot();
    if (s.phase === 'racing') break;
    await h.step(15);
  }
  await tag(page, 'go');
  await h.step(150);
  await tag(page, 'ko');
  await page.evaluate(() => window.__br.fx.testKo());
  await h.step(120);
  await tag(page, 'wrecked');
  await page.evaluate(() => window.__br.fx.testWrecked());
  await h.step(400);
  // A real SHOWTIME on three pinned low-HP rivals (rise look, impact window, chain KOs).
  await tag(page, 'ult');
  await page.evaluate(() => {
    const br = window.__br;
    const c = br.combat;
    if (!c) return;
    const rivals = br.session().riders.filter((r) => !r.isPlayer && r.mode === 'racing').slice(0, 3);
    rivals.forEach((r, i) => { c.pin(r.id, 8 + i * 6, (i - 1) * 2.2, true); c.set(r.id, { hp: 20 }); });
    c.set(0, { sp: 100 });
    c.cast(0, 4);
  });
  await h.step(10);
  await page.evaluate(() => window.__br.combat?.unpin());
  await h.step(230);
  // The r4 presets: every one of them must reuse the particle pool's program.
  await tag(page, 'r4');
  await page.evaluate((names) => {
    for (const n of names) window.__br.fx.burst(n, { level: 2 }, { ahead: 8 });
  }, R4);
  await h.step(60);
  // A rainy race: the weather layer must be compiled behind its own loading screen, not in the race.
  await tag(page, 'intro');
  await page.evaluate(() => window.__br.start({ trackId: 'coast', seed: 3, weather: 'rain' }));
  for (let i = 0; i < 80; i++) {
    const s = await h.snapshot();
    if (s.phase === 'racing') break;
    await h.step(15);
  }
  await tag(page, 'rain');
  await h.step(120);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  // The rain phase is only worth something if the weather layer really is up in that race.
  const layer = await page.evaluate(() => {
    const o = window.__br.app.scene.getObjectByName('fx:weather');
    return o ? { visible: o.visible, kind: o.userData.kind ?? null } : null;
  });
  const log = await page.evaluate(report);
  for (const e of log) console.log(`${e.tag.padEnd(8)} ${e.phase.padEnd(9)} ${e.progs.join(', ').slice(0, 300)}`);
  const late = log.filter((e) => e.tag !== 'intro' && e.tag !== 'boot');
  const fxLate = late.filter((e) => e.progs.some((p) => /fx\.|\?ShaderMaterial/.test(p)));
  console.log(JSON.stringify({ track, quality, layer, late: late.reduce((n, e) => n + e.progs.length, 0), fxLate: fxLate.length, errors: await h.errors() }));
  if (late.length) process.exitCode = 1;
  if (!layer || !layer.visible || layer.kind !== 'rain') {
    console.error('the rain race has no visible weather layer — the rain phase proves nothing');
    process.exitCode = 1;
  }
}, { size: '1280x720' });
