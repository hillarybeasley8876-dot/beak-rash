// Shared helpers for the r4 acceptance tests (lead-owned, read-only for workers). Each test prints PASS / FAIL lines
// and ends with `<name> OK` or `<name> FAILED (n)` (exit 1). Built on tools/lib.mjs (withPage, __br helpers).
export { withPage } from '../lib.mjs';

const failures = [];
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function expect(ok, msg) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`);
  if (!ok) failures.push(msg);
  return ok;
}

export function finish(name) {
  console.log(failures.length ? `\n${name} FAILED (${failures.length})` : `\n${name} OK`);
  process.exit(failures.length ? 1 : 0);
}

/** Open a race in manual stepping (no intro wait) and step until GO; returns when phase === 'racing'. */
export async function race(page, h, { track = 'coast', seed = 3, extra = '&traffic=0&police=0' } = {}) {
  await h.goto(`/?race=${track}&seed=${seed}&manual=1${extra}`);
  await page.evaluate(() => window.__br.manual(true));
  for (let i = 0; i < 40; i++) {
    const phase = await page.evaluate(() => { window.__br.step(30); return window.__br.session()?.phase; });
    if (phase === 'racing') return;
  }
  throw new Error('race never reached the racing phase');
}

/** Record every listed bus event as {n, t (session time), e (payload copy)} in window.__ev. */
export async function capture(page, names) {
  await page.evaluate((list) => {
    window.__ev = [];
    const bus = window.__br.app.bus;
    for (const n of list) {
      bus.on(n, (e) => window.__ev.push({ n, t: window.__br.session()?.time ?? 0, e: JSON.parse(JSON.stringify(e)) }));
    }
  }, names);
}

export const events = (page, name) =>
  page.evaluate((n) => (window.__ev ?? []).filter((x) => !n || x.n === n), name ?? null);

export async function clearEvents(page) {
  await page.evaluate(() => { window.__ev = []; });
}

/** Step `frames` manual frames (60 fps) with the given scripted controls held. */
export async function hold(page, controls, frames) {
  await page.evaluate(([c, n]) => { window.__br.setControls(c); window.__br.step(n); }, [controls, frames]);
}

export const player = (page) => page.evaluate(() => {
  const p = window.__br.session().player;
  return JSON.parse(JSON.stringify({ ...p, mods: p.mods, statuses: p.statuses }));
});

export async function noErrors(h, label) {
  const errs = await h.errors();
  expect(errs.length === 0, `${label}: no console errors (${errs.slice(0, 2).join(' | ')})`);
}
