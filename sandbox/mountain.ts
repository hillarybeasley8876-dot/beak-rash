// Sunset Pass bench: a 2D plan of the mountain layout (no 3D world) for fast layout iteration.
//   /sandbox/mountain.html            top view coloured by height, zones, s labels, elevation strip
//   window.__mtn = { ready, stats }   stats: length, heights, grades, closest non-adjacent road parts
import { buildLayout, type BuiltLayout } from '../src/world/layout/build';
import { MOUNTAIN } from '../src/world/layouts/mountain';

const canvas = document.getElementById('c') as HTMLCanvasElement;
const hud = document.getElementById('hud') as HTMLDivElement;
const L = buildLayout(MOUNTAIN);

interface Stats {
  length: number; yMin: number; yMax: number; maxGrade: number;
  minGap: Array<{ s: number; s2: number; d: number; dy: number }>;
  /** Centre line every 100 m: world x/z/y and heading (deg, 0 = −Z, + = right). */
  frames: Array<[number, number, number, number, number]>;
}

/** Closest pairs of road samples more than `arc` metres apart along the road (horizontal distance). */
function gaps(B: BuiltLayout, arc = 150, step = 4): Stats['minGap'] {
  const out: Stats['minGap'] = [];
  for (let i = 0; i < B.n; i += step) {
    let best = Infinity, bj = -1;
    for (let j = 0; j < B.n; j += 2) {
      if (Math.abs(i - j) < arc) continue;
      const d = Math.hypot((B.px[i] ?? 0) - (B.px[j] ?? 0), (B.pz[i] ?? 0) - (B.pz[j] ?? 0));
      if (d < best) { best = d; bj = j; }
    }
    if (best < 150) out.push({ s: B.sMin + i, s2: B.sMin + bj, d: Math.round(best), dy: Math.round((B.py[bj] ?? 0) - (B.py[i] ?? 0)) });
  }
  // Keep local minima only (one entry per close approach).
  return out.filter((g, k) => (out[k - 1]?.d ?? Infinity) >= g.d && (out[k + 1]?.d ?? Infinity) > g.d);
}

function stats(B: BuiltLayout): Stats {
  let yMin = Infinity, yMax = -Infinity, maxGrade = 0;
  for (let i = 0; i < B.n; i++) {
    yMin = Math.min(yMin, B.py[i] ?? 0); yMax = Math.max(yMax, B.py[i] ?? 0);
    maxGrade = Math.max(maxGrade, Math.abs(B.slope[i] ?? 0));
  }
  const frames: Stats['frames'] = [];
  for (let s = 0; s <= B.length; s += 100) {
    const i = Math.round(s - B.sMin);
    const hd = (Math.atan2(B.tx[i] ?? 0, -(B.tz[i] ?? 0)) * 180) / Math.PI;
    frames.push([s, Math.round(B.px[i] ?? 0), Math.round(B.pz[i] ?? 0), Math.round(B.py[i] ?? 0), Math.round(hd)]);
  }
  return { length: B.length, yMin, yMax, maxGrade, minGap: gaps(B, 200), frames };
}

const ZONE_COL: Record<string, string> = {
  start: '#ff3b3b', village: '#ffb36b', pines: '#5fbf4a', hairpin: '#ff5fa2', leg: '#a3cf5a', cliff: '#b49474',
  cutting: '#8b6e56', tunnel: '#444', portal: '#8b6e56', bridge: '#4fb6ff', bridgeExit: '#b49474', summit: '#ffe600',
  crest: '#ffe600', descent: '#c99ad8', chicane: '#ff1e3c', lake: '#7cc0ff', lakeside: '#5fdbd6', finish: '#ff3b3b',
};

function draw(B: BuiltLayout): void {
  const W = (canvas.width = window.innerWidth), H = (canvas.height = window.innerHeight);
  const g = canvas.getContext('2d');
  if (!g) return;
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < B.n; i++) {
    x0 = Math.min(x0, B.px[i] ?? 0); x1 = Math.max(x1, B.px[i] ?? 0);
    z0 = Math.min(z0, B.pz[i] ?? 0); z1 = Math.max(z1, B.pz[i] ?? 0);
  }
  const mapH = H * 0.8, pad = 40;
  const k = Math.min((W - pad * 2) / (x1 - x0), (mapH - pad * 2) / (z1 - z0));
  const X = (x: number): number => pad + (x - x0) * k, Z = (z: number): number => pad + (z - z0) * k;
  g.fillStyle = '#15131c';
  g.fillRect(0, 0, W, H);
  // Grid every 100 m.
  g.strokeStyle = '#2a2633';
  for (let x = Math.ceil(x0 / 100) * 100; x < x1; x += 100) { g.beginPath(); g.moveTo(X(x), 0); g.lineTo(X(x), mapH); g.stroke(); }
  for (let z = Math.ceil(z0 / 100) * 100; z < z1; z += 100) { g.beginPath(); g.moveTo(0, Z(z)); g.lineTo(W, Z(z)); g.stroke(); }
  // Road band (true width) coloured by zone.
  g.lineCap = 'round';
  for (let i = 1; i < B.n; i++) {
    const s = B.sMin + i;
    const zone = B.zones.find((zn) => s >= zn.s0 && s < zn.s1)?.name ?? '';
    g.strokeStyle = s < 0 || s > B.length ? '#555' : ZONE_COL[zone] ?? '#fff';
    g.lineWidth = Math.max(2, B.halfWidth * 2 * k);
    g.beginPath(); g.moveTo(X(B.px[i - 1] ?? 0), Z(B.pz[i - 1] ?? 0)); g.lineTo(X(B.px[i] ?? 0), Z(B.pz[i] ?? 0)); g.stroke();
  }
  g.fillStyle = '#fff';
  g.font = '11px monospace';
  for (let s = 0; s <= B.length; s += 100) {
    const i = Math.round(s - B.sMin);
    g.fillText(`${s} (${Math.round(B.py[i] ?? 0)}m)`, X(B.px[i] ?? 0) + 6, Z(B.pz[i] ?? 0) - 4);
  }
  // Elevation strip.
  const top = mapH + 10, eh = H - top - 10;
  let yMax = 0;
  for (let i = 0; i < B.n; i++) yMax = Math.max(yMax, B.py[i] ?? 0);
  g.strokeStyle = '#ffb36b';
  g.lineWidth = 2;
  g.beginPath();
  for (let i = 0; i < B.n; i += 2) {
    const px = 10 + (i / B.n) * (W - 20), py = top + eh - ((B.py[i] ?? 0) / Math.max(1, yMax)) * eh;
    if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
  }
  g.stroke();
}

const st = stats(L);
draw(L);
hud.textContent = `Sunset Pass ${st.length.toFixed(0)} m  y ${st.yMin.toFixed(0)}..${st.yMax.toFixed(0)}  max grade ${(st.maxGrade * 100).toFixed(1)}%\n`
  + st.minGap.map((m) => `s=${m.s}~${m.s2} d=${m.d} dy=${m.dy}`).join('\n');
(window as unknown as { __mtn: unknown }).__mtn = { ready: true, stats: st };
