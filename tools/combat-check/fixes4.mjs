// Fix round 2 (resumed) regressions: RiderState.weaponUses, per-frame visual sync. Rider ids: 1 goose, 2 cat,
// 3 capybara, 4 shiba, 5 pigeon, 6 penguin, 7 seagull, 8 sloth, 9 corgi.
export const fixes4 = [
  ['rider.weaponUses follows the weapon: a stolen worn one keeps its count, hits wear it, a break or a drop + pickup', () => {
    const cc = window.__cc; cc.reset(); const c = cc.C(); const p = cc.P(), g = cc.R(1);
    const hit = (loose) => { c.force({ crit: false, block: false, loose }); g.hp = g.maxHp; cc.press('attackR'); cc.step(1); cc.step(40); };
    const fresh = [p.weaponUses, g.weaponUses];
    c.give(1, 'baguette', 2); c.pin(1, 0.2, 1.2); cc.step(2);
    hit(true);
    const stolen = { mine: p.weapon, uses: p.weaponUses, theirs: g.weaponUses };
    hit(false);
    const worn = p.weaponUses;
    hit(false);
    const broke = { weapon: p.weapon, uses: p.weaponUses, ev: cc.of('combat:weaponBreak').length };
    c.give(0, 'leek'); c.give(1, 'pan', 2); cc.step(2); cc.mark();
    hit(true);
    const drop = c.items().find((it) => it.kind === 'weapon' && it.weapon === 'pan');
    c.give(0, 'none'); c.pin(1, -80, 0); cc.step(2);
    window.__br.teleport(0, drop.s - 8, drop.x); cc.lane = drop.x; cc.ctl({ throttle: 0.6 });
    cc.until(() => cc.of('pickup:take', (e) => e.riderId === 0).length > 0, 240);
    const picked = { weapon: p.weapon, uses: p.weaponUses };
    c.give(0, 'none');
    return { ok: fresh[0] === Infinity && stolen.mine === 'baguette' && stolen.uses === 2 && stolen.theirs === Infinity && worn === 1 &&
      broke.weapon === 'none' && broke.uses === Infinity && broke.ev === 1 && !!drop && picked.weapon === 'pan' && picked.uses === 2 &&
      p.weaponUses === Infinity, info: { fresh, stolen, worn, broke, drop: !!drop, picked } };
  }],
  ['render sync: ribbons and pickup instances are rewritten once per rendered frame on final poses, hit-stop frames too', () => {
    const cc = window.__cc; cc.reset(); const c = cc.C(); const p = cc.P(), br = window.__br;
    c.spawn('coin', p.s + 25, 2); c.cast(0, 3); cc.step(4);
    const root = cc.S().world.children.find((o) => o.name === 'combat');
    const ribbons = [], coins = root.children.find((o) => o.name === 'pickups:coin');
    root.traverse((o) => { if (o.isMesh && o.geometry.getAttribute('color')?.itemSize === 4 && o.geometry.drawRange.count > 0) ribbons.push(o); });
    const versions = () => [...ribbons.map((m) => m.geometry.getAttribute('position').version), coins.instanceMatrix.version];
    const delta = (a, b) => b.map((v, i) => v - a[i]);
    const v0 = versions(), t0 = cc.S().time; cc.step(1);
    const v1 = versions(), t1 = cc.S().time; br.app.clock.hitStop(0.1); cc.step(1);
    const v2 = versions(), t2 = cc.S().time;
    const normal = delta(v0, v1), frozen = delta(v1, v2);
    cc.until(() => c.running().length === 0, 300);
    return { ok: ribbons.length === 2 && t1 > t0 && t2 === t1 && normal.every((d) => d === 1) && frozen.every((d) => d === 1),
      info: { ribbons: ribbons.length, normal, frozen, substepTime: t1 - t0, hitStopTime: t2 - t1 } };
  }],
];
