// Race-start sync part of tools/audio-check.mjs: the race song waits in its vamp through the
// intro, the count-in fills the countdown and bar 1 of section A lands on GO — also after a
// same-track restart (pause → 重新开始) and after a pause in the middle of the countdown.
import { withPage } from './lib.mjs';

/** Wait in-page for race:countdown n (resolves with the audio time it fired at). */
const countdownAt = (page, n, timeout = 20000) => page.evaluate(([want, ms]) => new Promise((resolve, reject) => {
  const off = window.__br.app.bus.on('race:countdown', ({ n: got }) => {
    if (got !== want) return;
    if (typeof off === 'function') off();
    resolve(window.__br.app.audio.rt.ctx.currentTime);
  });
  setTimeout(() => reject(new Error(`no race:countdown ${want} within ${ms} ms`)), ms);
}), [n, timeout]);

/** Section starts and GO from the debug sync state, plus the audio clock now. */
const syncState = (page) => page.evaluate(() => ({ ...window.__br.audio.state().sync, now: window.__br.app.audio.rt.ctx.currentTime }));

/** Bar 1 of section A on GO (±30 ms) and no earlier A since `from` (audio time). */
function landsOnGo(sync, from) {
  const go = sync.lastGo;
  const a = sync.starts.filter((s) => s.section === 'A' && s.at >= from);
  const onGo = a.some((s) => Math.abs(s.at - go) <= 0.03);
  const early = a.filter((s) => s.at < go - 0.03);
  return { ok: go !== null && onGo && early.length === 0, go, a: a.map((s) => +(s.at - go).toFixed(3)), early: early.length };
}

export async function startCheck(args) {
  const fails = [];
  const expect = (cond, msg) => {
    console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`);
    if (!cond) fails.push(`start: ${msg}`);
  };
  const stub = typeof args.stub === 'string' ? `&stub=${args.stub}` : '';
  console.log('\n-- race start sync (restart, pause in the countdown)');
  await withPage(async (page, h) => {
    await h.goto(`/?race=coast&seed=3&police=0&autopilot=1${stub}`);
    await h.eval(() => window.__br.audio.unlock());
    await h.realtime();
    const t0 = await countdownAt(page, 3);
    await countdownAt(page, 0);
    await h.sleep(300);
    const first = landsOnGo(await syncState(page), t0);
    expect(first.ok, `first race: A on GO (A starts ${JSON.stringify(first.a)} s from GO)`);

    await h.sleep(2500);
    const restartAt = (await syncState(page)).now;
    await h.eval(() => window.__br.app.bus.emit('flow:restartRace', {}));
    const c3 = await countdownAt(page, 3);
    const atCount = await syncState(page);
    const vamping = atCount.starts.some((s) => s.section === 'vamp' && s.at > restartAt);
    await countdownAt(page, 0);
    await h.sleep(300);
    const again = landsOnGo(await syncState(page), c3);
    expect(vamping && again.ok, `restart (same track): vamp in the intro ${vamping}, A on GO (A starts ${JSON.stringify(again.a)} s from GO)`);

    // Pause at "2" for 2.4 s: section A must not start in the pause menu, and must land on the real GO.
    await h.eval(() => window.__br.app.bus.emit('flow:restartRace', {}));
    await countdownAt(page, 3);
    const c2 = await countdownAt(page, 2);
    await h.eval(() => window.__br.app.bus.emit('flow:pause', { paused: true }));
    await h.sleep(2400);
    const resumedAt = (await syncState(page)).now;
    await h.eval(() => window.__br.app.bus.emit('flow:pause', { paused: false }));
    await countdownAt(page, 0);
    await h.sleep(300);
    const sync = await syncState(page);
    const inPause = sync.starts.filter((s) => s.section === 'A' && s.at > c2 && s.at < resumedAt).length;
    const paused = landsOnGo(sync, resumedAt);
    expect(inPause === 0 && paused.ok, `pause in the countdown: ${inPause} A starts while paused, A on GO (A starts ${JSON.stringify(paused.a)} s from GO)`);
    const errs = (await h.errors()).filter((e) => /\[audio\]|src\/audio/.test(e));
    expect(errs.length === 0, `no audio errors (${errs.length})`);
  });
  return fails;
}
