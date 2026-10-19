#!/usr/bin/env node
// species/actors: shader programs compiled AFTER the GO frame (perf acceptance: rider variants must be warm by GO).
// Runs a real race (realtime), then fires every rider-owned variant: respawn fade + invuln pulse, pigeon ghost,
// doge glint, chill steam, swings (smear), stun stars, a KO cinematic and a wreck. Prints each new program with the
// object path that first used it ("rider:" paths are ours).
//   node tools/actors-programs.mjs [track=coast] [quality=high] [rivals=pigeon,shiba,capybara,cat,penguin,seagull,sloth]
import { withPage } from './lib.mjs';

const [track = 'coast', quality = 'high', rivals = 'pigeon,shiba,capybara,cat,penguin,seagull,sloth'] = process.argv.slice(2);

function install() {
  const br = window.__br, g = br.game, r = br.app.renderer;
  const P = { seen: new Set(), atGo: -1, fresh: [], label: 'boot' };
  const scan = () => {
    const progs = r.info.programs ?? [];
    const news = progs.filter((p) => !P.seen.has(p.id));
    if (!news.length) return;
    const paths = new Map();
    br.app.scene.traverse((o) => {
      const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      for (const m of mats) {
        const pr = r.properties.get(m).currentProgram;
        if (!pr || paths.has(pr.id)) continue;
        const path = [];
        for (let q = o; q && path.length < 6; q = q.parent) path.push(q.name || q.type);
        paths.set(pr.id, `${path.join('<')}|${m.type}|${m.name}`);
      }
    });
    for (const p of news) {
      P.seen.add(p.id);
      if (P.atGo >= 0) P.fresh.push({ label: P.label, what: paths.get(p.id) ?? `?${p.name}|${String(p.cacheKey).slice(0, 60)}` });
    }
  };
  const orig = g.frame.bind(g);
  g.frame = (raw) => {
    orig(raw);
    const s = br.session();
    if (s && P.atGo < 0 && (P.tl ??= []).length < 400) P.tl.push(`${s.phase[0]}${(r.info.programs ?? []).length}`);
    if (P.atGo < 0 && s && s.phase === 'racing') {
      scan();
      P.fresh.length = 0;
      P.atGo = (r.info.programs ?? []).length;
      P.warm = [...s.views.values()].map((v) => `${v.warm?.stage}/${v.warm?.waited}`).join(' ');
    }
    scan();
  };
  window.__progs = P;
}

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
await withPage(async (page, h) => {
  await h.goto(`/?race=${track}&seed=3&quality=${quality}&autopilot=1&police=0&rivals=${rivals}`, { timeout: 120000 });
  await page.evaluate(install);
  await page.waitForFunction(() => window.__progs.atGo >= 0, null, { timeout: 60000 });
  const step = async (label, fn, arg, ms) => {
    await page.evaluate((l) => { window.__progs.label = l; }, label);
    const res = await page.evaluate(fn, arg);
    await sleep(ms);
    return res;
  };
  const ids = await page.evaluate(() => Object.fromEntries(window.__br.session().riders.map((r) => [r.character, r.id])));
  await sleep(1500);
  const victim = ids.cat ?? 1;
  await step('respawn-fade', (v) => window.__br.ko(v, null), victim, 4500);
  for (const c of ['pigeon', 'shiba', 'capybara', 'cat', 'penguin', 'sloth', 'seagull']) {
    if (ids[c] === undefined) continue;
    await step(`skill:${c}`, (id) => {
      const cb = window.__br.combat;
      cb.resetCooldowns(id);
      cb.set(id, { sp: 100 });
      cb.cast(id, 1);
    }, ids[c], 900);
  }
  await step('swings', (all) => { for (const id of all) window.__br.combat.swing(id, 1, id % 2 === 0); }, Object.values(ids), 900);
  await step('stun', (all) => { for (const id of all) window.__br.combat.status(id, 'stun', 1.2); }, Object.values(ids), 1500);
  await step('player-skills', () => {
    const cb = window.__br.combat;
    for (const slot of [1, 2, 3]) { cb.resetCooldowns(0); cb.set(0, { sp: 100 }); cb.cast(0, slot); }
  }, null, 2500);
  const rival = ids.penguin ?? 2;
  await step('ko-cinematic', (v) => window.__br.ko(v, 0), rival, 4000);
  await step('wrecked', (a) => window.__br.ko(0, a), ids.seagull ?? 3, 5000);
  const out = await page.evaluate(() => ({ atGo: window.__progs.atGo, fresh: window.__progs.fresh, total: window.__br.app.renderer.info.programs.length }));
  if (process.env.TL) console.log('warm', await page.evaluate(() => window.__progs.warm), '\ntimeline', await page.evaluate(() => window.__progs.tl.join(' ')));
  if (process.env.DUMP) {
    const keys = await page.evaluate((n) => window.__br.app.renderer.info.programs.filter((p) => p.name === n).map((p) => `${p.id}: ${p.cacheKey}`), process.env.DUMP);
    for (const k of keys) console.log('KEY', k.replace(/,(false|true|0|1|),/g, (m) => m).slice(0, 900));
  }
  const ours = out.fresh.filter((f) => f.what.includes('rider:'));
  console.log(JSON.stringify({ track, quality, programsAtGo: out.atGo, total: out.total, afterGo: out.fresh.length, riderOwned: ours.length }));
  for (const f of out.fresh) console.log(`${f.what.includes('rider:') ? 'RIDER' : 'other'} [${f.label}] ${f.what.slice(0, 150)}`);
  const errs = await h.errors();
  if (errs.length) console.log('errors:', errs.slice(0, 5));
}, { size: '1280x720' });
