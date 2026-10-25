// Basic race scenarios: police spawn/catch/BUSTED, countdown + launch boost, finish + results,
// restart mid-intro + quit cleanup, 60 s DNF timeout.
import { events, RECORD } from '../race-lib.mjs';

export const basicScenarios = {
  async police(page, h, { check, stub, a }) {
    await h.goto(`/?race=coast&seed=5&intro=0&manual=1&traffic=0${stub}`);
    await h.eval(RECORD);
    await h.controls({ throttle: 1 });
    await h.step(600);
    await h.eval('window.__br.race.setHeat(0.95)');
    await h.step(30);
    const spawned = await h.eval('window.__br.race.police()');
    await h.step(600);
    const caught = await h.eval('window.__br.race.police()');
    if (a.shots) { await h.eval("window.__br.race.spectate('side')"); await h.shot('shots/race/sc-police-alongside.png'); }
    await h.controls({ throttle: 0, brake: 1 });
    for (let i = 0; i < 10; i++) {
      await h.step(30);
      if (a.verbose) console.log(JSON.stringify(await h.eval('window.__br.race.police()')), (await h.snapshot()).riders[0].v);
    }
    const busted = await events(h, 'police:busted');
    const snap = await h.snapshot();
    if (a.shots) await h.shot('shots/race/sc-police-busted.png');
    const alerts = await events(h, 'police:alert');
    check('police spawns when heat > 0.5', spawned?.mode === 'chase', spawned);
    check('police catches up alongside', caught && Math.abs(caught.gap) < 6, caught);
    check('slow next to police → BUSTED once', busted.length === 1 && busted[0].p.fine === 100, { busted: busted.length, mode: snap.riders.find((r) => r.c === 'pelican')?.mode });
    check('police alerts emitted', alerts.length >= 2, alerts.map((e) => e.p.level).join(','));
    await h.controls({ throttle: 1 });
    await h.step(400);
    const after = await h.snapshot();
    check('player resumes racing after BUSTED', after.riders.find((r) => r.c === 'pelican')?.mode === 'racing', after.riders.find((r) => r.c === 'pelican'));
  },
  async launch(page, h, { check, stub, a }) {
    await h.goto(`/?race=coast&seed=6&intro=0&manual=1&traffic=0${stub}`);
    await h.eval(RECORD);
    await h.step(150);
    await h.controls({ throttle: 1 });
    await h.step(60);
    const boosts = await events(h, 'rider:boost');
    const cd = await events(h, 'race:countdown');
    const p0 = await h.eval('window.__br.session().player.boostTime');
    check('countdown 3-2-1-GO events', cd.map((e) => e.p.n).join(',') === '3,2,1,0', cd.map((e) => e.p.n).join(','));
    check('throttle held on GO gives launch boost', boosts.some((e) => e.p.riderId === 0) && p0 > 0, { p0, boosts: boosts.length });
  },
  async finish(page, h, { check, stub, a }) {
    await h.goto(`/?race=coast&seed=7&intro=0&manual=1&traffic=0&autopilot=1${stub}`);
    await h.eval(RECORD);
    await h.step(400);
    const len = await h.eval('window.__br.session().track.length');
    await h.eval(`window.__br.teleport(0, ${len} - 30, 0)`);
    await h.step(420);
    const fin = await events(h, 'race:finishLine');
    const end = await events(h, 'race:end');
    const res = end[0]?.p.results ?? [];
    check('player crossing the line emits finishLine', fin.some((e) => e.p.riderId === 0), fin.map((e) => e.p));
    check('race:end exactly once with 8 rows', end.length === 1 && res.length === 8, { ends: end.length, rows: res.length });
    check('results sorted by place with times', res.every((r, i) => r.place === i + 1 && r.time !== null), res.map((r) => `${r.place}:${r.name}:${r.time?.toFixed?.(1)}:${r.coins}`).join(' '));
    check('winner gets place bonus coins', (res[0]?.coins ?? 0) >= 500, res[0]);
    await h.step(300);
    check('no second race:end', (await events(h, 'race:end')).length === 1);
  },
  async restart(page, h, { check, stub, a }) {
    await h.goto(`/?race=coast&seed=9&manual=1${stub}`);
    await h.step(60);
    await h.eval("window.__br.app.bus.emit('flow:restartRace', {})");
    // The new race is up once core's warm-up (sim frozen behind the loading card) and the card's exit hold are over:
    // the 400 frames below run in one synchronous loop, so nothing that waits for real time may still be pending.
    await page.waitForFunction(() => window.__br.session()?.phase === 'intro' && window.__br.app.ui.screen === 'race'
      && window.__br.game.loading === false, null, { timeout: 60000 });
    await h.step(400);
    const mid = await h.eval('({ n: window.__br.session().obstacles.length, race: !!window.__br.race, phase: window.__br.session().phase })');
    await h.eval("window.__br.app.bus.emit('flow:quitRace', {})");
    await h.step(30);
    const after = await h.eval('({ race: !!window.__br.race, session: !!window.__br.session(), mode: window.__br.app.rig.mode })');
    check('restart mid-intro starts a fresh racing session', mid.race && mid.phase === 'racing', mid);
    check('quit disposes race debug hooks and camera override', !after.race && !after.session && after.mode !== 'cinematic', after);
  },
  async timeout(page, h, { check, stub, a }) {
    await h.goto(`/?race=coast&seed=8&intro=0&manual=1&traffic=0${stub}`);
    await h.eval(RECORD);
    await h.step(400);
    const len = await h.eval('window.__br.session().track.length');
    await h.eval(`window.__br.teleport(1, ${len} - 5, 0)`);
    await h.step(30);
    await h.step(3700, 1 / 60);
    const end = await events(h, 'race:end');
    const me = end[0]?.p.results.find((r) => r.isPlayer);
    check('race ends 60 s after the winner with player DNF', end.length === 1 && me && me.time === null, me);
  },
};
