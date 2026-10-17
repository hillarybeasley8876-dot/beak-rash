// Feel bench panel: live tuning sliders (sim TUNING + chase CHASE), feature jumps, slow-mo, fixed-fps
// stepping and a readout. Sliders blur after use so the arrow keys keep steering the bike.
import { TUNING } from '../src/sim/tuning';
import { CHASE } from '../src/camera/chase';
import type { Game } from '../src/core/game';
import type { DebugApi } from '../src/core/debug';
import type { DebugRow } from '../src/sim/debug';

const DEG = Math.PI / 180;

interface Slider { label: string; min: number; max: number; step: number; get: () => number; set: (v: number) => void }

const SLIDERS: Slider[] = [
  { label: 'grip τ s', min: 0.03, max: 0.2, step: 0.005, get: () => TUNING.gripTau, set: (v) => { TUNING.gripTau = v; } },
  { label: 'curve push', min: 0, max: 2, step: 0.05, get: () => TUNING.curvePush, set: (v) => { TUNING.curvePush = v; } },
  { label: 'steer auth', min: 4, max: 11, step: 0.1, get: () => TUNING.steerAuthHigh, set: (v) => { TUNING.steerAuthHigh = v; } },
  { label: 'lean carve', min: 0, max: 0.08, step: 0.005, get: () => TUNING.leanCarve, set: (v) => { TUNING.leanCarve = v; } },
  { label: 'lean λ', min: 4, max: 24, step: 1, get: () => TUNING.leanLambda, set: (v) => { TUNING.leanLambda = v; } },
  { label: 'drift in m/s', min: 1, max: 6, step: 0.1, get: () => TUNING.driftLatIn, set: (v) => { TUNING.driftLatIn = v; } },
  { label: 'drift slip°', min: 10, max: 40, step: 1, get: () => TUNING.driftSlip / DEG, set: (v) => { TUNING.driftSlip = v * DEG; } },
  { label: 'air g', min: 9.8, max: 30, step: 0.5, get: () => TUNING.airGravity, set: (v) => { TUNING.airGravity = v; } },
  { label: 'cam dist', min: 3.5, max: 8, step: 0.1, get: () => CHASE.dist[1] ?? 5.6, set: (v) => { CHASE.dist[1] = v; } },
  { label: 'cam height', min: 1.2, max: 4, step: 0.05, get: () => CHASE.height[1] ?? 2.2, set: (v) => { CHASE.height[1] = v; } },
  { label: 'fov @top', min: 55, max: 90, step: 1, get: () => CHASE.fov[1] ?? 74, set: (v) => { CHASE.fov[1] = v; } },
  { label: 'cam ωx', min: 4, max: 20, step: 0.5, get: () => CHASE.omegaX, set: (v) => { CHASE.omegaX = v; } },
];

const FPS_MODES = [0, 30, 60, 144];

export function mountFeelPanel(root: HTMLElement, game: Game, debug: DebugApi, onRow: (row: DebugRow) => void): void {
  const defaults = { tuning: { ...TUNING }, chase: JSON.parse(JSON.stringify(CHASE)) as typeof CHASE };
  root.innerHTML = '<h1>FEEL BENCH · sim</h1>';
  const sliders = SLIDERS.map((sl) => addSlider(root, sl));
  const sec = (text: string): void => { root.insertAdjacentHTML('beforeend', `<div class="sec">${text}</div>`); };
  sec('time');
  let fpsIdx = 0;
  let slow = false;
  const fpsBtn = button(root, 'fps: real', () => {
    fpsIdx = (fpsIdx + 1) % FPS_MODES.length;
    fpsBtn.textContent = `fps: ${FPS_MODES[fpsIdx] || 'real'}`;
    debug.manual((FPS_MODES[fpsIdx] ?? 0) > 0);
  });
  const slowBtn = button(root, 'slow-mo 0.1×', () => {
    slow = !slow;
    game.app.clock.setScale('bench', slow ? 0.1 : 1, 0.15);
    slowBtn.classList.toggle('on', slow);
  });
  sec('events');
  button(root, 'crash me', () => { const s = game.session; if (s) s.physics.crash(s.player, 'wall', null); });
  button(root, 'KO nearest', () => {
    const s = game.session;
    if (!s) return;
    const near = s.riders.filter((r) => !r.isPlayer && r.mode === 'racing').sort((a, b) => Math.abs(a.s - s.player.s) - Math.abs(b.s - s.player.s))[0];
    if (near) debug.ko(near.id, s.player.id);
  });
  button(root, 'reset tuning', () => {
    Object.assign(TUNING, defaults.tuning);
    Object.assign(CHASE, JSON.parse(JSON.stringify(defaults.chase)) as typeof CHASE);
    sliders.forEach((fn) => fn());
  });
  sec('jump to feature (−60 m)');
  const feats = game.session?.track.features.filter((f) => ['ramp', 'jumpCrest', 'oil', 'puddle', 'boostPad'].includes(f.kind)) ?? [];
  for (const f of feats.slice(0, 14)) {
    button(root, `${f.kind}@${Math.round(f.s0)}`, () => {
      const s = game.session;
      if (!s) return;
      Object.assign(s.player, { s: f.s0 - 60, x: (f.x0 + f.x1) / 2, speed: 18, vx: 0, y: 0, vy: 0, airborne: false });
    });
  }
  const pre = document.createElement('pre');
  root.append(pre);
  let acc = 0;
  let last = performance.now();
  const tick = (now: number): void => {
    const dtReal = Math.min(0.1, (now - last) / 1000);
    last = now;
    const fps = FPS_MODES[fpsIdx] ?? 0;
    if (fps > 0) {
      acc += dtReal;
      for (let i = 0; acc >= 1 / fps && i < 8; i++, acc -= 1 / fps) debug.step(1, 1 / fps);
    }
    const s = game.session;
    const sim = (debug as DebugApi & { sim?: { riders: () => DebugRow[]; cam: DebugRow } }).sim;
    const row = s && sim ? sim.riders()[s.player.id] : undefined;
    if (s && sim && row) {
      onRow(row);
      const cam = sim.cam;
      pre.textContent = [
        `v ${(Number(row.v) * 3.6).toFixed(1)} km/h  top ${(Number(row.top) * 3.6).toFixed(0)}  ${row.surface}`,
        `drift ${row.drifting ? `L${row.driftLevel} ${Number(row.charge).toFixed(2)}s` : '-'}  boost ${Number(row.boost).toFixed(2)}×${row.boostPower}`,
        `draft ${row.draft}  air ${row.air ? `${row.airKind} y=${row.y}` : '-'}  mode ${row.mode}`,
        `cam ${cam.mode} fov ${cam.fov} trauma ${cam.trauma} kick ${cam.kick}`,
      ].join('\n');
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function addSlider(root: HTMLElement, sl: Slider): () => void {
  const label = document.createElement('label');
  const input = document.createElement('input');
  const out = document.createElement('span');
  Object.assign(input, { type: 'range', min: String(sl.min), max: String(sl.max), step: String(sl.step) });
  const sync = (): void => { input.value = String(sl.get()); out.textContent = sl.get().toFixed(3).replace(/\.?0+$/, ''); };
  input.addEventListener('input', () => { sl.set(Number(input.value)); sync(); });
  input.addEventListener('change', () => input.blur());
  label.append(sl.label, input, out);
  root.append(label);
  sync();
  return sync;
}

function button(root: HTMLElement, text: string, fn: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = text;
  b.addEventListener('click', () => { fn(); b.blur(); });
  root.append(b);
  return b;
}
