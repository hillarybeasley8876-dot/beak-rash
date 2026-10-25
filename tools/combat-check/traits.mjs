// r4 weapon traits (SPEC §15): the pan parry, the baguette's knock-loose, the leek's three-hit chain, the
// selfie flash, the keyboard's crit chance, the saltfish boomerang, the slipper seeker and the STYLE /
// trick rewards. Run in the page (see page.mjs). Rider ids: 1 goose, 2 cat, 3 capybara, 4 shiba.
export const traits = [
  ['pan parry: a rival melee hit is parried (no damage, the attacker is stunned, combat:parry)', () => {
    const cc = window.__cc; cc.reset(); const c = cc.C(); const p = cc.P(), g = cc.R(1);
    c.give(0, 'pan', 6); c.give(1, 'none'); c.pin(1, 0.2, 1.3); p.hp = p.maxHp; g.hp = g.maxHp;
    c.force({ crit: false, block: false }); cc.step(2);
    c.swing(1, -1, true);      // the rival's heavy swing at the player
    cc.step(3);
    c.swing(0, -1, false);     // the player's parry swing (away from the attacker: a parry, not a counter)
    cc.step(40);
    const parries = cc.of('combat:parry'), hits = cc.of('combat:hit', (h) => h.victim === 0);
    return { ok: parries.length === 1 && parries[0].attacker === 1 && parries[0].weapon === 'pan' &&
      parries[0].obstacleId === null && hits.length === 0 && p.hp === p.maxHp && cc.has(g, 'stun'),
      info: { parries, hits, hp: p.hp, stun: cc.has(g, 'stun') } };
  }],
  ['baguette: a heavy hit always knocks the weapon loose (the loose roll is forced off)', () => {
    const cc = window.__cc; cc.reset(); const c = cc.C(); const p = cc.P(), g = cc.R(1);
    c.give(0, 'baguette', 6); c.give(1, 'pan', 6); c.pin(1, 0.2, 1.3); g.hp = g.maxHp;
    c.force({ crit: false, block: false, loose: false });   // the roll alone would never knock it loose
    cc.step(2);
    c.swing(0, 1, true); cc.step(40);
    const dropped = cc.of('combat:weaponDrop');
    return { ok: g.weapon === 'none' && dropped.length === 1 && dropped[0].weapon === 'pan' && p.weapon === 'baguette',
      info: { theirs: g.weapon, dropped, mine: p.weapon } };
  }],
  ['leek: the third hit in a row deals x1.5 damage (and +50 % knock)', () => {
    const cc = window.__cc; cc.reset(); const c = cc.C(); const p = cc.P(), g = cc.R(1);
    c.give(0, 'leek', 10); c.give(1, 'none'); c.pin(1, 0.2, 1.3); g.hp = 9999;
    c.force({ crit: false, block: false }); cc.step(2);
    const dmg = [];
    for (let i = 0; i < 3; i++) {
      c.swing(0, 1, false);
      cc.until(() => cc.of('combat:hit', (h) => h.attacker === 0 && h.victim === 1).length > 0, 60);
      dmg.push(...cc.of('combat:hit', (h) => h.attacker === 0 && h.victim === 1).map((h) => h.damage));
      cc.step(24);   // 0.5 s apart: inside the 1.2 s window
      cc.mark();
    }
    return { ok: dmg.length === 3 && Math.abs(dmg[2] - dmg[0] * 1.5) < 0.6, info: { dmg } };
  }],
  ['selfie: a landed hit blinds the victim', () => {
    const cc = window.__cc; cc.reset(); const c = cc.C(); const p = cc.P(), g = cc.R(1);
    c.give(0, 'selfie', 9); c.give(1, 'none'); c.pin(1, 0.2, 1.3); g.hp = 9999;
    c.force({ crit: false, block: false }); cc.step(2);
    c.swing(0, 1, false); cc.step(20);
    return { ok: cc.has(g, 'blind'), info: { statuses: g.statuses.map((s) => s.id) } };
  }],
  ['keyboard: about a quarter of the hits crit (the other weapons 10 %)', () => {
    const cc = window.__cc; cc.reset(); const c = cc.C(); const p = cc.P(), g = cc.R(1);
    c.give(1, 'none'); c.pin(1, 0.2, 1.3); g.hp = 99999;
    cc.step(2);
    for (let i = 0; i < 60; i++) {
      p.combo = 0; p.comboTimer = 0;   // ONE MORE! would force the crits and hide the weapon's own chance
      c.give(0, 'keyboard', 5); c.swing(0, 1, false); cc.step(34);
    }
    const hits = cc.of('combat:hit', (h) => h.attacker === 0 && h.weapon === 'keyboard');
    const crits = hits.filter((h) => h.crit).length;
    return { ok: hits.length >= 55 && crits / hits.length >= 0.08 && crits / hits.length <= 0.45,
      info: { hits: hits.length, crits, rate: +(crits / hits.length).toFixed(3) } };
  }],
  ['saltfish: a throw that hits nothing comes back to the hand (one use fewer)', () => {
    const cc = window.__cc; cc.reset(); const c = cc.C(); const p = cc.P();
    c.give(0, 'saltfish', 8); c.resetCooldowns(); cc.step(20);
    cc.ctl({ throttle: 1, heavy: true, heavyHeld: true }); cc.step(1);
    cc.ctl({ throttle: 1, heavyHeld: true }); cc.step(20);
    cc.ctl({ throttle: 0.5, heavyHeld: false }); cc.step(150);
    const thrown = cc.of('combat:throw');
    return { ok: thrown.length === 1 && p.weapon === 'saltfish' && p.weaponUses === 7,
      info: { thrown: thrown.length, weapon: p.weapon, uses: p.weaponUses } };
  }],
  ['slipper: a thrown slipper homes onto a rival off to the side', () => {
    const cc = window.__cc; cc.reset(); const c = cc.C(); const p = cc.P(), g = cc.R(1);
    c.pin(1, 20, 9); g.hp = 9999; c.give(0, 'slipper', 3); c.resetCooldowns(); cc.step(10);
    cc.ctl({ throttle: 1, heavy: true, heavyHeld: true }); cc.step(1);
    cc.ctl({ throttle: 1, heavyHeld: true }); cc.step(20);
    cc.ctl({ throttle: 1, heavyHeld: false }); cc.step(150);
    const hits = cc.of('combat:hit', (h) => h.attacker === 0 && h.victim === 1);
    return { ok: hits.length === 1 && hits[0].weapon === 'slipper', info: { hits, thrown: cc.of('combat:throw').length } };
  }],
  ['rewards: a banked STYLE chain pays SP and coins, a landed trick pays SP', () => {
    const cc = window.__cc; cc.reset(); const c = cc.C(); const p = cc.P();
    const sp0 = p.sp, coins0 = p.coins;
    window.__br.app.bus.emit('style:bank', { riderId: 0, total: 600, count: 3, sp: 6, coins: 2, broken: false });
    cc.step(2);
    const bank = { sp: p.sp - sp0, coins: p.coins - coins0 };
    window.__br.app.bus.emit('rider:trick', { riderId: 0, phase: 'land', kind: 'spin', count: 2, points: 290 });
    cc.step(2);
    const trick = p.sp - sp0 - bank.sp;
    return { ok: bank.sp === 6 && bank.coins === 2 && trick === 16, info: { bank, trick } };
  }],
];
