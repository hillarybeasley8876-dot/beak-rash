#!/usr/bin/env node
// r6 acceptance: skills (SPEC §24 Skills 2.0). Lead-owned, read-only for workers. Every new skill is cast by the
// player through its real loadout slot (`?loadout` set on the rider) against pinned rivals, and its effect is checked
// against its description in data/skills.ts. Reactions are checked through combat/elements.ts.
//   node tools/r6/skills.mjs [--only <group>]   groups: elem, gag, meme, ults, react, ai (each group also checks that its
// damaging skills reach a police officer: combat:obstacleHit with the skill id; the big ults with ko)
import { parseArgs } from '../lib.mjs';
import { expect, finish, noErrors, withPage } from '../r4/accept-lib.mjs';

const a = parseArgs(process.argv.slice(2));
const only = a.only ? String(a.only).split(',') : null;
const want = (g) => !only || only.includes(g);
const LINEUP = 'goose,cat,capybara,shiba,pigeon,penguin,seagull';
const URL = `/?race=coast&seed=7&traffic=0&police=0&manual=1&rivals=${LINEUP}&stub=fx,audio,ui`;

/** In-page kit: put a skill in the player's slot 1 and cast it at pinned rivals; collect events. */
function install() {
  const br = window.__br;
  const EV = ['combat:hit', 'skill:cast', 'skill:hit', 'skill:denied', 'combat:element', 'combat:reaction', 'ult:start',
    'ult:impact', 'combat:obstacleHit', 'projectile:spawn', 'pickup:take', 'pickup:spawn', 'taunt'];
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
    has: (r, id) => r.statuses.some((st) => st.id === id && st.time > 0),
    str: (r, id) => Math.max(0, ...r.statuses.filter((st) => st.id === id && st.time > 0).map((st) => st.strength)),
    /** A clean scene: rivals parked 60 m+ behind (passive), full HP, no statuses, cooldowns reset. */
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
    /** Cast `id` at a police officer 8 m ahead (an obstacle of kind 'police'); returns its combat:obstacleHit count. */
    police(id, slot = 1, dx = 0.4) {
      k.reset();
      const s = k.S(), p = k.P();
      const ob = { id: 990, kind: 'police', s: p.s + 8, x: p.x + dx, speed: p.speed, halfWidth: 0.45, halfLength: 0.9, height: 1.6, solid: false, active: true };
      s.obstacles.push(ob);
      k.cast(id, slot);
      for (let i = 0; i < 150; i++) { ob.s += ob.speed / 60; k.step(1); }
      s.obstacles.splice(s.obstacles.indexOf(ob), 1);
      return k.of('combat:obstacleHit', (e) => e.obstacleId === 990 && e.skillId === id).length;
    },
    /** Put `id` in the player's slot 1 (or the ult slot) and cast it now. */
    cast(id, slot = 1) {
      const p = k.P();
      if (slot === 4) { p.loadout.ult = id; p.sp = 100; } else p.loadout.slots[slot - 1] = id;
      k.C().resetCooldowns(0);
      k.ev.length = 0;
      k.C().cast(0, slot);
    },
  };
  for (const t of EV) br.app.bus.on(t, (p) => k.ev.push({ t, p: JSON.parse(JSON.stringify(p)) }));
  window.__k = k;
  // ride to a flat stretch away from features before testing
  for (let i = 0; i < 3000 && k.S().phase !== 'racing'; i++) br.step(1);
  br.setControls({ throttle: 1 });
  for (let i = 0; i < 120; i++) k.step(1);
}

/** Run a scenario in the page; returns { ok, info }. */
const run = (page, fn) => page.evaluate(fn).catch((err) => ({ ok: false, info: `threw: ${String(err.message).split('\n')[0]}` }));

await withPage(async (page, h) => {
  await h.goto(URL, { timeout: 120000 });
  await page.evaluate(install);
  // 0. Every catalogue skill has an implementation and a pose / glyph; the player's loadout is what the runner casts.
  const cat = await page.evaluate(async () => {
    const skills = (await import('/src/data/skills.ts')).SKILLS;
    const reg = (await import('/src/gameplay/combat/skills/registry.ts')).SKILL_IMPLS;
    const missing = Object.keys(skills).filter((id) => !reg[id]);
    const p = window.__k.P();
    return { n: Object.keys(skills).length, missing, loadout: p.loadout };
  });
  expect(cat.missing.length === 0, `every skill in data/skills.ts has an implementation (${cat.n} skills; missing: ${cat.missing.join(', ')})`);
  expect(Array.isArray(cat.loadout?.slots) && cat.loadout.slots.length === 3 && cat.loadout.slots[0] === 'pelican.torpedo' && cat.loadout.ult === 'pelican.ult',
    `the player spawns with the pelican's default kit in RiderState.loadout (${JSON.stringify(cat.loadout)})`);

  if (want('elem')) {
    const r = await run(page, () => {
      const k = window.__k, c = k.C(), out = {};
      // pool.firebreath: a cone 10 m ahead, burn on whoever it touches
      k.reset(); c.pin(1, 5, 0.6); k.step(2); k.cast('pool.firebreath'); k.step(60);
      out.fire = { hit: k.of('combat:hit', (e) => e.skillId === 'pool.firebreath' && e.victim === 1).length, burn: k.has(k.R(1), 'burn') || k.of('combat:element', (e) => e.victim === 1 && e.element === 'fire').length > 0 };
      // pool.icelance: homing, 2 cold stacks; a second lance freezes (3 stacks)
      k.reset(); c.pin(2, 18, 1); k.step(2); k.cast('pool.icelance'); k.step(90);
      const cold1 = k.str(k.R(2), 'cold');
      c.resetCooldowns(0); k.cast('pool.icelance'); k.step(90);
      out.ice = { cold1, frozen: k.has(k.R(2), 'frozen') };
      // pool.thunder: strikes the nearest rival ahead within 40 m
      k.reset(); c.pin(3, 25, -1); k.step(2); k.cast('pool.thunder'); k.step(40);
      out.thunder = k.of('combat:hit', (e) => e.skillId === 'pool.thunder' && e.victim === 3).length;
      // pool.watergun: pushes the rival ahead aside and wets it
      k.reset(); c.pin(4, 6, 0); k.step(2); const x0 = k.R(4).x; c.unpin(4); k.cast('pool.watergun'); k.step(30);
      out.water = { wet: k.has(k.R(4), 'wet'), pushed: +Math.abs(k.R(4).x - x0).toFixed(2) };
      // pool.tornado: a whirlwind that travels along the road and knocks riders it meets
      k.reset(); c.pin(5, 20, 0); k.step(2); k.cast('pool.tornado'); k.step(150);
      out.tornado = k.of('skill:hit', (e) => e.skillId === 'pool.tornado' && e.victim === 5).length + k.of('combat:hit', (e) => e.skillId === 'pool.tornado' && e.victim === 5).length;
      // pool.snowball: an arcing ball that hits a group (≥ 2 riders around the impact) with 2 cold stacks
      k.reset(); c.pin(1, 16, 0); c.pin(2, 16.5, 1.4); k.step(2); k.cast('pool.snowball'); k.step(90);
      out.snow = [1, 2].filter((id) => k.str(k.R(id), 'cold') >= 2 || k.has(k.R(id), 'frozen')).length;
      // pool.rocket: a burst forward (top speed up for ≥ 1.5 s) leaving a fire line that burns a rider behind
      k.reset(); c.pin(3, -4, 0); k.step(2); const v0 = k.P().mods.speedMul * (1 + (k.P().boostTime > 0 ? k.P().boostPower : 0));
      k.cast('pool.rocket'); k.step(30); const v1 = k.P().mods.speedMul * (1 + (k.P().boostTime > 0 ? k.P().boostPower : 0));
      c.unpin(3); k.R(3).x = k.P().x; k.step(80);
      out.rocket = { boost: +(v1 / v0).toFixed(2), burned: k.has(k.R(3), 'burn') || k.of('combat:element', (e) => e.victim === 3 && e.element === 'fire').length > 0 };
      // pool.firecracker: a trap behind the caster that blows up when a rider comes close
      k.reset(); k.cast('pool.firecracker'); k.step(20); c.pin(4, -2, 0); k.step(60);
      out.cracker = k.of('combat:hit', (e) => e.skillId === 'pool.firecracker' && e.victim === 4).length;
      // pool.bubble: blocks the next melee hit; popping it wets riders around
      k.reset(); k.cast('pool.bubble'); k.step(5); c.pin(2, 0.2, 1.2); k.step(2);
      const hp = k.P().hp; c.swing(2, 0, false); k.step(40);
      out.bubble = { blocked: k.P().hp === hp, wet: k.has(k.R(2), 'wet') };
      out.police = ['pool.firebreath', 'pool.icelance', 'pool.thunder', 'pool.snowball'].filter((id) => k.police(id) < 1);
      return {
        ok: out.fire.hit >= 1 && out.fire.burn && out.ice.cold1 >= 2 && out.ice.frozen && out.thunder >= 1 && out.water.wet && out.water.pushed >= 1
          && out.tornado >= 1 && out.snow >= 2 && out.rocket.boost >= 1.25 && out.rocket.burned && out.cracker >= 1 && out.bubble.blocked && out.bubble.wet
          && out.police.length === 0,
        info: out,
      };
    });
    expect(r.ok, `elemental pool skills do what their descriptions say ${JSON.stringify(r.info)}`);
  }

  if (want('gag')) {
    const r = await run(page, () => {
      const k = window.__k, c = k.C(), out = {};
      // pool.boomerang: out and back, can hit on both ways
      k.reset(); c.pin(1, 9, 0); k.step(2); k.cast('pool.boomerang'); k.step(120);
      out.boomerang = k.of('combat:hit', (e) => e.skillId === 'pool.boomerang' && e.victim === 1).length;
      // pool.pie: the rider ahead stops to eat (rooted ≥ 1.5 s)
      k.reset(); c.pin(2, 10, 0); k.step(2); k.cast('pool.pie'); k.step(50);
      out.pie = k.has(k.R(2), 'rooted');
      // pool.brainfight: riders around get mirrored steering
      k.reset(); c.pin(3, 3, 1.5); c.pin(4, -3, -1.5); k.step(2); k.cast('pool.brainfight'); k.step(10);
      out.brain = [3, 4].filter((id) => k.R(id).mods.steerInvert).length;
      // pool.blink: teleports 10–20 m ahead (no wall, stays on the road)
      k.reset(); const s0 = k.P().s; k.cast('pool.blink'); k.step(6);
      out.blink = +(k.P().s - s0 - k.P().speed * 0.1).toFixed(1);
      // pool.thermos: heals and removes negative statuses
      k.reset(); const p = k.P(); p.hp = p.maxHp * 0.5; c.status(0, 'slow', 3, 0.3); c.status(0, 'burn', 3, 1);
      k.cast('pool.thermos'); k.step(30);
      out.thermos = { hp: +(p.hp / p.maxHp).toFixed(2), clean: !k.has(p, 'slow') && !k.has(p, 'burn') };
      // pool.ducks: five ducks run ahead and wobble whoever they hit
      k.reset(); c.pin(5, 14, 0); k.step(2); k.cast('pool.ducks'); k.step(120);
      out.ducks = k.has(k.R(5), 'wobble') || k.of('skill:hit', (e) => e.skillId === 'pool.ducks' && e.victim === 5).length > 0;
      // pool.popup: blinds the rider ahead for seconds
      k.reset(); c.pin(6, 12, 0); k.step(2); k.cast('pool.popup'); k.step(20);
      out.popup = k.has(k.R(6), 'blind');
      // pool.warsong: the caster is boosted and riders around are slowed
      k.reset(); c.pin(1, 3, 1.5); k.step(2); k.cast('pool.warsong'); k.step(10);
      out.warsong = { boost: k.has(k.P(), 'boost'), slow: k.has(k.R(1), 'slow') };
      out.police = ['pool.boomerang', 'pool.ducks'].filter((id) => k.police(id) < 1);
      return {
        ok: out.boomerang >= 1 && out.pie && out.brain === 2 && out.blink >= 9 && out.thermos.hp >= 0.6 && out.thermos.clean && out.ducks && out.popup && out.warsong.boost && out.warsong.slow
          && out.police.length === 0,
        info: out,
      };
    });
    expect(r.ok, `gag / utility pool skills do what their descriptions say ${JSON.stringify(r.info)}`);
  }

  if (want('react')) {
    const r = await run(page, () => {
      const k = window.__k, c = k.C(), out = {};
      const react = (first, second, wantRe) => {
        k.reset(); c.pin(1, 6, 0); c.pin(2, 7, 1.3); k.step(2);
        k.cast(first); k.step(70); c.resetCooldowns(0); k.ev.length = 0;
        k.cast(second); k.step(70);
        return k.of('combat:reaction', (e) => e.reaction === wantRe).length;
      };
      out.vaporize = react('pool.watergun', 'pool.firebreath', 'vaporize');
      out.freeze = react('pool.watergun', 'pool.icelance', 'freeze');
      out.electro = react('pool.watergun', 'pool.thunder', 'electro');
      out.overload = react('pool.firebreath', 'pool.thunder', 'overload');
      return { ok: out.vaporize >= 1 && out.freeze >= 1 && out.electro >= 1 && out.overload >= 1, info: out };
    });
    expect(r.ok, `element reactions fire between skills (combat:reaction) ${JSON.stringify(r.info)}`);
  }

  if (want('meme')) {
    const r = await run(page, () => {
      const k = window.__k, c = k.C(), out = {};
      // bananacat.peel: three peels behind; a rider riding over one spins out with mirrored steering
      k.reset(); k.cast('bananacat.peel'); k.step(30); c.pin(1, -3, 0); c.unpin(1); k.R(1).x = k.P().x; k.R(1).s = k.P().s - 8; k.step(80);
      out.peel = k.R(1).mods.steerInvert || k.has(k.R(1), 'confused') || k.has(k.R(1), 'oiled');
      // cryingcat.tears: riders around get wet and slowed, the caster boosted
      k.reset(); c.pin(2, 3, 1.5); k.step(2); k.cast('cryingcat.tears'); k.step(30);
      out.tears = { wet: k.has(k.R(2), 'wet'), slow: k.has(k.R(2), 'slow'), boost: k.has(k.P(), 'boost') };
      // xinxian.fresh: pulls in pickups near the caster; every pickup speeds it up
      k.reset(); const p = k.P(); for (let i = 0; i < 4; i++) c.spawn('coin', p.s + 4 + i * 2, p.x + 3); k.cast('xinxian.fresh'); k.step(120);
      out.fresh = { taken: k.of('pickup:take', (e) => e.riderId === 0).length, boost: k.has(p, 'boost') };
      // moodeng.bounce: leaps and slams ahead: area damage + stun
      k.reset(); c.pin(3, 8, 0.5); c.pin(4, 9, -1); k.step(2); k.cast('moodeng.bounce'); k.step(90);
      out.bounce = [3, 4].filter((id) => k.of('combat:hit', (e) => e.skillId === 'moodeng.bounce' && e.victim === id).length > 0).length;
      // pedro.trash: something random happens (a projectile, a weapon, coins or a stink cloud)
      k.reset(); c.pin(5, 10, 0); k.step(2); const before = { w: p.weapon, coins: p.coins };
      k.cast('pedro.trash'); k.step(60);
      out.trash = k.of('projectile:spawn', (e) => e.owner === 0).length > 0 || p.weapon !== before.w || p.coins > before.coins
        || k.of('pickup:spawn').length > 0 || k.of('skill:hit', (e) => e.skillId === 'pedro.trash').length > 0;
      // hamster.violin: riders around are silenced (no skill casts)
      k.reset(); c.pin(6, 3, 1.5); k.step(2); k.cast('hamster.violin'); k.step(10);
      const silenced = k.R(6).mods.silenced; c.cast(6, 1); k.step(3);
      out.violin = { silenced, denied: k.of('skill:denied', (e) => e.riderId === 6).length > 0 };
      out.police = ['moodeng.bounce'].filter((id) => k.police(id) < 1);
      return {
        ok: out.peel && out.tears.wet && out.tears.slow && out.tears.boost && out.fresh.taken >= 3 && out.fresh.boost && out.bounce === 2 && out.trash && out.violin.silenced && out.violin.denied
          && out.police.length === 0,
        info: out,
      };
    });
    expect(r.ok, `the meme roster's signature skills do what their descriptions say ${JSON.stringify(r.info)}`);
  }

  if (want('ults')) {
    const r = await run(page, () => {
      const k = window.__k, c = k.C(), out = {};
      // ult.timestop: everyone else halted 3 s; the caster keeps riding; hits land
      k.reset(); c.pin(1, 6, 0); c.pin(2, 15, 1); k.step(2); c.unpin(1); c.unpin(2);
      const s1 = k.R(1).s; k.cast('ult.timestop', 4); k.step(30);
      out.stop = { halted: k.R(1).mods.halted && k.R(2).mods.halted, still: +(k.R(1).s - s1).toFixed(2), me: !k.P().mods.halted };
      k.step(200);
      out.stopEnds = !k.R(1).mods.halted;
      // ult.meteor: meteors rain on the road ahead and burn whoever they hit
      k.reset(); c.pin(3, 20, 0); c.pin(4, 30, 1.5); k.step(2); k.cast('ult.meteor', 4); k.step(240);
      out.meteor = [3, 4].filter((id) => k.of('combat:hit', (e) => e.skillId === 'ult.meteor' && e.victim === id).length > 0).length;
      // ult.storm: everyone ahead in range is wet, then struck (electro chains)
      k.reset(); c.pin(5, 15, 0); c.pin(6, 25, -1.5); k.step(2); k.cast('ult.storm', 4); k.step(240);
      out.storm = [5, 6].filter((id) => k.of('combat:hit', (e) => (e.skillId === 'ult.storm' || e.skillId === 'reaction') && e.victim === id).length > 0).length;
      out.police = ['ult.meteor', 'ult.storm'].filter((id) => k.police(id, 4, 0) < 1 || !k.of('combat:obstacleHit', (e) => e.obstacleId === 990 && e.ko === true).length);
      return { ok: out.stop.halted && out.stop.still < 0.05 && out.stop.me && out.stopEnds && out.meteor >= 1 && out.storm === 2 && out.police.length === 0, info: out };
    });
    expect(r.ok, `the shared ults work (time stop / meteor / storm) ${JSON.stringify(r.info)}`);
  }

  await noErrors(h, 'skills');
}, { size: '960x540' });

if (want('ai')) {
  // AI: rivals carrying pool skills in slot 2 use them in a real race (autopilot field, 60 s)
  await withPage(async (page, h) => {
    await h.goto('/?race=coast&seed=11&traffic=0&police=0&manual=1&stub=fx,audio', { timeout: 120000 });
    const out = await page.evaluate(() => {
      const br = window.__br;
      for (let i = 0; i < 3000 && br.session()?.phase !== 'racing'; i++) br.step(1);
      const casts = [];
      br.app.bus.on('skill:cast', (e) => casts.push(e));
      br.setControls({ throttle: 1 });
      for (let i = 0; i < 60 * 60; i += 2) {
        const p = br.session().player, sc = br.app.input.scripted;
        if (sc) sc.steer = Math.max(-1, Math.min(1, -p.x * 0.3));
        br.step(2);
      }
      const s = br.session();
      const slot2 = casts.filter((e) => e.riderId !== 0 && e.slot === 2);
      return { total: casts.filter((e) => e.riderId !== 0).length, slot2: slot2.length, kinds: [...new Set(slot2.map((e) => e.skillId))], loadouts: s.riders.filter((r) => !r.isPlayer).map((r) => r.loadout.slots.join('/')) };
    });
    expect(out.slot2 >= 3 && out.kinds.length >= 2, `rivals fire their slot-2 pool skills in a race (${out.slot2} casts of ${out.kinds.join(', ')}; ${out.total} rival casts in all)`);
    await noErrors(h, 'ai skills');
  }, { size: '960x540' });
}

finish('r6-skills');
