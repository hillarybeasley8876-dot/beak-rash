// Realtime audio-thread load part of tools/audio-check.mjs: the browser's own render-capacity
// meter (CDP WebAudio.getRealtimeData, the fraction of each render quantum spent rendering) in
// the menu (title theme), a race on autopilot, the forced final-stretch layer, a busy pack (a
// burst of rival hits and bumps), and the race without music. Budget: p50 ≤ 5 %, p90 ≤ 8 %.
import os from 'node:os';
import { withPage } from './lib.mjs';

const P50_MAX = 5;
const P90_MAX = 8;

async function meter(page, h) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('WebAudio.enable');
  const ids = [];
  cdp.on('WebAudio.contextCreated', (e) => { if (e.context.contextType === 'realtime') ids.push(e.context.contextId); });
  return async (seconds) => {
    const xs = [];
    for (let i = 0; i < seconds * 4; i++) {
      await h.sleep(250);
      const id = ids[ids.length - 1];
      if (id === undefined) continue;
      const r = await cdp.send('WebAudio.getRealtimeData', { contextId: id }).catch(() => null);
      if (r) xs.push(r.realtimeData.renderCapacity * 100);
    }
    xs.sort((a, b) => a - b);
    const q = (p) => +(xs[Math.min(xs.length - 1, Math.floor(xs.length * p))] ?? NaN).toFixed(1);
    return { n: xs.length, p50: q(0.5), p90: q(0.9) };
  };
}

/** A burst of rival combat around the player: hits, bumps, swings (the busiest sfx moment). */
const packBurst = () => {
  const c = window.__br.app.camera.position;
  const pos = { x: c.x + 1.5, y: c.y - 1, z: c.z - 6 };
  const bus = window.__br.app.bus;
  const weapons = ['fish', 'pan', 'baguette', 'slipper', 'keyboard', 'leek'];
  let k = 0;
  const iv = setInterval(() => {
    const a = 1 + (k % 6);
    const b = 1 + ((k + 3) % 6);
    bus.emit('combat:hit', { attacker: a, victim: b, damage: 8, side: 1, weapon: weapons[k % 6], heavy: k % 3 === 0, crit: k % 5 === 0, blocked: false, skillId: null, pos });
    bus.emit('rider:bump', { a, b, strength: 2, pos });
    bus.emit('combat:swing', { riderId: a, side: k % 2 ? 1 : -1, heavy: false, weapon: weapons[k % 6] });
    k++;
  }, 120);
  setTimeout(() => clearInterval(iv), 6000);
};

export async function cpuCheck(args = {}) {
  const fails = [];
  const report = {};
  const stub = typeof args.stub === 'string' ? `&stub=${args.stub}` : '';
  const load = os.loadavg()[0];
  const loaded = load > os.cpus().length * 0.6;
  console.log(`\n-- realtime audio load (renderCapacity, 1920x1080; machine load ${load.toFixed(1)} / ${os.cpus().length} cores${loaded ? ': busy, overruns are warnings' : ''})`);
  await withPage(async (page, h) => {
    const measure = await meter(page, h);
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
    await page.evaluate(packBurst);
    await h.sleep(500);
    report.pack = await measure(5);
    await h.eval(() => window.__br.app.audio.rt.conductor.setIntensity(2));
    await h.sleep(4000);
    report.stretch = await measure(8);
    await h.eval(() => window.__br.app.audio.rt.conductor.play(null, 0.2));
    await h.sleep(1500);
    report.sfxOnly = await measure(6);
  }, { size: '1920x1080' });
  for (const [k, r] of Object.entries(report)) {
    const over = r.p50 > P50_MAX || r.p90 > P90_MAX;
    const gate = ['menu', 'race', 'pack', 'stretch'].includes(k);
    console.log(`${over && gate ? (loaded ? 'warn' : 'FAIL') : 'ok  '} ${k.padEnd(8)} p50 ${r.p50} %  p90 ${r.p90} %  (${r.n} samples)`);
    if (over && gate && !loaded) fails.push(`cpu ${k}: p50 ${r.p50} % / p90 ${r.p90} % (max ${P50_MAX} / ${P90_MAX})`);
  }
  return { fails, report };
}
