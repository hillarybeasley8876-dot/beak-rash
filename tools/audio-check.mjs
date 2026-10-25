#!/usr/bin/env node
// Audio check, two parts (exit code 1 when anything fails the quality bar):
//  offline — renders every song (20 s from the top, the loop seam, the adaptive final-stretch layer),
//            every stinger and every sfx through the real mixing graph in an OfflineAudioContext
//            (sandbox/audio.html): peak / RMS / clipping / clicks / dropouts / render cost; per song the
//            bass stem, the hook over the race mix, and one full loop's tone (octaves vs 125 Hz, width,
//            loudness range, breakdown / build); per race song the final-stretch layer's tone.
//  game    — runs a real race (audio-check-game.mjs): nothing before unlock, music per screen, event →
//            sound mapping, KO cinematic, pause muffle, mix peaks in game, no errors when muted;
//            race-start sync (audio-check-start.mjs), adaptive layers / finish cues (audio-check-adaptive.mjs),
//            held KO lines after short / cut cinematics (audio-check-barks.mjs),
//            no-WebAudio / WebKit robustness (audio-check-robust.mjs),
//            realtime audio-thread load (audio-check-cpu.mjs: renderCapacity p50 ≤ 5 %, p90 ≤ 8 %).
//   node tools/audio-check.mjs [--offline | --game | --cpu] [--seconds 20] [--only race-coast] [--sfx] [--verbose]
//                              [--stub camera,fx]   (isolate from other units' breakage)
import os from 'node:os';
import { withPage, parseArgs, BASE } from './lib.mjs';
import { gameCheck } from './audio-check-game.mjs';
import { robustCheck } from './audio-check-robust.mjs';
import { startCheck } from './audio-check-start.mjs';
import { cpuCheck } from './audio-check-cpu.mjs';
import { adaptiveCheck } from './audio-check-adaptive.mjs';
import { barksCheck } from './audio-check-barks.mjs';

const args = parseArgs(process.argv.slice(2));
const SECONDS = Number(args.seconds ?? 20);
const PEAK_MAX = -1;        // dBFS
// Net offline render time / audio time (% of one core) for the music: the band now plays from bars
// rendered off the audio thread (music/bars.ts), so this is the render thread's cost; the audio-thread
// budget is the realtime gate (audio-check-cpu.mjs). The render time is wall-clock: on a loaded machine
// (other agents, browsers) it inflates, so above one runnable thread per core overruns are warnings.
const CPU_MAX = 6;
const LOADED = os.loadavg()[0] > os.cpus().length;

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
const RUN_OFFLINE = !args.game && !args.cpu;
const RUN_GAME = !args.offline && !args.only && !args.cpu;
const RUN_CPU = !args.offline && !args.only;
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
    const { bass } = r.stems;
    if (bass !== undefined && (bass > -5 || bass < -11)) bad.push(`bass ${bass} LU (want -11…-5)`);
    if (r.mask && Math.max(...Object.values(r.mask)) < 3) bad.push(`hook under the race mix ${JSON.stringify(r.mask)} dB`);
    if (bad.length) failures.push(`${id} mix: ${bad.join(', ')}`);
    const stems = Object.entries(r.stems).map(([k, v]) => `${k} ${v}`).join(' ');
    console.log(`${(id + ' mix').padEnd(26)} ${stems} | low ${(r.low * 100).toFixed(0)}% | hook ${r.mask ? JSON.stringify(r.mask) : '-'}  ${bad.length ? 'FAIL ' + bad.join(', ') : 'ok'}`);
  }
  // Loop-level tone (critic r3): octaves vs the 125 Hz one, width above 200 Hz (the low end is mono),
  // loudness range, and the breakdown / build shape of section D.
  for (const id of songs) {
    if (only && !only.includes(id)) continue;
    const t = await page.evaluate((songId) => window.__audioCheck.tone(songId), id);
    const o = t.octaves;
    const bad = [];
    if (o['63'] < -1 || o['63'] > 3) bad.push(`63 Hz ${o['63']} dB (want -1…+3 vs 125 Hz)`);
    if (o['31.5'] > -4) bad.push(`31.5 Hz ${o['31.5']} dB (max -4: no rumble)`);
    if (o['1000'] > -6) bad.push(`1 kHz ${o['1000']} dB (max -6)`);
    if (o['8000'] > -10) bad.push(`8 kHz ${o['8000']} dB (max -10)`);
    if (t.sideMidHigh < -12) bad.push(`width ${t.sideMidHigh} dB S/M above 200 Hz (min -12)`);
    if (t.lra < 4) bad.push(`LRA ${t.lra} LU (min 4)`);
    if (t.breakdown && t.breakdown.dropDb > -6) bad.push(`breakdown only ${t.breakdown.dropDb} dB under B2 (want ≤ -6)`);
    if (t.breakdown && t.breakdown.build.some((v, k, a) => k > 0 && v <= (a[k - 1] ?? -Infinity))) bad.push(`build not rising ${t.breakdown.build.join(' ')}`);
    if (bad.length) failures.push(`${id} tone: ${bad.join(', ')}`);
    console.log(`${(id + ' tone').padEnd(26)} 63 ${o['63']} 250 ${o['250']} 1k ${o['1000']} 4k ${o['4000']} 8k ${o['8000']} | S/M ${t.sideMid} (>200 Hz ${t.sideMidHigh}) corr ${t.corr} | LRA ${t.lra} | D ${t.breakdown?.dropDb ?? '-'}  ${bad.length ? 'FAIL ' + bad.join(', ') : 'ok'}`);
    if (!id.startsWith('race-')) continue;
    // The final-stretch layer (claps, cowbell, doubled hook, double-time hats) was the honkiest mix of all.
    const st = await page.evaluate((songId) => window.__audioCheck.tone(songId, true), id);
    const so = st.octaves;
    const sbad = [];
    if (so['1000'] > -4) sbad.push(`1 kHz ${so['1000']} dB (max -4)`);
    if (so['8000'] > -8) sbad.push(`8 kHz ${so['8000']} dB (max -8)`);
    if (sbad.length) failures.push(`${id} stretch tone: ${sbad.join(', ')}`);
    console.log(`${(id + ' stretch tone').padEnd(26)} 63 ${so['63']} 250 ${so['250']} 1k ${so['1000']} 4k ${so['4000']} 8k ${so['8000']} | S/M >200 Hz ${st.sideMidHigh}  ${sbad.length ? 'FAIL ' + sbad.join(', ') : 'ok'}`);
  }
  if (!only) {
    for (const id of stingers) {
      const s = await page.evaluate((x) => window.__audioCheck.renderStinger(x), id);
      const bad = verdict(s, { music: false });
      if (bad.length) failures.push(`${s.id}: ${bad.join(', ')}`);
      console.log(row(s, bad));
    }
  }
  if (!only) {
    // Reused voices stay silent until their note (two notes per instrument, stingers after 5 s idle)
    // and a song stop fades (0.8 s: about -1.2 dB 100 ms in, -6 dB 400 ms in).
    const r = await page.evaluate(async () => {
      const c = window.__audioCheck;
      return { inst: await c.retriggerChecks(), sting: await c.stingerIdleChecks(), fade: await c.fadeOutCheck() };
    });
    const bad = [...r.inst, ...r.sting].filter((s) => s.preDb >= -60 || s.hitDb < -40);
    for (const s of bad) failures.push(`retrigger ${s.id}: ${s.preDb} dBFS in the 150 ms before the note (max -60), note ${s.hitDb} dBFS`);
    for (const s of args.verbose ? [...r.inst, ...r.sting] : bad) console.log(`retrigger ${s.id.padEnd(17)} before ${s.preDb} dB  note ${s.hitDb} dB`);
    console.log(`retrigger: ${r.inst.length} instruments + ${r.sting.length} stingers, ${bad.length} failing`);
    const fadeOk = r.fade.at100 > -3 && r.fade.at400 < -3 && r.fade.at400 > -12;
    if (!fadeOk) failures.push(`song stop fade: ${r.fade.at100} dB at 100 ms (want > -3), ${r.fade.at400} dB at 400 ms`);
    console.log(`song stop fade (${r.fade.id}): ${r.fade.at100} dB at 100 ms, ${r.fade.at400} dB at 400 ms  ${fadeOk ? 'ok' : 'FAIL'}`);
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

if (RUN_GAME) {
  failures.push(...await gameCheck(args), ...await startCheck(args), ...await adaptiveCheck(args), ...await barksCheck(args));
  failures.push(...await robustCheck(args));
}
if (RUN_CPU) failures.push(...(await cpuCheck(args)).fails);

if (failures.length) {
  console.log(`\nFAILED (${failures.length}):\n- ` + failures.join('\n- '));
  process.exit(1);
}
console.log('\nall audio checks passed');
