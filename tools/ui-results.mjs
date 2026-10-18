#!/usr/bin/env node
// Results-screen check (ui-screens): the REAL achievements system (gameplay/achievements) unlocks + saves,
// the results screen shows what it announced. Race 1: four player KOs in 2.4 s (goose first) → chips show
// three + "+N"; race 2 (no events) → "本场无新成就" (the previous race's unlocks must not leak in).
// Other units run as core stubs by default (`--real` for every real unit). Exits 1 on any failed check.
//   node tools/ui-results.mjs [--real]
import fs from 'node:fs';
import { parseArgs, withPage } from './lib.mjs';

const args = parseArgs(process.argv.slice(2));
const STUB = args.real ? '' : '&stub=world,sim,camera,actors,combat,race,fx,audio';
const OUT = 'shots/ui-screens';
const RIVALS = ['goose', 'cat', 'shiba', 'pigeon', 'seagull', 'sloth', 'capybara'];
const problems = [];
const expect = (ok, what) => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) problems.push(what);
};

/** Start a race, optionally KO `kos` rivals as the player, end it with the player first; return the results UI. */
async function race(page, h, kos) {
  await page.evaluate((rivals) => window.__br.start({ trackId: 'coast', rivals }), RIVALS);
  for (let i = 0; i < 60 && (await page.evaluate(() => window.__br.app.ui.screen)) !== 'race'; i++) await h.sleep(250);
  const fresh = await page.evaluate((victims) => {
    const br = window.__br;
    const s = br.session();
    const me = s.player.id;
    const pos = { x: 0, y: 0, z: 0 };
    victims.forEach((c, i) => {
      s.time += i ? 0.8 : 0;
      const victim = s.riders.find((r) => r.character === c).id;
      br.app.bus.emit('combat:ko', { attacker: me, victim, cause: 'ko', pos, skillId: null, weapon: 'fish' });
    });
    const others = s.riders.filter((r) => r.id !== me);
    const results = [s.player, ...others].map((r, i) => ({
      riderId: r.id, character: r.character, name: r.character, isPlayer: r.id === me, place: i + 1,
      time: 150 + i * 3, kos: r.id === me ? victims.length : 0, wrecked: 0, coins: r.id === me ? 500 + 50 * victims.length : 10,
    }));
    const unlocked = [];
    const off = br.app.bus.on('achievement:unlock', ({ id }) => unlocked.push(id));
    br.app.bus.emit('race:end', { results });
    off();
    return { all: br.ach ? br.ach.fresh().slice() : null, atEnd: unlocked, saved: br.app.save.data.achievements.slice() };
  }, kos);
  await h.sleep(3200);
  const ui = await page.evaluate(() => ({
    screen: window.__br.app.ui.screen,
    chips: [...document.querySelectorAll('.br-ach-chip .br-ach-name')].map((e) => e.textContent),
    more: document.querySelector('.br-ach-more b')?.textContent ?? null,
    none: Boolean(document.querySelector('.br-ach-none')),
    say: [...document.querySelectorAll('.br-pod-say')].map((e) => e.textContent),
    quote: document.querySelector('.br-grade-quote')?.textContent ?? null,
    errors: window.__br.errors.slice(),
  }));
  return { fresh, ui };
}

await withPage(async (page, h) => {
  fs.mkdirSync(OUT, { recursive: true });
  await h.goto(`/?screen=menu${STUB}`);
  await h.sleep(1500);
  await page.evaluate(() => window.__br.ach?.forget());

  console.log('[ui-results] race 1: four KOs');
  const a = await race(page, h, ['goose', 'cat', 'shiba', 'pigeon']);
  await page.screenshot({ path: `${OUT}/results-ach.png` });
  const ids = a.fresh.all ?? [];
  expect(a.ui.screen === 'results', `results screen is up (${a.ui.screen})`);
  expect(ids.length >= 4, `achievements system unlocked ≥ 4 ids (${ids.join(',')})`);
  expect(ids.every((id) => a.fresh.saved.includes(id)), 'every unlock is in the save');
  expect(a.ui.chips.length === Math.min(3, ids.length), `three chips (${a.ui.chips.join(' / ')})`);
  expect(a.ui.more === (ids.length > 3 ? `+${ids.length - 3}` : null), `"+N" chip = ${a.ui.more}`);
  expect(!a.ui.none, 'no "本场无新成就" line');
  expect(a.ui.say.length === 1, `winner (the player) speaks on the podium: ${a.ui.say.join(' | ')}`);
  expect(Boolean(a.ui.quote), `grade quote: ${a.ui.quote}`);
  expect(a.ui.errors.length === 0, `no console errors ${a.ui.errors.slice(-2).join(' | ')}`);

  console.log('[ui-results] race 2: no events');
  await page.evaluate(() => { window.__br.errors.length = 0; });
  const b = await race(page, h, []);
  expect(b.ui.screen === 'results', `results screen is up (${b.ui.screen})`);
  const gained = b.fresh.all ?? [];
  expect(b.ui.chips.length === Math.min(3, gained.length), `chips only for this race's unlocks (${gained.join(',') || 'none'})`);
  expect(gained.length > 0 || b.ui.none, '"本场无新成就" when nothing unlocked');
  expect(b.ui.errors.length === 0, `no console errors ${b.ui.errors.slice(-2).join(' | ')}`);
}, { size: '1920x1080' });

if (problems.length) {
  console.log(`[ui-results] ${problems.length} problem(s):\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log('[ui-results] all checks passed');
