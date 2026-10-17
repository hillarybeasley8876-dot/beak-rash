// Sandbox control panel (DOM). Thin: every button calls the window.__actors API.
import type { ViewCue } from '../src/core/contracts';
import type { BikeId, CharacterId, WeaponId } from '../src/core/types';
import { ROSTER_IDS, S, controls, riders } from './actors-scene';

interface Api {
  set(o: Partial<typeof S>): void;
  cue(name: ViewCue, opts?: { side?: -1 | 1; skillId?: string }): void;
  action(kind: 'attack' | 'heavy' | 'skill' | 'ult' | 'bell' | 'hit', side: -1 | 1, dur: number, skillId?: string | null): void;
  weapon(w: WeaponId): void;
  status(id: 'stun' | 'invisible', time: number): void;
  boost(time: number): void;
  crash(): void;
}

const BIKES: BikeId[] = ['roadbike', 'erba', 'shared', 'fixie', 'mtb', 'tandem', 'kidbike'];
const WEAPONS: WeaponId[] = ['none', 'saltfish', 'baguette', 'pan', 'leek', 'umbrella', 'selfie', 'slipper', 'keyboard'];
const CUES: ViewCue[] = ['attack', 'heavy', 'hit', 'stun', 'skill', 'ult', 'bell', 'taunt', 'victory', 'defeat', 'land', 'boost'];

function row(panel: HTMLElement, label: string): HTMLDivElement {
  const d = document.createElement('div');
  d.className = 'row';
  d.innerHTML = `<b>${label}</b> `;
  panel.appendChild(d);
  return d;
}

function btn(parent: HTMLElement, text: string, fn: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = text;
  b.onclick = fn;
  parent.appendChild(b);
  return b;
}

export function buildPanel(api: Api): void {
  const panel = document.getElementById('panel') as HTMLDivElement;
  panel.innerHTML = '<b style="color:#ff1e3c">ACTORS</b>';
  const who = row(panel, 'rider');
  for (const id of ROSTER_IDS) btn(who, id, () => api.set({ character: id as CharacterId, mode: 'ride' }));
  btn(who, 'GALLERY', () => api.set({ mode: S.mode === 'gallery' ? 'ride' : 'gallery' }));
  btn(who, 'turntable', () => { controls.autoRotate = !controls.autoRotate; });
  const bikes = row(panel, 'bike');
  for (const b of BIKES) btn(bikes, b, () => api.set({ bike: b }));
  const move = row(panel, 'ride');
  for (const v of [0, 4, 8, 14, 20]) btn(move, `${v}m/s`, () => api.set({ speed: v }));
  btn(move, 'weave', () => api.set({ weave: !S.weave }));
  btn(move, 'boost', () => api.boost(2));
  const time = row(panel, 'time');
  for (const t of [1, 0.25, 0.1]) btn(time, `${t}x`, () => api.set({ scale: t }));
  const cues = row(panel, 'cue');
  for (const c of CUES) btn(cues, c, () => api.cue(c, { side: c === 'attack' || c === 'hit' ? (Math.random() < 0.5 ? -1 : 1) : undefined }));
  btn(cues, 'swing L', () => api.action('attack', -1, 0.32));
  btn(cues, 'swing R', () => api.action('attack', 1, 0.32));
  btn(cues, 'heavy', () => api.action('heavy', 1, 0.52));
  btn(cues, 'stun 2s', () => api.status('stun', 2));
  btn(cues, 'ghost', () => api.status('invisible', 1.5));
  btn(cues, 'CRASH', () => api.crash());
  const wpn = row(panel, 'weapon');
  for (const w of WEAPONS) btn(wpn, w, () => api.weapon(w));
  const stats = document.createElement('div');
  stats.id = 'stats';
  panel.appendChild(stats);
  setInterval(() => {
    const r = riders[0];
    stats.textContent = r ? `${S.mode} ${S.character} on ${S.bike}  v=${r.state.speed.toFixed(1)}  mode=${r.state.mode}` : '';
  }, 250);
}
