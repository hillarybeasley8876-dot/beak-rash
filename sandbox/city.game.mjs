#!/usr/bin/env node
// In-game contact sheet for the city (all units, HUD, post-processing): start a race, teleport the
// player along the track, grab the game view at each s and tile the frames into one PNG.
//   node sandbox/city.game.mjs --out shots/env-city/sheet.png [--s 60,400,…] [--q "&stub=fx"] [--x 1.8]
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, withPage } from '../tools/lib.mjs';

const a = parseArgs(process.argv.slice(2));
const list = String(a.s ?? '60,300,520,700,790,960,1150,1300,1450,1580,1760,2000,2240,2380,2780,3250').split(',').map(Number);
const out = a.out ?? 'shots/env-city/game-sheet.png';
const x = Number(a.x ?? 1.8);
await withPage(async (page, h) => {
  await h.goto(`/?race=${a.track ?? 'city'}&seed=${a.seed ?? 1}&traffic=0&police=0${a.q ?? ''}`);
  await h.controls({ throttle: 1 });
  await h.step(400);
  const shots = [];
  for (const s of list) {
    await h.eval(`(() => { const b = window.__br; const ss = b.session(); if (!ss) return; for (const r of ss.riders) { if (r.isPlayer) b.teleport(r.id, ${s}, ${x}); else b.teleport(r.id, ${s} + 6 + r.id * 4, ((r.id % 3) - 1) * 3); } })()`);
    await h.step(Number(a.settle ?? 45));
    shots.push((await page.screenshot()).toString('base64'));
  }
  const errors = await h.errors();
  const cols = Number(a.cols ?? 4);
  const html = `<body style="margin:0;background:#111;display:grid;grid-template-columns:repeat(${cols},1fr);gap:2px">${shots
    .map((b64, i) => `<div style="position:relative"><img style="width:100%;display:block" src="data:image/png;base64,${b64}"><span style="position:absolute;left:4px;top:4px;background:#000;color:#fff;font:12px monospace;padding:1px 4px">s=${list[i]}</span></div>`)
    .join('')}</body>`;
  const rows = Math.ceil(shots.length / cols);
  const width = Number(a.width ?? 1600);
  await page.setViewportSize({ width, height: Math.round((width / cols) * (9 / 16) * rows) + rows * 2 });
  await page.setContent(html);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await page.screenshot({ path: out, fullPage: true });
  console.log(JSON.stringify({ out, errors: errors.slice(0, 10), console: h.logs.slice(0, 10) }, null, 1));
}, { size: a.size ?? '1280x720' });
