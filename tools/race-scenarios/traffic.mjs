// Traffic scenarios (critic r1): new vehicles never pop into clear view — every spawn that lands inside
// the chase camera's frustum is at least 60 % into the fog.

const INIT = `(() => { window.__seen = new Set(window.__br.race.traffic().map((v) => v.id)); })()`;
const CHECK = `(() => {
  const br = window.__br, s = br.session(), cam = br.app.camera, out = [], fog = s.track.look.fog;
  const V = cam.position.constructor;
  for (const v of br.race.traffic()) {
    if (window.__seen.has(v.id)) continue;
    window.__seen.add(v.id);
    const o = s.obstacles.find((x) => x.id === v.id); if (!o) continue;
    const p = s.track.toWorld(o.s, o.x, o.height / 2, new V());
    const d = p.distanceTo(cam.position);
    const n = p.clone().project(cam);
    const onScreen = n.z < 1 && Math.abs(n.x) < 1 && Math.abs(n.y) < 1;
    out.push({ id: v.id, type: v.type, ds: Math.round(o.s - s.player.s), dist: Math.round(d), onScreen,
      fog: +Math.min(1, Math.max(0, (d - fog.near) / (fog.far - fog.near))).toFixed(2), t: +s.time.toFixed(1) });
  }
  return out;
})()`;

export const trafficScenarios = {
  async popin(page, h, { check, stub, a }) {
    await h.goto(`/?race=coast&seed=${a.seed ?? 4}&manual=1&intro=0&autopilot=1&police=0${stub}`);
    await h.step(30, 1 / 30);
    await h.eval(INIT);
    const spawns = [];
    for (let i = 0; i < 1500; i++) {
      await h.step(2, 1 / 30);
      spawns.push(...(await h.eval(CHECK)));
      if (i % 300 === 0 && (await h.eval('window.__br.session().phase')) === 'finished') break;
    }
    const vis = spawns.filter((x) => x.onScreen);
    const clear = vis.filter((x) => x.fog < 0.6);
    const alive = await h.eval('window.__br.race.traffic().length');
    check('traffic spawns inside the view are ≥ 60 % fogged', spawns.length > 5 && clear.length === 0,
      { spawns: spawns.length, inView: vis.length, minFog: Math.min(...vis.map((x) => x.fog)), clear: clear.slice(0, 3), alive });
  },
};
