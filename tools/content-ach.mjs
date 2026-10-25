// Achievement rule scenarios (node, no browser): a fake app/session drives the real rule code through
// the real EventBus and checks what unlocks — and, as importantly, what must NOT unlock.
// Usage: node tools/content-ach.mjs [--only name,name]
import { importTs } from './content-ts.mjs';

const { createAchievements } = await importTs('src/gameplay/achievements.ts');
const { EventBus } = await importTs('src/core/events.ts');
const { createRiderState } = await importTs('src/core/rider.ts');
const { ACHIEVEMENTS } = await importTs('src/data/achievements.ts');

const FIELD = ['pelican', 'goose', 'capybara', 'cat', 'shiba', 'pigeon', 'seagull', 'sloth'];
const ID = Object.fromEntries(FIELD.map((c, i) => [c, i]));
const P = { x: 0, y: 0, z: 0 };

/** Minimal AppContext + Session the rules need (bus, save, riders, places, time). */
function makeWorld({ autopilot = false, bike = 'roadbike', stats = {}, config = {}, best = {}, achievements = [] } = {}) {
  const bus = new EventBus();
  const save = {
    data: {
      achievements: [...achievements], stats: { races: 0, wins: 0, kos: 0, wrecked: 0, busted: 0, distance: 0, ...stats },
      career: { unlocked: 1, best: { ...best } },
    },
    update(fn) { fn(this.data); },
  };
  const riders = FIELD.map((c, i) => {
    const r = createRiderState(i, c, i === 0 ? bike : 'roadbike', i === 0);
    r.mode = 'racing';
    return r;
  });
  const session = {
    config: { autopilot, mode: 'quick', trackId: 'coast', level: 1, ...config }, riders, player: riders[0], phase: 'racing', time: 0,
    rider: (id) => riders[id],
  };
  const app = { bus, save };
  const sys = createAchievements(app);
  const events = [];
  bus.on('achievement:unlock', ({ id }) => events.push(id));
  sys.attach(session);
  const w = {
    bus, save, session, sys, events, riders,
    emit: (type, payload) => bus.emit(type, payload),
    at: (t) => { session.time = t; return w; },
    /** Set standings (ids in place order) and emit placeChange like race/standings.ts. */
    order: (ids) => {
      ids.forEach((id, i) => {
        const r = riders[id];
        if (r.place === i + 1) return;
        const from = r.place;
        r.place = i + 1;
        bus.emit('race:placeChange', { riderId: id, from, to: i + 1 });
      });
    },
    finish: (place, time = 100) => bus.emit('race:finishLine', { riderId: 0, place, time }),
    ko: (victim, { attacker = 0, skillId = null, weapon = 'none' } = {}) =>
      bus.emit('combat:ko', { attacker, victim, cause: 'ko', pos: P, skillId, weapon }),
    has: (id) => save.data.achievements.includes(id),
  };
  return w;
}


const scenarios = [];
const scenario = (name, fn) => scenarios.push({ name, fn });

async function run() {
  const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1].split(',') : null;
  let failed = 0;
  for (const s of scenarios) {
    if (only && !only.includes(s.name)) continue;
    const problems = [];
    const expect = (cond, msg) => { if (!cond) problems.push(msg); };
    try {
      s.fn(expect);
    } catch (err) {
      problems.push(`threw: ${err instanceof Error ? err.stack : String(err)}`);
    }
    if (problems.length) failed++;
    console.log(`${problems.length ? 'FAIL' : 'ok  '} ${s.name}${problems.length ? `\n     - ${problems.join('\n     - ')}` : ''}`);
  }
  const ids = new Set(ACHIEVEMENTS.map((a) => a.id));
  console.log(`\n${scenarios.length - failed}/${scenarios.length} scenarios passed · ${ids.size} achievements defined`);
  process.exitCode = failed ? 1 : 0;
}

// ---------------------------------------------------------------- placing & finishing
scenario('comeback-from-last', (expect) => {
  const w = makeWorld();
  w.emit('race:start', {});
  w.order([1, 2, 3, 4, 5, 6, 7, 0]);       // player drops to last
  w.order([0, 1, 2, 3, 4, 5, 6, 7]);       // …and fights back
  w.finish(1);
  for (const id of ['first_win', 'comeback', 'podium', 'pacifist', 'untouched']) expect(w.has(id), `missing ${id}`);
  expect(!w.has('clutch'), 'clutch without a final-stretch overtake');
  expect(w.events.length === w.save.data.achievements.length, 'one event per unlock');
});

scenario('win-without-ever-being-last', (expect) => {
  const w = makeWorld();
  w.emit('race:start', {});
  w.order([1, 2, 0, 3, 4, 5, 6, 7]);
  w.finish(1);
  expect(w.has('first_win') && !w.has('comeback'), 'comeback needs a last place');
});

scenario('clutch-final-stretch', (expect) => {
  const w = makeWorld();
  w.emit('race:start', {});
  w.order([1, 0, 2, 3, 4, 5, 6, 7]);
  w.emit('race:finalStretch', { riderId: 0 });
  w.order([0, 1, 2, 3, 4, 5, 6, 7]);
  w.finish(1);
  expect(w.has('clutch'), 'clutch');
});

scenario('pacifist-and-untouched-need-it', (expect) => {
  const w = makeWorld();
  w.emit('race:start', {});
  w.emit('combat:swing', { riderId: 0, side: 1, heavy: false, weapon: 'none' });
  w.emit('combat:hit', { attacker: 1, victim: 0, damage: 9, side: -1, weapon: 'pan', heavy: false, crit: false, blocked: false, pos: P, skillId: null });
  w.finish(4);
  expect(!w.has('pacifist') && !w.has('untouched') && !w.has('podium'), 'no pacifist/untouched/podium');
});

scenario('blocked-hit-is-not-hurt-and-bell-is-not-attack', (expect) => {
  const w = makeWorld();
  w.emit('combat:bell', { riderId: 0, pos: P, angered: [1] });
  w.emit('combat:hit', { attacker: 1, victim: 0, damage: 0, side: -1, weapon: 'pan', heavy: false, crit: false, blocked: true, pos: P, skillId: null });
  w.finish(2);
  expect(w.has('pacifist') && w.has('untouched'), 'bell + blocked hit keep both');
});

scenario('bump-damage-is-not-untouched', (expect) => {
  const w = makeWorld();
  w.riders[0].hp -= 4;                                       // sim bump damage (no combat:hit)
  w.emit('rider:bump', { a: 0, b: ID.goose, strength: 6, pos: P });
  w.emit('pickup:take', { riderId: 0, kind: 'fish', pos: P });
  w.riders[0].hp = w.riders[0].maxHp;                         // healed back to full later
  w.finish(2);
  expect(!w.has('untouched') && w.has('pacifist'), 'a bump that cost HP breaks untouched');
  const v = makeWorld();
  v.emit('rider:bump', { a: ID.goose, b: 0, strength: 1, pos: P });   // soft shove, no HP lost
  v.finish(2);
  expect(v.has('untouched'), 'a soft shove keeps untouched');
});

scenario('credited-ko-is-not-pacifist', (expect) => {
  // A hard bump writes lastHitBy; the rival wrecks within 3 s → combat credits the KO without a swing.
  const w = makeWorld();
  w.emit('race:start', {});
  w.emit('rider:bump', { a: 0, b: ID.goose, strength: 6, pos: P });
  w.ko(ID.goose);
  w.finish(2);
  expect(w.has('first_ko') && w.has('goose'), 'the credited KO counts');
  expect(!w.has('pacifist'), 'a KO to your name is not 情绪稳定');
  const v = makeWorld();
  v.emit('race:start', {});
  v.ko(ID.cat, { attacker: ID.goose });                        // rivals fighting each other
  v.finish(2);
  expect(v.has('pacifist') && !v.has('first_ko'), 'rival-on-rival KOs keep pacifist');
});

scenario('last-place-and-phoenix', (expect) => {
  const w = makeWorld();
  for (let i = 0; i < 3; i++) w.emit('rider:crash', { riderId: 0, cause: 'wall', speed: 15, pos: P, attacker: null });
  w.finish(3);
  expect(w.has('phoenix') && w.has('podium') && !w.has('untouched'), 'phoenix after 3 wrecks');
  const v = makeWorld();
  v.finish(8);
  expect(v.has('last_place'), 'last_place on 8/8');
});

scenario('bike-wins', (expect) => {
  const k = makeWorld({ bike: 'kidbike' });
  k.finish(1);
  const e = makeWorld({ bike: 'erba' });
  e.finish(2);
  expect(k.has('kidbike') && !e.has('erba'), 'kidbike win yes, erba 2nd no');
});

scenario('race-end-margins-and-career-stats', (expect) => {
  const res = (t1, t2) => FIELD.map((c, i) => ({ riderId: i, character: c, name: c, isPlayer: i === 0, place: i + 1,
    time: i === 0 ? t1 : i === 1 ? t2 : 200 + i, kos: 0, wrecked: 0, coins: 0 }));
  const a = makeWorld({ stats: { races: 20, kos: 99 } });
  a.emit('race:end', { results: res(150, 150.2) });
  expect(a.has('photo_finish') && !a.has('blowout') && a.has('veteran') && !a.has('kos100'), 'photo + veteran');
  const b = makeWorld({ stats: { races: 3, kos: 100 } });
  b.emit('race:end', { results: res(150, 161) });
  expect(b.has('blowout') && !b.has('photo_finish') && b.has('kos100') && !b.has('veteran'), 'blowout + kos100');
});

// ---------------------------------------------------------------- fighting & skills
scenario('ko-chain-and-counts', (expect) => {
  const w = makeWorld();
  w.at(10).ko(ID.cat);
  w.at(14).ko(ID.shiba);                    // 4 s later: not a chain
  expect(w.has('first_ko') && !w.has('double'), 'two separate KOs are not a double');
  w.at(15).ko(ID.goose);                    // 1 s after the last one: double
  w.at(16.5).ko(ID.pigeon);                 // chain of three
  expect(w.has('double') && w.has('triple') && w.has('goose') && w.has('hat_trick') && w.has('everyone'), 'chain/goose/hat_trick/everyone');
  expect(!w.has('rampage'), 'rampage needs six');
  w.at(30).ko(ID.capybara); w.at(40).ko(ID.sloth);
  expect(w.has('rampage'), 'six KOs');
});

scenario('rival-kos-do-not-count', (expect) => {
  const w = makeWorld();
  w.at(5).ko(ID.goose, { attacker: ID.cat });
  w.at(5.5).ko(ID.shiba, { attacker: ID.cat });
  w.at(6).ko(ID.cat, { attacker: null });
  expect(w.save.data.achievements.length === 0, `nothing for others' KOs, got ${w.save.data.achievements}`);
  w.ko(0, { attacker: ID.goose });
  expect(w.has('goosed'), 'KO by the goose');
});

scenario('weapon-kos', (expect) => {
  const w = makeWorld();
  w.at(3).ko(ID.cat, { weapon: 'slipper', skillId: 'pelican.torpedo' });
  expect(!w.has('slipper'), 'a skill KO is not a slipper KO');
  w.at(20).ko(ID.shiba, { weapon: 'slipper' });
  w.at(40).ko(ID.goose, { weapon: 'keyboard' });
  expect(w.has('slipper') && w.has('keyboard'), 'slipper + keyboard');
});

scenario('showtime-triple', (expect) => {
  const w = makeWorld();
  w.at(50).emit('ult:start', { riderId: 0, skillId: 'pelican.ult' });
  w.at(51).emit('ult:impact', { riderId: 0, skillId: 'pelican.ult', pos: P, victims: [1, 2, 3, 4] });
  w.at(51.1).ko(ID.goose, { skillId: 'pelican.ult' }); w.ko(ID.capybara, { skillId: 'pelican.ult' });
  expect(w.has('first_ko') && !w.has('showtime'), 'two is not three (an ult KO is still a first KO)');
  expect(!w.has('ult_first'), 'the first SHOWTIME is no achievement any more');
  w.ko(ID.shiba, { skillId: 'pelican.ult' });
  expect(w.has('showtime'), 'showtime');
  w.at(53).ko(ID.cat);                       // finished off by hand 2 s later: the ult's, and a hand KO
  const got = w.save.data.achievements;
  expect(['double', 'triple', 'hat_trick', 'everyone', 'goose'].every((id) => !got.includes(id)),
    `SHOWTIME's own KOs are no chain, no count, no species, no goose KO (${got})`);
});

scenario('hand-kos-after-showtime-count', (expect) => {
  const w = makeWorld();
  w.at(20).emit('ult:impact', { riderId: 0, skillId: 'pelican.ult', pos: P, victims: [ID.cat, ID.shiba] });
  w.at(20.1).ko(ID.cat, { skillId: 'pelican.ult' });
  w.at(21).ko(ID.shiba);                     // a stunned victim, finished by a swing
  w.at(23).ko(ID.goose);
  expect(w.has('double') && w.has('goose') && !w.has('hat_trick'), `two hand KOs: double + goose, no hat trick (${w.save.data.achievements})`);
  w.at(26).ko(ID.pigeon);
  expect(w.has('triple') && w.has('hat_trick'), '3 hand KOs within 6 s: triple + hat trick');
});

scenario('gulp-torpedo-wing', (expect) => {
  const w = makeWorld();
  // Real order (combat/skills/gulp.ts): cast → [bite: skill:hit at once | swallow: 'gulped' 0.8 s, status removed,
  // then the spit's skill:hit] → skill:end. Nothing about the status is visible at skill:hit.
  w.emit('skill:cast', { riderId: 0, skillId: 'pelican.gulp', slot: 2 });
  w.emit('skill:hit', { riderId: 0, skillId: 'pelican.gulp', victim: ID.goose, pos: P });   // goose 0.92: bite
  w.emit('skill:hit', { riderId: 0, skillId: 'pelican.gulp', victim: ID.capybara, pos: P }); // 1.05: bite
  w.emit('skill:end', { riderId: 0, skillId: 'pelican.gulp' });
  expect(!w.has('gulp'), 'a bite is not a swallow');
  w.emit('skill:hit', { riderId: ID.cat, skillId: 'cat.spin', victim: ID.pigeon, pos: P });
  expect(!w.has('gulp'), 'a rival skill hit is not a gulp');
  w.emit('skill:cast', { riderId: 0, skillId: 'pelican.gulp', slot: 2 });
  w.emit('skill:hit', { riderId: 0, skillId: 'pelican.gulp', victim: ID.cat, pos: P });     // cat 0.85: spit
  w.emit('skill:end', { riderId: 0, skillId: 'pelican.gulp' });
  expect(w.has('gulp'), 'swallowing the cat (scale 0.85) and spitting it out is a gulp');
  for (let i = 0; i < 5; i++) w.emit('skill:hit', { riderId: 0, skillId: 'pelican.torpedo', victim: ID.cat, pos: P });
  expect(!w.has('torpedo'), 'torpedo hits are not a torpedo KO');
  w.at(30).ko(ID.cat, { skillId: 'pelican.torpedo' });
  const wing = (victim) => w.emit('skill:hit', { riderId: 0, skillId: 'pelican.wing', victim, pos: P });
  wing(ID.cat);                                                                          // wing not active
  w.emit('skill:cast', { riderId: 0, skillId: 'pelican.wing', slot: 3 });
  wing(ID.cat); wing(ID.cat); wing(ID.shiba);
  w.emit('skill:end', { riderId: 0, skillId: 'pelican.wing' });
  expect(!w.has('wing'), 'same rider twice is one, two riders is not three');
  w.emit('skill:cast', { riderId: 0, skillId: 'pelican.wing', slot: 3 });
  wing(ID.cat); wing(ID.shiba); wing(ID.pigeon);
  expect(w.has('gulp') && w.has('torpedo') && w.has('wing'), 'gulp/torpedo/wing');
});

scenario('thief-one-more-payback', (expect) => {
  const w = makeWorld();
  w.emit('combat:weaponPick', { riderId: 0, weapon: 'pan', stolenFrom: null });
  w.emit('combat:combo', { riderId: 0, count: 2 });
  expect(!w.has('thief') && !w.has('one_more'), 'crate pick / combo 2');
  const steal = () => w.emit('combat:weaponPick', { riderId: 0, weapon: 'pan', stolenFrom: ID.goose });
  steal(); steal();
  for (const count of [2, 3, 4, 5, 6, 7, 8, 9, 3, 2]) w.emit('combat:combo', { riderId: 0, count });   // ONE MORE ×4
  expect(!w.has('thief') && !w.has('one_more'), 'two steals / four ONE MOREs');
  steal();
  w.emit('combat:combo', { riderId: 0, count: 3 });
  w.at(20).emit('skill:hit', { riderId: ID.seagull, skillId: 'seagull.steal', victim: 0, pos: P });
  w.at(32).ko(ID.seagull);
  expect(w.has('thief') && w.has('one_more') && !w.has('payback'), 'payback window is 10 s');
  w.at(40).emit('skill:hit', { riderId: ID.seagull, skillId: 'seagull.steal', victim: 0, pos: P });
  w.at(45).ko(ID.seagull);
  expect(w.has('payback'), 'payback');
});

// ---------------------------------------------------------------- riding, police, rivals
scenario('riding', (expect) => {
  const w = makeWorld();
  w.emit('rider:boost', { riderId: 0, kind: 'pad', power: 0.18, time: 0.6 });      // plain launch
  w.emit('race:start', {});
  w.emit('rider:boost', { riderId: 0, kind: 'pad', power: 0.4, time: 1 });         // a boost pad later
  expect(!w.has('perfect_start'), 'plain launch / pad are not perfect starts');
  w.emit('rider:drift', { riderId: 0, phase: 'level', level: 3 });
  w.emit('rider:drift', { riderId: 0, phase: 'end', level: 0 });                   // crashed out of it
  expect(!w.has('drift3'), 'charging L3 is not releasing it');
  w.emit('rider:drift', { riderId: 0, phase: 'end', level: 3 });
  for (let i = 0; i < 3; i++) w.emit('rider:land', { riderId: 0, airTime: 0.8, perfect: i !== 1 });
  expect(!w.has('perfect3'), 'two perfect landings');
  w.emit('rider:land', { riderId: 0, airTime: 0.8, perfect: true });
  for (let i = 0; i < 9; i++) w.emit('rider:nearMiss', { riderId: 0, kind: 'traffic' });
  expect(!w.has('near_miss'), 'nine near misses');
  w.emit('rider:nearMiss', { riderId: 0, kind: 'rider' });
  w.emit('rider:crash', { riderId: 0, cause: 'water', speed: 12, pos: P, attacker: null });
  for (const id of ['drift3', 'perfect3', 'near_miss', 'water']) expect(w.has(id), `missing ${id}`);
  // 蹭饭达人: five slingshots that each turn into an overtake within 2 s (pulling out of the grid pack is not one).
  const sling = (t, passAfter, from = 5, to = from - 1) => {
    w.at(t).emit('rider:boost', { riderId: 0, kind: 'draft', power: 0.15, time: 0.8 });
    if (passAfter !== null) w.at(t + passAfter).emit('race:placeChange', { riderId: 0, from, to });
  };
  sling(1, null);
  sling(10, 3);                // passed someone, but 3 s later
  sling(20, 1, 4, 5);          // lost a place
  w.at(30).emit('race:placeChange', { riderId: 0, from: 5, to: 4 });   // an overtake with no slingshot
  expect(!w.has('slingshot'), 'slingshots without a quick overtake do not count');
  sling(40, 0.5);
  w.at(40.8).emit('race:placeChange', { riderId: 0, from: 4, to: 3 });  // same slingshot, 2nd rider: one credit
  sling(50, 1.5);
  expect(!w.has('slingshot'), 'two slingshot passes');
  sling(60, 2); sling(70, 0.2);
  expect(!w.has('slingshot'), 'four slingshot passes');
  sling(80, 1);
  expect(w.has('slingshot'), 'five slingshot passes');
  const p = makeWorld();
  p.emit('rider:boost', { riderId: 0, kind: 'pad', power: 0.3, time: 1.1 });
  const l = makeWorld();
  l.emit('race:start', {});
  l.emit('rider:boost', { riderId: 0, kind: 'launch', power: 0.3, time: 1.1 });
  expect(p.has('perfect_start') && l.has('perfect_start'), 'perfect start (pad before GO / launch kind)');
});

scenario('police', (expect) => {
  const a = makeWorld();
  a.emit('police:alert', { riderId: 0, level: 1 });
  a.emit('police:alert', { riderId: 0, level: 2 });
  a.emit('police:alert', { riderId: 0, level: 0 });          // race/police.ts giveUp(false): lets a calm rider go
  expect(!a.has('corgi') && !a.has('busted'), 'being let go (no reason) is not outrunning');
  a.emit('police:alert', { riderId: 0, level: 1, reason: 'spawn' });
  a.emit('police:alert', { riderId: 0, level: 0 });
  expect(!a.has('corgi'), 'a spawn-started chase let go without a reason is not outrunning');
  const b = makeWorld();
  b.emit('police:alert', { riderId: 0, level: 1, reason: 'spawn' });
  b.emit('police:busted', { riderId: 0, fine: 100 });
  b.riders[0].mode = 'busted';
  b.emit('police:alert', { riderId: 0, level: 0, reason: 'busted' });
  b.riders[0].mode = 'racing';
  b.emit('police:alert', { riderId: 0, level: 0 });                                // stray 0 after the ticket
  expect(b.has('busted') && !b.has('corgi'), 'busted is not outrunning');
  const c = makeWorld();
  c.emit('police:alert', { riderId: 0, level: 1 });
  c.riders[0].finishTime = 120;
  c.emit('police:alert', { riderId: 0, level: 0, reason: 'lost' });                // finished while chased
  expect(!c.has('corgi'), 'finishing is not outrunning');
  const d = makeWorld();
  d.emit('police:alert', { riderId: 0, level: 0, reason: 'lost' });               // no chase seen
  d.emit('police:alert', { riderId: 0, level: 1, reason: 'spawn' });
  d.emit('police:alert', { riderId: 0, level: 0, reason: 'lost' });
  expect(d.has('corgi'), 'outrun (reason lost)');
});

scenario('pigeon-and-sloth-passes', (expect) => {
  const w = makeWorld();
  w.order([1, 2, 0, 3, 4, ID.pigeon, 6, 7]);               // pigeon behind the player
  w.at(30).emit('skill:cast', { riderId: ID.pigeon, skillId: 'pigeon.ghost', slot: 1 });
  w.at(31.5).emit('skill:end', { riderId: ID.pigeon, skillId: 'pigeon.ghost' });
  w.at(31.6).order([1, 2, ID.pigeon, 0, 3, 4, 6, 7]);      // reappears ahead
  expect(w.has('pigeon'), 'passed by the invisible pigeon');
  w.order([1, 2, 0, 3, 4, 5, 6, 7]);
  w.order([1, 2, 0, 3, 4, ID.sloth, 6, 5]);
  w.at(60).emit('skill:cast', { riderId: ID.sloth, skillId: 'sloth.flash', slot: 1 });
  w.at(61).emit('skill:end', { riderId: ID.sloth, skillId: 'sloth.flash' });
  w.at(63).order([1, 2, ID.sloth, 0, 3, 4, 6, 5]);         // 2 s after the skill: too late
  expect(!w.has('sloth'), 'sloth window closed');
  const v = makeWorld();
  v.order([1, ID.sloth, 0, 3, 4, 5, 6, 2]);                // sloth already ahead
  v.at(10).emit('skill:cast', { riderId: ID.sloth, skillId: 'sloth.flash', slot: 1 });
  v.at(11).order([ID.sloth, 1, 0, 3, 4, 5, 6, 2]);
  expect(!v.has('sloth'), 'a rival already ahead does not "pass" you');
});

// ---------------------------------------------------------------- lifecycle & persistence
scenario('no-unlocks-after-quit-or-in-autopilot', (expect) => {
  const w = makeWorld();
  w.sys.attach(null);                                       // quit / restart
  w.finish(1);
  w.ko(ID.goose);
  const a = makeWorld({ autopilot: true });
  a.finish(1);
  a.ko(ID.goose);
  expect(w.save.data.achievements.length === 0 && a.save.data.achievements.length === 0, 'nothing unlocked');
});

scenario('saved-once-across-races', (expect) => {
  const w = makeWorld();
  w.ko(ID.goose);
  const second = { ...w.session, time: 0 };
  w.sys.attach(second);
  w.ko(ID.goose);
  const count = w.save.data.achievements.filter((id) => id === 'goose').length;
  expect(count === 1 && w.events.filter((id) => id === 'goose').length === 1, `goose saved ${count}x`);
  expect(w.sys.fresh().length === 0, 'fresh resets per race');
});

// ---------------------------------------------------------------- career (cups), old saves
/** race:end with the player at `place` (null = DNF); the career rules only read the player's row. */
const endRace = (w, place) => w.emit('race:end', { results: FIELD.map((c, i) => ({ riderId: i, character: c, name: c, isPlayer: i === 0,
  place: i === 0 ? place ?? 8 : i + 1, time: i === 0 && place === null ? null : 150 + i, kos: 0, wrecked: 0, coins: 0 })) });

scenario('cup-and-career-clears', (expect) => {
  const career = (trackId, level) => ({ mode: 'career', trackId, level });
  const mid = makeWorld({ config: career('city', 1) });          // a cup's middle event
  endRace(mid, 1);
  const quick = makeWorld({ config: { mode: 'quick', trackId: 'mountain', level: 1 } });
  endRace(quick, 1);
  const fourth = makeWorld({ config: career('mountain', 1) });   // the final, but 4th
  endRace(fourth, 4);
  const dnf = makeWorld({ config: career('mountain', 1) });
  endRace(dnf, null);
  expect([mid, quick, fourth, dnf].every((w) => !w.has('cup1')), 'no cup without a top-3 on its last event');
  const cup1 = makeWorld({ config: career('mountain', 1) });
  endRace(cup1, 3);
  expect(cup1.has('cup1') && !cup1.has('cup2') && !cup1.has('career'), 'third on the 菜鸟杯 final clears it');
  const last = makeWorld({ config: career('mountain', 3), best: { '1-mountain': 2, '2-mountain': 1 } });
  endRace(last, 1);
  expect(['cup1', 'cup2', 'cup3', 'career'].every((id) => last.has(id)), `the last cup with two cleared before: all four (${last.save.data.achievements})`);
  const old = makeWorld({ config: { mode: 'quick', trackId: 'coast', level: 1 }, best: { '1-mountain': 1, '2-mountain': 3, '3-mountain': 2 } });
  endRace(old, 6);
  expect(['cup1', 'cup2', 'cup3', 'career'].every((id) => old.has(id)), 'a save that cleared the career before collects them at its next race end');
  const twice = makeWorld({ config: career('mountain', 1), achievements: ['cup1'] });
  endRace(twice, 1);
  expect(twice.events.length === 0 && twice.save.data.achievements.filter((id) => id === 'cup1').length === 1, 'cleared again: no second unlock');
});

scenario('old-save-with-retired-and-unknown-ids', (expect) => {
  const w = makeWorld({ achievements: ['ult_first', 'no_such_thing', 'goose'] });
  w.emit('ult:start', { riderId: 0, skillId: 'pelican.ult' });
  w.at(4).ko(ID.goose);
  w.at(5).ko(ID.cat);
  const ids = w.save.data.achievements;
  expect(ids.includes('ult_first') && ids.includes('no_such_thing'), 'unknown ids stay in the save untouched');
  expect(ids.filter((id) => id === 'goose').length === 1 && !w.events.includes('goose'), 'an id already saved is not unlocked again');
  expect(w.events.includes('first_ko') && w.events.includes('double') && !w.events.includes('ult_first'), `new unlocks still work (${w.events})`);
  expect(ACHIEVEMENTS.every((a) => a.id !== 'ult_first'), 'ult_first is retired from the catalogue');
});

scenario('nothing-after-race-end', (expect) => {
  const w = makeWorld();
  w.emit('police:alert', { riderId: 0, level: 1 });
  const results = FIELD.map((c, i) => ({ riderId: i, character: c, name: c, isPlayer: i === 0, place: i + 1,
    time: null, kos: 0, wrecked: 0, coins: 0 }));
  w.emit('race:end', { results });                          // DNF: the session lives on until quit
  w.emit('police:alert', { riderId: 0, level: 0 });         // police teardown on dispose
  w.ko(ID.goose);
  w.finish(1);
  expect(w.save.data.achievements.length === 0, `got ${w.save.data.achievements}`);
});

await run();
