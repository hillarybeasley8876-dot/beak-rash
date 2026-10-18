// In-game check of the achievement system with every real unit, through game.ts's own instance (created
// once, attached per race): drives a race through the real systems (launch, debug KOs → combat KO path,
// teleport to the finish) and checks unlocks, the save and the bus events, then a restart and an autopilot
// race. Also grabs in-game shots of content text (taunt bubbles, loading tip, results).
// Run via: node tools/content-shots.mjs game
import fs from 'node:fs';
import { withPage } from './lib.mjs';

const OUT = 'shots/content';
const RIVALS = 'goose,cat,pigeon,capybara,shiba,seagull,sloth';
const STUB = process.env.CONTENT_STUB ?? 'audio';
const URL = (extra = '') => `/?race=coast&seed=3&traffic=0&police=0&rivals=${RIVALS}&manual=1${STUB ? `&stub=${STUB}` : ''}${extra}`;

/** In-page: use game.ts's own achievement system (fails on the stub), clear old unlocks, record events. */
const WIRE = async () => {
  const br = window.__br;
  if (!br.ach) throw new Error('gameplay/achievements did not load (stub in use?)');
  window.__ach = br.game.achievements;
  br.ach.forget();
  window.__unlocks = [];
  br.app.bus.on('achievement:unlock', ({ id }) => window.__unlocks.push(id));
  return true;
};

const idOf = (page, character) => page.evaluate((c) => window.__br.session().riders.find((r) => r.character === c)?.id ?? -1, character);

function expectAll(problems, got, want, label) {
  for (const id of want) if (!got.includes(id)) problems.push(`${label}: missing ${id}`);
}

export async function game() {
  fs.mkdirSync(OUT, { recursive: true });
  const problems = [];
  await withPage(async (page, h) => {
    await h.goto(URL());
    await page.evaluate(WIRE);
    // Countdown: press throttle only during "1" → PERFECT START (race flow: fresh press after 2.0 s).
    await page.evaluate(() => window.__br.race.skipIntro());
    await h.step(130);
    await h.controls({ throttle: 1 });
    await h.step(90);
    const goose = await idOf(page, 'goose');
    const cat = await idOf(page, 'cat');
    // Two real roster lines as bubbles over riders on the grid (race/ai/taunts emits the same event).
    await page.evaluate(() => {
      const { bus } = window.__br.app;
      for (const r of window.__br.session().riders) {
        if (r.character === 'goose') bus.emit('taunt', { riderId: r.id, text: '铁锅炖我？先追上我！', character: 'goose' });
        if (r.character === 'shiba') bus.emit('taunt', { riderId: r.id, text: '墨镜一戴，谁也不爱。', character: 'shiba' });
      }
    });
    await h.step(20);
    await h.shot(`${OUT}/game-taunts.png`);
    await page.evaluate(([g]) => window.__br.ko(g, 0), [goose]);
    await h.step(12);
    await page.evaluate(([c]) => window.__br.ko(c, 0), [cat]);
    await h.step(240);
    const mid = await page.evaluate(() => window.__unlocks.slice());
    expectAll(problems, mid, ['perfect_start', 'first_ko', 'goose', 'double'], 'race 1 KOs');
    if (mid.includes('pacifist')) problems.push('pacifist before the finish');
    // Finish: put the player 40 m before the line and pedal through it, then wait for race:end.
    await page.evaluate(() => { const s = window.__br.session(); window.__br.teleport(s.player.id, s.track.length - 40, 0); });
    for (let i = 0; i < 20 && (await page.evaluate(() => window.__br.app.ui.screen)) !== 'results'; i++) await h.step(60);
    const end = await page.evaluate(() => ({
      unlocks: window.__unlocks.slice(), fresh: window.__ach.fresh().slice(), screen: window.__br.app.ui.screen,
      saved: JSON.parse(localStorage.getItem('beak-rash.save.v1') ?? '{}').achievements ?? [], errors: window.__br.errors.slice(),
    }));
    expectAll(problems, end.unlocks, ['first_win', 'podium', 'untouched'], 'race 1 finish');
    if (end.unlocks.includes('pacifist')) problems.push('pacifist despite two KOs to the player');
    if (end.screen !== 'results') problems.push(`expected results screen, got ${end.screen}`);
    if (new Set(end.saved).size !== end.saved.length) problems.push(`duplicate ids in save: ${end.saved}`);
    for (const id of end.unlocks) if (!end.saved.includes(id)) problems.push(`unlocked ${id} not in localStorage`);
    if (end.fresh.join() !== end.unlocks.join()) problems.push(`fresh() ${end.fresh} ≠ events ${end.unlocks}`);
    console.log(`race 1 unlocks (${end.unlocks.length}): ${end.unlocks.join(', ')}`);
    for (const e of end.errors) problems.push(`page error: ${e.slice(0, 200)}`);
    await h.step(120);
    await page.waitForTimeout(3000);   // screen transitions and count-ups run on real time
    await h.shot(`${OUT}/game-results.png`);

    // Restart: the new race starts with nothing fresh, already-earned ids never fire again.
    await page.evaluate(() => { window.__old = window.__br.session(); window.__br.app.bus.emit('flow:restartRace', {}); });
    // Loading is async (track build): keep stepping in real time until the new race is up.
    for (let i = 0; i < 240 && (await page.evaluate(() => !window.__br.race || !window.__br.session() || window.__br.session() === window.__old)); i++) {
      await h.step(5);
      await page.waitForTimeout(250);
    }
    await page.evaluate(() => { window.__unlocks.length = 0; window.__br.race.skipIntro(); });
    await h.step(230);
    for (const c of ['goose', 'pigeon', 'capybara']) {
      await page.evaluate(([v]) => window.__br.ko(v, 0), [await idOf(page, c)]);
      await h.step(12);
    }
    await h.step(200);
    const second = await page.evaluate(() => ({ unlocks: window.__unlocks.slice(), fresh: window.__ach.fresh().slice() }));
    for (const id of ['goose', 'first_ko', 'double']) if (second.unlocks.includes(id)) problems.push(`race 2 re-fired ${id}`);
    expectAll(problems, second.unlocks, ['triple', 'hat_trick'], 'race 2 (attached again after restart)');
    if (second.fresh.join() !== second.unlocks.join()) problems.push(`race 2 fresh() ${second.fresh} ≠ ${second.unlocks}`);
    console.log(`race 2 (restart) unlocks: ${second.unlocks.join(', ') || '—'}`);
    await page.evaluate(() => window.__br.show('loading', { config: window.__br.session().config }));
    await h.step(90);
    await page.waitForTimeout(1200);
    await h.shot(`${OUT}/game-loading.png`);
  }, { size: '1920x1080' });

  // Autopilot (attract / soak) races never unlock anything.
  await withPage(async (page, h) => {
    await h.goto(URL('&autopilot=1'));
    await page.evaluate(WIRE);
    await page.evaluate(() => window.__br.race.skipIntro());
    await h.step(240);
    await page.evaluate(([g]) => window.__br.ko(g, 0), [await idOf(page, 'goose')]);
    await h.step(200);
    const auto = await page.evaluate(() => window.__unlocks.slice());
    if (auto.length) problems.push(`autopilot unlocked ${auto}`);
    console.log(`autopilot unlocks: ${auto.join(', ') || '—'}`);
  }, { size: '1280x720' });

  for (const p of problems) console.log(`FAIL ${p}`);
  console.log(problems.length ? `${problems.length} problems` : 'game check OK');
  return problems.length;
}
