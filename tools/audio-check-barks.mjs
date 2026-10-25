// Held KO lines (part of audio-check --game): the characters' lines wait for the end of the KO
// cinematic, then for the bark channel. A long rival bark cut by the announcer must not block the
// pelican's quip; a repeat KO's short cinematic still gets the victim's groan; so does WRECKED.
import { pathToFileURL } from 'node:url';
import { withPage, parseArgs } from './lib.mjs';

/** Bark checks in a live race; returns failure messages. */
export async function barksCheck(args) {
  const fails = [];
  const expect = (cond, msg) => {
    console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`);
    if (!cond) fails.push(`barks: ${msg}`);
  };
  await withPage(async (page, h) => {
    console.log('\n-- held KO lines (/?race=coast)');
    await h.goto(`/?race=coast&seed=3&police=0&traffic=0${typeof args.stub === 'string' ? `&stub=${args.stub}` : ''}`);
    await h.eval(() => window.__br.audio.unlock());
    await h.realtime();
    await h.controls({ throttle: 1 });
    const ready = await page.waitForFunction(() => window.__br.snapshot().phase === 'racing', null, { timeout: 60000 })
      // Every clip decoded (they stream in after unlock, a few at a time).
      .then(() => page.waitForFunction(() => {
        const v = window.__br.app.audio.rt.voices;
        return v.loading.size === 0 && v.clips.size >= v.byText.size;
      }, null, { timeout: 90000 }))
      .then(() => true, () => false);
    expect(ready, 'race running and every voice clip decoded');
    if (!ready) return;
    await h.eval(() => {
      window.__cine = [];
      window.__br.app.bus.on('cine:ko', (e) => window.__cine.push({ phase: e.phase, ms: performance.now() }));
    });
    /** KO `victim` (moved next to the player) by `attacker`; returns the bark ids traced after the
     *  cinematic's end with their delay (ms), and the cinematic's length. */
    const ko = async (victim, attacker, before) => {
      const at = await page.evaluate(([v, a]) => {
        const br = window.__br;
        const me = br.snapshot().riders[0];
        if (v !== 0) br.teleport(v, me.s + 4, me.x + 1);
        if (a !== null && a !== 0) br.teleport(a, me.s - 3, me.x - 1);
        const t = performance.now();
        br.ko(v, a);
        return t;
      }, [victim, attacker]);
      await page.waitForFunction((t) => window.__cine.some((e) => e.ms >= t && e.phase === 'end'), at, { timeout: 8000 }).catch(() => null);
      await h.sleep(1800);
      return page.evaluate(([t, pre]) => {
        const start = window.__cine.find((e) => e.ms >= t && e.phase === 'start');
        const end = window.__cine.find((e) => e.ms >= t && e.phase === 'end');
        const ref = end?.ms ?? Infinity;
        const barks = window.__br.audio.trace().filter((e) => e.kind === 'bark' && e.ms >= ref - 5 && !pre.includes(e.id));
        return {
          cine: end && start ? Math.round(end.ms - start.ms) : null,
          barks: barks.map((e) => ({ id: e.id, after: Math.round(e.ms - ref) })),
        };
      }, [at, before ?? []]);
    };
    const show = (r) => `cine ${r.cine} ms; ${r.barks.map((b) => `${b.id} +${b.after} ms`).join(', ') || 'no bark'}`;
    const reset = () => h.eval(() => {
      const a = window.__br.app.audio;
      a.cool.delete('pelicanLine');
      a.rt.voices.barkUntil = -Infinity;
    });

    // 1. A long rival bark is cut by ann_ko at the peak: the pelican's quip still follows the cinematic.
    await reset();
    await h.eval(() => window.__br.app.audio.rt.voices.play('sloth_taunt_3', { channel: 'bark', gain: 0.7 }));
    await h.sleep(500);
    const first = await ko(2, 0, ['sloth_taunt_3']);
    const quip = first.barks.find((b) => /^pelican_ko_/.test(b.id));
    expect(quip !== undefined && quip.after <= 1300, `long rival bark cut by the announcer → pelican quip after the cinematic (${show(first)})`);

    // 2. A repeat KO within 10 s (short cinematic, the pelican's 6 s line cooldown running): the victim's groan.
    const victim = await page.evaluate(() => {
      const ids = new Set(window.__br.app.audio.rt.voices.byText.values());
      const r = window.__br.snapshot().riders.find((x) => x.id > 2 && ids.has(`${x.c}_hurt_0`));
      return r ? { id: r.id, c: r.c } : null;
    });
    if (victim) {
      await h.eval(() => { window.__br.app.audio.rt.voices.barkUntil = -Infinity; });
      const second = await ko(victim.id, 0);
      const groan = second.barks.find((b) => b.id.startsWith(`${victim.c}_hurt_`));
      expect(groan !== undefined && groan.after <= 1300, `repeat KO (short cinematic) → ${victim.c}'s hurt line (${show(second)})`);
    } else expect(false, 'repeat KO: no rival with a voiced hurt line');

    // 3. The player is wrecked (short cinematic, ann_wrecked at the peak): the pelican's groan follows.
    await h.sleep(1500);
    await reset();
    const wreck = await ko(0, 1);
    const hurt = wreck.barks.find((b) => /^pelican_hurt_/.test(b.id));
    expect(hurt !== undefined && hurt.after <= 1000, `player wrecked → pelican_hurt within 1 s of the cinematic's end (${show(wreck)})`);
    const errs = (await h.errors()).filter((e) => /\[audio\]|src\/audio/.test(e));
    expect(errs.length === 0, `no audio errors (${errs.length})`);
  });
  return fails;
}

// Standalone: node tools/audio-check-barks.mjs [--stub camera,fx]  (exit 1 on any failure)
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const fails = await barksCheck(parseArgs(process.argv.slice(2)));
  console.log(fails.length ? `\nFAILED (${fails.length}):\n- ${fails.join('\n- ')}` : '\nall passed');
  process.exit(fails.length ? 1 : 0);
}
