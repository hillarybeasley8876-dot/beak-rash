// fx probe: camera direction / rig state frame by frame around a test KO.
import { withPage } from '../tools/lib.mjs';

await withPage(async (page, h) => {
  await h.goto('/?race=coast&seed=3&traffic=0&police=0');
  await h.controls({ throttle: 1 });
  await h.step(420);
  const probe = () => h.eval(() => {
    const br = window.__br;
    const r2 = (v) => +v.toFixed(2);
    const c = br.app.camera;
    const d = c.getWorldDirection(c.position.clone()).toArray().map(r2);
    const sim = br.sim?.cam ?? {};
    return `t=${r2(br.app.clock.realTime)} ${br.app.rig.mode} blend=${sim.blending} dir=${d} pos=${c.position.toArray().map(r2)} fov=${r2(c.fov)} p.s=${r2(br.session().player.s)}`;
  });
  if (process.argv[2] !== 'noko') await h.eval(() => window.__br.fx.testKo({}));
  for (let i = 0; i < 34; i++) {
    await h.step(3);
    console.log(await probe());
  }
});
