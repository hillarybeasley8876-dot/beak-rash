// Audio lab (sandbox/audio.html): every song, stinger, sfx and voice line on a button, adaptive
// intensity / muffle / bass-drop controls, a spatial pan + distance test and a live meter.
// Built on the same Engine / Conductor / SfxPlayer / VoicePlayer the game uses.
import { prepareDrumSamples } from '../music/instruments/drum-samples';
import { prepareSampleBanks } from '../music/instruments/banks';
import { AUDIO_RATE, Engine } from '../engine';
import { DEFAULT_VOLUMES } from '../check';
import { Conductor } from '../music/conductor';
import { SONGS } from '../music/songs';
import { STINGERS, type StingerId } from '../music/stingers';
import { SFX, SfxPlayer } from '../sfx/bank';
import { VoicePlayer } from '../voice/player';
import { VOICE } from '../../data/voice';
import { Meter } from './meter';
import { LAB_CSS } from './style';

interface Lab {
  ctx: AudioContext;
  engine: Engine;
  conductor: Conductor;
  sfx: SfxPlayer;
  voices: VoicePlayer;
  meter: Meter;
}

const SFX_GROUPS: Array<[string, RegExp]> = [
  ['UI', /^ui\./], ['Bike', /^bike\./], ['Combat', /^(swing|hit|ko|weapon|pickup)\./], ['Skills', /^skill\./],
  ['Animals', /^animal\./], ['World', /^(traffic|police|obstacle|cine)\./],
];

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  e.textContent = text;
  return e;
}

function section(root: HTMLElement, title: string): HTMLElement {
  const box = el('section', 'box');
  box.append(el('h2', '', title));
  const body = el('div', 'btns');
  box.append(body);
  root.append(box);
  return body;
}

export function mountLab(root: HTMLElement): void {
  const style = document.createElement('style');
  style.textContent = LAB_CSS;
  document.head.append(style);
  const head = el('header', 'head');
  head.append(el('h1', '', '暴力鹈鹕 AUDIO LAB'), el('p', 'sub', 'procedural music · synthesized sfx · TTS voices'));
  const unlock = el('button', 'big', '▶ UNLOCK AUDIO 解锁');
  const status = el('div', 'status', 'audio locked — nothing plays before a click');
  head.append(unlock, status);
  const canvas = el('canvas', 'meter');
  canvas.width = 900;
  canvas.height = 160;
  const now = el('div', 'now', '');
  root.append(head, canvas, now);
  let lab: Lab | null = null;
  const spatial = { pan: 0, dist: 7 };

  unlock.onclick = (): void => {
    if (lab) return;
    const ctx = new AudioContext({ latencyHint: 'interactive', sampleRate: AUDIO_RATE });
    const engine = new Engine(ctx, DEFAULT_VOLUMES);
    prepareDrumSamples(ctx);
    void prepareSampleBanks(ctx.sampleRate);
    const l: Lab = {
      ctx, engine, conductor: new Conductor(engine), sfx: new SfxPlayer(engine),
      voices: new VoicePlayer(engine, new URL('/', window.location.href)), meter: new Meter(ctx, engine.output, canvas),
    };
    lab = l;
    l.voices.prefetch();
    setInterval(() => {
      l.conductor.schedule(ctx.currentTime + 0.18);
      l.voices.update();
    }, 25);
    const tick = (): void => {
      const m = l.meter.draw();
      status.textContent = `running ${ctx.sampleRate} Hz · song ${l.conductor.playing ?? '—'} · intensity ${l.conductor.level} · ` +
        `muffle ${l.engine.muffled.toFixed(2)} · peak ${m.peak.toFixed(1)} dBFS`;
      requestAnimationFrame(tick);
    };
    tick();
    unlock.textContent = 'AUDIO ON 已解锁';
  };

  const music = section(root, 'MUSIC 音乐');
  for (const [id, song] of Object.entries(SONGS)) {
    const b = el('button', 'song', `${id}\n${song.bpm} bpm · ${song.key}`);
    b.onclick = () => {
      lab?.conductor.play(id, 0.6);
      now.textContent = `${song.title} — ${song.notes}`;
    };
    music.append(b);
  }
  const stop = el('button', 'alt', '■ stop');
  stop.onclick = () => lab?.conductor.play(null, 0.8);
  music.append(stop);
  [0, 1, 2].forEach((lvl) => {
    const b = el('button', 'alt', ['intensity 0 · cruise', 'intensity 1 · top 3', 'intensity 2 · final stretch'][lvl] ?? '');
    b.onclick = () => lab?.conductor.setIntensity(lvl);
    music.append(b);
  });
  mountControls(root, () => lab, spatial, now);
}

function slider(label: string, min: number, max: number, step: number, value: number, on: (v: number) => void): HTMLElement {
  const wrap = el('label', 'slider', label);
  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);
  input.oninput = () => on(Number(input.value));
  wrap.append(input);
  return wrap;
}

function mountControls(root: HTMLElement, lab: () => Lab | null, spatial: { pan: number; dist: number }, now: HTMLElement): void {
  const fx = section(root, 'MIX 混音 · slow-mo muffle / KO bass drop');
  fx.append(
    slider('muffle', 0, 1, 0.01, 0, (v) => lab()?.engine.setMuffle(v)),
    slider('bass drop', 0, 1, 0.01, 0, (v) => lab()?.conductor.dropBass(v)),
    slider('tunnel reverb', 0, 1, 0.01, 0, (v) => lab()?.engine.setSfxSpace(v)),
  );
  const st = section(root, 'STINGERS 插曲');
  for (const id of Object.keys(STINGERS) as StingerId[]) {
    const b = el('button', 'sting', id);
    b.onclick = () => lab()?.conductor.stinger(id);
    st.append(b);
  }
  const sp = section(root, 'SPATIAL 空间 · applies to every sfx button');
  sp.append(
    slider('pan', -1, 1, 0.05, 0, (v) => { spatial.pan = v; }),
    slider('distance m', 1, 140, 1, 7, (v) => { spatial.dist = v; }),
  );
  const sweep = el('button', 'alt', '⇄ pass-by sweep');
  sweep.onclick = () => {
    const l = lab();
    if (!l) return;
    [-0.9, -0.45, 0, 0.45, 0.9].forEach((pan, i) => setTimeout(() => l.sfx.play('bike.passby', { pan }), i * 220));
  };
  sp.append(sweep);
  for (const [title, re] of SFX_GROUPS) {
    const box = section(root, `SFX · ${title}`);
    for (const id of Object.keys(SFX).filter((k) => re.test(k))) {
      const b = el('button', 'sfx', id.replace(/^[a-z]+\./, ''));
      b.title = id;
      b.onclick = () => {
        const gain = 7 / Math.max(7, spatial.dist);
        lab()?.sfx.play(id, { volume: gain, pan: spatial.pan, lowpass: spatial.dist < 25 ? 20000 : 14000 - 11500 * Math.min(1, (spatial.dist - 25) / 110) });
        now.textContent = `sfx ${id}`;
      };
      box.append(b);
    }
  }
  const lines = Object.values(VOICE);
  const speakers = Array.from(new Set(lines.map((l) => l.speaker)));
  const vbox = section(root, `VOICES 配音 · ${lines.length} lines`);
  for (const sp2 of speakers) {
    for (const line of lines.filter((l) => l.speaker === sp2)) {
      const b = el('button', sp2 === 'announcer' ? 'ann' : 'bark', `${sp2 === 'announcer' ? '播报' : sp2} ${line.text}`);
      b.onclick = () => {
        lab()?.voices.play(line.id, { channel: sp2 === 'announcer' ? 'announcer' : 'bark', pan: spatial.pan });
        now.textContent = `voice ${line.id}: ${line.text}`;
      };
      vbox.append(b);
    }
  }
}
