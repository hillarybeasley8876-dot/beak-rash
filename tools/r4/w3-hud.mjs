#!/usr/bin/env node
// r4 acceptance: w3-hud (the race HUD for every r4 event). Lead-owned, read-only for workers. Emits the r4 bus events
// by hand (combat / race / sim run normally, rivals parked far ahead) and checks the HUD reacts (DOM, visible).
//   node tools/r4/w3-hud.mjs
import { expect, finish, hold, noErrors, race, withPage } from './accept-lib.mjs';

const C = { throttle: 0.6 };
const P = { x: 0, y: 1, z: 0 };
/** Visible element matching sel whose text includes `text` (inside the viewport, opaque enough). */
const shown = (page, sel, text = '') => page.evaluate(([s, t]) => [...document.querySelectorAll(s)].some((e) => {
  const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
  return r.width > 2 && r.height > 2 && cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05 &&
    r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth && (e.textContent ?? '').includes(t);
}), [sel, text]);
const anyText = (page, text) => page.evaluate((t) => document.querySelector('#ui')?.innerText.includes(t) ?? false, text);

await withPage(async (page, h) => {
  await race(page, h, { track: 'coast', seed: 3, extra: '&traffic=0&police=0' });
  await page.evaluate(() => { const b = window.__br, s = b.session(); for (const r of s.riders) if (!r.isPlayer) b.teleport(r.id, s.player.s + 700 + r.id * 12, 0); });
  await page.evaluate(() => window.__br.manual(false)); // the HUD animates on real time
  const emit = (n, p) => page.evaluate(([a, b]) => window.__br.app.bus.emit(a, b), [n, p]);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // police
  await emit('police:wanted', { riderId: 0, level: 2, prev: 1 });
  await wait(400);
  const stars = await page.evaluate(() => { const e = document.querySelector('.brh-wanted'); return e ? Number(e.getAttribute('data-level')) : -1; });
  expect(stars === 2 && (await shown(page, '.brh-wanted')), `police:wanted 2 → a .brh-wanted badge with data-level 2 (${stars})`);
  await emit('police:wanted', { riderId: 0, level: 0, prev: 2 });
  await wait(1200);
  expect(!(await shown(page, '.brh-wanted')), 'wanted 0 → the stars go away');
  await emit('police:windup', { riderId: 0, obstacleId: 900, side: 1, pos: P, time: 0.45 });
  await wait(150);
  expect(await shown(page, '.brh-baton-warn'), 'police:windup → a .brh-baton-warn warning');
  await emit('police:roadblock', { riderId: 0, s: 900, gapX: 2, gapWidth: 3.2, pos: P });
  await wait(300);
  expect(await anyText(page, '前方设卡'), 'police:roadblock → 前方设卡 banner');
  await emit('police:down', { obstacleId: 900, attacker: 0, pos: P });
  await wait(300);
  expect(await anyText(page, '柯基下班了'), 'police:down → 柯基下班了');
  await emit('police:bribe', { riderId: 0, obstacleId: 900, amount: 50, accepted: true });
  await wait(300);
  expect(await anyText(page, 'V我50'), 'police:bribe accepted → a V我50 chip');

  // tricks + STYLE
  await emit('rider:trick', { riderId: 0, phase: 'land', kind: 'backflip', count: 2, points: 290 });
  await wait(250);
  expect(await shown(page, '.brh-trick', '290'), 'rider:trick land → a .brh-trick pop with +290');
  await emit('style:chain', { riderId: 0, action: 'nearMiss', label: '擦肩', points: 60, total: 1240, mult: 2.25, count: 5 });
  await wait(250);
  expect(await shown(page, '.brh-style', '2.25') && (await page.evaluate(() => /1,?240/.test(document.querySelector('.brh-style')?.textContent ?? ''))), 'style:chain → the .brh-style meter shows ×2.25 and 1240');
  await emit('style:bank', { riderId: 0, total: 1240, count: 5, sp: 12, coins: 4, broken: false });
  await wait(250);
  expect(await anyText(page, '+12'), 'style:bank → a +12 SP pop');

  // weapons: throw hint, trait label, parry
  await page.evaluate(() => { localStorage.removeItem('beak-rash.hint.throw'); window.__br.combat?.give(0, 'saltfish', 8); });
  await emit('combat:weaponPick', { riderId: 0, weapon: 'saltfish', stolenFrom: null });
  await wait(500);
  expect(await anyText(page, '投掷'), 'first weapon pickup → a 按住 K / Y 投掷 hint');
  expect(await anyText(page, '回旋镖'), 'the weapon slot names the trait (saltfish 回旋镖)');
  await emit('combat:parry', { riderId: 0, attacker: 3, obstacleId: null, weapon: 'pan', pos: P });
  await wait(200);
  expect(await anyText(page, '当'), 'combat:parry → 当！');

  // rivals
  const goose = await page.evaluate(() => window.__br.session().riders.find((r) => r.character === 'goose')?.id ?? 1);
  await page.evaluate((id) => { const b = window.__br, s = b.session(); b.teleport(id, s.player.s + 12, 1.5); }, goose);
  await emit('race:nemesis', { riderId: goose, character: 'goose', grudge: 80 });
  await wait(600);
  expect(await anyText(page, '宿敌'), 'race:nemesis → 宿敌 on screen (card / tag)');
  await emit('race:alliance', { phase: 'form', members: [goose, 2], target: 0, reason: 'leader' });
  await wait(400);
  expect(await anyText(page, '围剿'), 'race:alliance form → 围剿 banner');
  await emit('race:alliance', { phase: 'break', members: [goose, 2], target: 0, reason: 'betrayal' });
  await wait(400);
  expect(await anyText(page, '塑料友谊'), 'race:alliance betrayal → 塑料友谊');

  // track events
  for (const [kind, text] of [['fishSpill', '鱼车'], ['geese', '鹅'], ['roadworks', '施工']]) {
    await emit('race:event', { kind, phase: 'warn', s: 1200, pos: P });
    await wait(350);
    expect(await anyText(page, text), `race:event ${kind} warn → a banner with ${text}`);
    await wait(2200);
  }
  await noErrors(h, 'hud');
}, { size: '1920x1080' });

finish('w3-hud');
