#!/usr/bin/env node
// r7 audit: does each skill FEEL like it did something? (SPEC §24, r7 feel contract). Lead-owned, read-only for workers.
// One CONTROL ride and one CAST ride per skill, from the same seed and the same formation (seven rivals around the
// player, their own skills switched off). The only difference between the rides is the player's cast at t0, so
// whatever differs afterwards is what the skill did:
//   screen — share of the 1280×720 frame that changes (python tools/r7/feel_diff.py), at +0.1 … +3.5 s
//   HUD    — words and numbers that appear only in the CAST ride
//   sound  — sounds heard only in the CAST ride
//   sim    — each rival's metres lost / HP lost / statuses gained, the player's metres gained (vs CONTROL)
// Writes <out>/<skill>/cast-<frame>.jpg + run.json, <out>/control-{a,b}/…, then <out>/summary.json and sheets.
//   node tools/r7/feel.mjs [--only id,id] [--out F:/dev/beak-rash-out/r7/feel] [--par 3] [--base http://127.0.0.1:5300]
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { parseArgs } from '../lib.mjs';

const a = parseArgs(process.argv.slice(2));
const OUT = path.resolve(String(a.out ?? 'F:/dev/beak-rash-out/r7/feel'));
const BASE = String(a.base ?? process.env.BR_BASE ?? 'http://127.0.0.1:5300');
const PAR = Math.max(1, Number(a.par ?? 3));
const LINEUP = 'goose,cat,capybara,shiba,pigeon,penguin,seagull';
const PAGE = `/?race=coast&seed=7&traffic=0&police=0&manual=1&intro=0&rivals=${LINEUP}`;
/** Where the seven rivals ride at t0 (metres ahead, metres to the right of the player). */
const FORM = [[7, 0.8], [12, -1.6], [20, 0.4], [2.5, 2.4], [-3, -2.2], [-8, 0.6], [32, -0.5]];
/** Frames after t0 at which the screen is captured and the riders sampled (60 frames = 1 s). */
const MARKS = [6, 18, 36, 72, 144, 210];
fs.mkdirSync(OUT, { recursive: true });
const { chromium } = createRequire(new URL('../../package.json', import.meta.url))('playwright');

/** In-page kit: the formation, the cast, the samples, the HUD words and the sounds. */
function install(FORM) {
  const br = window.__br;
  const S = () => br.session(), P = () => S().player, C = () => br.combat;
  const clamp = (v) => Math.max(-1, Math.min(1, v));
  const step = (n) => {
    for (let i = 0; i < n; i++) {
      const p = P(), sc = br.app.input.scripted;
      if (sc) sc.steer = clamp(-p.x * 0.9 - p.vx * 0.12);
      br.step(1);
      k.frame++;
    }
  };
  const k = { frame: 0, t0Ms: 0, texts: [], events: [] };
  br.manual(true);
  for (let i = 0; i < 3000 && S().phase !== 'racing'; i++) br.step(1);
  br.setControls({ throttle: 1 });
  step(90);
  const rivals = S().riders.filter((r) => !r.isPlayer);
  for (const r of rivals) { r.loadout.slots = []; r.loadout.ult = null; }   // their own kits stay quiet
  C().force({ crit: false, block: false, loose: false });
  C().clearItems();
  FORM.forEach(([ds, dx], i) => { if (rivals[i]) C().pin(rivals[i].id, ds, dx, true); });
  step(30);
  const v = P().speed;
  C().unpin();
  for (const r of rivals) r.speed = v;
  for (const r of S().riders) { r.hp = r.maxHp; r.statuses.length = 0; r.sp = 0; r.weapon = 'none'; r.invuln = 0; }
  // a race-like scene: the player is hurt (a heal shows), the three rivals ahead carry SP and one a weapon (something to
  // steal), and a few pickups lie on the road ahead (something to grab)
  P().hp = Math.round(P().maxHp * 0.7);
  rivals.slice(0, 3).forEach((r) => { r.sp = 40; });
  if (rivals[0]) C().give(rivals[0].id, 'pan', 6);
  const p0 = P();
  for (const [ds, dx, kind] of [[9, -1.2, 'coin'], [11, 1.2, 'coin'], [14, 0, 'fish'], [18, -2, 'coin']]) br.app.bus.emit('pickup:spawn', { kind, s: p0.s + ds, x: dx });
  C().resetCooldowns();
  step(6);
  for (const t of ['skill:cast', 'skill:hit', 'skill:denied', 'combat:hit', 'combat:element', 'combat:reaction', 'ult:start', 'ult:impact', 'combat:ko', 'rider:crash']) {
    br.app.bus.on(t, (p) => k.events.push([k.frame, t, JSON.parse(JSON.stringify(p, (key, val) => (key === 'pos' ? undefined : val)))]));
  }
  new MutationObserver((recs) => {
    for (const r of recs) {
      const n = r.type === 'characterData' ? r.target.parentElement : r.target;
      const els = [n, ...[...r.addedNodes].map((x) => (x.nodeType === 3 ? x.parentElement : x))];
      for (const el of els) {
        if (!(el instanceof HTMLElement)) continue;
        const t = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
        // the classes of the element and its two parents: a HUD line often carries its class on a wrapper
        const cls = [el, el.parentElement, el.parentElement?.parentElement].map((e) => (e ? String(e.className) : '')).filter(Boolean).join(' ');
        if (t && t.length <= 40) k.texts.push([k.frame, cls.slice(0, 120), t]);
      }
    }
  }).observe(document.body, { subtree: true, childList: true, characterData: true });
  k.frame = 0;
  k.t0Ms = performance.now();
  k.step = step;
  k.cast = (id) => {
    const p = P();
    const ult = id.startsWith('ult.') || id === 'pelican.ult';
    if (ult) { p.loadout.ult = id; p.sp = 100; } else p.loadout.slots[0] = id;
    C().resetCooldowns(0);
    return C().cast(0, ult ? 4 : 1);
  };
  k.sample = () => ({
    frame: k.frame, time: +S().time.toFixed(3),
    riders: S().riders.map((r) => ({ id: r.id, c: r.character, s: +r.s.toFixed(2), x: +r.x.toFixed(2), v: +r.speed.toFixed(2), hp: +r.hp.toFixed(1),
      sp: +r.sp.toFixed(1), w: r.weapon, coins: r.coins, st: r.statuses.filter((q) => q.time > 0).map((q) => q.id), mode: r.mode })),
  });
  k.finish = () => ({ texts: k.texts, events: k.events, sounds: (br.audio.trace?.() ?? []).filter((e) => e.ms >= k.t0Ms).map((e) => e.id) });
  /** The camera now, and where it sits relative to the player (shake, FOV kick and zoom are feedback too). */
  k.pose = () => {
    const cam = br.app.camera, p = P();
    const at = S().track.toWorld(p.s, p.x, p.y ?? 0, cam.position.clone());
    return { p: cam.position.toArray(), q: cam.quaternion.toArray(), fov: cam.fov, rel: [cam.position.x - at.x, cam.position.y - at.y, cam.position.z - at.z] };
  };
  /** The 3D frame drawn from `pose` (the CONTROL ride's camera) — nothing but the world, no HUD — as a JPEG. */
  k.world = (pose) => {
    const cam = br.app.camera;
    const save = { p: cam.position.clone(), q: cam.quaternion.clone(), fov: cam.fov };
    if (pose) { cam.position.fromArray(pose.p); cam.quaternion.fromArray(pose.q); cam.fov = pose.fov; }
    cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
    br.app.fx.render();
    const url = br.app.renderer.domElement.toDataURL('image/jpeg', 0.9);
    cam.position.copy(save.p); cam.quaternion.copy(save.q); cam.fov = save.fov; cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
    br.app.fx.render();
    return url;
  };
  window.__feel = k;
}

/** The CONTROL ride's camera at each mark: every other ride's world frames are drawn from it. */
let lockPoses = null;

async function ride(browser, dir, skill) {
  fs.mkdirSync(dir, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.goto(BASE + PAGE, { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction(() => window.__br?.ready === true, null, { timeout: 120000 });
    await page.evaluate(() => window.__br.audio.unlock?.());   // the sounds are traced once the audio runs
    await page.evaluate(install, FORM);
    const cast = skill ? await page.evaluate((id) => window.__feel.cast(id), skill) : null;
    const samples = [await page.evaluate(() => window.__feel.sample())];
    const poses = [];
    let at = 0;
    for (const m of MARKS) {
      await page.evaluate((n) => window.__feel.step(n), m - at);
      at = m;
      const tag = String(m).padStart(3, '0');
      await page.screenshot({ path: path.join(dir, `f${tag}.jpg`), type: 'jpeg', quality: 90 });
      const pose = await page.evaluate(() => window.__feel.pose());
      poses.push(pose);
      const url = await page.evaluate((lock) => window.__feel.world(lock), lockPoses ? lockPoses[poses.length - 1] : null);
      fs.writeFileSync(path.join(dir, `w${tag}.jpg`), Buffer.from(url.split(',')[1], 'base64'));
      samples.push(await page.evaluate(() => window.__feel.sample()));
    }
    const fin = await page.evaluate(() => window.__feel.finish());
    const run = { skill, cast, samples, poses, ...fin, errors };
    fs.writeFileSync(path.join(dir, 'run.json'), JSON.stringify(run));
    return run;
  } finally {
    await page.close();
  }
}

const allSkills = await (async () => {
  const src = fs.readFileSync(new URL('../../src/data/skills.ts', import.meta.url), 'utf8');
  return [...src.matchAll(/^  '([a-z]+\.[a-zA-Z]+)': /gm)].map((m) => m[1]);
})();
const skills = a.only ? String(a.only).split(',') : allSkills;
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
try {
  const first = await ride(browser, path.join(OUT, 'control-a'), null);
  lockPoses = first.poses;
  console.log(`rode control-a (camera poses recorded)${first.errors.length ? '  page errors: ' + first.errors.slice(0, 2).join(' | ') : ''}`);
  const jobs = [['control-b', null], ...skills.map((id) => [id, id])];
  const queue = [...jobs];
  await Promise.all(Array.from({ length: PAR }, async () => {
    for (let j = queue.shift(); j; j = queue.shift()) {
      const [name, id] = j;
      const t0 = Date.now();
      try {
        const run = await ride(browser, path.join(OUT, name), id);
        console.log(`rode ${name.padEnd(18)} ${((Date.now() - t0) / 1000).toFixed(0)} s${run.errors.length ? '  page errors: ' + run.errors.slice(0, 2).join(' | ') : ''}`);
      } catch (e) {
        console.log(`FAILED ${name}: ${String(e.message).split('\n')[0]}`);
      }
    }
  }));
} finally {
  await browser.close();
}
const py = spawnSync('python', [new URL('./feel_diff.py', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), OUT, ...skills], { stdio: 'inherit' });
process.exit(py.status ?? 1);
