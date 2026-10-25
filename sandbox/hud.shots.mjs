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
const CALLOUTS = `$h('.co').map((n) => [n.querySelector('.co-en')?.textContent, n.querySelector('.co-cn')?.textContent, n.querySelector('.co-x')?.textContent, n.classList.contains('down') ? 'down' : n.classList.contains('up') ? 'up' : ''].join('|')).join(' / ')`;
/** Visible taunt bubbles and how many overlap each other or a drawn name tag. */
const BUBBLES = `(() => {
  const vis = (n) => getComputedStyle(n).visibility !== 'hidden';
  const R = (n) => n.getBoundingClientRect();
  const hit = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  const bub = $h('.tb').filter(vis).map((n) => R(n.querySelector('.tb-box')));
  const tags = $h('.nt').filter((n) => vis(n) && +(n.style.opacity || 1) > 0.2).map((n) => R(n.querySelector(getComputedStyle(n.querySelector('.nt-in')).display !== 'none' ? '.nt-plate' : '.nt-pip')));
  let bb = 0, bt = 0;
  bub.forEach((a, i) => { bub.forEach((b, j) => { if (j > i && hit(a, b)) bb++; }); tags.forEach((t) => { if (hit(a, t)) bt++; }); });
  const float = $h('.tb').filter((n) => vis(n) && !n.classList.contains('is-dock')).length;
  return 'bubbles=' + bub.length + ' float' + (float <= 2 ? '<=2' : '=' + float) + ' bubble-bubble=' + bb + ' bubble-tag=' + bt;
})()`;
/** Every skill band on stage: 'thin' (projectile corner band) or 'wide'. */
const BAND = `$h('.ci-band').map((n) => (n.classList.contains('is-thin') ? 'thin' : 'wide')).join()`;
const CO_ALPHA = `'co=' + ($h('.co-stack')[0].style.opacity || 1)`;
const QUIP = `(() => { const n = $h('.qp')[0]; return n ? (getComputedStyle(n).visibility !== 'hidden' ? 'on@' : 'off@') + n.textContent : '-'; })()`;
const PACK = '__hud.place(1, 7, -1.2); __hud.place(2, 8, 0.6); __hud.place(3, 9.5, 2.0); __hud.place(4, 12, -0.4)';
/** 成就解锁 chips on screen (opacity > 0.05) and their names. */
const ACH = `(() => { const on = $h('.chip-ach').filter((n) => +(n.style.opacity || 1) > 0.05); return 'ach=' + on.length + ' ' + on.map((n) => n.querySelector('.chip-en').textContent).join('|'); })()`;
/** SHOWTIME state of the cluster (.cl is-full / is-idle) and the ult diamond (is-ready / is-idle). */
const ULT = `(() => { const c = $h('.cl')[0], d = $h('.sk-d.ult')[0]; const f = (n, k) => n && n.classList.contains(k) ? k : '-'; return 'cl=' + f(c, 'is-full') + ',' + f(c, 'is-idle') + ' p=' + f(d, 'is-ready') + ',' + f(d, 'is-idle'); })()`;
/** Visible npc:say bubbles (police corgi) and their text. */
const NPC = `(() => { const on = $h('.tb.is-npc').filter((n) => getComputedStyle(n).visibility !== 'hidden'); return 'npc=' + on.length + ' ' + on.map((n) => n.textContent).join('|'); })()`;
/** WRECKED splash: tint layer present, and the title's exit offset (px). */
const WRECK = `(() => { const s = $h('.ci-wrecked')[0]; if (!s) return 'wrecked=0'; const t = s.querySelector('.sx-title'); const x = parseFloat((t ? t.style.transform : '').replace('translateX(', '')) || 0; return 'wrecked=1 cine=' + s.classList.contains('ci-cine') + ' tint=' + (s.querySelector('.sx-tint') ? 1 : 0) + ' away=' + Math.round(-x); })()`;
/** Pairwise overlaps between the visible boxes of two selectors (same selector = among themselves). */
const OVERLAPS = (a, b, label) => `(() => {
  const vis = (n) => { for (let e = n; e; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity < 0.05) return false; if (e.id === 'hud') break; } return true; };
  const A = $h('${a}').filter(vis).map((n) => n.getBoundingClientRect());
  const B = '${a}' === '${b}' ? A : $h('${b}').filter(vis).map((n) => n.getBoundingClientRect());
  let n = 0;
  A.forEach((x, i) => B.forEach((y, j) => { if (('${a}' !== '${b}' || j > i) && x.left < y.right - 2 && x.right > y.left + 2 && x.top < y.bottom - 2 && x.bottom > y.top + 2) n++; }));
  return '${label}: ' + A.length + '/' + B.length + ' overlaps=' + n;
})()`;
/** Name-tag level of detail: full plates on screen, and how many of them reach into the keep-clear zone. */
const LOD = `(() => {
  const W = innerWidth, H = innerHeight;
  const on = (n) => getComputedStyle(n).visibility !== 'hidden';
  const tags = $h('.nt').filter((n) => on(n) && +(n.style.opacity || 1) > 0.2);
  const full = tags.filter((n) => getComputedStyle(n.querySelector('.nt-in')).display !== 'none').map((n) => n.querySelector('.nt-plate').getBoundingClientRect());
  const inZone = full.filter((r) => r.right > W * 0.38 && r.left < W * 0.62 && r.bottom > H * 0.25 && r.top < H * 0.5).length;
  return 'tags=' + tags.length + ' full=' + full.length + (full.length <= 3 ? ' full<=3' : '') + ' inZone=' + inZone;
})()`;
/* ---- r4 (§14–§19) ---- */
/** The wanted badge on screen and its star count. */
const WANTED = `(() => { const n = $h('.brh-wanted').find((x) => getComputedStyle(x).visibility !== 'hidden'); return 'level=' + (n ? n.dataset.level : '-'); })()`;
/** The baton wind-up warning over the corgi. */
const BATON = `'baton=' + $h('.brh-baton-warn').filter((n) => getComputedStyle(n).visibility !== 'hidden').length`;
/** The r4 diagonal warning banner (roadblock / alliance / track event). */
const BANNER = `$h('.rb').map((n) => n.textContent).join('|')`;
/** The r4 cut-ins (the corgi going off duty, the 宿敌 card). */
const CUT = `$h('.ci-police .sx-cn, .ci-nemesis .sx-cn').map((n) => n.textContent).join('|')`;
/** The note chips (the bribe). */
const NOTES = `$h('.chip-note').map((n) => n.textContent).join('|')`;
/** The trick card. */
const TRICK = `$h('.brh-trick').map((n) => n.textContent).join('|')`;
/** The STYLE meter and its bank pop. */
const STYLE = `$h('.brh-style').map((n) => n.textContent).join('|') + ' bank=' + $h('.sty-bank').map((n) => n.textContent).join('|')`;
/** The throw hint on the chip column and the weapon's trait name. */
const THROW = `$h('.chip-hint').map((n) => n.textContent).join('|') + ' trait=' + $h('.wp-trait').map((n) => n.textContent).join('|')`;
/** The parry pop. */
const PARRY = `$h('.brh-parry').map((n) => n.textContent).join('|')`;
/** The name-tag marks (宿敌 / the alliance's chain link). */
const MARKS = `$h('.nt-mark.on').map((n) => n.textContent || 'chain').join('|')`;
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
  ko: [F('koStart'), S(27), F('koPeak', { chain: 1 }), S(26), X(OVERLAPS('.sx-title .rg', '.sx-card', 'title/cards'), 'overlaps=0')],
  ko2: [F('koStart'), S(27), F('koPeak', { chain: 2 }), S(30), X(OVERLAPS('.sx-title .rg', '.sx-card', 'title/cards'), 'overlaps=0')],
  koFallback: [F('koNoCine'), S(56), X(OVERLAPS('.sx-title .rg', '.sx-card', 'title/cards'), '9/2 overlaps=0')],
  koEnd: [
    F('koStart'), S(12), F('koPeak', { chain: 1 }), S(12), F('koEnd'), S(12),
    X(`'ko-on-stage=' + $h('.brh-cutins > .ci-ko').filter((n) => +(n.style.opacity || 1) > 0.05).length`, 'ko-on-stage=0'),
  ],
  wrecked: [F('crash', { cause: 'traffic' }), S(26), X(WRECK, 'wrecked=1 cine=false tint=1')],
  bandWreck: [
    F('skill'), S(6), F('crash', { cause: 'traffic' }), S(12), F('skill', { id: 'pelican.wing', slot: 3 }), S(4),
    X(`$h('.brh-cutins > .ci').map((n) => n.className + '@' + (n.style.opacity || 1)).join(' ')`, 'ci-wrecked'),
    X(`String($h('.ci-band').filter((n) => +(n.style.opacity || 1) > 0.05).length)`, '0'),
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
    X(ACH, 'ach=1 开饭了'), S(70), X(ACH, 'ach=1 和平从来不是选项'),
  ],
  // One 成就解锁 chip at a time: five at once → three in turn, then one "还有 2 个成就" summary.
  achQueue: [
    ...['first_ko', 'goose', 'double', 'thief', 'one_more'].map((id) => F('achievement', { id })), S(10), X(ACH, 'ach=1 开饭了'),
    S(76), X(ACH, 'ach=1 和平从来不是选项'), S(76), X(ACH, 'ach=1 一鱼两吃'), S(76), X(ACH, 'ach=1 还有 2 个成就'),
  ],
  // Full SP with nobody in reach (ultTarget false): grey "SHOWTIME 无目标", no READY; back to READY 0.3 s after a target.
  ultIdle: [P('cruise'), P('spIdle'), S(30), X(ULT, 'cl=is-full,is-idle p=-,is-idle')],
  ultBack: [P('cruise'), P('spIdle'), S(30), P('spTarget'), S(8), X(ULT, 'is-idle'), S(20), X(ULT, 'cl=is-full,- p=is-ready,-')],
  npcSay: [F('npcSay', { ds: 9, x: 2.2 }), S(16), X(NPC, 'npc=1 ')],
  npcGone: [F('npcSay', { ds: 9, x: 2.2 }), S(10), F('npcGone'), S(4), X(NPC, 'npc=0')],
  // WRECKED over its cinematic: no red wash (fx draws red edges); on cine end the lettering snaps out (≤ 0.15 s).
  wreckedCine: [
    F('koStart'), S(18), F('wreckedPeak'), S(20), X(WRECK, 'wrecked=1 cine=true tint=0'),
    F('koEnd'), S(4), X(WRECK, 'wrecked=1'), S(9), X(WRECK, 'wrecked=0'),
  ],
  tags: [E('__hud.place(1, 6, -2.5); __hud.place(2, 11, 2.2); __hud.place(3, 17, 0.4)'), F('angry', { id: 2 }), S(30)],
  taunt: [E('__hud.place(2, 9, 2)'), F('taunt', { id: 2 }), S(14)],
  pack: [
    E(PACK), F('taunt', { id: 1 }), S(3), F('taunt', { id: 2 }), S(3), F('taunt', { id: 3 }), S(3),
    F('taunt', { id: 0, text: '叮叮叮！' }), S(16), X(BUBBLES, 'bubbles=3 ', 'float<=2', 'bubble-bubble=0', 'bubble-tag=0'),
    X(QUIP, 'on@叮叮叮！'),
  ],
  packLater: [
    E(PACK), F('taunt', { id: 1 }), S(3), F('taunt', { id: 2 }), S(3), F('taunt', { id: 3 }), S(3),
    F('taunt', { id: 4 }), S(110), X(BUBBLES, 'float<=2', 'bubble-bubble=0', 'bubble-tag=0'),
  ],
  behind: [
    E('__hud.place(5, -12, 3); __hud.place(6, -15, 3.6)'), F('taunt', { id: 5 }), S(2), F('taunt', { id: 6 }), S(16),
    X(BUBBLES, 'bubbles=2 ', 'bubble-bubble=0'),
  ],
  quipDock: [
    P('cruise'), F('skill', { id: 'pelican.wing', slot: 3 }), E('__hud.place(5, -12, 3); __hud.place(6, -15, 3.6)'), S(4),
    F('taunt', { id: 5 }), S(2), F('taunt', { id: 6 }), S(16),
    X(QUIP, 'on@'), X(OVERLAPS('.qp-box', '.tb-box', 'quip/bubble'), '/2 overlaps=0'),
  ],
  chipStack: [
    E('__hud.place(1, 6, -2); __hud.place(2, 9, 2); __hud.place(3, 12, 0)'),
    F('rivalSkill', { id: 1 }), S(2), F('rivalSkill', { id: 2 }), S(2), F('rivalSkill', { id: 3 }), S(24),
    X(OVERLAPS('.chip-card', '.chip-card', 'chips'), '3/3 overlaps=0'),
  ],
  tagLod: [
    E('__hud.place(1, 5, -1.5); __hud.place(2, 7, 1.2); __hud.place(3, 9, -0.3); __hud.place(4, 12, 2.2); __hud.place(5, 15, -2.0); __hud.place(6, 19, 0.8)'),
    S(40), X(LOD, 'full<=3', 'inZone=0'),
    X(OVERLAPS('.nt-plate', '.nt-plate', 'plates'), 'overlaps=0'),
  ],
  damage: [E('__hud.place(1, 4, 1.5)'), F('hit', { dmg: 12 }), S(3), F('hit', { dmg: 19, crit: true }), S(3), F('hit', { me: true, dmg: 9 }), S(8)],
  police: [F('police', { level: 1 }), S(40)],
  threat: [E('__hud.place(3, -5, -2)'), F('angry', { id: 3 }), S(30)],
  incoming: [
    E('__hud.place(1, -16, 0.6)'), F('incoming', { owner: 1 }), S(12),
    X(`$h('.eg-inc').filter((n) => getComputedStyle(n).visibility !== 'hidden').map((n) => n.textContent).join()`, 'INCOMING!', '咸鱼鱼雷'),
  ],
  incomingEnd: [
    F('incoming', { owner: 1, id: 7 }), S(6), F('projEnd', { id: 7 }), S(12),
    X(`String($h('.eg-inc').filter((n) => getComputedStyle(n).visibility !== 'hidden').length)`, '0'),
  ],
  intro: [E('__hud.freezeSim(true); __br.session().phase = "intro"'), S(40)],
  skillThin: [P('cruise'), F('torpedo'), S(14), X(BAND, 'thin')],
  skillWide: [P('cruise'), F('skill', { id: 'pelican.gulp', slot: 2 }), S(14), X(BAND, 'wide')],
  bandCallout: [
    F('perfect'), S(6), F('torpedo'), S(14), X(CO_ALPHA, 'co=0'),
    S(40), X(CALLOUTS, 'PERFECT!|完美落地'), X(CO_ALPHA, 'co=1'),
  ],
  quip: [
    P('cruise'), F('skill', { id: 'pelican.torpedo', slot: 1 }), S(10), F('skill', { id: 'pelican.wing', slot: 3 }), S(16),
    X(QUIP, 'on@咸鱼快递，到付！'),
  ],
  quipKo: [F('koStart'), F('koNoCine'), S(30), X(QUIP, '@一口一个！'), F('koEnd'), S(60), X(QUIP, 'on@一口一个！')],
  quipHurt: [F('respawn'), S(16), X(QUIP, 'on@我的嘴……')],
  quipDeny: [
    P('cruise'), F('skill', { id: 'pelican.wing', slot: 3 }), S(12), F('denied', { slot: 4, reason: 'sp' }), S(4),
    X(`(() => { const q = $h('.qp-box')[0].getBoundingClientRect(); const hit = $h('.sk-deny').filter((n) => +getComputedStyle(n).opacity > 0.05).map((n) => n.getBoundingClientRect()).filter((d) => d.left < q.right && d.right > q.left && d.top < q.bottom && d.bottom > q.top); return 'deny-overlaps=' + hit.length; })()`, 'deny-overlaps=0'),
  ],
  sfx: [
    E('__hudSfx.length = 0'), F('placeChange', { from: 5, to: 4 }), S(4), F('placeChange', { from: 4, to: 3 }), S(4),
    X(`'ticks=' + __hudSfx.filter((id) => id === 'ui.confirm').length`, 'ticks=1'), S(24), F('placeChange', { from: 3, to: 4 }), S(4),
    F('finalStretch'), S(4), F('achievement', { id: 'goose' }), S(4), F('koNoCine'), S(50),
    X('__hudSfx.join()', 'ui.confirm', 'ui.back', 'ui.cutin', 'ui.unlock', 'ui.slash'),
  ],
  ticket: [
    E('__hudSfx.length = 0; Object.assign(__br.session().player, { mode: "busted", modeTime: 0 })'), F('busted'), S(30),
    X('__hudSfx.join()', 'ui.stamp'), S(160), X(`'counts=' + __hudSfx.filter((id) => id === 'ui.count').length`, 'counts=3'),
  ],
  // ---- r4 (§14–§19): the police, the tricks, the STYLE meter, the weapons, the rivals, the events ----
  r4Wanted: [F('wanted', { level: 2 }), S(20), X(WANTED, 'level=2')],
  r4Baton: [F('windup', { ds: 6, x: 1.6 }), S(6), X(BATON, 'baton=1')],
  r4Roadblock: [F('roadblock'), S(20), X(BANNER, '前方设卡')],
  r4PoliceDown: [F('policeDown'), S(20), X(CUT, '柯基下班了')],
  r4Bribe: [F('bribe'), S(20), X(NOTES, 'V我50')],
  r4Trick: [F('trick', { kind: 'backflip', points: 290 }), S(10), X(TRICK, '+290')],
  r4Style: [F('styleChain'), S(10), X(STYLE, '×2.25', '1,240')],
  r4StyleBank: [F('styleChain'), S(6), F('styleBank'), S(8), X(STYLE, '+12 SP')],
  r4Throw: [F('throwPick'), S(20), X(THROW, '投掷', '回旋镖')],
  r4Parry: [F('parry'), S(8), X(PARRY, '当')],
  r4Nemesis: [E('__hud.place(1, 8, 1.5)'), F('nemesis'), S(16), X(CUT, '宿敌'), X(MARKS, '宿敌')],
  r4Alliance: [
    E('__hud.place(1, 8, -1.5); __hud.place(2, 12, 1.5)'), F('alliance'), S(16),
    X(BANNER, '围剿'), X(MARKS, 'chain'),
  ],
  r4Betrayal: [F('alliance'), S(6), F('alliance', { phase: 'break', reason: 'betrayal' }), S(12), X(BANNER, '塑料友谊')],
  r4Event: [F('event', { kind: 'fishSpill' }), S(16), X(BANNER, '鱼车')],
};
const STUB_ONLY = new Set(['sfx', 'ticket']);
const AFTER = {
  ticket: 'window.__br.session().player.mode = "racing"',
  intro: 'window.__br.session().phase = "racing"; window.__hud.freezeSim(false)',
};

await withPage(async (page, h) => {
  await h.goto(q);
  // Only this sandbox's HUD (#hud): with --live the game's own HUD instance also lives in #ui.
  await page.evaluate(() => { window.$h = (sel) => [...(document.getElementById('hud') ?? document).querySelectorAll(sel)]; });
  await h.controls({ throttle: 1 });
  await h.step(300);
  for (const [name, steps] of Object.entries(SCENES)) {
    if (only && !only.includes(name)) continue;
    // The UI-sound spy hears every app.audio.sfx call: with --live the game's own HUD in #ui and the real fx /
    // audio units sound too, so the sound scenes only assert against stub units.
    if (a.live && STUB_ONLY.has(name)) {
      console.log(`SKIP ${name} (stub units only)`);
      continue;
    }
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
