// Finish-line regressions (run last: each one finishes the race and restarts it afterwards).
export const finish = [
  ['finish line: a rival held in the pouch never finishes ahead of the pelican', async () => {
    const cc = window.__cc, br = window.__br; cc.reset(); const c = cc.C();
    const L = cc.S().track.length;
    br.teleport(0, L - 8, 0); cc.ctl({ throttle: 1 }); cc.step(1);
    c.pin(5, 1.0, 0.8); cc.step(2);
    cc.press('skill2'); cc.step(1); cc.step(2);
    const v = cc.R(5), held = cc.has(v, 'gulped');
    c.unpin(5);
    let maxHeld = -Infinity;
    cc.until(() => { if (cc.has(v, 'gulped')) maxHeld = Math.max(maxHeld, v.s); return !v.airborne && !v.mods.intangible && !cc.has(v, 'gulped'); }, 240);
    const landedS = v.s;
    cc.until(() => cc.of('race:finishLine', (e) => e.riderId === 5).length > 0, 400);
    const me = cc.of('race:finishLine', (e) => e.riderId === 0)[0], pg = cc.of('race:finishLine', (e) => e.riderId === 5)[0];
    const info = { held, maxHeld: maxHeld - L, landed: landedS - L, me, pg };
    await cc.restart();
    return { ok: held && maxHeld < L && landedS < L && me?.place === 1 && (!pg || pg.place > me.place), info };
  }],
  ['ghost: no backwards jump near the finish or after finishing', async () => {
    const cc = window.__cc, br = window.__br; cc.reset(); const c = cc.C(); const p = cc.P();
    const L = cc.S().track.length;
    const ends = [];
    const off = br.app.bus.on('skill:end', (e) => { if (e.riderId === 5) ends.push(cc.R(5).s - L); });
    br.teleport(0, L - 10, 0); c.set(0, { speed: 0 }); cc.ctl({ throttle: 0, brake: 1 }); cc.step(2);
    c.pin(5, 6, 1.5); cc.step(2); c.cast(5, 1); cc.until(() => ends.length > 0, 240);
    const near = ends[0];
    c.unpin(5);
    br.teleport(0, L - 30, 0); c.set(0, { speed: 20 }); cc.ctl({ throttle: 1 }); cc.step(2);
    c.pin(5, 6, 1.5); cc.step(2); c.resetCooldowns(5);
    const fromS = cc.R(5).s - L;
    c.cast(5, 1); cc.until(() => ends.length > 1, 240);
    const finished = ends[1], mode = cc.R(5).mode;
    off();
    const info = { near, fromS, finished, mode, ps: p.s - L };
    await cc.restart();
    return { ok: near >= -4.5 && near < 0 && mode === 'finished' && finished >= 0, info };
  }],
  ['3-race loop: GPU memory, programs and bus listeners return to the same baseline every race', async () => {
    const cc = window.__cc, br = window.__br, gl = br.app.renderer.info;
    const measure = () => {
      let listeners = 0;
      for (const set of br.app.bus.handlers.values()) listeners += set.size;
      return { geo: gl.memory.geometries, tex: gl.memory.textures, programs: gl.programs.length, listeners };
    };
    const rows = [];
    for (let race = 0; race < 3; race++) {
      cc.reset(); const c = cc.C(), p = cc.P();
      c.pin(1, 24, 2.5); cc.step(2); cc.press('skill1'); cc.step(60);
      c.pin(5, 1.0, 0.8); cc.step(2); cc.press('skill2'); cc.step(3); c.unpin(5); cc.step(90);
      cc.press('skill3'); cc.step(40);
      for (const id of [1, 2, 3, 4, 7, 8]) { c.resetCooldowns(); c.pin(id, 4, 1.4); cc.step(2); c.cast(id, 1); cc.step(30); }
      c.spawn('weapon', p.s + 20, p.x + 3, 'pan'); p.sp = 100; cc.press('ult');
      cc.until(() => cc.of('ult:impact').length > 0, 600); cc.step(150);
      const during = measure();
      br.game.endSession(); br.step(3);
      rows.push({ during, after: measure() });
      await cc.restart();
    }
    const same = (k) => rows[1].during[k] === rows[2].during[k] && rows[0].after[k] === rows[1].after[k] && rows[1].after[k] === rows[2].after[k];
    return { ok: ['geo', 'tex', 'programs', 'listeners'].every(same), info: rows };
  }],
];
