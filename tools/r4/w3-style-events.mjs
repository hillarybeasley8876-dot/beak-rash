#!/usr/bin/env node
// r4 acceptance: w3-style-events (SPEC §17: STYLE for threading the police roadblock's gap (150), riding through a
// goose flock without touching a goose (120), smashing a fruit stall (100)). Lead-owned, read-only for workers.
// The events are emitted the way race / police / events emit them; the player rides through.
//   node tools/r4/w3-style-events.mjs
import { capture, clearEvents, events, expect, finish, hold, noErrors, race, withPage } from './accept-lib.mjs';

const C = { throttle: 1 };
const P = { x: 0, y: 0, z: 0 };

await withPage(async (page, h) => {
  await race(page, h, { track: 'coast', seed: 3, extra: '&traffic=0&police=0' });
  const park = () => page.evaluate(() => { const b = window.__br, s = b.session(); for (const r of s.riders) if (!r.isPlayer) b.teleport(r.id, s.player.s + 900 + r.id * 12, 0); });
  await park();
  await capture(page, ['style:chain']);
  /** Run `setup` in the page (it sets window.__tgt, the spot), ride until `past` metres beyond it; the chain actions. */
  const ride = async (setup, past = 20, during = null) => {
    await hold(page, { throttle: 0, brake: 1 }, 200); // let any open chain time out and bank
    await clearEvents(page);
    await page.evaluate(setup);
    let hooked = false;
    for (let i = 0; i < 60; i++) {
      await hold(page, C, 10);
      const st = await page.evaluate(() => { const p = window.__br.session().player; return { s: p.s, tgt: window.__tgt }; });
      if (during && !hooked && st.s > st.tgt - 4) { hooked = true; await page.evaluate(during); }
      if (st.s > st.tgt + past) break;
    }
    await hold(page, C, 10);
    return (await events(page, 'style:chain')).filter((x) => x.e.riderId === 0).map((x) => `${x.e.action}:${x.e.points}`);
  };

  // 1. the roadblock: through the gap scores, around it (outside the gap) does not
  let acts = await ride(() => {
    const b = window.__br, s = b.session(), p = s.player;
    window.__tgt = p.s + 70; b.teleport(0, p.s, 2); p.speed = 16;
    b.app.bus.emit('police:roadblock', { riderId: 0, s: window.__tgt, gapX: 2, gapWidth: 3.2, pos: { x: 0, y: 0, z: 0 } });
  });
  expect(acts.some((a) => a.startsWith('roadblock:150')), `threading the roadblock's gap scores roadblock 150 (${acts.join(', ') || 'none'})`);
  acts = await ride(() => {
    const b = window.__br, s = b.session(), p = s.player;
    window.__tgt = p.s + 70; b.teleport(0, p.s, -3.5); p.speed = 16;
    b.app.bus.emit('police:roadblock', { riderId: 0, s: window.__tgt, gapX: 2, gapWidth: 3.2, pos: { x: 0, y: 0, z: 0 } });
  });
  expect(!acts.some((a) => a.startsWith('roadblock')), `passing outside the gap scores nothing (${acts.join(', ') || 'none'})`);

  // 2. the goose flock: through it untouched scores; a goose honking at the player (a touch) does not
  acts = await ride(() => {
    const b = window.__br, s = b.session(), p = s.player;
    window.__tgt = p.s + 70; b.teleport(0, p.s, 0); p.speed = 16;
    b.app.bus.emit('race:event', { kind: 'geese', phase: 'start', s: window.__tgt, pos: { x: 0, y: 0, z: 0 } });
  }, 45);
  expect(acts.some((a) => a.startsWith('geese:120')), `riding through the goose flock untouched scores geese 120 (${acts.join(', ') || 'none'})`);
  acts = await ride(() => {
    const b = window.__br, s = b.session(), p = s.player;
    window.__tgt = p.s + 70; b.teleport(0, p.s, 0); p.speed = 16;
    b.app.bus.emit('race:event', { kind: 'geese', phase: 'start', s: window.__tgt, pos: { x: 0, y: 0, z: 0 } });
  }, 45, () => {
    const b = window.__br, s = b.session(), p = s.player;
    s.obstacles.push({ id: 995, kind: 'goose', s: p.s + 1, x: p.x, speed: 0, halfWidth: 0.3, halfLength: 0.3, height: 0.6, solid: false, active: true });
    b.app.bus.emit('traffic:honk', { obstacleId: 995, pos: { x: 0, y: 0, z: 0 } });
  });
  expect(!acts.some((a) => a.startsWith('geese')), `a goose the player touched (it honks at the player) — no flock bonus (${acts.join(', ') || 'none'})`);

  // 3. a fruit stall the player smashes (its owner shouts) scores; one smashed far from the player does not
  acts = await ride(() => {
    const b = window.__br, s = b.session(), p = s.player;
    window.__tgt = p.s + 40; b.teleport(0, p.s, 0); p.speed = 16;
  }, 10, () => {
    const b = window.__br, s = b.session(), p = s.player;
    s.obstacles.push({ id: 996, kind: 'stall', s: p.s + 1.5, x: p.x + 0.5, speed: 0, halfWidth: 1.2, halfLength: 1, height: 2, solid: false, active: true });
    b.app.bus.emit('npc:say', { obstacleId: 996, character: 'sloth', text: '我的西瓜！' });
  });
  expect(acts.some((a) => a.startsWith('stall:100')), `smashing a fruit stall scores stall 100 (${acts.join(', ') || 'none'})`);
  acts = await ride(() => {
    const b = window.__br, s = b.session(), p = s.player;
    window.__tgt = p.s + 40; b.teleport(0, p.s, 0); p.speed = 16;
  }, 10, () => {
    const b = window.__br, s = b.session(), p = s.player;
    s.obstacles.push({ id: 997, kind: 'stall', s: p.s + 300, x: 0, speed: 0, halfWidth: 1.2, halfLength: 1, height: 2, solid: false, active: true });
    b.app.bus.emit('npc:say', { obstacleId: 997, character: 'sloth', text: '我的西瓜！' });
  });
  expect(!acts.some((a) => a.startsWith('stall')), `a stall smashed 300 m away (a rival did it) scores nothing (${acts.join(', ') || 'none'})`);
  await noErrors(h, 'style events');
}, { size: '1280x720' });

finish('w3-style-events');
