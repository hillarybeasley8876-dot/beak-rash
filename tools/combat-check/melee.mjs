// Melee scenarios (run in the page; window.__cc from page.mjs). Rider ids follow the lineup in
// combat-check.mjs: 1 goose, 2 cat, 3 capybara, 4 shiba, 5 pigeon, 6 penguin, 7 seagull, 8 sloth, 9 corgi.
export const melee = [
  ['light hit lands once (dmg, wobble, hit reaction)', () => {
    const cc = window.__cc; cc.reset(); const c = cc.C();
    c.force({ crit: false, block: false, loose: false });
    c.pin(1, 0.2, 1.2); cc.step(2);
    const v = cc.R(1), hp0 = v.hp;
    cc.press('attackR'); cc.step(1);
    const f = cc.until(() => cc.of('combat:hit').length > 0, 40);
    const wob = cc.has(v, 'wobble'), act = v.action?.kind;
    cc.step(40);
    const hits = cc.of('combat:hit'), swings = cc.of('combat:swing', (p) => p.riderId === 0), h = hits[0];
    return { ok: hits.length === 1 && swings.length === 1 && h?.victim === 1 && h.damage === 8 && !h.blocked && v.hp === hp0 - 8 && wob && act === 'hit',
      info: { frames: f, hits: hits.length, dmg: h?.damage, hp0, hp: v.hp, wob, act } };
  }],
  ['wrong side / out of reach / |ds| too big / reach weapon', () => {
    const cc = window.__cc; cc.reset(); const c = cc.C(); c.force({ crit: false, block: false, loose: false });
    const tryHit = (ds, dx, key) => {
      c.pin(1, ds, dx); cc.step(2); cc.mark();
      cc.press(key); cc.step(1); cc.step(40);
      return cc.of('combat:hit').length;
    };
    const wrong = tryHit(0.2, 1.2, 'attackL');
    const far = tryHit(0.2, 2.4, 'attackR');
    const ahead = tryHit(2.0, 1.2, 'attackR');
    c.give(0, 'selfie');
    const selfie = tryHit(0.2, 2.4, 'attackR');
    return { ok: wrong === 0 && far === 0 && ahead === 0 && selfie === 1, info: { wrong, far, ahead, selfie } };
  }],
  ['never hits intangible / invisible / invulnerable riders', () => {
    const cc = window.__cc; cc.reset(); const c = cc.C(); c.force({ crit: false, block: false });
    c.pin(1, 0.2, 1.2);
    const res = {};
    for (const mode of ['intangible', 'invisible', 'invuln']) {
      if (mode === 'invuln') cc.R(1).invuln = 2; else c.status(1, mode, 2);
      cc.step(2); cc.mark();
      cc.press('attackR'); cc.step(1); cc.step(40);
      res[mode] = cc.of('combat:hit').length;
      cc.R(1).statuses.length = 0; cc.R(1).invuln = 0;
    }
    return { ok: res.intangible === 0 && res.invisible === 0 && res.invuln === 0, info: res };
  }],
  ['forced crit ×1.6 and counter-crit cancels the rival swing', () => {
    const cc = window.__cc; cc.reset(); const c = cc.C();
    c.force({ crit: true, block: false, loose: false }); c.pin(1, 0.2, 1.2); cc.step(2);
    cc.press('attackR'); cc.step(1); cc.step(40);
    const crit = cc.of('combat:hit')[0];
    c.force({ block: false, loose: false }); cc.step(30); cc.mark();
    const p = cc.P(), hpP = p.hp;
    c.swing(1, -1, true);
    cc.press('attackR'); cc.step(1); cc.step(60);
    const counter = cc.of('combat:hit', (h) => h.attacker === 0)[0];
    const back = cc.of('combat:hit', (h) => h.attacker === 1).length;
    return { ok: crit?.crit === true && crit.damage === 12 && counter?.crit === true && back === 0 && p.hp === hpP,
      info: { critDmg: crit?.damage, counter: counter?.crit, rivalHits: back } };
  }],
  ['heavy picks the side automatically and hits harder', () => {
    const cc = window.__cc; cc.reset(); const c = cc.C(); c.force({ crit: false, block: false, loose: false });
    c.pin(3, 0.3, -1.3); cc.step(2);
    cc.press('heavy'); cc.step(1); cc.step(60);
    const h = cc.of('combat:hit')[0], sw = cc.of('combat:swing')[0];
    return { ok: h?.victim === 3 && h.heavy && h.side === -1 && h.damage === 13 && sw?.heavy === true, info: { h, sw } };
  }],
  ['combo of 3 → ONE MORE! (+2 SP) and the next hit crits; one rival pays a full swing once per 4 s', () => {
    const cc = window.__cc; cc.reset(); const c = cc.C(); c.force({ block: false, loose: false });
    c.pin(3, 0.2, 1.2); cc.step(2);
    const sp0 = cc.P().sp;
    for (let i = 0; i < 4; i++) { cc.press('attackR'); cc.step(1); cc.step(30); }
    const hits = cc.of('combat:hit', (h) => h.attacker === 0), combos = cc.of('combat:combo');
    const gained = cc.P().sp - sp0;
    const want = 2.5 + 3 * 0.5 + 2; // a full swing, three repeats on the same rival, ONE MORE (+ a little drafting)
    return { ok: hits.length === 4 && combos.some((e) => e.count === 3) && hits[3].crit === true && gained >= want - 1e-6 && gained < want + 2.5,
      info: { hits: hits.map((h) => h.crit), combos: combos.map((e) => e.count), gained } };
  }],
];
