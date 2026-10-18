// Adaptive-music part of tools/audio-check.mjs: the top-3 layers follow the player's place only
// after it held for 2 s (a 3 ↔ 4 pack battle does not toggle them) and switch on a 2-bar line;
// once the player has finished, the final-stretch form and intensity hold until the results; the
// FINISH cue, its announcer line and the results song's opening depend on the place.
import { withPage } from './lib.mjs';

/** Pin the player's place / progress / mode (race logic writes are ignored while pinned). */
const pinPlayer = () => {
  const p = window.__br.session().player;
  const pin = (window.__pin = { place: 5, progress: 0.3, mode: p.mode });
  for (const k of ['place', 'progress', 'mode']) Object.defineProperty(p, k, { configurable: true, get: () => pin[k], set: () => {} });
  // Every change of the SongPlayer's applied intensity, with its section step (2-bar line = step % 32 = 0).
  const log = (window.__ints = []);
  const watch = () => {
    const sp = window.__br.app.audio.rt.conductor.current;
    if (sp && sp.intensity !== window.__lastInt) {
      window.__lastInt = sp.intensity;
      log.push({ at: performance.now(), level: sp.intensity, step: sp.stepInSection, form: sp.form.join(' ') });
    }
    window.__watchRaf = requestAnimationFrame(watch);
  };
  watch();
};

export async function adaptiveCheck(args = {}) {
  const fails = [];
  const expect = (cond, msg) => {
    console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`);
    if (!cond) fails.push(`adaptive: ${msg}`);
  };
  const stub = typeof args.stub === 'string' ? `&stub=${args.stub}` : '';
  console.log('\n-- adaptive music (top-3 hold + 2-bar line, finish freeze, place-based cues)');
  await withPage(async (page, h) => {
    await h.goto(`/?race=coast&seed=3&police=0&traffic=0&autopilot=1${stub}`);
    await h.eval(() => window.__br.audio.unlock());
    await h.realtime();
    await page.waitForFunction(() => window.__br.session()?.phase === 'racing', null, { timeout: 40000 });
    await h.sleep(1500);
    await page.evaluate(pinPlayer);
    const level = () => page.evaluate(() => window.__br.app.audio.rt.conductor.level);
    const setPin = (o) => page.evaluate((v) => Object.assign(window.__pin, v), o);

    // A pack battle: 3rd ↔ 4th every 0.9 s for 5.4 s → the top-3 layer never switches on.
    let maxLevel = 0;
    for (let i = 0; i < 6; i++) {
      await setPin({ place: i % 2 ? 4 : 3 });
      await h.sleep(900);
      maxLevel = Math.max(maxLevel, await level());
    }
    expect(maxLevel === 0, `3 ↔ 4 every 0.9 s: top-3 layer stays off (max intensity ${maxLevel})`);
    // Holding 3rd: on after 2 s, applied by the SongPlayer on a 2-bar line.
    await setPin({ place: 3 });
    await h.sleep(1500);
    const early = await level();
    await h.sleep(1500);
    const held = await level();
    expect(early === 0 && held === 1, `3rd held: off at 1.5 s (${early}), on at 3 s (${held})`);
    await h.sleep(4500);
    const ints = await page.evaluate(() => window.__ints.slice());
    const on = ints.find((e) => e.level === 1);
    expect(on !== undefined && on.step % 32 <= 3, `top-3 layer applied on a 2-bar line (section step ${on?.step ?? 'never'})`);

    // Final stretch, then the finish: the stretch form and intensity 2 hold until the results.
    await setPin({ progress: 0.9 });
    await h.sleep(5000);
    const stretch = await page.evaluate(() => ({ level: window.__br.app.audio.rt.conductor.level, form: window.__br.app.audio.rt.conductor.current.form.join(' ') }));
    await setPin({ mode: 'finished', place: 6 });
    await page.evaluate(() => window.__br.app.bus.emit('race:finishLine', { riderId: window.__br.session().player.id, place: 6, time: 99 }));
    await h.sleep(6000);
    const after = await page.evaluate(() => ({ level: window.__br.app.audio.rt.conductor.level, form: window.__br.app.audio.rt.conductor.current.form.join(' ') }));
    expect(stretch.level === 2 && after.level === 2 && after.form === stretch.form,
      `finished in the stretch: form "${stretch.form}" / intensity ${stretch.level} held 6 s later ("${after.form}" / ${after.level})`);
    const trace = await page.evaluate(() => window.__br.audio.trace().map((e) => `${e.kind}:${e.id}`));
    expect(trace.includes('sting:finishLow') && !trace.includes('sting:finish'), 'place 6 → the deflated finishLow cue (no fanfare)');
    expect(trace.includes('voice:ann_finish'), 'place 6 → 完赛 announcer line (ann_finish)');
    // Results: off the podium the song opens on its B section; on the podium from its intro.
    const results = await page.evaluate(async () => {
      const a = window.__br.app.audio;
      a.music('results', 0.2);
      await new Promise((r) => setTimeout(r, 400));
      const low = a.rt.conductor.current.sectionName();
      window.__br.app.bus.emit('race:finishLine', { riderId: window.__br.session().player.id, place: 1, time: 90 });
      a.music('title', 0.1);
      a.music('results', 0.2);
      await new Promise((r) => setTimeout(r, 400));
      return { low, podium: a.rt.conductor.current.sectionName() };
    });
    expect(results.low === 'B' && results.podium !== 'B', `results song opens on ${results.low} after 6th, on ${results.podium} after 1st`);
    const trace2 = await page.evaluate(() => window.__br.audio.trace().map((e) => `${e.kind}:${e.id}`));
    expect(trace2.includes('sting:finish'), 'place 1 → the full FINISH fanfare');
    const errs = (await h.errors()).filter((e) => /audio/i.test(e));
    expect(errs.length === 0, `no audio errors (${errs.length})`);
    await page.evaluate(() => cancelAnimationFrame(window.__watchRaf));
  });
  return fails;
}
