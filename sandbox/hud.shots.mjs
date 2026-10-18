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
/** Assert: `js` (evaluated in the page) must contain every string in `want` (a failed check exits 1). */
const X = (js, ...want) => ['expect', js, want];
const CALLOUTS = `[...document.querySelectorAll('.co')].map((n) => [n.querySelector('.co-en')?.textContent, n.querySelector('.co-cn')?.textContent, n.querySelector('.co-x')?.textContent, n.classList.contains('down') ? 'down' : n.classList.contains('up') ? 'up' : ''].join('|')).join(' / ')`;
/** Visible taunt bubbles and how many overlap each other or a drawn name tag. */
const BUBBLES = `(() => {
  const vis = (n) => getComputedStyle(n).visibility !== 'hidden';
  const R = (n) => n.getBoundingClientRect();
  const hit = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  const bub = [...document.querySelectorAll('.tb')].filter(vis).map((n) => R(n.querySelector('.tb-box')));
  const tags = [...document.querySelectorAll('.nt')].filter((n) => vis(n) && +(n.style.opacity || 1) > 0.2).map((n) => R(n.querySelector('.nt-plate')));
  let bb = 0, bt = 0;
  bub.forEach((a, i) => { bub.forEach((b, j) => { if (j > i && hit(a, b)) bb++; }); tags.forEach((t) => { if (hit(a, t)) bt++; }); });
  return 'bubbles=' + bub.length + ' bubble-bubble=' + bb + ' bubble-tag=' + bt;
})()`;
const PACK = '__hud.place(1, 7, -1.2); __hud.place(2, 8, 0.6); __hud.place(3, 9.5, 2.0); __hud.place(4, 12, -0.4)';
const SCENES = {
  hud: [P('cruise'), P('rich'), S(20)],
  busy: [P('cruise'), P('rich'), P('drift2'), P('cooldowns'), P('weapon'), P('draft'), S(20)],
  boost: [P('cruise'), P('boost'), P('spfull'), S(20)],
  drift3: [P('cruise'), P('drift3'), P('lowhp'), P('slipper'), S(12)],
  denied: [P('cruise'), P('cooldowns'), F('denied', { slot: 2 }), S(6)],
  countdown3: [F('countdown', { n: 3 }), S(10)],
  go: [F('countdown', { n: 0 }), S(12)],
  launch: [F('countdown', { n: 0 }), F('launch', { power: 0.3 }), S(70), X(CALLOUTS, 'PERFECTSTART!|起步完美')],
  skill: [P('cruise'), F('skill'), S(16)],
  rivalSkill: [E('__hud.place(1, -5, 2)'), F('rivalSkill'), S(14)],
  showtime: [P('spfull'), F('showtime'), S(32)],
  ko: [F('koStart'), S(27), F('koPeak', { chain: 1 }), S(26)],
  ko2: [F('koStart'), S(27), F('koPeak', { chain: 2 }), S(30)],
  wrecked: [F('crash', { cause: 'traffic' }), S(26)],
  bandWreck: [
    F('skill'), S(6), F('crash', { cause: 'traffic' }), S(12), F('skill', { id: 'pelican.wing', slot: 3 }), S(4),
    X(`[...document.querySelectorAll('.brh-cutins > .ci')].map((n) => n.className + '@' + (n.style.opacity || 1)).join(' ')`, 'ci-wrecked'),
    X(`String([...document.querySelectorAll('.ci-band')].filter((n) => +(n.style.opacity || 1) > 0.05).length)`, '0'),
  ],
  busted: [F('busted'), S(40)],
  finish: [F('finish', { place: 1, time: 154.32 }), S(44)],
  callouts: [F('perfect'), S(10), F('drift', { level: 2 }), S(10), F('nearMiss'), S(4), F('nearMiss'), S(10)],
  onemore: [F('combo', { count: 3 }), S(16)],
  merge: [
    F('drift', { level: 1 }), S(8), F('drift', { level: 2 }), S(8), F('drift', { level: 3 }), S(4),
    X(CALLOUTS, 'DRIFT L3|三段!'),
    F('placeChange', { from: 5, to: 4 }), S(8), F('placeChange', { from: 4, to: 5 }), S(4),
    X(CALLOUTS, '▼ 5TH|被超了||down'),
    P('draftReady'), S(4), F('slingshot'), S(4), X(CALLOUTS, 'SLINGSHOT!|尾流弹射'),
  ],
  place: [F('placeChange', { from: 4, to: 3 }), S(12)],
  final: [F('finalStretch'), S(24)],
  achievement: [
    F('rivalSkill'), S(4), F('achievement', { id: 'first_ko' }), S(4), F('achievement', { id: 'goose' }), S(20),
    X(`[...document.querySelectorAll('.chip')].map((n) => n.textContent).join(' / ')`, '成就解锁 ACHIEVEMENT开饭了', '和平从来不是选项'),
  ],
  tags: [E('__hud.place(1, 6, -2.5); __hud.place(2, 11, 2.2); __hud.place(3, 17, 0.4)'), F('angry', { id: 2 }), S(30)],
  taunt: [E('__hud.place(2, 9, 2)'), F('taunt', { id: 2 }), S(14)],
  pack: [
    E(PACK), F('taunt', { id: 1 }), S(3), F('taunt', { id: 2 }), S(3), F('taunt', { id: 3 }), S(3),
    F('taunt', { id: 0, text: '叮叮叮！' }), S(16), X(BUBBLES, 'bubbles=2 ', 'bubble-bubble=0', 'bubble-tag=0'),
  ],
  packLater: [
    E(PACK), F('taunt', { id: 1 }), S(3), F('taunt', { id: 2 }), S(3), F('taunt', { id: 3 }), S(3),
    F('taunt', { id: 4 }), S(110), X(BUBBLES, 'bubbles=2 ', 'bubble-bubble=0', 'bubble-tag=0'),
  ],
  behind: [
    E('__hud.place(5, -12, 3); __hud.place(6, -15, 3.6)'), F('taunt', { id: 5 }), S(2), F('taunt', { id: 6 }), S(16),
    X(BUBBLES, 'bubbles=2 ', 'bubble-bubble=0'),
  ],
  damage: [E('__hud.place(1, 4, 1.5)'), F('hit', { dmg: 12 }), S(3), F('hit', { dmg: 19, crit: true }), S(3), F('hit', { me: true, dmg: 9 }), S(8)],
  police: [F('police', { level: 1 }), S(40)],
  threat: [E('__hud.place(3, -5, -2)'), F('angry', { id: 3 }), S(30)],
  incoming: [
    E('__hud.place(1, -16, 0.6)'), F('incoming', { owner: 1 }), S(12),
    X(`[...document.querySelectorAll('.eg-inc')].filter((n) => getComputedStyle(n).visibility !== 'hidden').map((n) => n.textContent).join()`, 'INCOMING!', '咸鱼鱼雷'),
  ],
  incomingEnd: [
    F('incoming', { owner: 1, id: 7 }), S(6), F('projEnd', { id: 7 }), S(12),
    X(`String([...document.querySelectorAll('.eg-inc')].filter((n) => getComputedStyle(n).visibility !== 'hidden').length)`, '0'),
  ],
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
      else if (kind === 'expect') {
        const got = String(await page.evaluate(arg));
        const bad = opts.filter((want) => !got.includes(want));
        console.log(`${bad.length ? 'FAIL' : 'PASS'} ${name}: ${got}${bad.length ? `  (missing ${bad.join(', ')})` : ''}`);
        if (bad.length) process.exitCode = 1;
      }
    }
    await h.shot(`${out}/${name}.png`);
    if (AFTER[name]) await page.evaluate(AFTER[name]);
    console.log('shot', name);
  }
  const errors = await h.errors();
  console.log(JSON.stringify({ errors, console: h.logs.slice(0, 20) }, null, 1));
}, { size });
