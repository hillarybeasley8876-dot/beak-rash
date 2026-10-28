#!/usr/bin/env node
// r6 acceptance: the police achievements (SPEC §25 — 薄纱警察). Lead-owned, read-only for workers. A fake race world
// drives the real achievement rules through the real EventBus (like tools/content-ach.mjs) and checks what unlocks
// and what must not: police_three (three officers down in one race), police_off (警局下班: the squad beaten, no more
// police this race), police_skill (an officer downed by a skill hit). corgi_down (one officer down) already exists.
//   node tools/r6/ach-police.mjs
import { importTs } from '../content-ts.mjs';

const { createAchievements } = await importTs('src/gameplay/achievements.ts');
const { EventBus } = await importTs('src/core/events.ts');
const { createRiderState } = await importTs('src/core/rider.ts');
const { ACHIEVEMENTS } = await importTs('src/data/achievements.ts');

const FIELD = ['pelican', 'goose', 'capybara', 'cat', 'shiba', 'pigeon', 'seagull', 'sloth'];
const P = { x: 0, y: 0, z: 0 };

function makeWorld() {
  const bus = new EventBus();
  const save = {
    data: { achievements: [], stats: { races: 0, wins: 0, kos: 0, wrecked: 0, busted: 0, distance: 0 }, career: { unlocked: 1, best: {} }, secrets: [], unlocks: [] },
    update(fn) { fn(this.data); },
  };
  const riders = FIELD.map((c, i) => { const r = createRiderState(i, c, 'roadbike', i === 0); r.mode = 'racing'; return r; });
  const session = {
    config: { autopilot: false, mode: 'quick', trackId: 'coast', level: 1, playerBike: 'roadbike' }, riders, player: riders[0], phase: 'racing', time: 0,
    rider: (id) => riders[id],
  };
  const sys = createAchievements({ bus, save });
  sys.attach(session);
  const w = {
    bus, save, session,
    at: (t) => { session.time = t; return w; },
    hit: (obstacleId, { attacker = 0, skillId = null, ko = false, damage = 20 } = {}) =>
      bus.emit('combat:obstacleHit', { obstacleId, attacker, weapon: 'none', damage, thrown: false, pos: P, skillId, ko }),
    down: (obstacleId, attacker = 0) => bus.emit('police:down', { obstacleId, attacker, pos: P }),
    has: (id) => save.data.achievements.includes(id),
  };
  return w;
}

const results = [];
const check = (name, ok, info = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${info ? ` ${info}` : ''}`); };

// the three new achievements exist, with Chinese names
const ids = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));
for (const id of ['police_three', 'police_off', 'police_skill']) {
  const a = ids.get(id);
  check(`achievement ${id} is defined with a Chinese name and description`, !!a && /[一-鿿]/.test(a.name) && /[一-鿿]/.test(a.desc), a ? `「${a.name}」${a.desc}` : '(missing)');
}

// police_three: three officers down by the player in one race; two is not three; a rival's downs do not count
{
  const w = makeWorld();
  w.at(10).down(901); w.at(20).down(902);
  const two = w.has('police_three');
  w.at(30).down(903, 3);
  const rival = w.has('police_three');
  w.at(40).down(904);
  check('police_three: unlocks on the player\'s third officer down in one race (not on two, not on a rival\'s)', !two && !rival && w.has('police_three'), JSON.stringify({ two, rival, three: w.has('police_three') }));
  check('corgi_down still unlocks on the first officer down', w.has('corgi_down'));
}
{
  // a new race starts from zero
  const w = makeWorld();
  w.at(10).down(901); w.at(20).down(902);
  w.sys = null;
  const w2 = makeWorld();
  w2.at(5).down(905);
  check('police_three counts per race (two in one race + one in the next is not three)', !w.has('police_three') && !w2.has('police_three'));
}

// police_off: 警局下班 for the player
{
  const w = makeWorld();
  w.bus.emit('police:offDuty', { riderId: 3 });
  const rival = w.has('police_off');
  w.bus.emit('police:offDuty', { riderId: 0 });
  check('police_off: unlocks when the player sends the police home (police:offDuty for the player; not for a rival)', !rival && w.has('police_off'), JSON.stringify({ rival, player: w.has('police_off') }));
}

// police_skill: the hit that downs the officer is one of the player's skills
{
  const w = makeWorld();
  w.at(10).hit(901, { skillId: null }); w.at(10.5).down(901);
  const melee = w.has('police_skill');
  w.at(20).hit(902, { skillId: 'pool.thunder' }); w.at(20.2).hit(902, { skillId: null }); w.at(20.3).down(902);
  const lastMelee = w.has('police_skill');
  w.at(30).hit(903, { skillId: 'pool.firebreath', attacker: 4 }); w.at(30.1).down(903, 4);
  const rival = w.has('police_skill');
  w.at(40).hit(904, { skillId: 'pool.icelance' }); w.at(40.1).down(904);
  check('police_skill: unlocks when the player\'s skill lands the downing hit (not a swing, not a rival\'s skill)', !melee && !lastMelee && !rival && w.has('police_skill'),
    JSON.stringify({ melee, lastMelee, rival, skill: w.has('police_skill') }));
}
{
  const w = makeWorld();
  w.at(10).hit(905, { skillId: 'ult.meteor', ko: true }); w.at(10.05).down(905);
  check('police_skill: an ult that downs an officer counts (ko: true)', w.has('police_skill'));
}

const failed = results.filter((ok) => !ok).length;
console.log(failed ? `\nr6-ach-police FAILED (${failed})` : '\nr6-ach-police OK');
process.exitCode = failed ? 1 : 0;
