#!/usr/bin/env node
// r6 acceptance: presentation of Skills 2.0 (SPEC §24 — "要素拉满": every skill sounds and looks like itself, and the
// element reactions are called out). Lead-owned, read-only for workers. Before this job the 26 r6 skills played the
// generic 'skill.cast' / 'skill.hit' sounds and the generic sparkle, a shared ult played the pelican's SHOWTIME sound,
// and a reaction (蒸发 / 感电 …) had no sound, no burst and no callout at all.
//   node tools/r6/present.mjs [--only audio,visual]
//     audio  — an own cast sound per skill ('skill.<id>' in audio/sfx bank), a sting per reaction ('react.<id>'),
//              both heard in a race (window.__br.audio.trace())
//     visual — an own fx flair per skill (fx/react FLAIR_SKILLS), a burst per reaction (fx stats().reactionBursts),
//              the HUD's element glyph over the rider who carries it and the reaction callout at the victim, the
//              HOW TO 「新玩法」 card that explains the reactions
import { parseArgs } from '../lib.mjs';
import { expect, finish, noErrors, withPage } from '../r4/accept-lib.mjs';

const a = parseArgs(process.argv.slice(2));
const only = a.only ? String(a.only).split(',') : null;
const want = (g) => !only || only.includes(g);
const LINEUP = 'goose,cat,capybara,shiba,pigeon,penguin,seagull';
const URL = `/?race=coast&seed=7&traffic=0&police=0&manual=1&rivals=${LINEUP}`;
/** The reactions (SPEC §24) and how the HUD names them. */
const REACT_CN = { vaporize: '蒸发', melt: '融化', freeze: '冻结', electro: '感电', superconduct: '超导', overload: '超载', swirl: '扩散' };
/** Two casts that make each reaction on rider 1 (6 m ahead) and rider 2 (7 m ahead, 1.3 m aside). */
const PAIRS = {
  vaporize: ['pool.watergun', 'pool.firebreath'],
  melt: ['pool.firebreath', 'pool.icelance'],
  freeze: ['pool.watergun', 'pool.icelance'],
  electro: ['pool.watergun', 'pool.thunder'],
  superconduct: ['pool.icelance', 'pool.thunder'],
  overload: ['pool.firebreath', 'pool.thunder'],
  swirl: ['pool.firebreath', 'pool.tornado'],
};
/** A sample of the r6 skills cast in a race (the catalogue check covers the rest), and where to pin a rival for each. */
const SAMPLE = {
  'pool.firebreath': [5, 0.6], 'pool.icelance': [18, 1], 'pool.thunder': [25, -1], 'pool.tornado': [20, 0],
  'pool.pie': [10, 0], 'pool.ducks': [12, 0], 'bananacat.peel': [-4, 0], 'moodeng.bounce': [6, 0], 'hamster.violin': [4, 1],
};

/** In-page kit (as tools/r6/skills.mjs): cast a skill from the player's loadout at pinned rivals; collect events. */
function install() {
  const br = window.__br;
  const EV = ['skill:cast', 'skill:hit', 'skill:denied', 'combat:element', 'combat:reaction', 'ult:start', 'ult:impact'];
  const k = {
    ev: [],
    S: () => br.session(), P: () => br.session().player, R: (id) => br.session().rider(id), C: () => br.combat,
    of: (t, f) => k.ev.filter((e) => e.t === t && (!f || f(e.p))).map((e) => e.p),
    step(n = 1) {
      for (let i = 0; i < n; i++) {
        const p = k.P(), sc = br.app.input.scripted;
        if (sc) sc.steer = Math.max(-1, Math.min(1, -p.x * 0.9 - p.vx * 0.12));
        br.step(1);
      }
    },
    reset() {
      const s = k.S(), c = k.C();
      c.unpin(); s.obstacles.length = 0; c.clearItems();
      for (const r of s.riders) if (!r.isPlayer) c.pin(r.id, -60 - r.id * 12, 0, true);
      for (let i = 0; i < 900 && !(s.riders.every((r) => r.mode === 'racing') && c.counts().skills === 0); i++) k.step(1);
      c.force({ crit: false, block: false, loose: false });
      c.resetCooldowns();
      for (const r of s.riders) { r.hp = r.maxHp; r.statuses.length = 0; r.sp = 0; r.weapon = 'none'; r.invuln = 0; }
      br.setControls({ throttle: 0.75 });
      k.step(2);
      k.ev.length = 0;
    },
    cast(id, slot = 1) {
      const p = k.P();
      if (slot === 4) { p.loadout.ult = id; p.sp = 100; } else p.loadout.slots[slot - 1] = id;
      k.C().resetCooldowns(0);
      k.C().cast(0, slot);
    },
    /** Audio trace ids since `ms` (performance.now()). */
    heard: (ms) => br.audio.trace().filter((e) => e.ms >= ms).map((e) => e.id),
  };
  for (const t of EV) br.app.bus.on(t, (p) => k.ev.push({ t, p: JSON.parse(JSON.stringify(p)) }));
  window.__k = k;
  for (let i = 0; i < 3000 && k.S().phase !== 'racing'; i++) br.step(1);
  br.setControls({ throttle: 1 });
  for (let i = 0; i < 120; i++) k.step(1);
}

const run = (page, fn, arg) => page.evaluate(fn, arg).catch((err) => ({ ok: false, info: `threw: ${String(err.message).split('\n')[0]}` }));

// ---- the catalogue: every skill and every reaction has its own sound and its own look
await withPage(async (page, h) => {
  await h.goto('/?screen=menu&stub=world,sim,camera,actors,combat,race');
  const cat = await page.evaluate(async () => {
    const { SKILLS } = await import('/src/data/skills.ts');
    const data = await import('/src/data/skills.ts');
    const { SFX } = await import('/src/audio/sfx/bank.ts');
    const fx = await import('/src/fx/react/skills.ts');
    const ids = Object.keys(SKILLS);
    return {
      n: ids.length,
      noSound: ids.filter((id) => !(`skill.${id}` in SFX)),
      noFlair: Array.isArray(fx.FLAIR_SKILLS) ? ids.filter((id) => !fx.FLAIR_SKILLS.includes(id)) : ['(fx/react/skills.ts exports no FLAIR_SKILLS)'],
      sounds: Object.keys(SFX),
      reactCn: data.REACTION_CN ?? null,
    };
  });
  if (want('audio')) {
    expect(cat.noSound.length === 0, `every skill has its own cast sound 'skill.<id>' in the sfx bank (${cat.n - cat.noSound.length} of ${cat.n}; missing: ${cat.noSound.join(', ')})`);
    const missing = Object.keys(REACT_CN).filter((r) => !cat.sounds.includes(`react.${r}`));
    expect(missing.length === 0, `every reaction has a sting 'react.<id>' in the sfx bank (missing: ${missing.join(', ') || 'none'})`);
  }
  if (want('visual')) {
    expect(cat.noFlair.length === 0, `every skill has its own fx flair (fx/react FLAIR_SKILLS; missing: ${cat.noFlair.join(', ')})`);
    const bad = Object.entries(REACT_CN).filter(([id, cn]) => cat.reactCn?.[id] !== cn).map(([id]) => id);
    expect(bad.length === 0, `data/skills.ts REACTION_CN names the seven reactions 蒸发 融化 冻结 感电 超导 超载 扩散 (wrong: ${bad.join(', ') || 'none'})`);
  }
  await noErrors(h, 'catalogue');
}, { size: '960x540' });

// ---- in a race: the sounds are heard, the reactions are called out
await withPage(async (page, h) => {
  await h.goto(URL, { timeout: 120000 });
  await page.evaluate(() => window.__br.audio.unlock());
  await page.evaluate(install);

  if (want('audio')) {
    const r = await run(page, (sample) => {
      const k = window.__k, c = k.C(), out = {};
      for (const [id, [ds, dx]] of Object.entries(sample)) {
        k.reset(); c.pin(1, ds, dx); k.step(2);
        const t0 = performance.now();
        k.cast(id); k.step(90);
        const heard = k.heard(t0);
        out[id] = heard.includes(`skill.${id}`);
      }
      // a shared ult: its own sound, never the pelican's SHOWTIME whoosh
      const ults = {};
      for (const id of ['ult.meteor', 'ult.storm', 'ult.timestop']) {
        k.reset(); c.pin(1, 12, 0); c.pin(2, 16, 1.5); c.pin(3, 20, -1.5); k.step(2);
        const t0 = performance.now();
        // a cast refused because the player is still busy (the last skill's pose) is retried
        for (let i = 0; i < 4 && !k.of('ult:start').length; i++) { k.ev.length = 0; k.cast(id, 4); k.step(i < 3 && !k.of('ult:start').length ? 30 : 0); }
        k.step(120);
        const heard = k.heard(t0);
        ults[id] = { own: heard.includes(`skill.${id}`), pelican: heard.includes('skill.pelican.ult'), cast: k.of('ult:start').length, denied: k.of('skill:denied').map((e) => e.reason).join(',') };
      }
      return { ok: Object.values(out).every(Boolean) && Object.values(ults).every((u) => u.own && !u.pelican), info: { skills: out, ults } };
    }, SAMPLE);
    expect(r.ok, `cast in a race, each skill plays its own sound and a shared ult plays its own, not the pelican's SHOWTIME ${JSON.stringify(r.info)}`);
  }

  const reacts = await run(page, (pairs) => {
    const k = window.__k, c = k.C(), out = {};
    const fxStats = () => window.__br.fx?.stats?.() ?? {};
    for (const [re, [first, second]] of Object.entries(pairs)) {
      k.reset(); c.pin(1, 6, 0); c.pin(2, 7, 1.3); k.step(2);
      k.cast(first); k.step(70);
      // the element glyph over the rider who carries the first element (HUD world layer)
      const el = k.of('combat:element')[0];
      const glyph = el ? [...document.querySelectorAll(`[data-element="${el.element}"]`)].filter((e) => {
        const b = e.getBoundingClientRect(), cs = getComputedStyle(e);
        return b.width > 0 && cs.visibility !== 'hidden' && +cs.opacity > 0.1 && b.top >= 0 && b.bottom <= innerHeight;
      }).length : 0;
      c.resetCooldowns(0); k.ev.length = 0;
      const bursts0 = fxStats().reactionBursts ?? 0;
      const t0 = performance.now();
      k.cast(second);
      let callout = null;
      for (let i = 0; i < 70; i++) {
        k.step(1);
        if (!callout && k.of('combat:reaction', (e) => e.reaction === re).length) {
          k.step(6);
          const els = [...document.querySelectorAll(`[data-reaction="${re}"]`)].filter((e) => {
            const b = e.getBoundingClientRect(), cs = getComputedStyle(e);
            return b.width > 0 && cs.visibility !== 'hidden' && +cs.opacity > 0.1 && b.left >= 0 && b.right <= innerWidth && b.top >= 0 && b.bottom <= innerHeight;
          });
          callout = els.map((e) => e.textContent ?? '').join('|') || '';
        }
      }
      out[re] = {
        fired: k.of('combat:reaction', (e) => e.reaction === re).length > 0,
        element: el?.element ?? null, glyph,
        callout, sting: k.heard(t0).includes(`react.${re}`),
        bursts: (fxStats().reactionBursts ?? 0) - bursts0,
      };
    }
    return { ok: true, info: out };
  }, PAIRS);
  const R = reacts.info ?? {};
  const fired = Object.keys(REACT_CN).filter((re) => R[re]?.fired);
  expect(fired.length === 7, `the seven reactions fire from skill pairs (${fired.join(', ')}; ${typeof R === 'string' ? R : ''})`);
  if (want('audio')) {
    const quiet = fired.filter((re) => !R[re].sting);
    expect(quiet.length === 0, `each reaction plays its sting react.<id> (silent: ${quiet.join(', ') || 'none'})`);
  }
  if (want('visual')) {
    const noCall = fired.filter((re) => !(R[re].callout ?? '').includes(REACT_CN[re]));
    expect(noCall.length === 0, `each reaction is called out at the victim in the HUD ([data-reaction] on screen with 蒸发！/感电！…; missing: ${noCall.map((re) => `${re}「${R[re].callout}」`).join(' ') || 'none'})`);
    const noBurst = fired.filter((re) => !(R[re].bursts >= 1));
    expect(noBurst.length === 0, `each reaction fires its own fx burst (fx stats().reactionBursts; none for: ${noBurst.join(', ') || 'none'})`);
    const noGlyph = fired.filter((re) => R[re].element && !(R[re].glyph >= 1));
    expect(noGlyph.length === 0, `the rider carrying an element shows its glyph (火/冰/雷/水/风) in the HUD ([data-element] on screen; missing after: ${noGlyph.map((re) => PAIRS[re][0]).join(', ') || 'none'})`);
    // the glyph leaves with the aura
    const gone = await run(page, () => {
      const k = window.__k, c = k.C();
      k.reset(); c.pin(1, 6, 0); k.step(2); k.cast('pool.watergun'); k.step(60);
      const on = document.querySelectorAll('[data-element="water"]').length;
      for (let i = 0; i < 60 * 7; i++) k.step(1);
      const vis = [...document.querySelectorAll('[data-element="water"]')].filter((e) => { const b = e.getBoundingClientRect(), cs = getComputedStyle(e); return b.width > 0 && cs.visibility !== 'hidden' && +cs.opacity > 0.1; }).length;
      return { ok: on >= 1 && vis === 0 && !k.R(1).statuses.some((s) => s.id === 'wet' && s.time > 0), info: { on, after: vis } };
    });
    expect(gone.ok, `the element glyph goes away when the aura runs out ${JSON.stringify(gone.info)}`);
  }
  await noErrors(h, 'race');
}, { size: '1280x720' });

// ---- HOW TO: the 「新玩法」 tab explains the elements and the reactions
if (want('visual')) {
  await withPage(async (page, h) => {
    await h.goto('/?screen=howto&stub=world,sim,camera,actors,combat,race,fx,audio');
    await page.waitForFunction(() => window.__br?.app?.ui?.screen === 'howto', null, { timeout: 20000 });
    for (let i = 0; i < 3; i++) { await page.keyboard.press('ArrowRight'); await new Promise((r) => setTimeout(r, 200)); }
    const text = await page.evaluate(() => document.querySelector('.br-ht-page.is-on')?.textContent ?? '');
    const names = Object.values(REACT_CN).filter((cn) => text.includes(cn));
    expect(names.length === 7, `HOW TO → 新玩法 has a card for the element reactions naming all seven (${names.join(' ')})`);
    await noErrors(h, 'howto');
  }, { size: '1280x720' });
}

finish('r6-present');
