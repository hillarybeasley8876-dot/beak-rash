#!/usr/bin/env node
// r7 acceptance: status feedback on the HUD (SPEC §29). Lead-owned, read-only for workers. Reads the HUD's debug
// surface `window.__br.hud.status()` (see briefs/r7/status-hud.md) and the page text:
//   words   — a status put on a rival ahead pops its word (data/status-words.ts) over that rival at once
//   chips   — a chip over the rival while the status lasts, gone after it ends
//   banner  — a control status on the player shows a banner with its word and a countdown, and its screen cue;
//             silenced locks the skill slots
//   readout — the player's cast reads 命中 ×N when it hit, 落空 when it hit nobody, and a skill:result text
//   rear    — a trap that fires behind the player is called out with the victim's name and the skill's name
//   node tools/r7/status-hud.mjs [--only words,banner,readout,rear]
import { parseArgs } from '../lib.mjs';
import { expect, finish, noErrors, withPage } from '../r4/accept-lib.mjs';

const a = parseArgs(process.argv.slice(2));
const only = a.only ? String(a.only).split(',') : null;
const want = (g) => !only || only.includes(g);
const LINEUP = 'goose,cat,capybara,shiba,pigeon,penguin,seagull';
const URL = `/?race=coast&seed=7&traffic=0&police=0&manual=1&intro=0&rivals=${LINEUP}`;

/** In-page kit: the race, a clean scene with rivals parked where a test wants them, stepping, the HUD read-out. */
function install() {
  const br = window.__br;
  const S = () => br.session(), P = () => S().player, C = () => br.combat;
  const k = {
    step(n = 1) {
      for (let i = 0; i < n; i++) {
        const p = P(), sc = br.app.input.scripted;
        if (sc) sc.steer = Math.max(-1, Math.min(1, -p.x * 0.9 - p.vx * 0.12));
        br.step(1);
      }
    },
    rivals: () => S().riders.filter((r) => !r.isPlayer),
    /** Rivals where `spots` says ([ds, dx] each, the rest 80 m+ behind), all passive, clean, cooldowns reset. */
    scene(spots) {
      const c = C();
      c.unpin(); S().obstacles.length = 0; c.clearItems();
      k.rivals().forEach((r, i) => {
        r.loadout.slots = []; r.loadout.ult = null;
        const sp = spots[i] ?? [-80 - i * 10, 0];
        c.pin(r.id, sp[0], sp[1], true);
      });
      for (const r of S().riders) { r.hp = r.maxHp; r.statuses.length = 0; r.sp = 0; r.invuln = 0; }
      c.force({ crit: false, block: false, loose: false });
      c.resetCooldowns();
      br.setControls({ throttle: 0.8 });
      k.step(30);
    },
    hud: () => JSON.parse(JSON.stringify(br.hud?.status?.() ?? null)),
    text: () => document.body.innerText,
    cast(id, slot = 1) {
      const p = P();
      if (slot === 4) { p.loadout.ult = id; p.sp = 100; } else p.loadout.slots[slot - 1] = id;
      C().resetCooldowns(0);
      C().cast(0, slot);
    },
  };
  br.manual(true);
  for (let i = 0; i < 3000 && S().phase !== 'racing'; i++) br.step(1);
  br.setControls({ throttle: 1 });
  k.step(120);
  window.__k = k;
}

await withPage(async (page, h) => {
  await h.goto(URL, { timeout: 120000 });
  await page.evaluate(install);
  const { WORDS } = await page.evaluate(async () => {
    const m = await import('/src/data/status-words.ts');
    return { WORDS: m.STATUS_WORDS };
  });
  const NAMES = await page.evaluate(async () => {
    const m = await import('/src/data/roster.ts');
    return Object.fromEntries(Object.entries(m.ROSTER).map(([id, r]) => [id, r.name]));
  });
  const surface = await page.evaluate(() => typeof window.__br.hud?.status === 'function');
  expect(surface, 'the HUD exposes window.__br.hud.status() (briefs/r7/status-hud.md)');
  if (!surface) return;

  if (want('words')) {
    const LIST = ['stun', 'slow', 'chill', 'frozen', 'cold', 'burn', 'wet', 'charged', 'confused', 'rooted', 'silenced', 'blind', 'oiled'];
    for (const st of LIST) {
      const w = WORDS[st];
      await page.evaluate(() => window.__k.scene([[8, 0.6]]));
      const rid = await page.evaluate(() => window.__k.rivals()[0].id);
      await page.evaluate(([id, s]) => window.__br.combat.status(id, s, 2, s === 'cold' ? 2 : 1), [rid, st]);
      await page.evaluate(() => window.__k.step(12));
      const at = await page.evaluate(() => ({ hud: window.__k.hud(), text: window.__k.text() }));
      const word = at.hud?.words?.find((x) => x.rider === rid && x.status === st);
      expect(!!word && word.text.includes(w.word) && at.text.includes(w.word), `words: ${st} on the rival 8 m ahead pops 「${w.word}」 over it within 0.2 s (${JSON.stringify(word ?? at.hud?.words?.slice(0, 3))})`);
      const chip1 = (at.hud?.chips?.[rid] ?? []).includes(st);
      await page.evaluate(() => window.__k.step(60));
      const mid = await page.evaluate(() => window.__k.hud());
      await page.evaluate(() => window.__k.step(80));
      const after = await page.evaluate(() => window.__k.hud());
      expect(chip1 && (mid?.chips?.[rid] ?? []).includes(st) && !(after?.chips?.[rid] ?? []).includes(st),
        `words: the 「${w.glyph}」 chip shows over the rival while ${st} lasts and is gone after it (${chip1}, ${JSON.stringify(mid?.chips?.[rid])}, ${JSON.stringify(after?.chips?.[rid])})`);
    }
    // only what the player can see: a rival 150 m ahead pops no word
    await page.evaluate(() => window.__k.scene([[150, 0]]));
    const far = await page.evaluate(() => window.__k.rivals()[0].id);
    await page.evaluate((id) => { window.__br.combat.status(id, 'stun', 2); window.__k.step(12); }, far);
    const farHud = await page.evaluate(() => window.__k.hud());
    expect(!(farHud?.words ?? []).some((x) => x.rider === far), 'words: a rival 150 m ahead (off the screen) pops no word');
  }

  if (want('banner')) {
    const LIST = ['confused', 'silenced', 'frozen', 'stun', 'rooted', 'chill', 'slow', 'oiled'];
    const CUE = new Set(['confused', 'silenced', 'frozen', 'stun']);
    for (const st of LIST) {
      const w = WORDS[st];
      await page.evaluate(() => window.__k.scene([]));
      await page.evaluate((s) => { window.__br.combat.status(0, s, 2.5); window.__k.step(12); }, st);
      const at = await page.evaluate(() => ({ hud: window.__k.hud(), text: window.__k.text() }));
      const b = at.hud?.banner;
      expect(!!b && b.status === st && b.text.includes(w.word) && b.left > 1.5 && b.left <= 2.5 && at.text.includes(w.word),
        `banner: ${st} on the player shows 「${w.word}」 with a countdown (${JSON.stringify(b)})`);
      if (CUE.has(st)) expect(at.hud?.cue === st, `banner: ${st} turns on its screen cue (${at.hud?.cue})`);
      if (st === 'silenced') expect(at.hud?.slotsLocked === true, `banner: silenced locks the skill slots (${at.hud?.slotsLocked})`);
      await page.evaluate(() => window.__k.step(170));
      const after = await page.evaluate(() => window.__k.hud());
      expect(after?.banner === null && after?.cue === null && after?.slotsLocked === false, `banner: after ${st} ends the banner, the cue and the lock are gone (${JSON.stringify(after?.banner)}, ${after?.cue}, ${after?.slotsLocked})`);
    }
  }

  if (want('readout')) {
    // a hit: the goose's honk at three rivals ahead
    await page.evaluate(() => window.__k.scene([[6, 0.5], [9, -1], [12, 1]]));
    await page.evaluate(() => { window.__k.cast('goose.honk'); window.__k.step(90); });
    let r = await page.evaluate(() => window.__k.hud());
    const hit = (r?.readouts ?? []).find((x) => /命中\s*[×x]\s*\d/.test(x.text));
    expect(!!hit, `readout: the honk that hit reads 命中 ×N (${JSON.stringify(r?.readouts)})`);
    // a miss: the torpedo with nobody ahead
    await page.evaluate(() => window.__k.scene([]));
    await page.evaluate(() => { window.__k.cast('pelican.torpedo'); });
    let miss = null;
    for (let i = 0; i < 30 && !miss; i++) {
      await page.evaluate(() => window.__k.step(10));
      r = await page.evaluate(() => window.__k.hud());
      miss = (r?.readouts ?? []).find((x) => x.text.includes('落空'));
    }
    expect(!!miss, `readout: the torpedo that hit nobody reads 落空 (${JSON.stringify(r?.readouts)})`);
    // skill:result — the player's shows, a rival's does not
    await page.evaluate(() => {
      const bus = window.__br.app.bus;
      bus.emit('skill:result', { riderId: 0, skillId: 'pool.thermos', text: '+30 HP', good: true });
      bus.emit('skill:result', { riderId: window.__k.rivals()[0].id, skillId: 'pool.thermos', text: '+99 HP', good: true });
      window.__k.step(6);
    });
    r = await page.evaluate(() => window.__k.hud());
    expect((r?.readouts ?? []).some((x) => x.text.includes('+30 HP')) && !(r?.readouts ?? []).some((x) => x.text.includes('+99 HP')),
      `readout: the player's skill:result shows, a rival's does not (${JSON.stringify(r?.readouts)})`);
  }

  if (want('rear')) {
    // the rival rides 7 m behind in the caster's own lane (pinned there): the peels land on the road and fall back
    // through that spot, so it skids on one — the catch itself must be called out, not only the trap
    await page.evaluate(() => window.__k.scene([[-7, 0]]));
    const rid = await page.evaluate(() => window.__k.rivals()[0].id);
    const name = NAMES[await page.evaluate((id) => window.__br.session().rider(id).character, rid)];
    await page.evaluate(() => window.__k.cast('bananacat.peel'));
    let rear = null, r = null, skid = false;
    for (let i = 0; i < 40 && !rear; i++) {
      await page.evaluate(() => window.__k.step(6));
      r = await page.evaluate(() => window.__k.hud());
      skid = skid || await page.evaluate((id) => window.__br.session().rider(id).statuses.some((q) => q.id === 'confused'), rid);
      rear = (r?.rear ?? []).find((x) => x.text.includes('香蕉皮') && x.text.includes('踩中'));
    }
    expect(skid, `rear: the rival 7 m behind in the caster's lane skids on a peel (confused)`);
    expect(!!rear && rear.text.includes(name), `rear: the skid behind is called out — 「身后 · ${name} 踩中香蕉皮！」 (${JSON.stringify(r?.rear)})`);
  }
  await noErrors(h, 'status-hud');
}, { size: '1280x720' });
finish('r7-status-hud');
