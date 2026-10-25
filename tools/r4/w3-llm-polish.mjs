#!/usr/bin/env node
// r4 acceptance: w3-llm-polish (the 大模型限定款 must look wrong at a glance: from the race camera and in the garage).
// Lead-owned, read-only for workers. Same race (seed, grid, time) with bike=llm vs bike=roadbike: the bike region
// of the chase-camera frame must differ clearly; the garage turntable too. Keeps the llm bike's own checks green.
//   node tools/r4/w3-llm-polish.mjs [--min 0.1] [--garage 0.28]   (before the polish: race 2.1 %, garage 18.3 %)
import { parseArgs } from '../lib.mjs';
import { expect, finish, noErrors, withPage } from './accept-lib.mjs';

const a = parseArgs(process.argv.slice(2));
const MIN = Number(a.min ?? 0.1);
const GARAGE = Number(a.garage ?? 0.28);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Fraction of pixels whose RGB distance > 48 between two PNG screenshots (decoded in the page). */
async function diff(page, pa, pb) {
  return page.evaluate(async ([x, y]) => {
    const load = async (b64) => {
      const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
      const c = new OffscreenCanvas(bmp.width, bmp.height);
      const g = c.getContext('2d');
      g.drawImage(bmp, 0, 0);
      return g.getImageData(0, 0, bmp.width, bmp.height).data;
    };
    const A = await load(x), B = await load(y);
    let n = 0, d = 0;
    for (let i = 0; i < A.length; i += 4) {
      n++;
      if (Math.hypot(A[i] - B[i], A[i + 1] - B[i + 1], A[i + 2] - B[i + 2]) > 48) d++;
    }
    return d / n;
  }, [pa.toString('base64'), pb.toString('base64')]);
}

/** The chase-camera frame around the player on the grid, 1.5 s after GO, everything else frozen. */
async function raceShot(page, h, bike) {
  await h.goto(`/?race=coast&seed=3&manual=1&traffic=0&police=0&rivals=&bike=${bike}`, { timeout: 120000 });
  const box = await page.evaluate(() => {
    const b = window.__br;
    b.manual(true);
    for (let i = 0; i < 40 && b.session()?.phase !== 'racing'; i++) b.step(30);
    b.setControls({ throttle: 0, steer: 0, brake: 0 });
    b.step(90);
    const { camera, renderer } = b.app;
    const p = b.session().player;
    const V = camera.position.constructor;
    const w = b.session().track.toWorld(p.s, p.x, 0.55, new V()).project(camera);
    const r = renderer.domElement.getBoundingClientRect();
    return { x: r.left + (w.x * 0.5 + 0.5) * r.width, y: r.top + (-w.y * 0.5 + 0.5) * r.height, w: r.width, h: r.height };
  });
  await page.addStyleTag({ content: '.br-ui, #ui { display: none !important; }' });
  await sleep(400);
  const cw = Math.round(box.w * 0.2), ch = Math.round(box.h * 0.38);
  const clip = { x: Math.round(box.x - cw / 2), y: Math.round(box.y - ch * 0.62), width: cw, height: ch };
  return { png: await page.screenshot({ clip }), clip };
}

await withPage(async (page, h) => {
  const llm = await raceShot(page, h, 'llm');
  await h.shot('shots/r4-w3-llm-polish/accept-race-llm.png');
  const road = await raceShot(page, h, 'roadbike');
  await h.shot('shots/r4-w3-llm-polish/accept-race-road.png');
  const d = await diff(page, llm.png, road.png);
  expect(d >= MIN, `race camera: the llm bike differs from the roadbike in ${(d * 100).toFixed(1)} % of its region (≥ ${MIN * 100} %)`);
  await noErrors(h, 'race shots');
}, { size: '1280x720' });

await withPage(async (page, h) => {
  const shotGarage = async (bike) => {
    await h.goto('/?screen=garage');
    await page.waitForFunction(() => window.__br?.app?.ui?.screen === 'garage', null, { timeout: 30000 });
    await page.evaluate((id) => window.__br.app.save.update((d) => { if (!d.unlocks.includes('llm')) d.unlocks.push('llm'); d.bike = id; if (!d.bikes?.includes?.(id)) d.bikes?.push?.(id); }), bike);
    await page.evaluate(() => window.__br.app.ui.show('garage'));
    await sleep(2500);
    const el = await page.$('canvas.br-gar-canvas');
    const r = el ? await el.boundingBox() : null;
    return r ? page.screenshot({ clip: { x: r.x + r.width * 0.15, y: r.y + r.height * 0.15, width: r.width * 0.7, height: r.height * 0.7 } }) : null;
  };
  const a1 = await shotGarage('llm');
  const b1 = await shotGarage('roadbike');
  expect(!!a1 && !!b1, 'the garage turntable canvas is found');
  if (a1 && b1) {
    const d = await diff(page, a1, b1);
    expect(d >= GARAGE, `garage: the llm bike differs from the roadbike in ${(d * 100).toFixed(1)} % of the turntable (≥ ${GARAGE * 100} %)`);
  }
  await noErrors(h, 'garage shots');
}, { size: '1280x720' });

finish('w3-llm-polish');
