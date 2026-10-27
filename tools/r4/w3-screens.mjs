#!/usr/bin/env node
// r4 acceptance: w3-screens (5 tracks + race options, career 3 cups × 5 tracks with weather / reverse / routes,
// the results report lines, the 彩蛋 n/9 records, the UI eggs saved). Lead-owned, read-only for workers.
// Other units run as core stubs (the screens are what is tested).
//   node tools/r4/w3-screens.mjs
import { capture, events, expect, finish, noErrors, withPage } from './accept-lib.mjs';

const STUB = '&stub=world,sim,camera,actors,combat,race,fx,audio';
const RIVALS = ['goose', 'cat', 'shiba', 'pigeon', 'seagull', 'sloth', 'capybara'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const screenIs = (page, id) => page.waitForFunction((s) => window.__br?.app?.ui?.screen === s, id, { timeout: 30000 });
const key = async (page, k, n = 1) => { for (let i = 0; i < n; i++) { await page.keyboard.press(k); await sleep(160); } };
const opts = (page) => page.evaluate(() => {
  const p = document.querySelector('.br-race-opts');
  if (!p) return null;
  const v = (o) => p.querySelector(`[data-opt="${o}"]`)?.getAttribute('data-value') ?? null;
  return { for: p.getAttribute('data-for'), weather: v('weather'), reverse: v('reverse'), route: v('route') };
});
const lastStart = async (page) => (await events(page, 'flow:startRace')).at(-1)?.e.config ?? null;

// 1. quick race: five track cards (the focused one on screen), the race options of the focused track, options reach the config
await withPage(async (page, h) => {
  await h.goto(`/?screen=trackSelect${STUB}`);
  await screenIs(page, 'trackSelect');
  await sleep(1200);
  await capture(page, ['flow:startRace']);
  const tracks = await page.evaluate(async () => (await import('/src/data/tracks.ts')).TRACK_ORDER);
  const cards = await page.evaluate(() => [...document.querySelectorAll('.br-tc[data-track]')].map((el) => {
    const r = el.getBoundingClientRect();
    return { id: el.getAttribute('data-track'), inside: r.left >= -2 && r.top >= -2 && r.right <= innerWidth + 2 && r.bottom <= innerHeight + 2 && r.width > 80 };
  }));
  expect(JSON.stringify(cards.map((c) => c.id)) === JSON.stringify(tracks), `one card per track in TRACK_ORDER (${cards.map((c) => c.id).join(',')})`);
  // r6 (SPEC §26): three big cards in view, the row scrolls to the others — the focused card must be fully on screen
  // (tools/r6/ui.mjs walks all five with → and checks each focused card is on screen).
  const focused = await page.evaluate(() => { const f = document.querySelector('.br-tc.is-focus, .br-tc[aria-current="true"]'); return f?.getAttribute('data-track') ?? null; });
  expect(cards.length === 5 && cards.some((c) => c.inside && c.id === focused), `five cards, the focused one (${focused}) fully on screen at 1280×720 (${cards.filter((c) => c.inside).map((c) => c.id).join(',')} in view)`);
  const first = await opts(page);
  expect(!!first && first.for === 'coast' && first.weather === 'clear' && first.reverse === '0' && first.route === '0',
    `the options panel shows the focused track's defaults (${JSON.stringify(first)})`);
  const panel = await page.evaluate(() => { const r = document.querySelector('.br-race-opts')?.getBoundingClientRect(); return !!r && r.top >= 0 && r.bottom <= innerHeight && r.right <= innerWidth && r.left >= 0; });
  expect(panel, 'the options panel is fully on screen');
  await key(page, 'ArrowRight', 3);
  const wt = await opts(page);
  expect(wt?.for === 'watertown' && wt.weather === 'rain', `watertown focused: its own weather is rain (${JSON.stringify(wt)})`);
  await key(page, 'ArrowDown'); await key(page, 'ArrowRight');
  await key(page, 'ArrowDown'); await key(page, 'ArrowRight');
  await key(page, 'ArrowDown'); await key(page, 'ArrowRight');
  const set = await opts(page);
  expect(set?.weather === 'fog' && set.reverse === '1' && set.route === 'random', `↓ → weather / direction / route cycle with ←→ (${JSON.stringify(set)})`);
  await key(page, 'Enter');
  await sleep(800);
  const c = await lastStart(page);
  expect(c?.trackId === 'watertown' && c.mode === 'quick' && c.weather === 'fog' && c.reverse === true && Number.isInteger(c.route) && c.route > 0,
    `Enter starts watertown · fog · reverse · a seeded route (${JSON.stringify(c)})`);
  await noErrors(h, 'track select');
}, { size: '1280x720' });

await withPage(async (page, h) => {
  await h.goto(`/?screen=trackSelect${STUB}`);
  await screenIs(page, 'trackSelect');
  await sleep(1200);
  await capture(page, ['flow:startRace']);
  await key(page, 'ArrowRight', 4);
  await key(page, 'ArrowDown'); await key(page, 'ArrowLeft');
  const g = await opts(page);
  expect(g?.for === 'gobi' && g.weather === 'random', `gobi: ← from its own weather reaches 随机 (${JSON.stringify(g)})`);
  await key(page, 'Enter');
  await sleep(800);
  const c = await lastStart(page);
  expect(c?.trackId === 'gobi' && ['clear', 'dusk', 'fog'].includes(c.weather) && !c.reverse && !c.route, `随机 picks one of gobi's weathers (${JSON.stringify(c)})`);
  await noErrors(h, 'random weather');
}, { size: '1920x1080' });

// 2. career: 3 cups × 5 tracks, cup 2 weather variants, cup 3 reverse / seeded routes, old saves keep their progress
await withPage(async (page, h) => {
  await h.goto(`/?screen=menu${STUB}`);
  await screenIs(page, 'menu');
  const t = await page.evaluate(async () => {
    const m = await import('/src/ui/progress.ts');
    const { TRACK_ORDER, TRACK_WEATHER } = await import('/src/data/tracks.ts');
    const own = (id) => TRACK_WEATHER[id][0];
    const ev = m.CAREER.map((e) => ({ key: e.key, tier: e.tier, trackId: e.trackId, weather: e.weather ?? own(e.trackId), reverse: !!e.reverse, route: e.route ?? 0 }));
    const order = ev.map((e) => `${e.tier}-${e.trackId}`).join(',');
    const want = [1, 2, 3].flatMap((tier) => TRACK_ORDER.map((id) => `${tier}-${id}`)).join(',');
    const t1 = ev.filter((e) => e.tier === 1).every((e) => e.weather === own(e.trackId) && !e.reverse && e.route === 0);
    const t2 = ev.filter((e) => e.tier === 2).every((e) => TRACK_WEATHER[e.trackId].includes(e.weather) && e.weather !== own(e.trackId));
    const t3 = ev.filter((e) => e.tier === 3);
    return { n: ev.length, orderOk: order === want, t1, t2, t3ok: t3.every((e) => e.reverse || e.route > 0), t3rev: t3.filter((e) => e.reverse).length, t3route: t3.filter((e) => e.route > 0).length, ev };
  });
  expect(t.n === 15 && t.orderOk, `CAREER = 3 cups × the 5 tracks in TRACK_ORDER (${t.n})`);
  expect(t.t1, 'cup 1 races each track in its own weather, forward, authored layout');
  expect(t.t2, 'cup 2 races each track in one of its weather variants');
  expect(t.t3ok && t.t3rev >= 1 && t.t3route >= 1, `cup 3 races reversed or on a seeded route (reverse ${t.t3rev}, routes ${t.t3route})`);
  // an old 3-track save: events 1-5 were open (cup 1 + cup 2 coast/city), with these bests
  const mig = await page.evaluate(async () => {
    const m = await import('/src/ui/progress.ts');
    const save = window.__br.app.save;
    save.update((d) => { d.career.unlocked = 5; d.career.best = { '1-coast': 1, '1-city': 2, '1-mountain': 1, '2-coast': 3, '2-city': 5 }; });
    const open = (k) => m.isUnlocked(save, m.CAREER.find((e) => e.key === k));
    return Object.fromEntries(['1-watertown', '1-gobi', '2-coast', '2-city', '2-mountain', '3-coast'].map((k) => [k, open(k)]));
  });
  const wantMig = { '1-watertown': true, '1-gobi': false, '2-coast': true, '2-city': true, '2-mountain': false, '3-coast': false };
  expect(JSON.stringify(mig) === JSON.stringify(wantMig), `old saves keep their progress; the new tracks open behind a top 3 (${JSON.stringify(mig)})`);
  // the career screen: 15 events; a cup-2 event starts with its weather
  // focus the cup-2 city event through the screen's focus memory, then open the career screen
  const target = t.ev.findIndex((e) => e.key === '2-city');
  await capture(page, ['flow:startRace']);
  await page.evaluate(async (i) => {
    window.__br.app.save.update((d) => { d.career.unlocked = 15; for (const k of ['1-watertown', '1-gobi', '2-mountain', '2-watertown']) d.career.best[k] = 2; });
    (await import('/src/ui/screens/memory.ts')).remember('career', i);
    await window.__br.app.ui.show('career');
  }, target);
  await screenIs(page, 'career');
  await sleep(1500);
  const cells = await page.evaluate(() => [...document.querySelectorAll('[data-event]')].map((e) => e.getAttribute('data-event')));
  expect(cells.length === 15, `the career screen shows 15 events with data-event (${cells.length})`);
  const fits = await page.evaluate(() => [...document.querySelectorAll('[data-event]')].every((el) => { const r = el.getBoundingClientRect(); return r.left >= -2 && r.right <= innerWidth + 2 && r.top >= -2 && r.bottom <= innerHeight + 2; }));
  expect(cells.length === 15 && fits, 'every career event is fully on screen');
  const cityEv = t.ev[target];
  const shown = await page.evaluate(() => document.querySelector('.br-car-detail [data-weather]')?.getAttribute('data-weather') ?? null);
  expect(shown === cityEv.weather, `the detail panel of the focused 2-city event shows its weather (data-weather ${shown}, event ${cityEv.weather})`);
  await key(page, 'Enter');
  await sleep(800);
  const c = await lastStart(page);
  expect(c?.trackId === 'city' && c.mode === 'career' && c.level === 2 && c.weather === cityEv.weather, `a cup-2 event starts with its weather (${JSON.stringify(c)})`);
  await noErrors(h, 'career');
}, { size: '1280x720' });

// 3. results: nemesis / STYLE / police lines (only when they happened)
async function raceAndResults(page, h, happen) {
  await page.evaluate((r) => window.__br.start({ trackId: 'coast', rivals: r, nemesis: 'goose' }), RIVALS);
  for (let i = 0; i < 60 && (await page.evaluate(() => window.__br.app.ui.screen)) !== 'race'; i++) await sleep(250);
  await page.evaluate((on) => {
    const br = window.__br, s = br.session(), me = s.player.id, bus = br.app.bus, pos = { x: 0, y: 0, z: 0 };
    const goose = s.riders.find((r) => r.character === 'goose').id;
    if (on) {
      bus.emit('race:nemesisDown', { riderId: goose, attacker: me, bonus: 150 });
      bus.emit('police:down', { obstacleId: 900, attacker: me, pos });
      bus.emit('police:down', { obstacleId: 901, attacker: me, pos });
      bus.emit('police:bribe', { riderId: me, obstacleId: 902, amount: 50, accepted: true });
    }
    const others = s.riders.filter((r) => r.id !== me);
    const results = [s.player, ...others].map((r, i) => ({
      riderId: r.id, character: r.character, name: r.character, isPlayer: r.id === me, place: i + 1,
      time: 150 + i * 3, kos: 0, wrecked: 0, coins: r.id === me ? 500 : 10, styleBest: r.id === me && on ? 12400 : 0,
    }));
    bus.emit('race:end', { results });
  }, happen);
  await sleep(3500);
  return page.evaluate(() => ({
    screen: window.__br.app.ui.screen,
    lines: Object.fromEntries([...document.querySelectorAll('[data-line]')].map((e) => [e.getAttribute('data-line'), e.textContent ?? ''])),
  }));
}
await withPage(async (page, h) => {
  await h.goto(`/?screen=menu${STUB}`);
  await screenIs(page, 'menu');
  const a = await raceAndResults(page, h, true);
  expect(a.screen === 'results', `the results screen is up (${a.screen})`);
  expect(/150/.test(a.lines.nemesis ?? '') && /宿敌/.test(a.lines.nemesis ?? ''), `宿敌 line with the +150 bonus (${a.lines.nemesis})`);
  expect(/12[,，]?400/.test(a.lines.style ?? ''), `STYLE best line (${a.lines.style})`);
  expect(/2/.test(a.lines.police ?? '') && /V我50|贿|50/.test(a.lines.police ?? ''), `police line: 2 corgis down + the bribe (${a.lines.police})`);
  await page.evaluate(() => window.__br.app.ui.show('menu'));
  await screenIs(page, 'menu');
  const b = await raceAndResults(page, h, false);
  expect(b.screen === 'results' && !b.lines.style && !b.lines.police && !/150/.test(b.lines.nemesis ?? ''), `nothing happened → no style / police lines, no bonus (${JSON.stringify(b.lines)})`);
  await noErrors(h, 'results');
}, { size: '1280x720' });

// 4. the 彩蛋 n/9 records + the UI eggs are saved
await withPage(async (page, h) => {
  await h.goto(`/?screen=menu${STUB}`);
  await screenIs(page, 'menu');
  await capture(page, ['secret:found']);
  await sleep(800);
  for (const k of ['KeyP', 'KeyE', 'KeyL', 'KeyI', 'KeyC', 'KeyA', 'KeyN']) await key(page, k);
  await sleep(600);
  const word = await page.evaluate(() => window.__br.app.save.data.secrets.includes('pelican_word'));
  expect(word, 'typing PELICAN saves the pelican_word egg');
  expect((await events(page, 'secret:found')).some((x) => x.e.id === 'pelican_word'), 'and emits secret:found pelican_word');
  await page.evaluate(() => window.__br.app.save.update((d) => {
    d.secrets = ['duck_coast', 'duck_city', 'svg_gobi', 'sloth', 'bribe', 'pelican_word'];
    if (!d.unlocks.includes('llm')) d.unlocks.push('llm');
  }));
  await page.evaluate(() => window.__br.app.ui.show('career'));
  await screenIs(page, 'career');
  await sleep(1200);
  await key(page, 'Tab');
  await sleep(900);
  const sheet = await page.evaluate(() => {
    const box = document.querySelector('[data-eggs]');
    return box ? {
      text: box.textContent ?? '',
      cells: [...box.querySelectorAll('[data-egg]')].map((e) => ({ id: e.getAttribute('data-egg'), found: e.classList.contains('is-found'), text: e.textContent ?? '' })),
    } : null;
  });
  const found = sheet?.cells.filter((c) => c.found).map((c) => c.id).sort().join(',');
  expect(!!sheet && /6\s*\/\s*9/.test(sheet.text), `records sheet: 彩蛋 6/9 (${sheet?.text.slice(0, 40)})`);
  expect(sheet?.cells.length === 9 && found === 'bribe,ducks,konami,pelican_word,sloth,svg', `the nine egg cells, six found (${found})`);
  const ducks = sheet?.cells.find((c) => c.id === 'ducks');
  expect(/2\s*\/\s*5/.test(ducks?.text ?? ''), `the duck cell counts 2/5 (${ducks?.text})`);
  const hidden = sheet?.cells.filter((c) => !c.found).every((c) => c.text.includes('?'));
  expect(!!hidden, 'unfound eggs stay hidden (???)');
  await noErrors(h, 'records');
}, { size: '1280x720' });

await withPage(async (page, h) => {
  await h.goto(`/?screen=credits${STUB}`);
  await screenIs(page, 'credits');
  await capture(page, ['secret:found']);
  await sleep(33000);
  const thanks = await page.evaluate(() => window.__br.app.save.data.secrets.includes('credits_thanks'));
  expect(thanks, 'idling 30 s on the credits saves the credits_thanks egg');
  await noErrors(h, 'credits egg');
}, { size: '1280x720' });

finish('w3-screens');
