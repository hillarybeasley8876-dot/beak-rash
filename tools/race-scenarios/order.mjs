// Finish-order scenarios (critic r1): race:finishLine.place equals the final result place after a BUSTED
// (the penalty is served on the road), and two riders crossing in one substep are placed by crossing time.
import { events, openRace } from '../race-lib.mjs';

const DT = 1 / 30;

export const orderScenarios = {
  /** BUSTED player then a close finish against rival 1: announced places = final places. */
  async penalty(page, h, { check, stub }) {
    await openRace(h, `race=coast&seed=13&level=1&traffic=0&manual=1&intro=0${stub}`);
    await h.eval(`window.__runHuman(300, ${DT}, 1000, 'passive')`);
    await h.eval('window.__br.race.setHeat(0.95)');
    for (let i = 0; i < 40 && Math.abs((await h.eval('window.__br.race.police()')).gap) > 3; i++) {
      await h.eval(`window.__runHuman(15, ${DT}, 1000, 'passive')`);
    }
    await h.eval('window.__br.setControls({ throttle: 0, brake: 1 })');
    // (A rival may KO the braking player first: that is no offence, the bust follows after the respawn grace.)
    for (let i = 0; i < 40 && !(await events(h, 'police:busted')).length; i++) await h.step(15, DT);
    const busted = (await events(h, 'police:busted')).length;
    const hold = [];
    for (let i = 0; i < 6; i++) { await h.step(15, DT); hold.push(await h.eval('window.__br.session().player.mode')); }
    await h.step(90, DT);
    const len = await h.eval('window.__br.session().track.length');
    await h.eval(`(() => { const s = window.__br.session(); const r = s.rider(1); const p = s.player;
      s.riders.forEach((o) => { if (!o.isPlayer && o.id !== 1) o.s = Math.min(o.s, ${len} - 300); });
      p.s = ${len} - 25; p.x = -2; p.speed = 19; r.s = ${len} - 37; r.x = 2; r.speed = 19; r.mode = 'racing'; })()`);
    await h.eval(`window.__runHuman(300, ${DT}, 1000, 'passive')`);
    const fin = (await events(h, 'race:finishLine')).map((e) => e.p);
    const res = await h.eval('window.__rl.end ?? window.__br.race.results()');
    const mismatch = fin.filter((f) => res.find((r) => r.riderId === f.riderId)?.place !== f.place);
    check('BUSTED happened and held the player ~4 s', busted === 1 && hold.slice(0, 5).every((m) => m === 'busted'), { busted, hold });
    check('finishLine place = final place after BUSTED', fin.length >= 2 && mismatch.length === 0,
      { fin, final: res.slice(0, 3).map((r) => `${r.place}:${r.riderId}:${r.time?.toFixed(2)}`) });
  },

  /** Two riders crossing in one substep: the one with the shorter overshoot time wins. */
  async tie(page, h, { check, stub }) {
    await openRace(h, `race=coast&seed=21&manual=1&intro=0&traffic=0&police=0${stub}`);
    await h.eval('window.__br.setControls({ throttle: 1 })');
    await h.step(240, 1 / 60);
    const len = await h.eval('window.__br.session().track.length');
    await h.eval(`(() => { const s = window.__br.session(); const r1 = s.rider(1), r2 = s.rider(2);
      r1.s = ${len} - 0.12; r1.x = -2; r1.speed = 20; r2.s = ${len} - 0.04; r2.x = 2; r2.speed = 20; })()`);
    await h.step(1, 1 / 60);
    const fin = (await events(h, 'race:finishLine')).map((e) => e.p);
    const places = await h.eval('[1, 2].map((id) => window.__br.session().rider(id).place)');
    const f1 = fin.find((f) => f.riderId === 1), f2 = fin.find((f) => f.riderId === 2);
    check('same-substep finish: rider ahead gets place 1 with the earlier time',
      f2?.place === 1 && f1?.place === 2 && f2.time < f1.time, { fin });
    check('standings agree with finishLine places', places[0] === f1?.place && places[1] === f2?.place, { places });
  },
};
