#!/usr/bin/env node
// r4 acceptance: w1-llm-bike (SPEC §21 #2 Konami → 大模型限定款, #1 duck rider cosmetic). Lead-owned, read-only for
// workers.   node tools/r4/w1-llm.mjs
import { expect, finish, noErrors, sleep, withPage } from './accept-lib.mjs';

const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];
const rowsText = (page) => page.evaluate(() => [...document.querySelectorAll('.br-gar-row')].map((e) => e.textContent ?? '').join(' | '));
const toastText = (page) => page.evaluate(() => document.body.innerText);

// 1. fresh profile: hidden in the garage; Konami on the menu (keyboard) unlocks it once
await withPage(async (page, h) => {
  await page.addInitScript(() => { if (!sessionStorage.getItem('r4-init')) { localStorage.clear(); sessionStorage.setItem('r4-init', '1'); } });
  await h.goto('/?screen=garage');
  await sleep(1500);
  expect(!(await rowsText(page)).includes('大模型限定款'), 'locked: the LLM bike is not in the garage list');
  await h.goto('/?screen=menu');
  await sleep(1500);
  for (const k of KONAMI) { await page.keyboard.press(k); await sleep(120); }
  await sleep(600);
  const save = await page.evaluate(() => ({ unlocks: window.__br.app.save.data.unlocks, owned: window.__br.app.save.data.ownedBikes, screen: window.__br.app.ui.screen }));
  expect(save.unlocks.includes('llm') && save.owned.includes('llm'), `Konami unlocks and grants the bike (${JSON.stringify(save)})`);
  expect(save.screen === 'menu', `still on the menu after the code (${save.screen})`);
  expect((await toastText(page)).includes('大模型限定款已解锁'), 'a toast announces 大模型限定款已解锁');
  await h.goto('/?screen=garage');
  await sleep(1500);
  expect((await rowsText(page)).includes('大模型限定款'), 'unlocked: the garage lists 大模型限定款');
  await page.evaluate(() => window.__br.app.save.update((d) => { d.bike = 'llm'; }));
  await noErrors(h, 'unlock');
}, { size: '1920x1080' });

// 2. pad Konami: ✚↑↑↓↓←→←→ B A — B must not leave the menu while it completes the code
await withPage(async (page, h) => {
  await page.addInitScript(() => {
    localStorage.clear();
    const buttons = Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 }));
    const pad = { id: 'w1-llm pad', index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons, timestamp: 0 };
    window.__pad = (i, on) => { buttons[i] = { pressed: on, touched: on, value: on ? 1 : 0 }; pad.timestamp++; };
    navigator.getGamepads = () => [pad, null, null, null];
  });
  await h.goto('/?screen=menu');
  await sleep(1500);
  for (const b of [12, 12, 13, 13, 14, 15, 14, 15, 1, 0]) {
    await page.evaluate((i) => window.__pad(i, true), b);
    await sleep(90);
    await page.evaluate((i) => window.__pad(i, false), b);
    await sleep(110);
  }
  await sleep(600);
  const st = await page.evaluate(() => ({ unlocks: window.__br.app.save.data.unlocks, screen: window.__br.app.ui.screen }));
  expect(st.unlocks.includes('llm'), `pad Konami unlocks the bike (${JSON.stringify(st.unlocks)})`);
  expect(st.screen === 'menu', `pad B completing the code does not back out to the title (${st.screen})`);
  await noErrors(h, 'pad konami');
}, { size: '1280x720' });

// 3. racing the LLM bike: its own model (a chain that reaches the rider's neck), physics stats from data/bikes
await withPage(async (page, h) => {
  await h.goto('/?race=coast&seed=3&manual=1&traffic=0&police=0&bike=llm');
  await page.evaluate(() => { const b = window.__br; b.manual(true); for (let i = 0; i < 20 && b.session()?.phase !== 'racing'; i++) b.step(30); });
  const r = await page.evaluate(() => {
    const s = window.__br.session(), p = s.player, v = s.views.get(p.id);
    const chain = v.root.getObjectByName('llm-chain');
    let d = null;
    if (chain) {
      const V = v.root.position.constructor;
      const head = v.anchor('head', new V()), chest = v.anchor('chest', new V());
      const neck = new V().addVectors(head, chest).multiplyScalar(0.5);
      const pos = chain.geometry?.getAttribute?.('position');
      if (pos) {
        chain.updateWorldMatrix(true, false);
        d = Infinity;
        const t = new V();
        for (let i = 0; i < pos.count; i++) d = Math.min(d, t.fromBufferAttribute(pos, i).applyMatrix4(chain.matrixWorld).distanceTo(neck));
      }
    }
    return { bike: p.bike, chain: !!chain, d };
  });
  expect(r.bike === 'llm', `the player rides the llm bike (${r.bike})`);
  expect(r.chain && r.d !== null && r.d < 0.25, `the 'llm-chain' part reaches the rider's neck (closest vertex ${r.d?.toFixed?.(2)} m)`);
  await noErrors(h, 'llm race');
}, { size: '1280x720' });

// 4. duck rider cosmetic: shown only with settings.duckRider on and the 'duck' unlock
await withPage(async (page, h) => {
  const duck = async (on) => {
    await page.evaluate((x) => { localStorage.clear(); }, on);
    await page.evaluate((x) => {
      const s = JSON.parse(localStorage.getItem('beak-rash.save.v1') ?? '{}');
      localStorage.setItem('beak-rash.save.v1', JSON.stringify({ ...s, unlocks: x ? ['duck'] : [], settings: { ...(s.settings ?? {}), duckRider: x } }));
    }, on);
    await h.goto('/?race=coast&seed=3&manual=1&traffic=0&police=0');
    await page.evaluate(() => { const b = window.__br; b.manual(true); for (let i = 0; i < 20 && b.session()?.phase !== 'racing'; i++) b.step(30); });
    return page.evaluate(() => { const s = window.__br.session(); const o = s.views.get(s.player.id).root.getObjectByName('duck-rider'); return !!o && o.visible; });
  };
  await h.goto('/?screen=title');
  expect(await duck(true), 'duckRider on: a visible "duck-rider" object rides the player bike');
  expect(!(await duck(false)), 'duckRider off: no duck on the bike');
  await noErrors(h, 'duck');
}, { size: '1280x720' });

finish('w1-llm');
