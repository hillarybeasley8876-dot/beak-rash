// Page-side checks for the verification runs (each runs inside the page via page.evaluate).

/** Font faces by family: how many slices loaded / failed so far. */
export function fontReport(page) {
  return page.evaluate(async () => {
    await document.fonts.ready;
    const fams = {};
    for (const f of document.fonts) {
      const k = f.family.replace(/["']/g, '');
      fams[k] ??= { loaded: 0, error: 0, unloaded: 0 };
      if (f.status === 'loaded') fams[k].loaded++;
      else if (f.status === 'error') fams[k].error++;
      else fams[k].unloaded++;
    }
    return fams;
  });
}

/** Every <img> in the page: loaded, broken or pending, plus the visible HUD portraits. */
export function imageReport(page) {
  return page.evaluate(() => {
    const out = { total: 0, loaded: 0, broken: [], pending: [], visiblePortraits: [] };
    for (const img of document.querySelectorAll('img')) {
      out.total++;
      const name = img.src.replace(/^.*\/assets\//, 'assets/').slice(0, 90);
      if (!img.complete) out.pending.push(name);
      else if (img.naturalWidth === 0) out.broken.push(name);
      else out.loaded++;
      const r = img.getBoundingClientRect();
      const visible = r.width > 8 && r.height > 8 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
      if (visible && img.naturalWidth > 0 && name.includes('portraits/')) {
        out.visiblePortraits.push(`${name} @${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
    }
    return out;
  });
}

/** Audio state, voice clips decoded vs missing, and the level of the final mix over `seconds`. */
export function audioReport(page, seconds = 1.5) {
  return page.evaluate(async (secs) => {
    const br = window.__br;
    const sys = br.app.audio;
    const clips = sys?.rt?.voices?.clips;
    const voice = { decoded: 0, missing: [], inflight: sys?.rt?.voices?.loading?.size ?? null };
    if (clips) {
      for (const [id, c] of clips) {
        if (c instanceof AudioBuffer) voice.decoded++;
        else voice.missing.push(id);
      }
    }
    let level = null;
    try { level = await br.audio.level(secs); } catch (err) { level = String(err); }
    const lines = br.audio.trace().filter((t) => t.kind === 'voice' || t.kind === 'bark').map((t) => t.id);
    return { state: br.audio.state(), voice, level, voiceLinesPlayed: lines.slice(-12) };
  }, seconds);
}

/** Errors the game itself captured (console.error, window errors, rejections). */
export function gameErrors(page) {
  return page.evaluate(() => window.__br.errors.slice());
}

export function snapshot(page) {
  return page.evaluate(() => {
    const s = window.__br.snapshot();
    const me = s.riders?.[0];
    return { screen: s.screen, phase: s.phase, fps: s.fps, time: +Number(s.time).toFixed(1), player: me ? { s: me.s, v: me.v, place: me.place, hp: me.hp } : null };
  });
}
