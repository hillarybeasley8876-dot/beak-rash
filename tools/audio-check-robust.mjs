// Robustness part of tools/audio-check.mjs: the game must run (silently) without WebAudio.
import { withPage, BASE } from './lib.mjs';

/** Boot with the AudioContext constructor throwing / missing: title → menu → race, 0 page errors. */
async function noAudio(mode, expect) {
  await withPage(async (page, h) => {
    await page.addInitScript((m) => {
      if (m === 'undefined') window.AudioContext = undefined;
      else window.AudioContext = function NoAudio() { throw new DOMException('no audio device (audio-check)', 'NotSupportedError'); };
    }, mode);
    await page.goto(BASE + '/', { waitUntil: 'load', timeout: 60000 });
    const ready = await page.waitForFunction(() => window.__br?.ready === true, null, { timeout: 30000 }).then(() => true, () => false);
    await h.sleep(1200);
    await page.keyboard.press('Enter');
    await h.sleep(1000);
    const menu = await page.evaluate(() => window.__br?.app.ui.screen ?? null);
    if (ready) await page.evaluate(() => window.__br.start({ trackId: 'coast', seed: 2 }));
    await h.sleep(5000);
    await page.keyboard.press('KeyJ');
    await h.sleep(300);
    const race = await page.evaluate(() => window.__br?.app.ui.screen ?? null);
    const errs = h.logs.filter((l) => l.startsWith('[error]') || l.startsWith('[pageerror]'));
    // Without a constructor there is no rate to fall back from: only the real warning may appear.
    const misleading = mode === 'undefined' ? h.logs.filter((l) => l.includes('32 kHz')).length : 0;
    expect(ready && menu === 'menu' && (race === 'race' || race === 'intro') && errs.length === 0 && misleading === 0,
      `no WebAudio (${mode}): boots, key → ${menu}, race → ${race}, ${errs.length} page errors, ${misleading} rate-fallback warnings`);
    if (errs.length) console.log(errs.slice(0, 4).join('\n'));
  });
}

/**
 * Voice lines and pause: a line queued behind the announcer must not start over the pause menu,
 * and the trace logs lines when they actually sound (a queued line only once it starts).
 */
async function voicePause(stub, expect) {
  await withPage(async (page, h) => {
    await h.goto(`/?race=coast&seed=3&police=0&manual=1${stub}`);
    await h.eval(() => window.__br.audio.unlock());
    await h.realtime();
    await h.sleep(9000);
    const voiceSince = (t) => page.evaluate((from) => window.__br.audio.trace().filter((e) => e.kind === 'voice' && e.ms >= from).map((e) => [e.id, Math.round(e.ms - from)]), t);
    // Unpaused: ann_final waits for ann_ko and is logged when it starts (after ann_ko's 0.41 s).
    let t0 = await h.eval(() => { const a = window.__br.app.audio; const t = performance.now(); a.announce('ann_ko', 3); a.announce('ann_final', 2); return t; });
    await h.sleep(1500);
    const queued = await voiceSince(t0);
    const fin = queued.find(([id]) => id === 'ann_final');
    expect(queued[0]?.[0] === 'ann_ko' && fin !== undefined && fin[1] >= 300, `queued announcer line logged when it sounds (${JSON.stringify(queued)})`);
    // Paused 150 ms into ann_ko: the queued line is dropped, not played over the pause menu.
    t0 = await h.eval(() => { const a = window.__br.app.audio; const t = performance.now(); a.announce('ann_ko', 3); a.announce('ann_final', 2); return t; });
    await h.sleep(150);
    await h.eval(() => window.__br.app.bus.emit('flow:pause', { paused: true }));
    await h.sleep(1500);
    const during = await voiceSince(t0);
    await h.eval(() => window.__br.app.bus.emit('flow:pause', { paused: false }));
    await h.sleep(1200);
    const after = await voiceSince(t0);
    expect(!during.some(([id]) => id === 'ann_final') && !after.some(([id]) => id === 'ann_final'),
      `pause drops the queued announcer line (paused: ${JSON.stringify(during)}, resumed: ${JSON.stringify(after)})`);
  });
}

/** WebKit starts an allowed context asynchronously: it must be suspended again until the gesture. */
async function webkitEarly(stub, expect) {
  await withPage(async (page, h) => {
    await h.goto(`/?race=coast&seed=3&police=0&manual=1${stub}`);
    await h.sleep(1500);
    const pre = await h.eval(() => window.__br.audio.state());
    await page.mouse.click(640, 360);
    await h.sleep(800);
    await h.realtime();
    await h.sleep(2500);
    const after = await h.eval(() => window.__br.audio.state());
    expect(pre.ctx !== 'running' && !pre.live && after.live, `WebKit: context ${pre.ctx} before the gesture, ${after.ctx} (live ${after.live}) after`);
  }, { browser: 'webkit' });
}

export async function robustCheck(args = {}) {
  const fails = [];
  const expect = (cond, msg) => {
    console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`);
    if (!cond) fails.push(`robust: ${msg}`);
  };
  console.log('\n-- robustness');
  await noAudio('throw', expect);
  await noAudio('undefined', expect);
  const stub = typeof args.stub === 'string' ? `&stub=${args.stub}` : '';
  await voicePause(stub, expect);
  await webkitEarly(stub, expect);
  return fails;
}
