#!/usr/bin/env node
// r5 acceptance: wt-look (the water town's lane reads as 青石板 flagstones across its whole width; the drizzle is not
// a dark grey wash). Lead-owned, read-only for workers. Chase stills at four spots, the rider in the middle of the
// lane: in three columns of the lane below the horizon, the mean luminance and the density of slab joints (pixels
// whose local gradient is strong). Before r5: the left of the lane was dark asphalt-grey (mean 60–73 of 255, joints
// 0.014–0.025), only the middle third showed slabs.
//   node tools/r5/wt-look.mjs [--shots shots/r5-wt-look]
import fs from 'node:fs';
import { parseArgs } from '../lib.mjs';
import { expect, finish, noErrors, withPage } from '../r4/accept-lib.mjs';

const a = parseArgs(process.argv.slice(2));
const SHOTS = String(a.shots ?? 'shots/r5-wt-look');
fs.mkdirSync(SHOTS, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function metrics(page, png) {
  return page.evaluate(async (b64) => {
    const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
    const c = new OffscreenCanvas(bmp.width, bmp.height), g = c.getContext('2d');
    g.drawImage(bmp, 0, 0);
    const { data, width: W, height: H } = g.getImageData(0, 0, bmp.width, bmp.height);
    const L = (x, y) => { const i = (y * W + x) * 4; return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]; };
    const col = (a0, a1) => {
      let n = 0, sum = 0, edges = 0;
      for (let y = Math.round(H * 0.72); y < Math.round(H * 0.97) - 1; y++) {
        for (let x = Math.round(W * a0); x < Math.round(W * a1) - 1; x++) {
          const v = L(x, y); n++; sum += v;
          if (Math.abs(v - L(x + 1, y)) + Math.abs(v - L(x, y + 1)) > 24) edges++;
        }
      }
      return { mean: sum / n, edges: edges / n };
    };
    let all = 0, n = 0;
    for (let y = 0; y < H; y += 4) for (let x = 0; x < W; x += 4) { all += L(x, y); n++; }
    return { left: col(0.18, 0.36), mid: col(0.36, 0.45), right: col(0.56, 0.66), frame: all / n };
  }, png.toString('base64'));
}

async function tour(page, h, weather) {
  await h.goto(`/?race=watertown&seed=3&manual=1&traffic=0&police=0&weather=${weather}`, { timeout: 120000 });
  await page.evaluate(() => { const b = window.__br; b.manual(true); for (let i = 0; i < 40 && b.session()?.phase !== 'racing'; i++) b.step(30); });
  await page.addStyleTag({ content: '.br-ui, #ui { display: none !important; }' });
  const len = await page.evaluate(() => window.__br.session().track.length);
  const out = [];
  for (const f of [0.08, 0.4, 0.56, 0.9]) {
    const s = Math.round(len * f);
    await page.evaluate((at) => {
      const b = window.__br, ss = b.session();
      for (const r of ss.riders) { if (r.isPlayer) b.teleport(r.id, at, 0); else b.teleport(r.id, at + 600 + r.id * 9, 0); }
      b.step(45);
    }, s);
    await sleep(250);
    const png = await page.screenshot();
    fs.writeFileSync(`${SHOTS}/watertown-${weather}-${s}.png`, png);
    out.push({ s, ...(await metrics(page, png)) });
  }
  return out;
}

await withPage(async (page, h) => {
  const clear = await tour(page, h, 'clear');
  const fmt = (m) => `${m.mean.toFixed(0)}/${m.edges.toFixed(3)}`;
  const rows = clear.map((x) => `s${x.s} L ${fmt(x.left)} M ${fmt(x.mid)} R ${fmt(x.right)}`).join(' · ');
  expect(clear.every((x) => x.left.mean >= 80 && x.mid.mean >= 80), `the lane is light stone, not dark asphalt (mean ≥ 80 left and middle: ${rows})`);
  expect(clear.every((x) => x.left.edges >= 0.02 && x.mid.edges >= 0.02), 'slab joints show across the lane (joint density ≥ 0.02 left and middle)');
  expect(clear.every((x) => x.left.mean / Math.max(1, x.mid.mean) >= 0.75 && x.left.mean / Math.max(1, x.mid.mean) <= 1.33), 'the paving is even across the lane (left / middle luminance within 0.75–1.33)');
  const rain = await tour(page, h, 'rain');
  const cm = clear.reduce((q, x) => q + x.frame, 0) / clear.length, rm = rain.reduce((q, x) => q + x.frame, 0) / rain.length;
  expect(rm >= cm * 0.8, `the drizzle is soft, not a dark wash (frame luminance ${rm.toFixed(0)} vs clear ${cm.toFixed(0)}, ≥ 80 %)`);
  expect(rain.every((x) => x.left.edges >= 0.015), `the wet slabs still show their joints in the drizzle (${rain.map((x) => x.left.edges.toFixed(3)).join(', ')})`);
  await noErrors(h, 'watertown look');
}, { size: '1920x1080' });

finish('r5-wt-look');
