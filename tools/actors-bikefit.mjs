#!/usr/bin/env node
// species/actors: bike-fit report — for each bike, the saddle height and the grips/pedal circle in
// character space (origin = saddle top), plus each species' bind leg/arm reach.
//   node tools/actors-bikefit.mjs [query]
import { withPage } from './lib.mjs';

const BIKES = ['roadbike', 'erba', 'shared', 'fixie', 'mtb', 'kidbike', 'tandem'];
await withPage(async (page, h) => {
  await h.goto(`/sandbox/actors.html?panel=0&speed=6&${process.argv[2] ?? ''}`);
  const out = [];
  for (const bike of BIKES) {
    const r = await page.evaluate((b) => {
      window.__actors.set({ bike: b });
      window.__actors.step(2);
      const v = window.__actors.riders[0].view;
      const sad = v.bike.markers.saddle.getWorldPosition(v.bike.root.position.clone());
      const pedals = [];
      for (let i = 0; i < 24; i++) {
        window.__actors.step(1, 1 / 30);
        pedals.push([v.input.pedalL.y, v.input.pedalL.z]);
      }
      const ys = pedals.map((p) => p[0]), zs = pedals.map((p) => p[1]);
      const cy = (Math.max(...ys) + Math.min(...ys)) / 2, cz = (Math.max(...zs) + Math.min(...zs)) / 2;
      const R = (Math.max(...ys) - Math.min(...ys)) / 2;
      const f = (x) => +x.toFixed(3);
      return {
        bike: b, saddleY: f(sad.y), crank: [f(cy), f(cz)], R: f(R),
        grip: [f(v.input.gripL.x), f(v.input.gripL.y), f(v.input.gripL.z)],
        pedalX: f(v.input.pedalL.x), legScale: f(v.ride.legScale), armScale: f(v.ride.armScale),
      };
    }, bike);
    out.push(r);
  }
  for (const r of out) console.log(JSON.stringify(r));
  const errs = await h.errors();
  if (errs.length) console.log('errors', errs.slice(0, 3));
});
