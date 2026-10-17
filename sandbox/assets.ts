// Assets gallery (assets unit): renders every manifest entry from src/data/assets.ts through
// assetUrl(), so a missing or broken file shows up as a red MISSING tile and in the header count.
// Backdrop buttons (or ?bg=red|black|checker|white) check cut-out edges on every UI colour.
// Sets body[data-ready] once every image settled and body[data-failed] = failed count (for scripts).
import { ART, BILLBOARDS, LOADING_ART, PORTRAITS, assetUrl, type PortraitSet } from '../src/data/assets';
import { ROSTER } from '../src/data/roster';
import type { CharacterId, TrackId } from '../src/core/types';

const pending: Promise<boolean>[] = [];

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent?: HTMLElement): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  parent?.append(e);
  return e;
}

/** A labelled image tile; `bd` puts it on the switchable backdrop (for transparent cut-outs). */
function tile(parent: HTMLElement, rel: string | undefined, cls: string, label: string, bd = true): HTMLDivElement {
  const t = el('div', `tile ${cls}${bd ? ' bd' : ''}`, parent);
  if (!rel) {
    t.classList.add('missing');
    pending.push(Promise.resolve(false));
    return t;
  }
  const img = el('img', '', t);
  img.alt = label;
  pending.push(new Promise<boolean>((resolve) => {
    img.addEventListener('load', () => {
      t.title = `${rel} · ${img.naturalWidth}×${img.naturalHeight}`;
      // Wait for the decode too, so screenshots never catch a loaded-but-unpainted tile.
      img.decode().then(() => resolve(true), (e: unknown) => {
        console.error(`[assets] cannot decode ${rel}: ${String(e)}`);
        resolve(false);
      });
    }, { once: true });
    img.addEventListener('error', () => {
      console.error(`[assets] failed to load ${rel}`);
      t.classList.add('missing');
      resolve(false);
    }, { once: true });
  }));
  img.src = assetUrl(rel);
  el('span', 'label', t).textContent = label;
  return t;
}

function portraitCard(parent: HTMLElement, id: CharacterId, set: PortraitSet | undefined): void {
  const card = el('div', 'char', parent);
  el('p', 'name', card).textContent = `${ROSTER[id].name} · ${id} · ${ROSTER[id].codename}`;
  tile(card, set?.main, 'main', 'main');
  const row = el('div', 'row', card);
  tile(row, set?.smug, 'bust', 'smug');
  tile(row, set?.hurt, 'bust', 'hurt');
  tile(card, set?.eyes, 'eyes', 'eyes', false);
  const band = el('div', 'cutin', card);
  if (set?.eyes) {
    const img = el('img', '', band);
    img.alt = '';
    img.src = assetUrl(set.eyes);
    pending.push(img.decode().then(() => true, () => false));
  }
}

function build(): void {
  const portraits = document.getElementById('portraits');
  const art = document.getElementById('art');
  const bills = document.getElementById('billboards');
  if (!portraits || !art || !bills) throw new Error('[assets] gallery markup missing');
  for (const id of Object.keys(ROSTER) as CharacterId[]) portraitCard(portraits, id, PORTRAITS[id]);
  tile(art, ART.title, 'wide', 'title (16:9 full)', false);
  tile(art, ART.garage, 'wide', 'garage (16:9 full)', false);
  tile(art, ART.menu, 'cut', 'menu (cut-out)');
  for (const [i, rel] of LOADING_ART.entries()) tile(art, rel, 'cut', `loading_${i + 1}${rel === ART.loading ? ' (ART.loading)' : ''}`);
  tile(art, ART.results, 'cut', 'results (cut-out)');
  for (const track of ['coast', 'city', 'mountain'] as TrackId[]) {
    const row = el('div', 'grid', bills);
    row.style.marginBottom = '10px';
    const list = BILLBOARDS[track] ?? [];
    if (!list.length) tile(row, undefined, 'bill', `${track}: none`, false);
    list.forEach((rel, i) => tile(row, rel, 'bill', `${track}_${i + 1}`, false));
  }
}

function backdrop(bg: string): void {
  document.body.dataset.bg = bg;
  for (const b of document.querySelectorAll<HTMLButtonElement>('header button')) b.classList.toggle('on', b.dataset.bg === bg);
}

for (const b of document.querySelectorAll<HTMLButtonElement>('header button')) {
  b.addEventListener('click', () => backdrop(b.dataset.bg ?? 'split'));
}
backdrop(new URLSearchParams(location.search).get('bg') ?? 'split');
build();
void Promise.all(pending).then((ok) => {
  const failed = ok.filter((v) => !v).length;
  const stat = document.getElementById('stat');
  if (stat) {
    stat.textContent = `${ok.length} files · ${failed} missing`;
    stat.classList.toggle('bad', failed > 0);
  }
  document.body.dataset.failed = String(failed);
  document.body.dataset.ready = '1';
});
