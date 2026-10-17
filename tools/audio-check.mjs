#!/usr/bin/env node
// Audio check, two parts (exit code 1 when anything fails the quality bar):
//  offline — renders every song (20 s from the top, the loop seam, the adaptive final-stretch layer),
//            every stinger and every sfx through the real mixing graph in an OfflineAudioContext
//            (sandbox/audio.html): peak / RMS / clipping / clicks / dropouts / low-end share / render cost.
//  game    — runs a real race (gameCheck below): nothing before unlock, music per screen, event →
//            sound mapping, KO cinematic, pause muffle, mix peaks in game, no errors when muted.
//   node tools/audio-check.mjs [--offline | --game] [--seconds 20] [--only race-coast] [--sfx] [--verbose]
//                              [--stub camera,fx]   (isolate from other units' breakage)
import os from 'node:os';
import { withPage, parseArgs, BASE } from './lib.mjs';

const args = parseArgs(process.argv.slice(2));
const SECONDS = Number(args.seconds ?? 20);
const PEAK_MAX = -1;        // dBFS
const CPU_MAX = 4;
// The offline render time is wall-clock: on a loaded machine (other agents, browsers) it inflates.
// Above one runnable thread per core, CPU overruns are reported as warnings instead of failures.
const LOADED = os.loadavg()[0] > os.cpus().length;        // % of one core for music alone (net offline render time / audio time); sfx share the 5 % budget

function verdict(s, { music }) {
  const bad = [];
  if (s.peakDb > PEAK_MAX) bad.push(`peak ${s.peakDb} dBFS`);
  if (s.clipped > 0) bad.push(`${s.clipped} clipped`);
  if (s.clicks > 0) bad.push(`${s.clicks} clicks`);
  if (music && s.dropouts > 0) bad.push(`${s.dropouts} dropouts`);
  if (music && s.cpuNet > CPU_MAX && !LOADED) bad.push(`cpu ${s.cpuNet}%`);
  if (music && s.rmsDb < -30) bad.push(`too quiet ${s.rmsDb}`);
  return bad;
}

const row = (s, bad) =>
  `${s.id.padEnd(26)} peak ${String(s.peakDb).padStart(6)}  rms ${String(s.rmsDb).padStart(6)}  low ${s.lowShare.toFixed(2)}  ` +
  `clicks ${s.clicks}  cpu ${String(s.cpuNet).padStart(5)}% (raw ${s.cpuPct})  ${bad.length ? 'FAIL ' + bad.join(', ') : 'ok'}`;

const failures = [];
const RUN_OFFLINE = !args.game;
const RUN_GAME = !args.offline && !args.only;
if (RUN_OFFLINE) await withPage(async (page, h) => {
  await page.goto(BASE + '/sandbox/audio.html', { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.__audioCheck?.ready === true, null, { timeout: 60000 });
  const { songs, stingers, sfx } = await page.evaluate(() => ({
    songs: window.__audioCheck.songs, stingers: window.__audioCheck.stingers, sfx: window.__audioCheck.sfx ?? [],
  }));
  const only = typeof args.only === 'string' ? args.only.split(',') : null;
  console.log(`songs: ${songs.length}  stingers: ${stingers.length}  sfx: ${sfx.length}  load ${os.loadavg()[0].toFixed(1)} / ${os.cpus().length} cores${LOADED ? ' (loaded: cpu overruns are warnings)' : ''}`);
  for (const id of songs) {
    if (only && !only.includes(id)) continue;
    const runs = await page.evaluate(async ([songId, secs]) => {
      const c = window.__audioCheck;
      const song = await c.renderSong(songId, secs);
      const info = c.songInfo(songId);
      const seam = await c.renderSong(songId, Math.min(40, c.formSeconds(songId, info.formLength - 1) + 6), { section: info.formLength - 1 });
      const out = [song, seam];
      if (info.adaptive) out.push(await c.renderSong(songId, 12, { section: info.loopFrom, intensity: 2 }));
      return out;
    }, [id, SECONDS]);
    for (const s of runs) {
      const bad = verdict(s, { music: true });
      if (bad.length) failures.push(`${s.id}: ${bad.join(', ')}`);
      console.log(row(s, bad));
    }
  }
  // Mix balance (stems vs the full mix, glue comp bypassed) and the race hook over music + bike at 20 m/s.
  for (const id of songs) {
    if (only && !only.includes(id)) continue;
    const r = await page.evaluate(async (songId) => {
      const c = window.__audioCheck;
      const st = await c.stems(songId, 32, { section: c.songInfo(songId).loopFrom });
      const form = c.songInfo(songId).form;
      const a2 = form.indexOf('A2');
      return { ...st, mask: songId.startsWith('race-') && a2 >= 0 ? await c.hookMask(songId, a2, 16, 20) : null };
    }, id);
    const bad = [];
    const { lead, bass } = r.stems;
    if (lead !== undefined && lead > -60 && (lead > -3.5 || lead < -7.5)) bad.push(`lead ${lead} LU (want -7.5…-3.5)`);
    if (bass !== undefined && (bass > -6.5 || bass < -10.5)) bad.push(`bass ${bass} LU (want -10.5…-6.5)`);
    if (r.low > 0.4) bad.push(`60-150 Hz ${(r.low * 100).toFixed(0)} % (max 40)`);
    if (r.mask && Math.max(...Object.values(r.mask)) < 3) bad.push(`hook under the race mix ${JSON.stringify(r.mask)} dB`);
    if (bad.length) failures.push(`${id} mix: ${bad.join(', ')}`);
    const stems = Object.entries(r.stems).map(([k, v]) => `${k} ${v}`).join(' ');
    console.log(`${(id + ' mix').padEnd(26)} ${stems} | low ${(r.low * 100).toFixed(0)}% | hook ${r.mask ? JSON.stringify(r.mask) : '-'}  ${bad.length ? 'FAIL ' + bad.join(', ') : 'ok'}`);
  }
  if (!only) {
    for (const id of stingers) {
      const s = await page.evaluate((x) => window.__audioCheck.renderStinger(x), id);
      const bad = verdict(s, { music: false });
      if (bad.length) failures.push(`${s.id}: ${bad.join(', ')}`);
      console.log(row(s, bad));
    }
  }
  if (args.sfx || !only) {
    const results = await page.evaluate(async () => window.__audioCheck.renderAllSfx?.() ?? [], null);
    for (const s of results) {
      const bad = verdict(s, { music: false });
      if (bad.length) failures.push(`${s.id}: ${bad.join(', ')}`);
      if (bad.length || args.verbose) console.log(row(s, bad));
    }
    if (results.length) console.log(`sfx rendered: ${results.length}, failing: ${results.filter((s) => verdict(s, { music: false }).length).length}`);
  }
  const errors = h.logs.filter((l) => l.startsWith('[error]') || l.startsWith('[pageerror]'));
  if (errors.length) {
    failures.push(...errors);
    console.log('page errors:\n' + errors.join('\n'));
  }
});

if (RUN_GAME) failures.push(...await gameCheck());

if (failures.length) {
  console.log(`\nFAILED (${failures.length}):\n- ` + failures.join('\n- '));
  process.exit(1);
}
console.log('\nall audio checks passed');

// ---------------------------------------------------------------------------------------- game
/** In-game checks against the live game page; returns failure messages. */
async function gameCheck() {
  const fails = [];
  const expect = (cond, msg) => {
    console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`);
    if (!cond) fails.push(`game: ${msg}`);
  };
  await withPage(async (page, h) => {
    const trace = () => h.eval(() => window.__br.audio.trace());
    // Trace times are unrounded performance.now() ms; floor the emit time so nothing played in
    // the same millisecond is dropped.
    const since = async (ms) => (await trace()).filter((e) => e.ms >= Math.floor(ms));
    const has = (list, kind, id) => list.some((e) => e.kind === kind && e.id === id);
    const nowMs = () => h.eval(() => performance.now());
    // Fire bus events in-page; returns the emit time (performance.now ms).
    // Fire bus events in-page (positions just ahead of the camera); returns the emit time (ms).
    const emit = (events) => page.evaluate((evs) => {
      const c = window.__br.app.camera.position;
      const t0 = performance.now();
      for (const [type, payload] of evs) window.__br.app.bus.emit(type, { pos: { x: c.x, y: c.y - 1, z: c.z }, ...payload });
      return t0;
    }, events);

    console.log('\n-- in-game checks (/?race=coast, manual until unlocked)');
    await h.goto(`/?race=coast&seed=3&police=0&manual=1${typeof args.stub === 'string' ? `&stub=${args.stub}` : ''}`);
    const pre = await h.eval(() => window.__br.audio.state());
    expect(pre.ctx !== 'running' && pre.live === false && pre.song === null, `nothing plays before unlock (context ${pre.ctx}, live ${pre.live}, song ${pre.song}, wanted ${pre.wanted})`);
    await h.eval(() => window.__br.audio.unlock());
    const t0 = await nowMs();
    await h.realtime();
    await h.controls({ throttle: 1 });
    await h.sleep(8000);
    const st = await h.eval(() => window.__br.audio.state());
    expect(st.live && st.song === 'race-coast', `unlocked: context ${st.ctx} @ ${st.rate} Hz, base latency ${(st.latency * 1000).toFixed(1)} ms, song ${st.song}`);
    const intro = await since(t0);
    expect(has(intro, 'sting', 'count') && has(intro, 'sting', 'go'), 'countdown beeps + GO stinger');
    expect(['ann_3', 'ann_2', 'ann_1', 'ann_go'].filter((id) => has(intro, 'voice', id)).length >= 3, `countdown voice lines (${intro.filter((e) => e.kind === 'voice').map((e) => e.id).join(' ')})`);

    await h.eval(() => window.__br.app.audio.setVolumes({ music: 0, voice: 0 }));
    await h.sleep(300);
    const bike = await h.eval(() => window.__br.audio.level(2));
    expect(bike.rmsDb > -55 && bike.rmsDb < -12, `bike loops audible at speed (sfx only: rms ${bike.rmsDb} dBFS)`);
    await h.eval(() => window.__br.app.audio.setVolumes(window.__br.app.save.data.settings));
    const mix = await h.eval(() => window.__br.audio.level(4));
    expect(mix.peakDb < -1 && mix.rmsDb > -30, `race mix: peak ${mix.peakDb} dBFS (< -1), rms ${mix.rmsDb} dBFS`);

    const cases = [
      [[['combat:hit', { attacker: 0, victim: 1, damage: 12, side: 1, weapon: 'pan', heavy: false, crit: true, blocked: false, skillId: null }]], [['sfx', 'hit.pan'], ['sfx', 'hit.crit']]],
      [[['combat:hit', { attacker: 1, victim: 0, damage: 9, side: -1, weapon: 'slipper', heavy: true, crit: false, blocked: false, skillId: null }]], [['sfx', 'hit.slipper']]],
      [[['rider:land', { riderId: 0, airTime: 0.6, perfect: true }]], [['sfx', 'bike.land'], ['sfx', 'bike.perfect']]],
      [[['skill:cast', { riderId: 0, skillId: 'pelican.torpedo', slot: 1 }]], [['sfx', 'skill.pelican.torpedo']]],
      [[['skill:cast', { riderId: 0, skillId: 'goose.honk', slot: 1 }]], [['sfx', 'skill.goose.honk']]],
      [[['pickup:take', { riderId: 0, kind: 'coin' }]], [['sfx', 'pickup.coin']]],
      [[['rider:drift', { riderId: 0, phase: 'level', level: 3 }]], [['sfx', 'bike.drift.level']]],
      [[['rider:boost', { riderId: 0, kind: 'drift', power: 0.3, time: 1 }]], [['sfx', 'bike.miniturbo']]],
      [[['rider:crash', { riderId: 1, cause: 'wall', speed: 15, attacker: null }]], [['sfx', 'bike.crash']]],
      [[['traffic:honk', { obstacleId: -1 }]], [['sfx', 'traffic.horn.car']]],
      [[['taunt', { riderId: 0, text: '叮叮叮！', character: 'pelican' }]], [['sfx', 'bike.bell']]],
    ];
    for (const [events, want] of cases) {
      const at = await emit(events);
      await h.sleep(60);
      const got = await since(at);
      const missing = want.filter(([k, id]) => !has(got, k, id));
      const lag = Math.max(0, ...want.map(([k, id]) => (got.find((e) => e.kind === k && e.id === id)?.ms ?? at) - at));
      expect(missing.length === 0 && lag <= 17, `${events[0][0]} → ${want.map((w) => w[1]).join(' + ')} (+${lag.toFixed(1)} ms)${missing.length ? ' missing ' + missing.join(',') : ''}`);
      await h.sleep(250);
    }

    const koAt = await nowMs();
    await h.eval(() => window.__br.ko(2, 0));
    await h.sleep(500);
    const midKo = await h.eval(() => window.__br.audio.state());
    await h.sleep(1500);
    const ko = await since(koAt);
    expect(has(ko, 'sfx', 'ko.boom') && has(ko, 'sting', 'ko'), `KO → boom + KO stinger (${ko.map((e) => e.id).join(' ')})`);
    expect(ko.some((e) => e.kind === 'voice' && /^ann_(ko|double|triple)$/.test(e.id)), 'KO → announcer 击倒/双杀');
    expect(midKo.muffle > 0.4, `KO slow-mo muffles the music (muffle ${(+midKo.muffle).toFixed(2)})`);
    const after = await h.eval(() => window.__br.audio.state());
    expect(after.muffle < 0.15, `muffle released after the cinematic (${(+after.muffle).toFixed(2)})`);

    await h.eval(() => window.__br.app.bus.emit('flow:pause', { paused: true }));
    await h.sleep(400);
    const paused = await h.eval(() => window.__br.audio.state());
    await h.eval(() => window.__br.app.bus.emit('flow:pause', { paused: false }));
    await h.sleep(400);
    const resumed = await h.eval(() => window.__br.audio.state());
    expect(paused.muffle > 0.8 && resumed.muffle < 0.2, `pause muffles (${(+paused.muffle).toFixed(2)}) and resume clears (${(+resumed.muffle).toFixed(2)})`);

    // Pause → settings → pause → resume keeps the race song (same SongPlayer, not restarted).
    const before = await h.eval(() => window.__br.audio.state());
    await h.eval(() => window.__br.app.bus.emit('flow:pause', { paused: true }));
    await h.sleep(300);
    await page.evaluate(() => window.__br.show('settings'));
    await h.sleep(400);
    const inSettings = await h.eval(() => window.__br.audio.state());
    await page.evaluate(() => window.__br.show('pause'));
    await h.sleep(300);
    await h.eval(() => window.__br.app.bus.emit('flow:pause', { paused: false }));
    await h.sleep(400);
    const back = await h.eval(() => window.__br.audio.state());
    expect(inSettings.song === before.song && back.song === before.song && back.songsStarted === before.songsStarted,
      `pause → settings → resume keeps ${before.song} (settings: ${inSettings.song}, after: ${back.song}, players ${before.songsStarted} → ${back.songsStarted})`);

    await h.eval(() => window.__br.app.audio.setVolumes({ master: 0 }));
    await h.sleep(300);
    await emit([['combat:hit', { attacker: 0, victim: 1, damage: 5, side: 1, weapon: 'leek', heavy: false, crit: false, blocked: false, skillId: null }]]);
    const muted = await h.eval(() => window.__br.audio.level(1));
    expect(muted.peakDb < -70, `master 0 → silent (${muted.peakDb} dBFS)`);
    await h.eval(() => window.__br.app.audio.setVolumes(window.__br.app.save.data.settings));

    // After a race the menus get the lounge song; from the title, the main theme carries on into the menu.
    for (const [screen, song] of [['results', 'results'], ['menu', 'menu'], ['title', 'title'], ['menu', 'title']]) {
      await page.evaluate((sc) => window.__br.show(sc), screen);
      await h.sleep(250);
      const s2 = await h.eval(() => window.__br.audio.state());
      expect(s2.song === song, `screen ${screen} → music ${s2.song} (want ${song})`);
    }
    const fin = await h.eval(() => window.__br.audio.state());
    expect(fin.mainThreadPct < 1.5, `main-thread audio cost ${fin.mainThreadPct}% (scheduling + update; the audio thread is measured offline)`);
    const errs = await h.errors();
    const mine = errs.filter((e) => /\[audio\]|src\/audio/.test(e));
    expect(mine.length === 0, `no audio errors (${mine.length}; other units: ${errs.length - mine.length})`);
    if (mine.length) console.log(mine.join('\n'));
  });
  await withPage(async (page, h) => {
    // A race load blocks the main thread for seconds: the music must keep playing through it.
    console.log('\n-- race load (menu → race, recording the final mix)');
    await h.goto(`/?screen=menu${typeof args.stub === 'string' ? `&stub=${args.stub}` : ''}`);
    await page.mouse.click(640, 700);
    await h.sleep(2500);
    await page.evaluate(() => {
      window.__recP = window.__br.audio.record(6.5).then((x) => { window.__rec = x; });
      setTimeout(() => { void window.__br.start({ trackId: 'mountain', seed: 5 }); }, 1200);
    });
    await h.sleep(7500);
    const gap = await page.evaluate(async () => {
      await window.__recP;
      const bytes = Uint8Array.from(atob(window.__rec), (c) => c.charCodeAt(0));
      const buf = await new OfflineAudioContext(2, 32000, 32000).decodeAudioData(bytes.buffer);
      const d = buf.getChannelData(0);
      const win = Math.floor(buf.sampleRate * 0.1);
      let run = 0, longest = 0;
      for (let i = win * 5; i + win <= d.length; i += win) {
        let sum = 0;
        for (let j = i; j < i + win; j++) sum += d[j] * d[j];
        run = Math.sqrt(sum / win) < 0.0018 ? run + 1 : 0;
        longest = Math.max(longest, run);
      }
      return longest * 100;
    });
    expect(gap <= 200, `music keeps playing through a race load (longest gap ${gap} ms, limit 200)`);
  });
  return fails;
}
