#!/usr/bin/env node
// r4 acceptance: w1-world-weather (SPEC §20 weather). Lead-owned, read-only for workers.
//   node tools/r4/w1-weather.mjs [--tracks coast,city,mountain,watertown,gobi]
// For each allowed (track, weather): Track.weather / Track.grip, the look moves the right way against the same track's
// clear build, rain adds puddles, a disallowed weather falls back to clear with a warning, 0 console errors; one still
// per combination for the lead's review (shots/r4-accept-weather/sheet.jpg).
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { parseArgs } from '../lib.mjs';
import { expect, finish, withPage } from './accept-lib.mjs';

const a = parseArgs(process.argv.slice(2));
const ALLOWED = {
  coast: ['clear', 'rain', 'dusk', 'fog'], city: ['clear', 'rain', 'fog'], mountain: ['clear', 'snow', 'fog', 'rain'],
  watertown: ['clear', 'rain', 'fog'], gobi: ['clear', 'dusk', 'fog'],
};
const DISALLOWED = { coast: 'snow', city: 'snow', mountain: 'dusk', watertown: 'snow', gobi: 'snow' };
const tracks = String(a.tracks ?? 'coast,city,mountain,watertown,gobi').split(',');
const OUT = 'shots/r4-accept-weather';
fs.mkdirSync(OUT, { recursive: true });
const stills = [];
const luma = (hex) => { const n = parseInt(hex.slice(1), 16); return 0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255); };
const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };

for (const id of tracks) {
  await withPage(async (page, h) => {
    const build = async (w) => {
      await h.goto(`/?race=${id}&seed=3&manual=1&traffic=0&police=0&weather=${w}`, { timeout: 120000 });
      return page.evaluate(() => {
        const b = window.__br;
        b.manual(true);
        b.setControls({ throttle: 1 });
        for (let i = 0; i < 40 && b.session()?.phase !== 'racing'; i++) b.step(30);
        b.step(240);
        const t = b.session().track;
        const puddles = t.features.filter((f) => f.kind === 'puddle').length;
        return { weather: t.weather ?? null, grip: t.grip ?? null, look: JSON.parse(JSON.stringify(t.look)), puddles, errors: b.errors.slice() };
      });
    };
    const shot = async (w) => {
      await page.addStyleTag({ content: '.br-ui, #ui { display: none !important; }' });
      const f = `${OUT}/${id}-${w}.png`;
      await h.shot(f);
      stills.push(f);
      return f;
    };
    const whiteShare = (f) => Number(execFileSync('python', ['-c',
      `from PIL import Image\nim=Image.open(r'${f}').convert('RGB').resize((320,180))\np=list(im.getdata())\nprint(sum(1 for c in p if min(c)>200)/len(p))`]).toString().trim());
    const clear = await build('clear');
    const clearShot = await shot('clear');
    expect(clear.weather === 'clear' && clear.grip === 1, `${id} clear: weather clear, grip 1 (${clear.weather}, ${clear.grip})`);
    for (const w of ALLOWED[id].filter((x) => x !== 'clear')) {
      const r = await build(w);
      const f = await shot(w);
      const g = w === 'rain' ? 0.85 : w === 'snow' ? 0.75 : 1;
      expect(r.weather === w && Math.abs((r.grip ?? 0) - g) < 0.011, `${id} ${w}: Track.weather ${r.weather}, grip ${r.grip} (want ${g})`);
      expect(r.errors.length === 0, `${id} ${w}: no console errors (${r.errors.slice(0, 1).join('')})`);
      if (w === 'fog') expect(r.look.fog.far <= clear.look.fog.far * 0.4, `${id} fog: fog far ${r.look.fog.far} ≤ 40 % of clear ${clear.look.fog.far}`);
      if (w === 'rain') {
        expect(r.puddles >= Math.max(3, clear.puddles * 2), `${id} rain: puddles ${clear.puddles} → ${r.puddles}`);
        expect(r.look.grade.saturation < clear.look.grade.saturation || luma(r.look.sky.top) < luma(clear.look.sky.top) - 4,
          `${id} rain: a greyer, darker look (sat ${clear.look.grade.saturation} → ${r.look.grade.saturation}, sky luma ${luma(clear.look.sky.top).toFixed(0)} → ${luma(r.look.sky.top).toFixed(0)})`);
      }
      if (w === 'snow') {
        const [tr, , tb] = rgb(r.look.grade.tint);
        expect(tb >= tr, `${id} snow: a cold grade tint (${r.look.grade.tint})`);
        const ws = whiteShare(f), wc = whiteShare(clearShot);
        expect(ws >= wc + 0.05, `${id} snow: snow-white surfaces in view (${(wc * 100).toFixed(1)} % → ${(ws * 100).toFixed(1)} %)`);
      }
      if (w === 'dusk') {
        const [sr, , sb] = rgb(r.look.sun.color);
        expect(r.look.sun.dir.y > -0.45 && sr - sb >= 40, `${id} dusk: a low warm sun (dir.y ${r.look.sun.dir.y.toFixed(2)}, ${r.look.sun.color})`);
      }
    }
    const bad = await build(DISALLOWED[id]);
    expect(bad.weather === 'clear' && bad.errors.length === 0, `${id}: disallowed '${DISALLOWED[id]}' falls back to clear without errors (${bad.weather})`);
  }, { size: '960x540' });
}

execFileSync('python', ['tools/thumb.py', ...stills, '-o', `${OUT}/sheet.jpg`, '--cols', '4', '--width', '1600'], { stdio: 'inherit' });
finish('w1-weather');
