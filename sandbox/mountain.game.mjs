#!/usr/bin/env node
// Sunset Pass in-game views (real chase camera, post FX, HUD hidden): the autopilot player is teleported
// to each listed s:x, the camera settles, then a shot. Optional free-camera views (camera at track
// (s, x, h) looking at (s + ds, lx, ly)). Writes <out>_<label>.png and a contact sheet <out>_sheet.jpg.
//   node sandbox/mountain.game.mjs --list "1300:0,2010:0" [--cams "2030:-3:3:40:-30:8"] --out shots/env-mountain/g
//   cams item = s:x:h:ds:lx:ly
import { execFileSync } from 'node:child_process';
import { parseArgs, withPage } from '../tools/lib.mjs';

const a = parseArgs(process.argv.slice(2));
const out = String(a.out ?? 'shots/env-mountain/g');
const split = (v) => String(v ?? '').split(',').filter(Boolean).map((t) => t.split(':').map(Number));
const files = [];
const res = await withPage(async (page, h) => {
  await h.goto(`/?race=mountain&seed=${a.seed ?? 3}&autopilot=1&manual=1${a.q ?? ''}`, { timeout: 120000 });
  await page.evaluate(() => { const u = document.getElementById('ui'); if (u) u.style.visibility = 'hidden'; });
  await h.step(Number(a.pre ?? 480));
  const info = [];
  for (const [s, x = 0] of split(a.list)) {
    await page.evaluate(([S, X]) => window.__br.teleport(0, S - 25, X), [s, x]);
    await h.step(Number(a.settle ?? 75));
    const file = `${out}_${s}.png`;
    await h.shot(file);
    files.push(file);
    info.push(await page.evaluate(() => { const p = window.__br.session().player; return { s: Math.round(p.s), x: +p.x.toFixed(1) }; }));
  }
  for (const [s, x, hh, ds, lx, ly] of split(a.cams)) {
    await page.evaluate(([S, X, H, DS, LX, LY]) => {
      const br = window.__br, t = br.session().track, rig = br.app.rig;
      const P = t.toWorld(S, X, H, rig.camera.position.clone()), L = t.toWorld(S + DS, LX, LY, P.clone());
      rig.override((cam) => { cam.position.copy(P); cam.lookAt(L); cam.fov = 60; cam.updateProjectionMatrix(); return true; }, 0);
    }, [s, x, hh, ds, lx, ly]);
    await h.step(2);
    const file = `${out}_cam${s}_${x}.png`;
    await h.shot(file);
    files.push(file);
  }
  return { info, errors: (await h.errors()).slice(0, 10) };
}, { size: a.size ?? '1920x1080' });
console.log(JSON.stringify(res));
if (files.length) {
  execFileSync('python3', ['-c', `
import sys
from PIL import Image
fs = sys.argv[2:]; cols = 2 if len(fs) > 1 else 1; w = 640; h = 360
rows = (len(fs) + cols - 1) // cols
sheet = Image.new('RGB', (w * cols, h * rows))
for i, f in enumerate(fs):
    sheet.paste(Image.open(f).convert('RGB').resize((w, h)), ((i % cols) * w, (i // cols) * h))
sheet.save(sys.argv[1], quality=72)
`, `${out}_sheet.jpg`, ...files]);
  console.log(`sheet ${out}_sheet.jpg`);
}
