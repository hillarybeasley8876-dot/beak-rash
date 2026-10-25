#!/usr/bin/env node
// r4 acceptance: w3-world-polish (江南水乡 reads as a water town, the gobi has no stray slabs, the sea follows the
// weather). Lead-owned, read-only for workers.
//   node tools/r4/w3-world-polish.mjs [--shots shots/r4-w3-world-polish]
// Checks: watertown has no highway paint (no yellow centre lines in the road band of the chase camera at four spots)
// and canals along the road (water beyond an edge for ≥ 25 % of the track); no slab of bare grey geometry over the
// gobi's horizon (the lifted far plain at s ≈ 3375);
// the sea's colours follow rain / fog / dusk; budgets and a full race on both tracks; stills for the lead's review.
import fs from 'node:fs';
import { parseArgs } from '../lib.mjs';
import { expect, finish, noErrors, withPage } from './accept-lib.mjs';

const a = parseArgs(process.argv.slice(2));
const SHOTS = String(a.shots ?? 'shots/r4-w3-world-polish');
fs.mkdirSync(SHOTS, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Fraction of yellow-paint pixels in the road band ahead of the rider (PNG decoded in the page). */
async function yellowShare(page, png) {
  return page.evaluate(async (b64) => {
    const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
    const c = new OffscreenCanvas(bmp.width, bmp.height), g = c.getContext('2d');
    g.drawImage(bmp, 0, 0);
    const { data, width, height } = g.getImageData(0, 0, bmp.width, bmp.height);
    let n = 0, y = 0;
    for (let py = Math.round(height * 0.5); py < Math.round(height * 0.75); py++) {
      for (let px = Math.round(width * 0.2); px < Math.round(width * 0.8); px++) {
        if (px > width * 0.44 && px < width * 0.56) continue; // the rider's column (the player rides the right lane)
        const i = (py * width + px) * 4, r = data[i], gg = data[i + 1], b = data[i + 2];
        n++;
        if (r > 165 && gg > 130 && b < 110 && r - b > 85) y++;
      }
    }
    return y / n;
  }, png.toString('base64'));
}

/** Fraction of flat mid-grey pixels in the top half of the frame (sky, far hills): a slab of bare geometry. */
async function greyShare(page, png) {
  return page.evaluate(async (b64) => {
    const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
    const c = new OffscreenCanvas(bmp.width, bmp.height), g = c.getContext('2d');
    g.drawImage(bmp, 0, 0);
    const { data, width, height } = g.getImageData(0, 0, bmp.width, bmp.height);
    let n = 0, k = 0;
    for (let py = 0; py < height / 2; py += 2) {
      for (let px = 0; px < width; px += 2) {
        const i = (py * width + px) * 4, r = data[i] / 255, gg = data[i + 1] / 255, b = data[i + 2] / 255;
        const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), l = (mx + mn) / 2;
        const sat = mx === mn ? 0 : (mx - mn) / (1 - Math.abs(2 * l - 1));
        n++;
        if (sat < 0.12 && l > 0.3 && l < 0.7) k++;
      }
    }
    return k / n;
  }, png.toString('base64'));
}

async function open(page, h, id, extra = '') {
  await h.goto(`/?race=${id}&seed=3&manual=1&traffic=0&police=0${extra}`, { timeout: 120000 });
  await page.evaluate(() => {
    const b = window.__br;
    b.manual(true);
    for (let i = 0; i < 40 && b.session()?.phase !== 'racing'; i++) b.step(30);
  });
  await page.addStyleTag({ content: '.br-ui, #ui { display: none !important; }' });
}

/** Chase stills at fractions of the track: the yellow share of each, the worst draw calls / triangles. */
async function tour(page, h, id, fracs) {
  const len = await page.evaluate(() => window.__br.session().track.length);
  const out = [];
  for (const f of fracs) {
    const s = Math.round(len * f);
    const perf = await page.evaluate((at) => {
      const b = window.__br, ss = b.session();
      for (const r of ss.riders) { if (r.isPlayer) b.teleport(r.id, at, 3.2); else b.teleport(r.id, at + 600 + r.id * 9, 0); }
      b.step(45);
      const { renderer, scene, camera } = b.app;
      renderer.info.reset();
      renderer.render(scene, camera);
      return { calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
    }, s);
    await sleep(250);
    const png = await page.screenshot();
    fs.writeFileSync(`${SHOTS}/${id}-${s}.png`, png);
    out.push({ s, yellow: await yellowShare(page, png), grey: await greyShare(page, png), ...perf });
  }
  return out;
}

// the coast for reference: its highway paint is what the yellow detector finds
await withPage(async (page, h) => {
  await open(page, h, 'coast');
  const coast = await tour(page, h, 'coast', [0.2, 0.45]);
  expect(coast.some((x) => x.yellow > 0.002), `reference: the coast's centre lines are detected (${coast.map((x) => (x.yellow * 100).toFixed(2) + ' %').join(', ')})`);
  // the sea follows the weather
  const sea = {};
  for (const w of ['clear', 'rain', 'fog', 'dusk']) {
    await open(page, h, 'coast', `&weather=${w}`);
    sea[w] = await page.evaluate(() => {
      const o = window.__br.app.scene.getObjectByName('sea');
      const u = o?.material?.uniforms;
      if (!u) return null;
      const hsl = { h: 0, s: 0, l: 0 };
      u.uMid.value.getHSL(hsl);
      return { mid: u.uMid.value.getHexString(), deep: u.uDeep.value.getHexString(), s: hsl.s, l: hsl.l };
    });
  }
  expect(!!sea.clear && !!sea.rain && sea.rain.s <= sea.clear.s * 0.75, `rain: a greyer sea (saturation ${sea.rain?.s.toFixed(2)} vs clear ${sea.clear?.s.toFixed(2)})`);
  expect(!!sea.fog && sea.fog.s <= sea.clear.s * 0.75, `fog: a paler, greyer sea (saturation ${sea.fog?.s.toFixed(2)})`);
  expect(!!sea.dusk && (sea.dusk.mid !== sea.clear.mid || sea.dusk.deep !== sea.clear.deep), `dusk: the sea takes the evening colours (#${sea.dusk?.mid} vs #${sea.clear?.mid})`);
  await noErrors(h, 'coast reference');
}, { size: '1280x720' });

await withPage(async (page, h) => {
  await open(page, h, 'watertown', '&weather=clear'); // paint check in clear weather (rain greys the paint)
  const geo = await page.evaluate(() => {
    const t = window.__br.session().track;
    let water = 0, n = 0;
    for (let s = 0; s <= t.length; s += 5) { const b = t.bounds(s); n++; if (b.leftKind === 'water' || b.rightKind === 'water') water++; }
    return { water: water / n };
  });
  expect(geo.water >= 0.25, `watertown: canals along the road — water beyond an edge for ${(geo.water * 100).toFixed(0)} % of the track (≥ 25 %)`);
  const wt = await tour(page, h, 'watertown', [0.12, 0.38, 0.62, 0.86]);
  const worst = Math.max(...wt.map((x) => x.yellow));
  expect(worst < 0.001, `watertown: no highway centre lines in the road band (worst ${(worst * 100).toFixed(2)} %)`);
  expect(wt.every((x) => x.calls <= 420 && x.tris <= 1400000), `watertown: budget (${wt.map((x) => `${x.calls}/${Math.round(x.tris / 1000)}k`).join(' ')})`);
  await noErrors(h, 'watertown');
}, { size: '1280x720' });

await withPage(async (page, h) => {
  await open(page, h, 'gobi');
  const gb = await tour(page, h, 'gobi', [0.1, 0.4, 0.7, 0.9]);
  const slab = Math.max(...gb.map((x) => x.grey));
  expect(slab < 0.06, `gobi: no slab of bare grey geometry over the horizon (worst ${(slab * 100).toFixed(1)} % of the top half; ${gb.map((x) => `s${x.s} ${(x.grey * 100).toFixed(1)}`).join(', ')})`);
  expect(gb.every((x) => x.calls <= 420 && x.tris <= 1400000), `gobi: budget (${gb.map((x) => `${x.calls}/${Math.round(x.tris / 1000)}k`).join(' ')})`);
  await noErrors(h, 'gobi');
}, { size: '1280x720' });

// both still race to the end
for (const id of ['watertown', 'gobi']) {
  await withPage(async (page, h) => {
    await h.goto(`/?race=${id}&seed=4&manual=1&traffic=1&police=0&autopilot=1`, { timeout: 120000 });
    const run = await page.evaluate(async () => {
      const b = window.__br;
      b.manual(true);
      let ended = null;
      b.app.bus.on('race:end', (p) => { ended = p.results; });
      for (let i = 0; i < 400 && !ended; i++) { b.step(60); await new Promise((r) => setTimeout(r, 0)); }
      return { ended: !!ended, finished: ended ? ended.filter((r) => r.time !== null).length : 0 };
    });
    expect(run.ended && run.finished >= 6, `${id}: an autopilot race reaches race:end with ≥ 6 finishers (${run.finished})`);
    await noErrors(h, `${id} race`);
  }, { size: '1280x720' });
}

finish('w3-world-polish');
