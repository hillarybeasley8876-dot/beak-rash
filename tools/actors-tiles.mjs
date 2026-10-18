#!/usr/bin/env node
// species/actors: labelled tile sheets of scripted poses (cues, skills, weapons, crash) from the sandbox.
//   node tools/actors-tiles.mjs <set> <out.png> [cols=6] [tw=300] [th=330] [extra query]
// Each tile: [label, character, js to run after a reset, frames to step, view?]. Sets are defined below.
import fs from 'node:fs';
import path from 'node:path';
import { withPage } from './lib.mjs';

const RESET = `(() => { const A = window.__actors; for (const r of A.riders) { r.view.cues.clear(); r.state.action = null;
  r.state.statuses = []; r.state.boostTime = 0; r.state.mode = 'racing'; r.state.crash = null; } A.step(20); })()`;
const act = (k, side, dur, skill = null) => `window.__actors.action('${k}', ${side}, ${dur}, ${skill ? `'${skill}'` : 'null'})`;
const cue = (k, o = '{}') => `window.__actors.cue('${k}', ${o})`;
// [character, skill, sample time (s)]: skills are cast like combat does (__actors.skill: cue + short cast action).
const SKILLS = [
  ['goose', 'goose.honk', 0.36], ['capybara', 'capybara.chill', 0.9], ['cat', 'cat.spin', 0.36], ['shiba', 'shiba.doge', 0.55],
  ['pigeon', 'pigeon.ghost', 0.25], ['penguin', 'penguin.slide', 1.1], ['seagull', 'seagull.steal', 0.27], ['sloth', 'sloth.flash', 0.45],
  ['corgi', 'corgi.whistle', 0.4], ['pelican', 'pelican.gulp', 0.56], ['pelican', 'pelican.wing', 1.0], ['pelican', 'pelican.torpedo', 0.25],
];
const HOLDS = [['capybara', 'capybara.chill', [1.5, 3.0]], ['shiba', 'shiba.doge', [1.5, 2.6]], ['sloth', 'sloth.flash', [1.5, 2.6]],
  ['pigeon', 'pigeon.ghost', [0.9, 1.3]]];
const skill = (id) => `window.__actors.skill('${id}')`;
const W = ['saltfish', 'pan', 'leek', 'keyboard'];
const SETS = {
  weapons: W.flatMap((w) => [
    [`${w} ride chase`, 'pelican', `window.__actors.weapon('${w}')`, 4, 'chase'],
    [`${w} strike R`, 'pelican', `window.__actors.weapon('${w}');` + act('attack', 1, 0.32), 7, 'back'],
    [`${w} heavy R`, 'pelican', `window.__actors.weapon('${w}');` + act('heavy', 1, 0.52), 13, 'back'],
  ]),
  skills: SKILLS.flatMap(([c, id, t]) => [[`${id} 34`, c, skill(id), Math.round(t * 60), '34'], [`${id} back`, c, skill(id), Math.round(t * 60), 'back']]),
  holds: HOLDS.flatMap(([c, id, ts]) => ts.flatMap((t) => [[`${id} ${t}s 34`, c, skill(id), Math.round(t * 60), '34'],
    [`${id} ${t}s chase`, c, skill(id), Math.round(t * 60), 'chase']])),
  cues: [['ride', 'pelican', '', 1], ['bell', 'pelican', act('bell', 1, 0.55), 12], ['bell back', 'pelican', act('bell', 1, 0.55), 12, 'back'],
    ['taunt', 'pelican', cue('taunt', '{side:1}'), 30], ['victory', 'pelican', cue('victory'), 60], ['defeat', 'pelican', cue('defeat'), 60],
    ['land peak', 'pelican', cue('land'), 3], ['boost', 'pelican', cue('boost'), 5], ['hit', 'pelican', cue('hit', '{side:1}'), 5]],
  pelican: ['top', '34', 'front', 'back', 'chase', 'side'].flatMap((v) => [
    [`wing ${v}`, 'pelican', skill('pelican.wing'), 50, v], [`gulp ${v}`, 'pelican', skill('pelican.gulp'), 40, v],
  ]),
  crash: [0.15, 0.35, 0.6, 0.9, 1.3, 1.8, 2.2, 2.5].map((t) => [`crash ${t}s`, 'pelican', 'window.__actors.crash("ko")', Math.round(t * 60), 'side']),
};

const [set = 'cues', out = `shots/species/tiles-${set}.png`, cols = '6', tw = '300', th = '330', query = ''] = process.argv.slice(2);
const tiles = [];
await withPage(async (page, h) => {
  await h.goto(`/sandbox/actors.html?panel=0&speed=8&manual=1&bike=default&view=34&dist=3.0&ty=1.0&${query}`);
  let cur = '';
  for (const [label, c, js, frames, view = '34'] of SETS[set] ?? []) {
    if (c !== cur) { await page.evaluate((c) => window.__actors.set({ character: c }), c); cur = c; }
    await page.evaluate((v) => window.__actors.set({ view: v }), view);
    await page.evaluate(RESET);
    if (js) await page.evaluate(js);
    await page.evaluate((n) => window.__actors.step(n), frames);
    tiles.push({ label, b64: (await page.screenshot({ type: 'png' })).toString('base64') });
  }
  const errs = await h.errors();
  if (errs.length) console.log('errors:', errs.slice(0, 5));
}, { size: `${tw}x${th}` });
const n = Number(cols), rows = Math.ceil(tiles.length / n);
await withPage(async (page) => {
  const html = `<body style="margin:0;background:#222;display:grid;grid-template-columns:repeat(${n},${tw}px);gap:2px">${tiles
    .map((t) => `<div style="position:relative"><img src="data:image/png;base64,${t.b64}" width=${tw} height=${th}><span style="position:absolute;left:3px;top:1px;font:bold 12px sans-serif;color:#000;background:#fffa">${t.label}</span></div>`)
    .join('')}</body>`;
  await page.setContent(html);
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  await page.screenshot({ path: out, fullPage: true });
}, { size: `${n * (Number(tw) + 2)}x${rows * (Number(th) + 2)}` });
console.log(out);
