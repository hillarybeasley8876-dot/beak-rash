#!/usr/bin/env node
// Race soak: full autopilot races (manual stepping, dt 1/30) for several seeds. Asserts the race ends,
// nobody gets stuck, positions stay sane, traffic never spawns inside riders, the police can bust,
// and no console errors. Prints a per-seed summary.
//   node tools/race-soak.mjs [--seeds 1,2,3] [--track coast] [--stub fx,ui] [--shots] [--max 9000] [--lenient]
// Any console error fails; --lenient only fails on errors mentioning race/traffic/police (isolation runs).
import { parseArgs, withPage } from './lib.mjs';

const a = parseArgs(process.argv.slice(2));
const seeds = String(a.seeds ?? '1,2,3').split(',').map(Number);
const track = a.track ?? 'coast';
const stub = a.stub ? `&stub=${a.stub}` : '';
const MAX_FRAMES = Number(a.max ?? 9000);   // at dt 1/30 → 300 s of race time
const CHUNK = 15;                            // frames between samples (0.5 s)
const DT = 1 / 30;
let failures = 0;
/** Metres between the first and last rider still racing (how close the race is). */
const spread = (sample) => {
  const ss = (sample?.riders ?? []).map((r) => r.s);
  return ss.length ? `${(Math.max(...ss) - Math.min(...ss)).toFixed(0)} m` : '-';
};
const fail = (seed, msg) => { failures++; console.log(`  FAIL [seed ${seed}] ${msg}`); };

const INSTRUMENT = `(() => {
  const s = window.__br.session(), bus = window.__br.app.bus;
  const stats = { counts: {}, crashes: {}, spawnOverlaps: [], skills: {}, busted: 0, alerts: [], playerHitsTaken: 0, playerHitsGiven: 0, drifts: 0, aiOvertakes: 0 };
  window.__soak = stats;
  const inc = (o, k) => { o[k] = (o[k] ?? 0) + 1; };
  for (const t of ['combat:hit','combat:ko','rider:crash','race:placeChange','taunt','traffic:honk','rider:nearMiss','rider:drift','rider:hop','skill:cast','police:alert','police:busted','pickup:take','rider:bump','rider:obstacleHit'])
    bus.on(t, (p) => {
      inc(stats.counts, t);
      if (t === 'rider:crash') inc(stats.crashes, p.cause);
      if (t === 'skill:cast') inc(stats.skills, p.skillId);
      if (t === 'police:busted') stats.busted++;
      if (t === 'police:alert') stats.alerts.push(p.level);
      if (t === 'combat:hit' && p.victim === s.player.id) stats.playerHitsTaken++;
      if (t === 'combat:hit' && p.attacker === s.player.id) stats.playerHitsGiven++;
      if (t === 'rider:drift' && p.phase === 'start') stats.drifts++;
      if (t === 'race:placeChange' && p.to < p.from && p.riderId !== s.player.id) stats.aiOvertakes++;
    });
  const push = s.obstacles.push.bind(s.obstacles);
  s.obstacles.push = (...obs) => {
    for (const o of obs) for (const r of s.riders) {
      if (Math.abs(r.s - o.s) < o.halfLength + 0.9 && Math.abs(r.x - o.x) < o.halfWidth + 0.45 && o.kind !== 'police')
        stats.spawnOverlaps.push({ id: o.id, rider: r.id, ds: +(r.s - o.s).toFixed(1), dx: +(r.x - o.x).toFixed(1) });
    }
    return push(...obs);
  };
})()`;

const SAMPLE = `(() => {
  const s = window.__br.session();
  const bad = [];
  for (const r of s.riders) {
    const b = s.track.bounds(Math.min(Math.max(r.s, 0), s.track.length));
    if (![r.s, r.x, r.y, r.speed].every(Number.isFinite)) bad.push(r.id + ':NaN');
    else if (r.s < -5 || r.s > s.track.length + 250) bad.push(r.id + ':s=' + r.s.toFixed(0));
    else if (r.x < -b.left - 3 || r.x > b.right + 3) bad.push(r.id + ':x=' + r.x.toFixed(1));
  }
  return { phase: s.phase, time: s.time, ended: !!window.__raceEnded, bad,
    riders: s.riders.map((r) => ({ id: r.id, c: r.character, mode: r.mode, v: r.speed, s: r.s, place: r.place })) };
})()`;

for (const seed of seeds) {
  await withPage(async (page, h) => {
    await h.goto(`/?race=${track}&seed=${seed}&autopilot=1&manual=1&intro=0${stub}`);
    await h.eval(INSTRUMENT);
    await h.eval(`window.__br.app.bus.on('race:end', (p) => { window.__raceEnded = p.results; })`);
    const stuck = new Map();
    let frames = 0, sample = null, policeChecked = false, policeState = null, maxStuck = 0;
    while (frames < MAX_FRAMES) {
      await h.step(CHUNK, DT);
      frames += CHUNK;
      sample = await h.eval(SAMPLE);
      if (sample.bad.length) { fail(seed, `insane positions ${sample.bad.join(' ')}`); break; }
      for (const r of sample.riders) {
        const slow = sample.phase === 'racing' && r.mode === 'racing' && r.v < 2;
        const t = slow ? (stuck.get(r.id) ?? 0) + CHUNK * DT : 0;
        stuck.set(r.id, t);
        maxStuck = Math.max(maxStuck, t);
        if (t > 5) { fail(seed, `rider ${r.id} (${r.c}) stuck at s=${r.s.toFixed(0)}`); stuck.set(r.id, -999); }
      }
      if (!policeChecked && sample.time > 40) {
        policeChecked = true;
        // The corgi is outrunnable now: wait until it rides alongside, then brake next to it.
        await h.eval('window.__br.race.setHeat(0.95)');
        for (let i = 0; i < 40; i++) {
          await h.step(15, DT);
          frames += 15;
          const p = await h.eval('window.__br.race.police()');
          if (p?.mode === 'chase' && Math.abs(p.gap) < 4) break;
        }
        await h.eval('window.__br.race.brake(0, 6)');
        await h.step(240, DT);
        frames += 240;
        policeState = await h.eval('window.__br.race.police()');
      }
      if (sample.ended) break;
    }
    const stats = await h.eval('window.__soak');
    const results = await h.eval('window.__raceEnded ?? null');
    const errs = await h.errors();
    if (!results) fail(seed, `race did not end within ${MAX_FRAMES} frames (phase ${sample?.phase}, t=${sample?.time?.toFixed(0)})`);
    if (stats.spawnOverlaps.length) fail(seed, `traffic spawned inside riders ${JSON.stringify(stats.spawnOverlaps.slice(0, 3))}`);
    if (a.police !== '0' && stats.busted < 1) fail(seed, `police never busted the braking player (police ${JSON.stringify(policeState)})`);
    const mine = errs.filter((e) => /race|traffic|police/i.test(e));
    if (mine.length || (!a.lenient && errs.length)) fail(seed, `console errors: ${(mine.length ? mine : errs).slice(0, 2).map((e) => e.slice(0, 200)).join(' | ')}`);
    else if (errs.length) console.log(`  (warn) ${errs.length} console errors from other units, e.g. ${errs[0].slice(0, 120)}`);
    if (a.shots) await h.shot(`shots/race/soak-${seed}.png`);
    const me = results?.find((r) => r.isPlayer);
    console.log(`seed ${seed}: ${results ? 'ended' : 'NOT ENDED'} t=${sample?.time?.toFixed(1)}s frames=${frames} player=${me ? `${me.place} (${me.time?.toFixed(1) ?? 'DNF'})` : '-'} maxStuck=${maxStuck.toFixed(1)}s`);
    console.log(`  results: ${(results ?? []).map((r) => `${r.place}.${r.character}${r.time === null ? '(DNF)' : ''}`).join(' ')}`);
    console.log(`  events: ${JSON.stringify(stats.counts)}`);
    console.log(`  crashes: ${JSON.stringify(stats.crashes)} skills: ${JSON.stringify(stats.skills)} busted: ${stats.busted} alerts: ${stats.alerts.join('')}`);
    console.log(`  player hits taken/given: ${stats.playerHitsTaken}/${stats.playerHitsGiven} · drifts: ${stats.drifts} · AI overtakes: ${stats.aiOvertakes} · spread at end: ${spread(sample)}`);
  });
}
console.log(failures ? `\nSOAK FAILED (${failures})` : '\nSOAK OK');
process.exit(failures ? 1 : 0);
