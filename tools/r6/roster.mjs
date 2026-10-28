#!/usr/bin/env node
// r6 acceptance: roster (SPEC §23 — every racer is playable). Lead-owned, read-only for workers. The 「角色」 menu entry
// opens a roster screen: every racer with its portrait, name, title, the five stat bars and its signature skill; the
// focused one's loadout (U / I / O + P) can be edited and is saved per character; the pick is saved and the next race
// is ridden as that character — and the HUD, the HOW TO page, the menu hero and the cut-ins show that character's kit,
// not the pelican's.
//   node tools/r6/roster.mjs [--skip race]
import { parseArgs } from '../lib.mjs';
import { expect, finish, noErrors, withPage } from '../r4/accept-lib.mjs';

const a = parseArgs(process.argv.slice(2));
const skip = new Set(String(a.skip ?? '').split(',').filter(Boolean));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SAVE_KEY = 'beak-rash.save.v1';
const STUB = '&stub=world,sim,camera,combat,race,fx,audio';

/** Every visible element matching `sel` (on screen, not hidden). */
const visible = (sel) => [...document.querySelectorAll(sel)].filter((e) => {
  const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
  return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && +cs.opacity > 0.05;
});

const readSave = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), SAVE_KEY);
const screenIs = (page, id) => page.waitForFunction((x) => window.__br?.app?.ui?.screen === x, id, { timeout: 20000 }).then(() => true, () => false);

// 1. Menu → 角色 opens the roster: every racer (and only racers), with the parts the SPEC lists; all on screen.
for (const size of ['1280x720', '1920x1080']) {
  await withPage(async (page, h) => {
    await h.goto(`/?screen=menu${STUB}`);
    await page.evaluate((k) => localStorage.removeItem(k), SAVE_KEY);
    await h.goto(`/?screen=menu${STUB}`);
    await screenIs(page, 'menu');
    await sleep(700);
    const items = await page.evaluate(() => [...document.querySelectorAll('.br-menu-item')].map((e) => e.textContent ?? ''));
    const ros = items.findIndex((t) => /角色/.test(t));
    for (let i = 0; i < 14 && ros >= 0; i++) {
      const cur = await page.evaluate(() => [...document.querySelectorAll('.br-menu-item')].findIndex((e) => e.classList.contains('is-focus')));
      if (cur === ros) break;
      await page.keyboard.press(cur < ros ? 'ArrowDown' : 'ArrowUp');
      await sleep(110);
    }
    await page.keyboard.press('Enter');
    const opened = await screenIs(page, 'roster');
    expect(opened, `${size}: 「角色」 on the main menu opens the roster screen (ScreenId 'roster')`);
    if (!opened) return;
    await sleep(1200);
    const info = await page.evaluate(async (vis) => {
      const visibleEls = new Function(`return (${vis})`)();
      const { RACERS, ROSTER } = await import('/src/data/roster.ts');
      const cards = visibleEls('[data-roster]');
      const ids = cards.map((e) => e.getAttribute('data-roster'));
      const off = [...document.querySelectorAll('[data-roster], [data-roster-detail], [data-slot]')].filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1);
      }).length;
      const detail = document.querySelector('[data-roster-detail]');
      const text = detail?.textContent ?? '';
      const focus = document.querySelector('[data-roster].is-focus')?.getAttribute('data-roster') ?? null;
      const f = focus ? ROSTER[focus] : null;
      return {
        want: RACERS.length, ids, off, focus,
        police: ids.includes('corgi'),
        portraits: cards.filter((c) => c.querySelector('.br-portrait')).length,
        names: cards.filter((c) => (c.textContent ?? '').includes(ROSTER[c.getAttribute('data-roster')]?.name ?? '@@')).length,
        statBars: detail ? detail.querySelectorAll('.br-stat').length : 0,
        hasTitle: !!f && text.includes(f.title),
        slots: [...document.querySelectorAll('[data-slot]')].map((e) => e.getAttribute('data-slot')),
      };
    }, visible.toString());
    expect(info.ids.length === info.want && !info.police, `${size}: a card for every racer (${info.ids.length} of ${info.want}, the police corgi ${info.police ? 'listed!' : 'left out'})`);
    expect(info.portraits === info.ids.length && info.names === info.ids.length, `${size}: every card shows its portrait and its 中文名 (${info.portraits} portraits, ${info.names} names)`);
    expect(info.focus === 'pelican', `${size}: a fresh profile opens focused on the pelican (${info.focus})`);
    expect(info.statBars === 5 && info.hasTitle, `${size}: the detail panel shows the focused racer's title and its five stat bars (${info.statBars} bars, title ${info.hasTitle})`);
    expect(['1', '2', '3', 'ult'].every((s) => info.slots.includes(s)), `${size}: the loadout's four slots are shown (data-slot ${info.slots.join(',')})`);
    expect(info.off === 0, `${size}: every card, the detail panel and the slots are on screen (${info.off} off)`);
    await noErrors(h, `roster ${size}`);
  }, { size });
}

// 2. Pick a racer with the keyboard, edit a slot, 盲盒, Esc back — all saved; walking the grid previews each racer.
await withPage(async (page, h) => {
  await h.goto(`/?screen=menu${STUB}`);
  await page.evaluate((k) => localStorage.removeItem(k), SAVE_KEY);
  await h.goto(`/?screen=roster${STUB}`);
  const opened = await screenIs(page, 'roster');
  expect(opened, '?screen=roster opens the roster screen');
  if (!opened) return;
  await sleep(1000);
  // walk the grid with the arrows until moodeng is focused; every step changes the detail panel
  const seen = new Set();
  let focus = null;
  for (let i = 0; i < 40; i++) {
    focus = await page.evaluate(() => document.querySelector('[data-roster].is-focus')?.getAttribute('data-roster') ?? null);
    const name = await page.evaluate(() => document.querySelector('[data-roster-detail]')?.textContent ?? '');
    if (focus) seen.add(`${focus}|${name.slice(0, 40)}`);
    if (focus === 'moodeng') break;
    // → walks the cards in order (row by row), whatever ↓ does on the bottom row
    await page.keyboard.press('ArrowRight');
    await sleep(140);
  }
  expect(focus === 'moodeng', `the arrow keys walk the grid to any racer (reached ${focus}; ${seen.size} focus steps)`);
  const detail = await page.evaluate(async () => {
    const { ROSTER } = await import('/src/data/roster.ts');
    const { SKILLS } = await import('/src/data/skills.ts');
    const t = document.querySelector('[data-roster-detail]')?.textContent ?? '';
    const sig = SKILLS[ROSTER.moodeng.skill];
    return { name: t.includes(ROSTER.moodeng.name), sig: !!sig && t.includes(sig.name), slot1: document.querySelector('[data-slot="1"]')?.getAttribute('data-skill') ?? null };
  });
  expect(detail.name && detail.sig, `the detail panel follows the focus: moodeng's name and its signature skill 「Q弹冲击」 (${JSON.stringify(detail)})`);
  expect(detail.slot1 === 'moodeng.bounce', `the slots show the focused racer's kit (slot 1 = ${detail.slot1}; want moodeng.bounce, data-skill on [data-slot])`);
  // confirm = pick this racer
  await page.keyboard.press('Enter');
  await sleep(500);
  const picked = await readSave(page);
  expect(picked?.character === 'moodeng', `Enter picks the focused racer and saves it (SaveData.character = ${picked?.character})`);
  // edit slot 2: the screen offers the equippable skills; choose a different one and check the save
  {
    // keyboard path (the brief): Enter on a card picked it and moved the focus to slot 1; ←→ walk the slots, ↓ from
    // the grid reaches them too; Enter on a slot opens the picker
    for (let i = 0; i < 10; i++) {
      const s = await page.evaluate(() => document.querySelector('[data-slot].is-focus')?.getAttribute('data-slot') ?? null);
      if (s === '2') break;
      await page.keyboard.press(s === null ? 'ArrowDown' : s === '1' ? 'ArrowRight' : 'ArrowLeft'); await sleep(120);
    }
    await page.keyboard.press('Enter');
  }
  await sleep(500);
  const picker = await page.evaluate(async () => {
    const { equippable } = await import('/src/data/skills.ts');
    const opts = [...document.querySelectorAll('[data-pick]')].map((e) => e.getAttribute('data-pick'));
    const want = equippable('moodeng').map((s) => s.id);
    return { opts, want, cats: [...new Set([...document.querySelectorAll('[data-pick-cat]')].map((e) => e.getAttribute('data-pick-cat')))] };
  });
  expect(picker.opts.length > 0 && picker.want.every((id) => picker.opts.includes(id)) && picker.opts.every((id) => picker.want.includes(id)),
    `slot 2 opens a picker of exactly the skills moodeng may equip (${picker.opts.length} shown, ${picker.want.length} equippable)`);
  expect(picker.cats.length >= 5, `the picker groups the skills by category 攻击/控制/位移/… (data-pick-cat: ${picker.cats.join(',')})`);
  // choose the third option that is not already equipped
  const before = (await readSave(page))?.loadouts?.moodeng ?? null;
  for (let i = 0; i < 3; i++) { await page.keyboard.press('ArrowDown'); await sleep(90); }
  const chosen = await page.evaluate(() => document.querySelector('[data-pick].is-focus')?.getAttribute('data-pick') ?? null);
  await page.keyboard.press('Enter');
  await sleep(500);
  const after = (await readSave(page))?.loadouts?.moodeng ?? null;
  const valid = await page.evaluate(async (l) => { const { validLoadout } = await import('/src/data/loadouts.ts'); return JSON.stringify(validLoadout(l, 'moodeng')) === JSON.stringify(l); }, after);
  expect(!!after && after.slots.includes(chosen) && valid && JSON.stringify(after) !== JSON.stringify(before),
    `choosing a skill saves the new loadout for that racer (SaveData.loadouts.moodeng ${JSON.stringify(after)}, chose ${chosen}; validLoadout keeps it: ${valid})`);
  const slotShows = await page.evaluate((c) => [...document.querySelectorAll('[data-slot]')].some((e) => e.getAttribute('data-skill') === c), chosen);
  expect(slotShows, `the slot shows the chosen skill at once (${chosen})`);
  // 盲盒 toggle
  const blind0 = (await readSave(page))?.blindBox ?? false;
  const toggled = await page.evaluate(() => { const b = document.querySelector('[data-blindbox]'); if (!b) return false; b.dispatchEvent(new MouseEvent('click', { bubbles: true })); return true; });
  await sleep(400);
  const blind1 = (await readSave(page))?.blindBox ?? false;
  expect(toggled && blind1 !== blind0, `the 「盲盒」 toggle flips SaveData.blindBox (${blind0} → ${blind1})`);
  if (toggled && blind1 !== blind0) { await page.evaluate(() => document.querySelector('[data-blindbox]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))); await sleep(300); }
  // Esc → menu, and the menu hero is the picked racer
  await page.keyboard.press('Escape');
  const back = await screenIs(page, 'menu');
  await sleep(900);
  const hero = await page.evaluate(() => document.querySelector('.br-menu-hero [data-character]')?.getAttribute('data-character')
    ?? document.querySelector('.br-menu-hero')?.getAttribute('data-character') ?? null);
  const heroName = await page.evaluate(() => document.querySelector('.br-menu-name')?.textContent ?? '');
  expect(back, 'Esc on the roster goes back to the menu');
  expect(hero === 'moodeng' && heroName.includes('弹跳猪'), `the menu hero is the picked racer (data-character ${hero}, name「${heroName}」)`);
  await noErrors(h, 'roster edit');
}, { size: '1280x720' });

// 3. The race uses the pick: the player rides moodeng with the saved kit; the HUD diamonds, the ult cut-in and the
//    HOW TO skills page show moodeng's skills; a SHOWTIME by a non-pelican names its own ult.
if (!skip.has('race')) {
  await withPage(async (page, h) => {
    await h.goto(`/?screen=menu${STUB}`);
    const kit = { slots: ['moodeng.bounce', 'pool.icelance', 'pool.warsong'], ult: 'ult.storm' };
    await page.evaluate(({ k, kit }) => {
      const d = JSON.parse(localStorage.getItem(k) ?? '{}');
      d.character = 'moodeng';
      d.loadouts = { ...(d.loadouts ?? {}), moodeng: kit };
      d.blindBox = false;
      localStorage.setItem(k, JSON.stringify(d));
    }, { k: SAVE_KEY, kit });
    await h.goto('/?race=coast&seed=3&manual=1&intro=0&traffic=0&police=0');
    await h.step(30);
    const r = await page.evaluate(async () => {
      const { SKILLS } = await import('/src/data/skills.ts');
      const p = window.__br.session().player;
      const glyphs = [...document.querySelectorAll('.sk .sk-d .sk-g')].map((e) => e.textContent);
      return { character: p.character, loadout: p.loadout, glyphs, want: [...p.loadout.slots, p.loadout.ult].map((id) => (id ? SKILLS[id]?.glyph : '—')) };
    });
    expect(r.character === 'moodeng', `the race is ridden as the saved pick (player = ${r.character})`);
    expect(JSON.stringify(r.loadout) === JSON.stringify(kit), `with the saved loadout (${JSON.stringify(r.loadout)})`);
    expect(JSON.stringify(r.glyphs) === JSON.stringify(r.want), `the HUD skill diamonds show the player's loadout, the ult included (${r.glyphs.join(' ')}; want ${r.want.join(' ')})`);
    // the ult cut-in names the ult the player cast
    await page.evaluate(() => { const s = window.__br.session(); s.player.sp = 100; window.__br.app.bus.emit('ult:start', { riderId: s.player.id, skillId: 'ult.storm' }); });
    await h.step(8);
    const cut = await page.evaluate(() => document.querySelector('.ci-showtime .st-cn')?.textContent ?? null);
    expect(cut === '雷暴', `the SHOWTIME cut-in names the cast ult (「${cut}」, want 雷暴)`);
    await noErrors(h, 'roster race');
  }, { size: '1280x720' });
  // HOW TO: the skills page shows the picked racer's kit
  await withPage(async (page, h) => {
    await h.goto(`/?screen=menu${STUB}`);
    await page.evaluate((k) => { const d = JSON.parse(localStorage.getItem(k) ?? '{}'); d.character = 'hamster'; d.loadouts = {}; localStorage.setItem(k, JSON.stringify(d)); }, SAVE_KEY);
    await h.goto(`/?screen=howto${STUB}`);
    await screenIs(page, 'howto');
    await sleep(600);
    const names = await page.evaluate(async () => {
      const { defaultLoadout } = await import('/src/data/loadouts.ts');
      const { SKILLS } = await import('/src/data/skills.ts');
      const l = defaultLoadout('hamster');
      return { shown: [...document.querySelectorAll('.br-ht-sname')].map((e) => e.textContent), want: [...l.slots, l.ult].filter(Boolean).map((id) => SKILLS[id].name) };
    });
    expect(JSON.stringify(names.shown) === JSON.stringify(names.want), `HOW TO → 技能 shows the picked racer's kit (${names.shown.join(' / ')}; want ${names.want.join(' / ')})`);
    await noErrors(h, 'howto kit');
  }, { size: '1280x720' });
}

// 4. The slot row is one ↓ away from every card of the bottom row, and ↑ returns to the card you came from.
await withPage(async (page, h) => {
  await h.goto(`/?screen=menu${STUB}`);
  await page.evaluate((k) => localStorage.removeItem(k), SAVE_KEY);
  await h.goto(`/?screen=roster${STUB}`);
  if (!(await screenIs(page, 'roster'))) return;
  await sleep(900);
  const focusOf = () => page.evaluate(() => ({
    card: document.querySelector('[data-roster].is-focus')?.getAttribute('data-roster') ?? null,
    slot: document.querySelector('[data-slot].is-focus')?.getAttribute('data-slot') ?? null,
  }));
  const ids = await page.evaluate(async () => (await import('/src/data/roster.ts')).RACERS);
  const cols = 5, bottom = ids.slice(Math.floor((ids.length - 1) / cols) * cols);
  const rows = [];
  for (const target of bottom) {
    for (let i = 0; i < 20; i++) {
      const f = await focusOf();
      if (f.card === target) break;
      await page.keyboard.press(f.slot ? 'ArrowUp' : 'ArrowRight'); await sleep(110);
    }
    await page.keyboard.press('ArrowDown'); await sleep(140);
    const down = await focusOf();
    await page.keyboard.press('ArrowUp'); await sleep(140);
    const up = await focusOf();
    rows.push({ target, slot: down.slot, back: up.card });
  }
  const ok = rows.every((r) => r.slot !== null && r.back === r.target);
  expect(ok, `↓ from every card of the bottom row enters the slot row, ↑ returns to that card (${rows.map((r) => `${r.target}→${r.slot}→${r.back}`).join(' ')})`);
  await noErrors(h, 'roster keys');
}, { size: '1280x720' });

finish('r6-roster');
