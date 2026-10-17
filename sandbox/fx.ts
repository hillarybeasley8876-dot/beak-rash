// fx sandbox: particle gallery, post toggles/sliders and the real KO cinematic replay, without a race.
//   /sandbox/fx.html?gallery=1&night=1&preset=hit&panel=0&manual=1&replay=ko
//   window.fxSandbox = { fire, gallery, closeup, replay, replayInfo, step, manual, night, post, toggles }
import { Vector3 } from 'three';
import { atlasCanvas } from '../src/fx/particles/atlas';
import { Particles } from '../src/fx/particles/system';
import { PostPipeline } from '../src/fx/post/pipeline';
import { PRESET_NAMES, PRESETS } from '../src/fx/presets';
import { createKit, type BurstOpts } from '../src/fx/presets/kit';
import { PostState } from '../src/fx/state';
import { REPLAY_KINDS, Replay, type ReplayKind } from './fx.replay';
import { createStage } from './fx.stage';

const params = new URLSearchParams(location.search);
const canvas = document.getElementById('c') as HTMLCanvasElement;
const panel = document.getElementById('panel') as HTMLDivElement;
const stage = createStage(canvas);
const post = new PostState();
const pipeline = new PostPipeline(stage.renderer, 'high');
const particles = new Particles('high');
stage.scene.add(particles.group);
const kit = createKit(particles, 7);
const replay = new Replay(stage.camera, stage.riders, post, (name, pos, opts) => PRESETS[name]?.(kit, pos, opts ?? {}));
let replayLog: HTMLPreElement | null = null;
let night = params.get('night') === '1';
let manual = params.get('manual') === '1';
let realTime = 0;
let galleryTimer = -1;
const sliders: Record<string, number> = {};

stage.setNight(night);
post.grade.bloom = night ? 0.9 : 0.25;
post.grade.threshold = night ? 0.7 : 1;

/** Presets that happen at road level (wheel contact) rather than body height. */
const AT_GROUND = new Set(['dust', 'grass', 'sand', 'dirt', 'landing', 'splash', 'oil', 'hopDust', 'shockwave']);

function fire(name: string, x = 0, z = -4, opts: BurstOpts = {}): void {
  const preset = PRESETS[name];
  if (!preset) {
    console.warn(`[fx-sandbox] unknown preset ${name}`);
    return;
  }
  const y = AT_GROUND.has(name) ? 0.1 : 1.2;
  preset(kit, new Vector3(x, y, z), { ground: 0, level: 2, dir: { x: 0, y: 0.4, z: 1 }, ...opts });
}

/** Fire every preset on a grid laid out on the road, seen from a high 3/4 view. */
function gallery(): void {
  const cols = 7;
  stage.camera.position.set(0, 7.5, 9);
  stage.camera.lookAt(0, 0.4, -6);
  PRESET_NAMES.forEach((name, i) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    fire(name, (c - (cols - 1) / 2) * 2.7, -r * 3.2);
  });
}

/** Close-up: fire a few presets side by side 5 m in front of a low camera. */
function closeup(names: string[], spacing = 1.9): void {
  stage.camera.position.set(0, 1.55, 5);
  stage.camera.lookAt(0, 1.2, 0);
  names.forEach((name, i) => fire(name, (i - (names.length - 1) / 2) * spacing, 0));
}

function resize(): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  stage.renderer.setSize(w, h, false);
  stage.camera.aspect = w / h;
  stage.camera.updateProjectionMatrix();
  pipeline.setSize(w, h, stage.renderer.getPixelRatio());
}

function applySliders(): void {
  const c = post.cine;
  c.ko = sliders.ko ?? 0; c.halftone = sliders.halftone ?? 0; c.zoom = sliders.zoom ?? 0; c.lines = sliders.koLines ?? 0;
  c.letterbox = sliders.letterbox ?? 0; c.red = sliders.red ?? 0; c.grain = sliders.grain ?? 0; c.vignette = sliders.vignette ?? 0;
  post.speed.edgeBlur = sliders.edgeBlur ?? 0; post.speed.chroma = sliders.chroma ?? 0; post.speed.lines = sliders.lines ?? 0;
}

function step(dt: number): void {
  realTime += dt;
  post.tick(dt);
  const dtSim = replay.update(dt);
  if (!replay.active) applySliders();
  particles.update(dtSim, dt);
  if (replayLog && replayLog.textContent !== replay.log.join('\n')) replayLog.textContent = replay.log.join('\n');
  if (galleryTimer >= 0) {
    galleryTimer -= dt;
    if (galleryTimer < 0) {
      gallery();
      galleryTimer = 1.6;
    }
  }
  pipeline.render(stage.scene, stage.camera, post, realTime);
}

let last = performance.now();
function loop(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!manual) step(dt);
  else pipeline.render(stage.scene, stage.camera, post, realTime);
  requestAnimationFrame(loop);
}

// ---------------------------------------------------------------- panel
function section(title: string): HTMLDivElement {
  const h = document.createElement('h3');
  h.textContent = title;
  const box = document.createElement('div');
  panel.append(h, box);
  return box;
}

function button(box: HTMLElement, label: string, fn: () => void): void {
  const b = document.createElement('button');
  b.textContent = label;
  b.onclick = fn;
  box.append(b);
}

function slider(box: HTMLElement, key: string, max: number, initial = 0): void {
  sliders[key] = Number(params.get(key) ?? initial);
  const l = document.createElement('label');
  const input = document.createElement('input');
  input.type = 'range';
  input.min = '0';
  input.max = String(max);
  input.step = String(max / 100);
  input.value = String(sliders[key]);
  input.oninput = () => { sliders[key] = Number(input.value); };
  l.append(key, input);
  box.append(l);
}

function buildPanel(): void {
  const presets = section('PRESETS');
  for (const name of PRESET_NAMES) button(presets, name, () => fire(name));
  const modes = section('MODES');
  button(modes, 'gallery once', gallery);
  button(modes, 'gallery loop', () => { galleryTimer = galleryTimer >= 0 ? -1 : 0; });
  button(modes, 'day/night', () => {
    night = !night;
    stage.setNight(night);
    post.grade.bloom = night ? 0.9 : 0.25;
    post.grade.threshold = night ? 0.7 : 1;
  });
  button(modes, 'post on/off', () => { pipeline.toggles.enabled = !pipeline.toggles.enabled; });
  button(modes, 'bloom', () => { pipeline.toggles.bloom = !pipeline.toggles.bloom; });
  button(modes, 'blur', () => { pipeline.toggles.blur = !pipeline.toggles.blur; });
  button(modes, 'atlas', () => {
    const el = document.getElementById('atlas') as HTMLCanvasElement;
    el.style.display = el.style.display === 'block' ? 'none' : 'block';
  });
  const pulses = section('PULSES');
  button(pulses, 'hurt', () => post.hurt(0.8));
  button(pulses, 'flash', () => post.flash(0.9, '#ffffff'));
  button(pulses, 'impact', () => post.impact(0.034));
  button(pulses, 'chroma', () => post.punch(0.012));
  const cineReplay = section('KO REPLAY (real KoCine)');
  for (const kind of REPLAY_KINDS) button(cineReplay, kind, () => replay.play(kind));
  replayLog = document.createElement('pre');
  replayLog.style.cssText = 'margin:4px 0;font:10px/1.3 monospace;color:#ffe600;white-space:pre-wrap';
  cineReplay.append(replayLog);
  const cine = section('KO LOOK');
  for (const [k, max] of [['ko', 1], ['halftone', 1], ['zoom', 0.3], ['koLines', 1], ['letterbox', 1], ['red', 1], ['grain', 1], ['vignette', 1]] as const) slider(cine, k, max);
  const speed = section('SPEED');
  for (const [k, max] of [['edgeBlur', 0.15], ['chroma', 0.02], ['lines', 1]] as const) slider(speed, k, max);
}

function drawAtlas(): void {
  const src = atlasCanvas();
  const el = document.getElementById('atlas') as HTMLCanvasElement;
  if (!src) return;
  el.width = src.width;
  el.height = src.height;
  el.getContext('2d')?.drawImage(src, 0, 0);
  el.style.width = el.style.height = '256px';
  if (params.get('atlas') === '1') el.style.display = 'block';
}

buildPanel();
drawAtlas();
if (params.get('panel') === '0') panel.classList.add('hidden');
window.addEventListener('resize', resize);
resize();
const firstPreset = params.get('preset');
if (firstPreset) fire(firstPreset);
if (params.get('gallery') === '1') galleryTimer = 0;
const firstReplay = params.get('replay');
if (firstReplay && (REPLAY_KINDS as string[]).includes(firstReplay)) replay.play(firstReplay as ReplayKind);
requestAnimationFrame(loop);

declare global {
  interface Window { fxSandbox?: unknown }
}
window.fxSandbox = {
  fire, gallery, closeup, post, toggles: pipeline.toggles, particles,
  replay: (kind: ReplayKind) => replay.play(kind),
  replayInfo: () => ({ ...replay.info(), log: replay.log.slice(), cine: { ...post.cine, focus: post.cine.focus.toArray() } }),
  step: (frames: number, dt = 1 / 60) => { for (let i = 0; i < frames; i++) step(dt); },
  manual: (on: boolean) => { manual = on; },
  night: (on: boolean) => { night = on; stage.setNight(on); post.grade.bloom = on ? 0.9 : 0.25; post.grade.threshold = on ? 0.7 : 1; },
  ready: true,
};
