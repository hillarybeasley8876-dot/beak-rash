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
  ['past the line nothing scores: SHOWTIME denied near the line, ended mid-dive, projectiles poof, no KO credit', async () => {
    const cc = window.__cc, br = window.__br; cc.reset(); const c = cc.C(); const p = cc.P();
    const L = cc.S().track.length;
    br.teleport(0, L - 15, 0); c.set(0, { speed: 20 }); cc.ctl({ throttle: 1 }); p.sp = 100; cc.step(1); cc.mark();
    cc.press('ult'); cc.step(2);
    const denied = cc.of('skill:denied', (e) => e.riderId === 0 && e.slot === 4)[0], starts0 = cc.of('ult:start').length;
    br.teleport(0, L - 60, 0); c.set(0, { speed: 20 }); p.sp = 100; c.pin(1, -8, 2); c.pin(2, 10, -2); cc.step(2);
    cc.R(1).hp = 20; cc.R(2).hp = 20; cc.mark();
    cc.press('ult'); cc.step(1); cc.step(12);
    const started = cc.of('ult:start').length, y0 = p.y;
    br.teleport(0, L + 1, 0); p.y = y0; p.airborne = true; cc.step(2);
    const ended = cc.of('skill:end', (e) => e.skillId === 'pelican.ult').length;
    cc.until(() => p.y <= 0.01 && !p.airborne, 240); cc.step(60);
    const ultEvents = { impact: cc.of('ult:impact').length, kos: cc.of('combat:ko').length, hits: cc.of('combat:hit', (h) => h.attacker === 0).length };
    const info = { denied, starts0, started, y0, ended, ultEvents, landedY: p.y, mode: p.mode, hp: [cc.R(1).hp, cc.R(2).hp] };
    await cc.restart();
    return { ok: denied?.reason === 'state' && starts0 === 0 && started === 1 && y0 > 2 && ended === 1 && ultEvents.impact === 0 &&
      ultEvents.kos === 0 && ultEvents.hits === 0 && p.mode !== 'racing' && info.hp.join() === '20,20', info };
  }],
  ['a finished rider scores nothing: its torpedo in flight poofs, a later wreck of its victim is not credited', async () => {
    const cc = window.__cc, br = window.__br; cc.reset(); const c = cc.C(); const p = cc.P();
    c.force({ crit: false, block: false, loose: false });
    const L = cc.S().track.length;
    br.teleport(0, L - 60, 0); c.set(0, { speed: 15 }); cc.ctl({ throttle: 1 }); c.pin(3, 0.2, 1.2); c.pin(1, 30, 0); cc.step(2);
    c.swing(0, 1); cc.until(() => cc.of('combat:hit', (h) => h.attacker === 0).length > 0, 40);
    const hit = cc.of('combat:hit', (h) => h.attacker === 0)[0], kos0 = p.kos, coins0 = p.coins, goose = cc.R(1).hp;
    cc.step(20); cc.press('skill1'); cc.until(() => cc.of('projectile:spawn').length > 0, 30);
    const spawn = cc.of('projectile:spawn')[0];
    c.unpin(1); c.unpin(3); br.teleport(0, L + 1, 0); cc.step(1);
    cc.until(() => cc.of('projectile:end').length > 0, 120);
    const poof = cc.of('projectile:end')[0], finishedFirst = p.finishTime !== null;
    cc.R(3).hp = 0; cc.step(3);
    const ko = cc.of('combat:ko', (k) => k.victim === 3)[0];
    const info = { hit: hit?.victim, spawn, poof, finishedFirst, ko, kos: p.kos - kos0, coins: p.coins - coins0 - cc.stylePaid().coins, goose: [goose, cc.R(1).hp] };
    await cc.restart();
    return { ok: hit?.victim === 3 && spawn?.target === 1 && poof?.id === spawn.id && poof.hit === null && finishedFirst &&
      info.goose[0] === info.goose[1] && ko?.attacker === null && info.kos === 0 && info.coins === 0, info };
  }],
  ['3-race loop: combat-owned scene state repeats every race; GPU memory, programs and listeners return to baseline', async () => {
    const cc = window.__cc, br = window.__br, gl = br.app.renderer.info;
    const measure = () => {
      let listeners = 0;
      for (const set of br.app.bus.handlers.values()) listeners += set.size;
      return { geo: gl.memory.geometries, tex: gl.memory.textures, programs: gl.programs.length, listeners };
    };
    /** Objects, unique geometries and materials under the combat root, plus the debug counts (combat's own state). */
    const owned = () => {
      const root = cc.S().world.getObjectByName('combat'), geos = new Set(), mats = new Set();
      let objects = 0;
      root?.traverse((o) => {
        objects++;
        if (o.geometry) geos.add(o.geometry.uuid);
        for (const m of [o.material ?? []].flat()) mats.add(m.uuid);
      });
      return { objects, geos: geos.size, mats: mats.size, ...cc.C().counts() };
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
      const during = owned();
      br.game.endSession(); br.step(3);
      rows.push({ during, after: measure() });
      await cc.restart();
    }
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    return { ok: same(rows[0].during, rows[1].during) && same(rows[1].during, rows[2].during) &&
      same(rows[0].after, rows[1].after) && same(rows[1].after, rows[2].after), info: rows };
  }],
];
