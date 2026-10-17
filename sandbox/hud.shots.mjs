#!/usr/bin/env node
// HUD screenshot tour: node sandbox/hud.shots.mjs [--only a,b] [--size 1920x1080] [--live] [--out shots/ui-hud]
// Boots /sandbox/hud.html (stub units unless --live), races a bit, then poses/fires each scenario and
// screenshots it. Prints window.__br.errors at the end.
import { parseArgs, withPage } from '../tools/lib.mjs';

const a = parseArgs(process.argv.slice(2));
const size = a.size ?? '1920x1080';
const out = a.out ?? 'shots/ui-hud';
const only = a.only ? String(a.only).split(',') : null;
const q = `/sandbox/hud.html?race=${a.race ?? 'coast'}&seed=${a.seed ?? 4}${a.live ? '&live=1' : ''}&traffic=0&police=0`;

/** Each scenario: list of [kind, arg, opts] steps; 'step' advances N frames. Every scene starts from reset(). */
const P = (n) => ['pose', n];
const F = (n, o) => ['fire', n, o];
const S = (n) => ['step', n];
const E = (js) => ['eval', js];
const SCENES = {
  hud: [P('cruise'), P('rich'), S(20)],
  busy: [P('cruise'), P('rich'), P('drift2'), P('cooldowns'), P('weapon'), P('draft'), S(20)],
  boost: [P('cruise'), P('boost'), P('spfull'), S(20)],
  drift3: [P('cruise'), P('drift3'), P('lowhp'), P('slipper'), S(12)],
  denied: [P('cruise'), P('cooldowns'), F('denied', { slot: 2 }), S(6)],
  countdown3: [F('countdown', { n: 3 }), S(10)],
  go: [F('countdown', { n: 0 }), S(12)],
  skill: [P('cruise'), F('skill'), S(16)],
  rivalSkill: [E('__hud.place(1, -5, 2)'), F('rivalSkill'), S(14)],
  showtime: [P('spfull'), F('showtime'), S(32)],
  ko: [F('koStart'), S(27), F('koPeak', { chain: 1 }), S(26)],
  ko2: [F('koStart'), S(27), F('koPeak', { chain: 2 }), S(30)],
  wrecked: [F('crash', { cause: 'traffic' }), S(26)],
  busted: [F('busted'), S(40)],
  finish: [F('finish', { place: 1, time: 154.32 }), S(44)],
  callouts: [F('perfect'), S(10), F('drift', { level: 2 }), S(10), F('nearMiss'), S(4), F('nearMiss'), S(10)],
  onemore: [F('combo', { count: 3 }), S(16)],
  place: [F('placeChange', { from: 4, to: 3 }), S(12)],
  final: [F('finalStretch'), S(24)],
  tags: [E('__hud.place(1, 6, -2.5); __hud.place(2, 11, 2.2); __hud.place(3, 17, 0.4)'), F('angry', { id: 2 }), S(30)],
  taunt: [E('__hud.place(2, 9, 2)'), F('taunt', { id: 2 }), S(14)],
  damage: [E('__hud.place(1, 4, 1.5)'), F('hit', { dmg: 12 }), S(3), F('hit', { dmg: 19, crit: true }), S(3), F('hit', { me: true, dmg: 9 }), S(8)],
  police: [F('police', { level: 1 }), S(40)],
  threat: [E('__hud.place(3, -5, -2)'), F('angry', { id: 3 }), S(30)],
  intro: [E('__hud.freezeSim(true); __br.session().phase = "intro"'), S(40)],
};
const AFTER = {
  intro: 'window.__br.session().phase = "racing"; window.__hud.freezeSim(false)',
};

await withPage(async (page, h) => {
  await h.goto(q);
  await h.controls({ throttle: 1 });
  await h.step(300);
  for (const [name, steps] of Object.entries(SCENES)) {
    if (only && !only.includes(name)) continue;
    await page.evaluate(() => window.__hud.reset());
    for (const [kind, arg, opts] of steps) {
      if (kind === 'step') await h.step(arg);
      else if (kind === 'pose') await page.evaluate((n) => window.__hud.pose(n), arg);
      else if (kind === 'fire') await page.evaluate(([n, o]) => window.__hud.fire(n, o), [arg, opts ?? {}]);
      else if (kind === 'eval') await page.evaluate(arg);
    }
    await h.shot(`${out}/${name}.png`);
    if (AFTER[name]) await page.evaluate(AFTER[name]);
    console.log('shot', name);
  }
  const errors = await h.errors();
  console.log(JSON.stringify({ errors, console: h.logs.slice(0, 20) }, null, 1));
}, { size });
