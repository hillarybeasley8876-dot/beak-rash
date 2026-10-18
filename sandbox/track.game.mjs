#!/usr/bin/env node
// In-game contact sheet: start a race, teleport the player along the track, grab the real game
// view (all units, HUD included) at each s, and tile the frames into one PNG.
//   node sandbox/track.game.mjs --out shots/track/game-sheet.png [--s 60,400,…] [--q "&stub=fx"]
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, withPage } from '../tools/lib.mjs';

const a = parseArgs(process.argv.slice(2));
const list = String(a.s ?? '60,420,640,900,1030,1370,1500,1640,1815,1990,2200,2450,2700,2850,3080,3290').split(',').map(Number);
const out = a.out ?? 'shots/track/game-sheet.png';
await withPage(async (page, h) => {
  await h.goto(`/?race=coast&seed=${a.seed ?? 1}&traffic=0&police=0${a.q ?? ''}`);
  await h.controls({ throttle: 1 });
  await h.step(400);
  const shots = [];
  for (const s of list) {
    await h.eval(`(() => { const b = window.__br; const ss = b.session(); if (!ss) return; for (const r of ss.riders) { if (r.isPlayer) b.teleport(r.id, ${s}, 1.8); else b.teleport(r.id, ${s} + 6 + r.id * 4, ((r.id % 3) - 1) * 3); } })()`);
    await h.step(45);
    shots.push((await page.screenshot()).toString('base64'));
  }
  const errors = await h.errors();
  const cols = 4;
  const html = `<body style="margin:0;background:#111;display:grid;grid-template-columns:repeat(${cols},1fr);gap:2px">${shots
    .map((b64, i) => `<div style="position:relative"><img style="width:100%;display:block" src="data:image/png;base64,${b64}"><span style="position:absolute;left:4px;top:4px;background:#000;color:#fff;font:12px monospace;padding:1px 4px">s=${list[i]}</span></div>`)
    .join('')}</body>`;
  const rows = Math.ceil(shots.length / cols);
  await page.setViewportSize({ width: 1600, height: Math.round((1600 / cols) * (9 / 16) * rows) + rows * 2 });
  await page.setContent(html);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await page.screenshot({ path: out, fullPage: true });
  console.log(JSON.stringify({ out, errors: errors.slice(0, 10), console: h.logs.slice(0, 10) }, null, 1));
}, { size: '1280x720' });
