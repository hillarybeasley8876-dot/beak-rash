// DOM control panel for the bikes sandbox (P5-ish skewed card): bike / view / quality / tint selectors,
// speed + steer sliders, markers and auto-spin toggles, live stats.
import type { BikeId, Quality } from '../src/core/types';
import { BIKE_ORDER, BIKES } from '../src/data/bikes';

/** The Konami unlock (大模型限定款) is not in the shop list, but the sandbox can show it. */
const ALL_BIKES: BikeId[] = [...BIKE_ORDER, 'llm'];

export const VIEWS = ['turntable', 'close', 'side', 'front', 'back', 'top', 'lineup', 'chase', 'grid'] as const;
export type View = (typeof VIEWS)[number];

export interface SandboxState {
  bike: BikeId;
  view: View;
  quality: Quality;
  tint: string;
  speed: number;
  steer: number;
  markers: boolean;
  spin: boolean;
  angle: number;
  /** Optional orbit target [x, y, z] and distance for close-ups (API/URL only). */
  focus: number[] | null;
  dist: number;
}

const TINTS: Array<[string, string]> = [
  ['', 'default'], ['#222222', 'goose'], ['#ffb000', 'capybara'], ['#d9534f', 'cat'], ['#2b2b2b', 'shiba'],
  ['#3fbf8f', 'pigeon'], ['#ffcc00', 'penguin'], ['#ffd23f', 'seagull'], ['#3a2e22', 'sloth'], ['#1f4fd1', 'corgi'],
];

export interface Panel { refresh(stats: Record<string, unknown>): void; sync(): void }

export function mountPanel(el: HTMLElement, s: SandboxState, onChange: (rebuild: boolean) => void, onLaunch: () => void): Panel {
  const opt = (v: string, label: string): string => `<option value="${v}">${label}</option>`;
  el.innerHTML = `
    <h1>BIKES 车库</h1>
    <label>bike <select data-k="bike">${ALL_BIKES.map((id) => opt(id, `${id} · ${BIKES[id].name}`)).join('')}</select></label>
    <label>view <select data-k="view">${VIEWS.map((v) => opt(v, v)).join('')}</select></label>
    <label>quality <select data-k="quality">${['high', 'medium', 'low'].map((q) => opt(q, q)).join('')}</select></label>
    <label>tint <select data-k="tint">${TINTS.map(([c, n]) => opt(c, n)).join('')}</select></label>
    <label>speed <input data-k="speed" type="range" min="0" max="25" step="0.5"></label>
    <label>steer <input data-k="steer" type="range" min="-0.6" max="0.6" step="0.02"></label>
    <label>markers <input data-k="markers" type="checkbox"></label>
    <label>auto-spin <input data-k="spin" type="checkbox"></label>
    <div><button data-act="prev">◀</button> <button data-act="next">▶</button> <button data-launch>LAUNCH 0→v</button></div>
    <div id="stats"></div>`;
  const inputs = [...el.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-k]')];
  const statsEl = el.querySelector('#stats') as HTMLElement;
  const sync = (): void => {
    for (const inp of inputs) {
      const k = inp.dataset.k as keyof SandboxState;
      if (inp instanceof HTMLInputElement && inp.type === 'checkbox') inp.checked = Boolean(s[k]);
      else inp.value = String(s[k]);
    }
  };
  for (const inp of inputs) {
    inp.addEventListener('input', () => {
      const k = inp.dataset.k as keyof SandboxState;
      const before = s[k];
      if (inp instanceof HTMLInputElement && inp.type === 'checkbox') Object.assign(s, { [k]: inp.checked });
      else if (inp instanceof HTMLInputElement) Object.assign(s, { [k]: Number(inp.value) });
      else Object.assign(s, { [k]: inp.value });
      onChange(['bike', 'view', 'quality', 'tint'].includes(k) && before !== s[k]);
    });
  }
  el.querySelector('[data-launch]')?.addEventListener('click', onLaunch);
  for (const btn of el.querySelectorAll<HTMLButtonElement>('[data-act]')) {
    btn.addEventListener('click', () => {
      const i = ALL_BIKES.indexOf(s.bike), n = ALL_BIKES.length;
      s.bike = ALL_BIKES[(i + (btn.dataset.act === 'next' ? 1 : n - 1)) % n] as BikeId;
      sync();
      onChange(true);
    });
  }
  sync();
  let lastText = '';
  return {
    sync,
    refresh(stats) {
      const text = Object.entries(stats).map(([k, v]) => `${k.padEnd(15)} ${Array.isArray(v) ? v.join(', ') : String(v)}`).join('\n');
      if (text !== lastText) statsEl.textContent = lastText = text;
    },
  };
}
