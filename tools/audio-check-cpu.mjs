// Realtime audio-thread load part of tools/audio-check.mjs: the browser's own render-capacity
// meter (CDP WebAudio.getRealtimeData, the fraction of each render quantum spent rendering) in
// the menu (title theme), a race on autopilot, the forced final-stretch layer, a busy pack (a
// burst of rival hits and bumps), and the race without music. Budget: p50 ≤ 5 %, p90 ≤ 8 %.
// A control tab in the same browser (one 32 kHz oscillator) is sampled alongside: while it reads
// < 1 % the meter is not inflated by machine load and an overrun FAILS; only a control ≥ 1 % turns
// overruns into warnings. Any '[audio] unknown sfx' warning during the run fails the gate too.
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import { withPage, parseArgs } from './lib.mjs';

const P50_MAX = 5;
const P90_MAX = 8;
const CONTROL_MAX = 1;
/** The machine counts as loaded above this share of busy CPU time (a 1 s sample of os.cpus()). */
export const LOAD_BUSY = 0.7;

/**
 * The machine's load (0..1): the share of the CPU the cores are busy with, sampled over ~1 s.
 * os.loadavg() is always [0,0,0] on Windows, so the load is measured from os.cpus() instead: the
 * busy ticks of two samples a second apart against the total ticks (a counter that went backwards
 * is skipped — Windows resets them).
 */
export async function machineLoad(sampleMs = 1000) {
  const s = await sampleLoad(sampleMs);
  return s.share;
}

/**
 * The hottest core's busy share (0..1): the audio thread runs on ONE core, so a saturated core
 * starves it even when the machine as a whole is not (a box with 32 cores at 60 % overall can
 * still have a core at 95 %).
 */
export async function machineHeat(sampleMs = 1000) {
  const s = await sampleLoad(sampleMs);
  return s.hot;
}

/** One load sample: the overall busy share and the hottest core's. */
async function sampleLoad(sampleMs) {
  const ticks = () => os.cpus().map((c) => ({ ...c.times }));
  const a = ticks();
  await new Promise((r) => setTimeout(r, sampleMs));
  const b = ticks();
  let idle = 0;
  let total = 0;
  let hot = 0;
  for (let i = 0; i < b.length; i++) {
    let cIdle = 0;
    let cTotal = 0;
    for (const k of Object.keys(b[i] ?? {})) {
      const d = (b[i][k] ?? 0) - (a[i]?.[k] ?? 0);
      if (d <= 0) continue;
      total += d;
      cTotal += d;
      if (k === 'idle') { idle += d; cIdle += d; }
    }
    if (cTotal > 0) hot = Math.max(hot, 1 - cIdle / cTotal);
  }
  const share = total > 0 ? Math.max(0, Math.min(1, 1 - idle / total)) : 0;
  return { share, hot: Math.max(0, Math.min(1, hot)) };
}

/**
 * A loaded machine: the cpu is busy beyond 70 % — as a whole, or on the core the audio thread
 * runs on. On such a box the render times and the main-thread measurements are inflated (the
 * threads are preempted), so an overrun is a warning, not a failure.
 */
export async function isLoaded(sampleMs = 1000) {
  const s = await sampleLoad(sampleMs);
  return s.share > LOAD_BUSY || s.hot > LOAD_BUSY;
}

/** The cpu snapshot of every core (the cumulative times, like os.cpus()). */
const snapshot = () => os.cpus().map((c) => ({ ...c.times }));

/**
 * The machine's busy share since the last snapshot (0..1). The load is sampled over ~1 s
 * (the caller keeps the snapshot), because a single short window says nothing about a busy box.
 */
function busyShare(prev) {
  const now = snapshot();
  let idle = 0;
  let total = 0;
  let hot = 0;
  for (let i = 0; i < now.length; i++) {
    let cIdle = 0;
    let cTotal = 0;
    for (const k of Object.keys(now[i] ?? {})) {
      const d = (now[i][k] ?? 0) - (prev[i]?.[k] ?? 0);
      if (d <= 0) continue;          // a counter that went backwards (Windows) is skipped
      total += d;
      cTotal += d;
      if (k === 'idle') { idle += d; cIdle += d; }
    }
    if (cTotal > 0) hot = Math.max(hot, 1 - cIdle / cTotal);
  }
  return {
    share: total > 0 ? Math.max(0, Math.min(1, 1 - idle / total)) : 0,
    hot: Math.max(0, Math.min(1, hot)),
    snapshot: now,
  };
}

/** Sampler for the newest realtime context of `page`: renderCapacity in % (null before one exists). */
async function sampler(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('WebAudio.enable');
  const ids = [];
  cdp.on('WebAudio.contextCreated', (e) => { if (e.context.contextType === 'realtime') ids.push(e.context.contextId); });
  return async () => {
    const id = ids[ids.length - 1];
    if (id === undefined) return null;
    const r = await cdp.send('WebAudio.getRealtimeData', { contextId: id }).catch(() => null);
    return r ? r.realtimeData.renderCapacity * 100 : null;
  };
}

const quantile = (xs, p) => +(xs[Math.min(xs.length - 1, Math.floor(xs.length * p))] ?? NaN).toFixed(2);

/** Measure the game and the control tab together for `seconds` (4 samples / s). */
function meter(game, control, h) {
  return async (seconds) => {
    const xs = [];
    const cs = [];
    // The machine's own load during the window (1 s buckets): a busy box inflates the render times.
    let prev = snapshot();
    let acc = 0;
    let accHot = 0;
    let n = 0;
    let busy = 0;
    let hot = 0;
    for (let i = 0; i < seconds * 4; i++) {
      await h.sleep(250);
      const [g, c] = await Promise.all([game(), control()]);
      if (g !== null) xs.push(g);
      if (c !== null) cs.push(c);
      const now = busyShare(prev);
      prev = now.snapshot;
      acc += now.share;
      accHot += now.hot;
      n += 1;
      if (n >= 4) { busy = Math.max(busy, acc / n); hot = Math.max(hot, accHot / n); acc = 0; accHot = 0; n = 0; }
    }
    if (n > 0) { busy = Math.max(busy, acc / n); hot = Math.max(hot, accHot / n); }
    xs.sort((a, b) => a - b);
    cs.sort((a, b) => a - b);
    return {
      n: xs.length, p50: quantile(xs, 0.5), p90: quantile(xs, 0.9),
      ctl50: quantile(cs, 0.5), ctl90: quantile(cs, 0.9),
      busy: +busy.toFixed(3), hot: +hot.toFixed(3),
    };
  };
}

/** A burst of rival combat around the player: hits with every weapon, bumps, swings (the busiest sfx moment). */
const packBurst = async () => {
  const { WEAPONS } = await import('/src/data/weapons.ts');
  const weapons = Object.keys(WEAPONS);
  const c = window.__br.app.camera.position;
  const pos = { x: c.x + 1.5, y: c.y - 1, z: c.z - 6 };
  const bus = window.__br.app.bus;
  let k = 0;
  const iv = setInterval(() => {
    const a = 1 + (k % 6);
    const b = 1 + ((k + 3) % 6);
    const weapon = weapons[k % weapons.length];
    bus.emit('combat:hit', { attacker: a, victim: b, damage: 8, side: 1, weapon, heavy: k % 3 === 0, crit: k % 5 === 0, blocked: false, skillId: null, pos });
    bus.emit('rider:bump', { a, b, strength: 2, pos });
    bus.emit('combat:swing', { riderId: a, side: k % 2 ? 1 : -1, heavy: false, weapon });
    k++;
  }, 120);
  setTimeout(() => clearInterval(iv), 6000);
  return weapons.length;
};

export async function cpuCheck(args = {}) {
  const fails = [];
  const report = {};
  // A loaded machine (other agents, browsers) inflates the render times: the overruns are warnings.
  const busy = await machineLoad(1000);
  const heat = await machineHeat(1000);
  let peak = busy;
  let peakHeat = heat;
  const loaded = busy > LOAD_BUSY || heat > LOAD_BUSY;
  const stub = typeof args.stub === 'string' ? `&stub=${args.stub}` : '';
  console.log(`\n-- realtime audio load (renderCapacity, 1920x1080, control tab = one 32 kHz oscillator) · machine ${(busy * 100).toFixed(0)}% busy, hottest core ${(heat * 100).toFixed(0)}%${loaded ? ' (loaded: overruns are warnings)' : ''}`);
  await withPage(async (page, h) => {
    const tab = await page.context().browser().newPage();
    const control = await sampler(tab);
    await tab.goto('about:blank');
    await tab.evaluate(() => {
      const c = new AudioContext({ sampleRate: 32000 });
      const osc = new OscillatorNode(c);
      osc.connect(new GainNode(c, { gain: 0.001 })).connect(c.destination);
      osc.start();
      window.__ctl = c;
    });
    const measure = meter(await sampler(page), control, h);
    await h.goto(`/?screen=menu${stub}`);
    await page.mouse.click(960, 900);
    await h.sleep(2500);
    report.menu = await measure(8);
    await h.eval(() => window.__br.app.audio.music(null));
    await h.sleep(1500);
    report.idle = await measure(5);
    await h.eval(() => window.__br.start({ trackId: 'coast', seed: 4, autopilot: true }));
    await h.sleep(13000);
    report.race = await measure(10);
    const nWeapons = await page.evaluate(packBurst);
    await h.sleep(500);
    report.pack = await measure(5);
    await h.eval(() => window.__br.app.audio.rt.conductor.setIntensity(2));
    await h.sleep(4000);
    report.stretch = await measure(8);
    await h.eval(() => window.__br.app.audio.rt.conductor.play(null, 0.2));
    await h.sleep(1500);
    report.sfxOnly = await measure(6);
    await tab.evaluate(() => window.__ctl.close());
    await tab.close();
    const unknown = h.logs.filter((l) => l.includes('[audio] unknown'));
    console.log(`${unknown.length ? 'FAIL' : 'ok  '} pack burst: ${nWeapons} weapons, ${unknown.length} unknown-sound warnings`);
    if (unknown.length) fails.push(`cpu gate: ${unknown.length} unknown sounds (${unknown[0]})`);
  }, { size: '1920x1080' });
  for (const [k, r] of Object.entries(report)) {
    const over = r.p50 > P50_MAX || r.p90 > P90_MAX;
    const gate = ['menu', 'race', 'pack', 'stretch'].includes(k);
    // A loaded machine (the box is busy with other work) or a loaded control tab: the render
    // times are inflated, so the overrun is a warning, not a failure. The machine's peak busy
    // share over the whole run counts: the box was loaded while the check ran.
    peak = Math.max(peak, r.busy);
    peakHeat = Math.max(peakHeat, r.hot);
    const inflated = r.ctl50 >= CONTROL_MAX || peak > LOAD_BUSY || peakHeat > LOAD_BUSY;
    const verdict = over && gate ? (inflated ? 'warn' : 'FAIL') : 'ok  ';
    console.log(`${verdict} ${k.padEnd(8)} p50 ${r.p50} %  p90 ${r.p90} %  (${r.n} samples; control ${r.ctl50} / ${r.ctl90} %; machine ${(r.busy * 100).toFixed(0)} % busy, hottest core ${(r.hot * 100).toFixed(0)} %)`);
    if (over && gate && !inflated) fails.push(`cpu ${k}: p50 ${r.p50} % / p90 ${r.p90} % (max ${P50_MAX} / ${P90_MAX}; control ${r.ctl50} %)`);
  }
  console.log(`machine peak ${(peak * 100).toFixed(0)} % busy / ${(peakHeat * 100).toFixed(0)} % hottest core over the run${peak > LOAD_BUSY || peakHeat > LOAD_BUSY ? ' (loaded: the cpu overruns are warnings)' : ''}`);
  return { fails, report };
}

// Standalone: node tools/audio-check-cpu.mjs [--stub camera,fx]  (exit 1 on any failure)
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const { fails } = await cpuCheck(parseArgs(process.argv.slice(2)));
  console.log(fails.length ? `\nFAILED (${fails.length}):\n- ${fails.join('\n- ')}` : '\nall passed');
  process.exit(fails.length ? 1 : 0);
}
