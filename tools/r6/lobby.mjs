#!/usr/bin/env node
// r6 acceptance: the online rooms' screens (SPEC §28 — 联机). Lead-owned, read-only for workers. The screens talk only
// to `app.net` (the NetSystem contract, src/core/contracts.ts), so this test swaps in a scripted fake before it opens
// them and checks what the screens show and which NetSystem calls they make: the 「联机」 menu entry, the online
// screen (name, create, join by code, errors), the lobby (code, members, picks, the host's setup, ready, start,
// changing racer through the roster screen and coming back, leaving), the race's 「等待其他玩家」 cover, remote
// humans' name tags, and the way back from the results to the lobby.
//   node tools/r6/lobby.mjs
import { expect, finish, noErrors, withPage } from '../r4/accept-lib.mjs';

const STUB = '&stub=world,sim,camera,combat,race,fx,audio';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** Click if the element is there (a missing element fails its check, it does not abort the test). */
const click = (page, sel) => page.click(sel, { timeout: 3000 }).then(() => true, () => false);

/** In-page: replace app.net with a fake that records calls and plays the relay's part. */
function installFake({ connectOk = true } = {}) {
  const L = (a, b, c, u) => ({ slots: [a, b, c], ult: u });
  const listeners = new Set();
  const n = {
    calls: [], state: 'offline', message: '', ping: null, room: null, name: '',
    emit() { for (const f of [...listeners]) f(); },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    async connect(name) {
      n.calls.push(['connect', name]); n.name = name;
      if (!connectOk) { n.state = 'error'; n.message = '连接不上联机服务器'; n.emit(); return false; }
      n.state = 'online'; n.ping = 42; n.emit(); return true;
    },
    me() { return { id: 1, name: n.name, character: 'pelican', bike: 'roadbike', loadout: L('pelican.torpedo', 'pelican.gulp', 'pelican.wing', 'pelican.ult'), ready: false }; },
    createRoom() { n.calls.push(['createRoom']); n.room = { code: 'K7QX', host: 1, you: 1, members: [n.me()], setup: { trackId: 'coast', weather: null, reverse: false }, state: 'lobby' }; n.emit(); },
    joinRoom(code) { n.calls.push(['joinRoom', code]); n.room = { code, host: 2, you: 1, members: [{ ...n.me(), id: 2, name: 'Bob', character: 'moodeng', bike: 'mtb' }, n.me()], setup: { trackId: 'city', weather: null, reverse: false }, state: 'lobby' }; n.emit(); },
    pick(p) { n.calls.push(['pick', p]); const m = n.room?.members.find((x) => x.id === n.room.you); if (m) Object.assign(m, p); n.emit(); },
    ready(on) { n.calls.push(['ready', on]); const m = n.room?.members.find((x) => x.id === n.room.you); if (m) m.ready = on; n.emit(); },
    setup(s) { n.calls.push(['setup', s]); if (n.room) n.room.setup = s; n.emit(); },
    start() { n.calls.push(['start']); },
    leave() { n.calls.push(['leave']); n.room = null; n.state = 'offline'; n.emit(); },
    frame() { return 0; },
  };
  window.__fake = n;
  window.__br.app.net = n;
}
const calls = (page, name) => page.evaluate((name) => window.__fake.calls.filter((c) => c[0] === name), name);
const screen = (page) => page.evaluate(() => window.__br.app.ui.screen);
const onScreen = (sel) => [...document.querySelectorAll(sel)].filter((e) => {
  const b = e.getBoundingClientRect(), cs = getComputedStyle(e);
  return b.width > 0 && b.height > 0 && cs.visibility !== 'hidden' && +cs.opacity > 0.05 && b.left >= -1 && b.top >= -1 && b.right <= innerWidth + 1 && b.bottom <= innerHeight + 1;
}).map((e) => (e.textContent ?? '').trim());
const textOf = (page, sel) => page.evaluate(new Function('sel', `return (${onScreen.toString()})(sel).join(' | ')`), sel);
const waitScreen = (page, id, ms = 15000) => page.waitForFunction((x) => window.__br.app.ui.screen === x && !window.__br.app.ui.busy, id, { timeout: ms }).then(() => true, () => false);
async function menuTo(page, cn) {
  for (let i = 0; i < 16; i++) {
    const at = await page.evaluate((cn) => { const items = [...document.querySelectorAll('.br-menu-item')]; return { cur: items.findIndex((e) => e.classList.contains('is-focus')), want: items.findIndex((e) => (e.textContent ?? '').includes(cn)) }; }, cn);
    if (at.want < 0) return false;
    if (at.cur === at.want) break;
    await page.keyboard.press(at.cur < at.want ? 'ArrowDown' : 'ArrowUp'); await sleep(110);
  }
  await page.keyboard.press('Enter');
  return true;
}

// ---- 1. menu → 联机 → name → 创建房间 → lobby; members, setup, ready, start; 换角色 and back; leave
await withPage(async (page, h) => {
  await h.goto(`/?screen=menu${STUB}`);
  await page.evaluate(() => localStorage.removeItem('beak-rash.save.v1'));
  await h.goto(`/?screen=menu${STUB}`);
  await page.evaluate(installFake);
  await waitScreen(page, 'menu');
  await sleep(600);
  const hasEntry = await menuTo(page, '联机');
  expect(hasEntry, 'the main menu has a 「联机」 entry');
  const onOnline = await waitScreen(page, 'online');
  expect(onOnline, 'Enter on 「联机」 opens the online screen (ScreenId online)');
  await sleep(500);
  // type a name and create a room (the name field takes the keyboard; Enter on 创建房间)
  const inputs = await page.evaluate(() => [...document.querySelectorAll('[data-net-name]')].length);
  expect(inputs === 1, 'the online screen has a name field ([data-net-name])');
  await click(page, '[data-net-name]');
  await page.keyboard.press('Control+A');
  await page.keyboard.type('Alice');
  await click(page, '[data-net-create]');
  await sleep(600);
  const c1 = await calls(page, 'connect'), cr = await calls(page, 'createRoom');
  expect(c1.length === 1 && c1[0][1] === 'Alice' && cr.length === 1, `创建房间 connects under the typed name and creates a room (${JSON.stringify(c1)} ${cr.length})`);
  const onLobby = await waitScreen(page, 'lobby');
  expect(onLobby, 'a room opens the lobby (ScreenId lobby)');
  await sleep(700);
  const code = await textOf(page, '[data-net-code]');
  expect(code.includes('K7QX'), `the lobby shows the room code big and plain ([data-net-code] 「${code}」)`);
  let members = await page.evaluate(() => [...document.querySelectorAll('[data-net-member]')].map((e) => e.textContent));
  expect(members.length === 1 && members[0].includes('Alice'), `the lobby lists the members (${JSON.stringify(members)})`);
  const picked = await calls(page, 'pick');
  expect(picked.length >= 1 && picked.at(-1)[1].character === 'pelican', `entering the lobby sends this player's racer and kit as the pick (${JSON.stringify(picked.at(-1))})`);
  // Bob joins
  await page.evaluate(() => { const n = window.__fake; n.room.members.push({ id: 2, name: 'Bob', character: 'moodeng', bike: 'mtb', loadout: { slots: ['moodeng.bounce', null, null], ult: null }, ready: true }); n.emit(); });
  await sleep(500);
  members = await page.evaluate(() => [...document.querySelectorAll('[data-net-member]')].map((e) => ({ t: e.textContent, pic: !!e.querySelector('.br-portrait') })));
  expect(members.length === 2 && members[1].t.includes('Bob') && members[1].t.includes('弹跳猪') && members.every((m) => m.pic), `a member who joins appears with name, racer and portrait (${JSON.stringify(members)})`);
  // the host's setup: → changes the track
  const s0 = (await calls(page, 'setup')).length;
  await click(page, '[data-net-track-next]');
  await sleep(400);
  const su = await calls(page, 'setup');
  expect(su.length > s0 && su.at(-1)[1].trackId !== 'coast', `the host changes the track (setup ${JSON.stringify(su.at(-1))})`);
  const trackText = await textOf(page, '[data-net-track]');
  expect(trackText.length > 0, `the lobby shows the chosen track (「${trackText}」)`);
  // start is held until everyone is ready
  const startDisabled = await page.evaluate(() => document.querySelector('[data-net-start]')?.classList.contains('is-disabled') || document.querySelector('[data-net-start]')?.getAttribute('aria-disabled') === 'true');
  expect(startDisabled, 'the host\'s 「开始」 is disabled while a member (the host itself) is not ready');
  await click(page, '[data-net-ready]');
  await sleep(400);
  const rd = await calls(page, 'ready');
  expect(rd.at(-1)?.[1] === true, `准备 sends ready (${JSON.stringify(rd)})`);
  await click(page, '[data-net-start]');
  await sleep(300);
  expect((await calls(page, 'start')).length === 1, 'with everyone ready the host starts the race (start)');
  // a non-host sees no host controls
  await page.evaluate(() => { window.__fake.room.host = 2; window.__fake.emit(); });
  await sleep(400);
  const hostBits = await page.evaluate(() => [...document.querySelectorAll('[data-net-start], [data-net-track-next]')].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && !e.classList.contains('is-disabled'); }).length);
  expect(hostBits === 0, `a member who is not the host cannot change the track or start (${hostBits} host controls enabled)`);
  // 换角色 → roster → pick hamster → back to the lobby, which sends the new pick
  await click(page, '[data-net-change]');
  const onRoster = await waitScreen(page, 'roster');
  expect(onRoster, '「换角色」 opens the roster screen');
  for (let i = 0; i < 20; i++) {
    const f = await page.evaluate(() => document.querySelector('[data-roster].is-focus')?.getAttribute('data-roster'));
    if (f === 'hamster') break;
    await page.keyboard.press('ArrowRight'); await sleep(110);
  }
  await page.keyboard.press('Enter'); await sleep(300);
  await page.keyboard.press('Escape');
  const back = await waitScreen(page, 'lobby');
  await sleep(500);
  const p2 = await calls(page, 'pick');
  expect(back && p2.at(-1)?.[1].character === 'hamster', `Esc on the roster returns to the lobby, which sends the new racer (${JSON.stringify(p2.at(-1)?.[1]?.character)})`);
  // everything on screen at 1280×720
  const off = await page.evaluate(() => [...document.querySelectorAll('[data-net-member], [data-net-code], [data-net-ready], [data-net-start], [data-net-change]')].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && (b.right > innerWidth + 1 || b.bottom > innerHeight + 1 || b.left < -1 || b.top < -1); }).length);
  expect(off === 0, `the lobby fits 1280×720 (${off} elements off screen)`);
  // leave: Esc asks, yes → leave + menu
  await page.keyboard.press('Escape'); await sleep(500);
  await page.keyboard.press('Enter'); await sleep(200);
  const left = await waitScreen(page, 'menu');
  expect(left && (await calls(page, 'leave')).length === 1, 'Esc in the lobby asks, and leaving calls leave() and returns to the menu');
  await noErrors(h, 'lobby');
}, { size: '1280x720' }).catch((err) => expect(false, `the lobby walk ran to the end (${err.message.split('\n')[0]})`));

// ---- 2. join by code (lower case typed → normalised), and a connection error shown on the online screen
await withPage(async (page, h) => {
  await h.goto(`/?screen=online${STUB}`);
  await page.evaluate(installFake);
  await waitScreen(page, 'online');
  await sleep(500);
  await click(page, '[data-net-name]'); await page.keyboard.press('Control+A'); await page.keyboard.type('Bob');
  await click(page, '[data-net-code-input]'); await page.keyboard.type('k7qx');
  await click(page, '[data-net-join]');
  await sleep(600);
  const j = await calls(page, 'joinRoom');
  expect(j.length === 1 && j[0][1] === 'K7QX', `加入房间 joins by the typed code, upper-cased (${JSON.stringify(j)})`);
  expect(await waitScreen(page, 'lobby'), 'joining opens the lobby');
  await h.goto(`/?screen=online${STUB}`);
  await page.evaluate(installFake, { connectOk: false });
  await waitScreen(page, 'online');
  await sleep(400);
  await click(page, '[data-net-name]'); await page.keyboard.press('Control+A'); await page.keyboard.type('Bob');
  await click(page, '[data-net-create]');
  await sleep(700);
  const msg = await textOf(page, '[data-net-message]');
  expect(msg.includes('连接不上'), `a connection error is shown on the online screen ([data-net-message] 「${msg}」) and it stays there`);
  expect(await screen(page) === 'online', 'a failed connection stays on the online screen');
  await noErrors(h, 'online');
}, { size: '1280x720' }).catch((err) => expect(false, `the join walk ran to the end (${err.message.split('\n')[0]})`));

// ---- 3. in the race: the waiting cover until ticks run, remote humans' names, results → back to the lobby
await withPage(async (page, h) => {
  await h.goto('/?screen=menu&quality=low');
  await page.evaluate(installFake);
  await page.evaluate(() => { window.__fake.createRoom(); });
  await page.evaluate(async () => {
    const L = (a, b, c, u) => ({ slots: [a, b, c], ult: u });
    window.__br.manual(true);
    await window.__br.start({ trackId: 'coast', seed: 5, rivals: ['goose', 'cat', 'capybara', 'shiba', 'pigeon', 'penguin'], online: { room: 'K7QX', local: 0, humans: [
      { slot: 0, member: 1, name: 'Alice', character: 'pelican', bike: 'roadbike', loadout: L('pelican.torpedo', 'pelican.gulp', 'pelican.wing', 'pelican.ult') },
      { slot: 1, member: 2, name: 'Bob', character: 'moodeng', bike: 'mtb', loadout: L('moodeng.bounce', null, null, null) },
    ] } });
  });
  await page.evaluate(() => window.__br.step(40, 1 / 60));   // no ticks: the race waits
  const wait = await textOf(page, '[data-net-wait]');
  expect(wait.includes('等待'), `before the first tick the race shows 「等待其他玩家…」 ([data-net-wait] 「${wait}」)`);
  await page.evaluate(() => {
    const s = window.__br.session();
    window.__fake.frame = () => { s.tick([{ throttle: 1 }, { throttle: 1 }].map((c) => ({ steer: 0, brake: 0, drift: false, lookBack: false, hop: false, attackL: false, attackR: false, heavy: false, skill1: false, skill2: false, skill3: false, ult: false, bell: false, heavyHeld: false, ...c }))); return 1; };
    window.__br.step(600, 1 / 60);
  });
  const wait2 = await textOf(page, '[data-net-wait]');
  expect(!wait2.includes('等待'), `the cover goes away once the ticks run (「${wait2}」)`);
  const tags = await page.evaluate(() => [...document.querySelectorAll('.nt-name')].map((e) => e.textContent));
  expect(tags.some((t) => t.includes('Bob')), `a remote human's name tag shows the player's name (${JSON.stringify(tags.slice(0, 6))})`);
  await page.evaluate(() => { const s = window.__br.session(); window.__br.app.bus.emit('race:end', { results: s.logic.results() }); });
  await waitScreen(page, 'results', 20000);
  await sleep(3500);
  const choices = await textOf(page, '.br-res-choice, [data-res-choice], .br-res-next');
  await page.keyboard.press('Enter');
  const toLobby = await waitScreen(page, 'lobby', 15000);
  expect(toLobby, `after an online race the results lead back to the lobby, not into another local race (${choices.slice(0, 120)})`);
  await noErrors(h, 'online race');
}, { size: '1280x720' }).catch((err) => expect(false, `the online race walk ran to the end (${err.message.split('\n')[0]})`));

finish('r6-lobby');
