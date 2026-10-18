// In-game part of tools/audio-check.mjs: a real race (nothing before unlock, countdown, event →
// sound mapping within a frame, KO cinematic, pause, mute, screen music, no errors) and a race
// load recording (the music keeps playing while the main thread blocks).
import { withPage } from './lib.mjs';

/** In-game checks against the live game page; returns failure messages. */
export async function gameCheck(args) {
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

    // Mute the way the settings screen does (saved), then an unrelated save (an achievement / coins)
    // must not bring the sound back; the old master level is restored afterwards.
    const master = await h.eval(() => window.__br.app.save.data.settings.master);
    await h.eval(() => window.__br.app.save.update((d) => { d.settings.master = 0; }));
    await h.sleep(300);
    await h.eval(() => window.__br.app.save.update((d) => { d.coins += 0; }));
    await emit([['combat:hit', { attacker: 0, victim: 1, damage: 5, side: 1, weapon: 'leek', heavy: false, crit: false, blocked: false, skillId: null }]]);
    const muted = await h.eval(() => window.__br.audio.level(1));
    expect(muted.peakDb < -70, `master 0 → silent, also across an unrelated save (${muted.peakDb} dBFS)`);
    await page.evaluate((m) => window.__br.app.save.update((d) => { d.settings.master = m; }), master);

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
