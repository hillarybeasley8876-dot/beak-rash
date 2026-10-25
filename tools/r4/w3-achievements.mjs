#!/usr/bin/env node
// r4 acceptance: w3-achievements (achievements for the r4 mechanics, maps and easter eggs). Lead-owned, read-only
// for workers. Races run with the other units as core stubs; the test plays the bus events a real race would emit
// and reads app.save.data.achievements.
//   node tools/r4/w3-achievements.mjs
import { expect, finish, noErrors, withPage } from './accept-lib.mjs';

const STUB = '&stub=world,sim,camera,actors,combat,race,fx,audio';
const RIVALS = ['goose', 'cat', 'shiba', 'pigeon', 'seagull', 'sloth', 'capybara'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const NEW = ['backflip', 'trick_combo', 'superman', 'style_5k', 'style_broken', 'corgi_down', 'parry', 'wanted3', 'bribe',
  'nemesis', 'alliance_break', 'alliance_win', 'event_survivor', 'watertown', 'gobi', 'reverse', 'snow', 'route', 'llm_win',
  'ducks', 'svg', 'goose_poem', 'sloth_wait', 'pelican_god', 'konami', 'eggs_all'];
const DUCKS = ['duck_coast', 'duck_city', 'duck_mountain', 'duck_watertown', 'duck_gobi'];

/** Start a race, run `script` (a function source run in the page with (br, s, me, bus, pos, other)), end it. */
async function race(page, config, script, place = 1) {
  await page.evaluate((c) => window.__br.start(c), { rivals: RIVALS, ...config });
  for (let i = 0; i < 80 && (await page.evaluate(() => window.__br.app.ui.screen)) !== 'race'; i++) await sleep(250);
  await page.evaluate(([src, place]) => {
    const br = window.__br, s = br.session(), me = s.player.id, bus = br.app.bus, pos = { x: 0, y: 0, z: 0 };
    const other = s.riders.find((r) => r.id !== me).id;
    bus.emit('race:start', {});
    new Function('br', 's', 'me', 'bus', 'pos', 'other', src)(br, s, me, bus, pos, other);
    const others = s.riders.filter((r) => r.id !== me);
    const order = [...others];
    order.splice(place - 1, 0, s.player);
    const results = order.map((r, i) => ({
      riderId: r.id, character: r.character, name: r.character, isPlayer: r.id === me, place: i + 1,
      time: 150 + i * 3, kos: 0, wrecked: 0, coins: 10, styleBest: 0,
    }));
    bus.emit('race:finishLine', { riderId: me, place, time: 150 + (place - 1) * 3 });
    bus.emit('race:end', { results });
  }, [script, place]);
  await sleep(1500);
  return page.evaluate(() => window.__br.app.save.data.achievements.slice());
}
const has = (list, id) => list.includes(id);

await withPage(async (page, h) => {
  await h.goto(`/?screen=menu${STUB}`);
  await page.waitForFunction(() => window.__br?.app?.ui?.screen === 'menu', null, { timeout: 30000 });
  const catalogue = await page.evaluate(async () => (await import('/src/data/achievements.ts')).ACHIEVEMENTS.map((a) => ({ id: a.id, name: a.name, desc: a.desc, icon: a.icon })));
  const ids = catalogue.map((a) => a.id);
  const missing = NEW.filter((id) => !ids.includes(id));
  expect(missing.length === 0, `the r4 achievements are in the catalogue (missing: ${missing.join(', ') || 'none'})`);
  expect(catalogue.filter((a) => NEW.includes(a.id)).every((a) => a.name && a.desc && [...a.icon].length === 1), 'each has a name, a description and a one-character icon');
  expect(new Set(ids).size === ids.length, 'no duplicate ids');
  await page.evaluate(() => window.__br.app.save.update((d) => { d.achievements = []; d.secrets = []; d.unlocks = d.unlocks.filter((u) => u !== 'llm'); }));

  // 1. near misses unlock nothing: rivals' tricks, a failed trick, small / unbroken chains, a rival's police KO, a refused bribe
  let got = await race(page, { trackId: 'coast' }, `
    bus.emit('rider:trick', { riderId: other, phase: 'land', kind: 'backflip', count: 3, points: 400 });
    bus.emit('rider:trick', { riderId: me, phase: 'fail', kind: 'backflip', count: 1, points: 0 });
    bus.emit('style:bank', { riderId: me, total: 4900, count: 6, sp: 20, coins: 19, broken: false });
    bus.emit('style:bank', { riderId: me, total: 1900, count: 4, sp: 19, coins: 7, broken: true });
    bus.emit('police:down', { obstacleId: 900, attacker: other, pos });
    bus.emit('police:bribe', { riderId: me, obstacleId: 900, amount: 50, accepted: false });
    bus.emit('police:wanted', { riderId: me, level: 2, prev: 1 });
    bus.emit('police:alert', { riderId: me, level: 0, reason: 'lost' });
    bus.emit('race:alliance', { phase: 'form', members: [other], target: me, reason: 'leader' });
    bus.emit('race:alliance', { phase: 'break', members: [other], target: me, reason: 'timeout' });
    bus.emit('race:event', { kind: 'geese', phase: 'start', s: 400, pos });
    bus.emit('race:event', { kind: 'stalls', phase: 'start', s: 900, pos });
    bus.emit('rider:crash', { riderId: me, cause: 'wall', speed: 12, pos, attacker: null });
  `, 2);
  const leaked = NEW.filter((id) => has(got, id));
  expect(leaked.length === 0, `near misses unlock nothing (${leaked.join(', ') || 'none'})`);

  // 2. the mechanics
  await page.evaluate(() => window.__br.app.ui.show('menu'));
  await sleep(800);
  got = await race(page, { trackId: 'coast', nemesis: 'goose' }, `
    const goose = s.riders.find((r) => r.character === 'goose').id;
    bus.emit('rider:trick', { riderId: me, phase: 'land', kind: 'backflip', count: 1, points: 120 });
    bus.emit('rider:trick', { riderId: me, phase: 'land', kind: 'spin', count: 3, points: 520 });
    bus.emit('rider:trick', { riderId: me, phase: 'land', kind: 'superman', count: 1, points: 120 });
    bus.emit('style:bank', { riderId: me, total: 5200, count: 9, sp: 25, coins: 20, broken: false });
    bus.emit('style:bank', { riderId: me, total: 2400, count: 5, sp: 24, coins: 9, broken: true });
    bus.emit('police:down', { obstacleId: 900, attacker: me, pos });
    bus.emit('combat:parry', { riderId: me, attacker: null, obstacleId: 901, weapon: 'pan', pos });
    bus.emit('police:wanted', { riderId: me, level: 3, prev: 2 });
    bus.emit('police:alert', { riderId: me, level: 0, reason: 'lost' });
    bus.emit('police:bribe', { riderId: me, obstacleId: 902, amount: 50, accepted: true });
    bus.emit('race:nemesisDown', { riderId: goose, attacker: me, bonus: 150 });
    bus.emit('race:alliance', { phase: 'form', members: [other, goose], target: me, reason: 'leader' });
    bus.emit('race:alliance', { phase: 'break', members: [other, goose], target: me, reason: 'betrayal' });
    bus.emit('race:event', { kind: 'fishSpill', phase: 'start', s: 400, pos });
    bus.emit('race:event', { kind: 'roadworks', phase: 'start', s: 1400, pos });
  `, 1);
  for (const id of ['backflip', 'trick_combo', 'superman', 'style_5k', 'style_broken', 'corgi_down', 'parry', 'wanted3', 'bribe', 'nemesis', 'alliance_break', 'alliance_win', 'event_survivor']) {
    expect(has(got, id), `${id} unlocks`);
  }

  // 3. maps and modes: wins only
  const wins = [
    ['watertown', { trackId: 'watertown' }], ['gobi', { trackId: 'gobi' }], ['reverse', { trackId: 'coast', reverse: true }],
    ['snow', { trackId: 'mountain', weather: 'snow' }], ['route', { trackId: 'city', route: 77 }],
  ];
  for (const [id, cfg] of wins) {
    await page.evaluate(() => window.__br.app.ui.show('menu'));
    await sleep(600);
    got = await race(page, cfg, '', 2);
    expect(!has(got, id), `${id}: 2nd place does not unlock it`);
    await page.evaluate(() => window.__br.app.ui.show('menu'));
    await sleep(600);
    got = await race(page, cfg, '', 1);
    expect(has(got, id), `${id}: a win unlocks it`);
  }
  await page.evaluate(() => window.__br.app.save.update((d) => { if (!d.unlocks.includes('llm')) d.unlocks.push('llm'); }));
  await page.evaluate(() => window.__br.app.ui.show('menu'));
  await sleep(600);
  got = await race(page, { trackId: 'coast', playerBike: 'llm' }, '', 1);
  expect(has(got, 'llm_win'), 'a win on the LLM bike unlocks llm_win');
  expect(has(got, 'konami'), 'the LLM bike in the save unlocks konami (at the next race end)');

  // 4. eggs: found in the race, or already in the save
  await page.evaluate((ducks) => window.__br.app.save.update((d) => { d.secrets = ducks.slice(0, 4); }), DUCKS);
  await page.evaluate(() => window.__br.app.ui.show('menu'));
  await sleep(600);
  got = await race(page, { trackId: 'gobi' }, `
    br.app.save.update((d) => { d.secrets.push('duck_gobi', 'svg_city', 'goose_poem', 'sloth', 'pelican_god'); });
    bus.emit('secret:found', { id: 'duck_gobi', riderId: me, pos, first: true });
    bus.emit('secret:found', { id: 'svg_city', riderId: me, pos, first: true });
    bus.emit('secret:found', { id: 'goose_poem', riderId: me, pos, first: true });
    bus.emit('secret:found', { id: 'sloth', riderId: me, pos, first: true });
    bus.emit('secret:found', { id: 'pelican_god', riderId: me, pos, first: true });
  `, 3);
  for (const id of ['ducks', 'svg', 'goose_poem', 'sloth_wait', 'pelican_god']) expect(has(got, id), `${id} unlocks`);
  expect(!has(got, 'eggs_all'), 'eggs_all waits for all nine eggs');
  await page.evaluate(() => window.__br.app.save.update((d) => { d.secrets.push('bribe', 'pelican_word', 'credits_thanks'); }));
  await page.evaluate(() => window.__br.app.ui.show('menu'));
  await sleep(600);
  got = await race(page, { trackId: 'coast' }, '', 5);
  expect(has(got, 'eggs_all'), 'all nine eggs in the save → eggs_all at the next race end');

  // 5. the records sheet lists them all
  await page.evaluate(() => window.__br.app.ui.show('career'));
  await sleep(1500);
  await page.keyboard.press('Tab');
  await sleep(900);
  const cells = await page.evaluate(() => document.querySelectorAll('.br-rec-cell').length);
  expect(cells === ids.length, `the records sheet shows every achievement (${cells}/${ids.length})`);
  await noErrors(h, 'achievements');
}, { size: '1280x720' });

finish('w3-achievements');
