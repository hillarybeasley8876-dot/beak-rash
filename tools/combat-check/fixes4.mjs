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
];
