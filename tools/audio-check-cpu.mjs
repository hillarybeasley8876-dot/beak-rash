// Realtime audio-thread load part of tools/audio-check.mjs: the browser's own render-capacity
// meter (CDP WebAudio.getRealtimeData, the fraction of each render quantum spent rendering) in
// the menu (title theme), a race on autopilot, the forced final-stretch layer, a busy pack (a
// burst of rival hits and bumps), and the race without music. Budget: p50 ≤ 5 %, p90 ≤ 8 %.
// A control tab in the same browser (one 32 kHz oscillator) is sampled alongside: while it reads
// < 1 % the meter is not inflated by machine load and an overrun FAILS; only a control ≥ 1 % turns
// overruns into warnings. Any '[audio] unknown sfx' warning during the run fails the gate too.
import { withPage } from './lib.mjs';

const P50_MAX = 5;
const P90_MAX = 8;
const CONTROL_MAX = 1;

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
    for (let i = 0; i < seconds * 4; i++) {
      await h.sleep(250);
      const [g, c] = await Promise.all([game(), control()]);
      if (g !== null) xs.push(g);
      if (c !== null) cs.push(c);
    }
    xs.sort((a, b) => a - b);
    cs.sort((a, b) => a - b);
    return { n: xs.length, p50: quantile(xs, 0.5), p90: quantile(xs, 0.9), ctl50: quantile(cs, 0.5), ctl90: quantile(cs, 0.9) };
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
  const stub = typeof args.stub === 'string' ? `&stub=${args.stub}` : '';
  console.log('\n-- realtime audio load (renderCapacity, 1920x1080, control tab = one 32 kHz oscillator)');
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
    const inflated = r.ctl50 >= CONTROL_MAX;
    const verdict = over && gate ? (inflated ? 'warn' : 'FAIL') : 'ok  ';
    console.log(`${verdict} ${k.padEnd(8)} p50 ${r.p50} %  p90 ${r.p90} %  (${r.n} samples; control ${r.ctl50} / ${r.ctl90} %)`);
    if (over && gate && !inflated) fails.push(`cpu ${k}: p50 ${r.p50} % / p90 ${r.p90} % (max ${P50_MAX} / ${P90_MAX}; control ${r.ctl50} %)`);
  }
  return { fails, report };
}
