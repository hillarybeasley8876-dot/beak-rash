#!/usr/bin/env node
// r4 acceptance: w1-actors-poses (SPEC §16 trick rotations + superman, §15 throw aim + umbrella glide). Lead-owned,
// read-only for workers. Runs with the sim and combat stubbed, so the forced RiderState fields stay as set and the
// test measures the actors view alone through RiderView.anchor() world positions.
//   node tools/r4/w1-poses.mjs
import { expect, finish, noErrors, withPage } from './accept-lib.mjs';

await withPage(async (page, h) => {
  await h.goto('/?race=coast&seed=3&manual=1&traffic=0&police=0&stub=sim,combat');
  await page.evaluate(() => { const b = window.__br; b.manual(true); for (let i = 0; i < 20 && b.session()?.phase !== 'racing'; i++) b.step(30); });
  // Pose the player, render one frame, return anchor positions in the bike's track frame (fwd / right / up, metres).
  const pose = (state) => page.evaluate((st) => {
    const b = window.__br, s = b.session(), p = s.player, v = s.views.get(p.id);
    Object.assign(p, { y: 1.5, airborne: true, trick: null, gliding: false, action: null, weapon: 'none' }, st);
    v.setWeapon(p.weapon);
    b.step(1);
    Object.assign(p, st);
    b.step(1);
    const f = s.track.frameAt(p.s);
    const V = v.root.position.constructor;
    const tmp = new V();
    const out = {};
    const base = new V();
    v.anchor('saddle', base);
    for (const n of ['head', 'chest', 'handL', 'handR', 'saddle', 'wheelF', 'wheelR', 'body']) {
      v.anchor(n, tmp);
      const d = { x: tmp.x - f.pos.x, y: tmp.y - f.pos.y, z: tmp.z - f.pos.z };
      out[n] = {
        fwd: d.x * f.tangent.x + d.y * f.tangent.y + d.z * f.tangent.z,
        right: d.x * f.right.x + d.y * f.right.y + d.z * f.right.z,
        up: d.x * f.up.x + d.y * f.up.y + d.z * f.up.z,
      };
    }
    return out;
  }, state);
  const sub = (a, b) => ({ fwd: a.fwd - b.fwd, right: a.right - b.right, up: a.up - b.up });
  const len = (d) => Math.hypot(d.fwd, d.right, d.up);
  const r2 = (n) => n.toFixed(2);

  const ride = await pose({});
  const axisR = sub(ride.wheelF, ride.wheelR);
  expect(axisR.fwd > 0.6, `riding: the front wheel leads (${r2(axisR.fwd)} m)`);

  // spin (dir +1 = clockwise from above: the nose swings to the right first)
  let q = await pose({ trick: { kind: 'spin', t: 0.1375, dur: 0.55, dir: 1 } });
  let ax = sub(q.wheelF, q.wheelR);
  expect(ax.right > 0.6 && Math.abs(ax.fwd) < 0.45, `spin 25 %: nose points right (fwd ${r2(ax.fwd)}, right ${r2(ax.right)})`);
  q = await pose({ trick: { kind: 'spin', t: 0.275, dur: 0.55, dir: 1 } });
  ax = sub(q.wheelF, q.wheelR);
  expect(ax.fwd < -0.6, `spin 50 %: the bike faces backwards (fwd ${r2(ax.fwd)})`);
  q = await pose({ trick: { kind: 'spin', t: 0.1375, dur: 0.55, dir: -1 } });
  ax = sub(q.wheelF, q.wheelR);
  expect(ax.right < -0.6, `spin left 25 %: nose points left (right ${r2(ax.right)})`);

  // flips: backflip lifts the nose first, frontflip drops it; at 50 % the rider hangs under the bike
  q = await pose({ trick: { kind: 'backflip', t: 0.1625, dur: 0.65, dir: -1 } });
  ax = sub(q.wheelF, q.wheelR);
  expect(ax.up > 0.6, `backflip 25 %: nose up (up ${r2(ax.up)})`);
  q = await pose({ trick: { kind: 'frontflip', t: 0.1625, dur: 0.65, dir: 1 } });
  ax = sub(q.wheelF, q.wheelR);
  expect(ax.up < -0.6, `frontflip 25 %: nose down (up ${r2(ax.up)})`);
  q = await pose({ trick: { kind: 'backflip', t: 0.325, dur: 0.65, dir: -1 } });
  expect(q.head.up < Math.min(q.wheelF.up, q.wheelR.up), `backflip 50 %: upside down, head below the wheels (head ${r2(q.head.up)}, wheels ${r2(q.wheelF.up)}/${r2(q.wheelR.up)})`);
  const pivot = (len(sub(q.saddle, ride.saddle)));
  expect(pivot < 1.2, `flips pivot near the bike's centre (saddle moved ${r2(pivot)} m, not around a wheel)`);

  // superman: hips up off the saddle, hands off the bars (relative to the saddle)
  q = await pose({ trick: { kind: 'superman', t: 0.5, dur: Infinity, dir: 1 } });
  const hips = sub(q.body, q.saddle).up - sub(ride.body, ride.saddle).up;
  const handMove = Math.min(len(sub(sub(q.handL, q.saddle), sub(ride.handL, ride.saddle))), len(sub(sub(q.handR, q.saddle), sub(ride.handR, ride.saddle))));
  expect(hips > 0.2, `superman: hips rise off the saddle (+${r2(hips)} m)`);
  expect(handMove > 0.15, `superman: both hands leave the bars (${r2(handMove)} m)`);

  // throw aim: the weapon hand is cocked back and up
  const armed = await pose({ y: 0, airborne: false, weapon: 'baguette' });
  q = await pose({ y: 0, airborne: false, weapon: 'baguette', action: { kind: 'throw', side: 1, t: 0.3, dur: 1.5, weapon: 'baguette', skillId: null, resolved: false } });
  const hr = sub(q.handR, q.chest), hr0 = sub(armed.handR, armed.chest);
  expect(hr.up - hr0.up > 0.15 && hr.fwd - hr0.fwd < -0.1, `throw aim: right hand up (+${r2(hr.up - hr0.up)}) and back (${r2(hr.fwd - hr0.fwd)})`);

  // umbrella glide: the umbrella hand is above the head
  q = await pose({ weapon: 'umbrella', gliding: true });
  const top = Math.max(q.handL.up, q.handR.up);
  expect(top > q.head.up + 0.1, `glide: the umbrella is held over the head (hand ${r2(top)}, head ${r2(q.head.up)})`);
  q = await pose({ weapon: 'umbrella', gliding: false });
  expect(Math.max(q.handL.up, q.handR.up) < q.head.up, 'not gliding: hands back on the bars');

  // back to normal riding after all of it
  q = await pose({ y: 0, airborne: false });
  ax = sub(q.wheelF, q.wheelR);
  expect(ax.fwd > 0.6 && len(sub(sub(q.handR, q.saddle), sub(ride.handR, ride.saddle))) < 0.12, 'trick/throw/glide cleared: the riding pose is back');
  await noErrors(h, 'poses');
}, { size: '1280x720' });

finish('w1-poses');
