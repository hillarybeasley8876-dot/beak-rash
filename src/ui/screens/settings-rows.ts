// Settings rows: data model + row widgets (meter / choice / action) bound to app.save.settings.
import type { AppContext } from '../../core/contracts';
import type { Settings } from '../../core/save';
import { choice, h, meter } from '../p5';

type MeterKey = 'master' | 'music' | 'sfx' | 'voice' | 'shake';

export type RowDef =
  | { kind: 'meter'; key: MeterKey; cn: string; en: string; desc: string }
  | { kind: 'choice'; key: 'quality' | 'autoPedal' | 'slowmo'; cn: string; en: string; desc: string; options: Array<[string, Settings[keyof Settings]]> }
  | { kind: 'action'; id: 'reset'; cn: string; en: string; desc: string };

export const ROWS: RowDef[] = [
  { kind: 'meter', key: 'master', cn: '主音量', en: 'MASTER', desc: '所有声音的总闸。鹈鹕建议：开大点。' },
  { kind: 'meter', key: 'music', cn: '音乐', en: 'MUSIC', desc: '放克贝斯配电钢琴，原创，放心摇头。' },
  { kind: 'meter', key: 'sfx', cn: '音效', en: 'SFX', desc: '咸鱼拍脸的声音，值得高保真。' },
  { kind: 'meter', key: 'voice', cn: '语音', en: 'VOICE', desc: '解说员和各位选手嘴炮的音量。' },
  { kind: 'choice', key: 'quality', cn: '画质', en: 'QUALITY', desc: '低：老电脑救星。高：鹈鹕毛根根分明。重启游戏后生效。', options: [['低', 'low'], ['中', 'medium'], ['高', 'high']] },
  { kind: 'meter', key: 'shake', cn: '镜头震动', en: 'SHAKE', desc: '被扇的时候，屏幕要不要跟着一起抖。' },
  { kind: 'choice', key: 'autoPedal', cn: '自动踩踏', en: 'AUTO-PEDAL', desc: '不用一直按 W，专心打架就好。按 S 照样刹车。', options: [['关', false], ['开', true]] },
  { kind: 'choice', key: 'slowmo', cn: '慢镜头', en: 'SLOW-MO', desc: '击倒时的升格慢镜头。完整版最燃，关掉最快。', options: [['完整', 'full'], ['简短', 'short'], ['关闭', 'off']] },
  { kind: 'action', id: 'reset', cn: '重置存档', en: 'RESET SAVE', desc: '小鱼干、车库、巡回赛进度全部清零。慎点。' },
];

export interface RowWidget {
  el: HTMLDivElement;
  /** Re-read the value from the save and redraw. */
  sync(): void;
  /** Step the value (−1 / +1); returns true when something changed. */
  step(dir: -1 | 1): boolean;
}

/** Push the settings that act immediately (volumes, auto-pedal). Quality waits for a restart. */
export function applySettings(app: AppContext): void {
  const s = app.save.data.settings;
  app.audio.setVolumes({ master: s.master, music: s.music, sfx: s.sfx, voice: s.voice });
  app.input.autoPedal = s.autoPedal;
}

export function rowWidget(app: AppContext, def: RowDef, onPick: (dir: -1 | 1) => void): RowWidget {
  const el = h('div', { class: `br-set-row is-${def.kind}` },
    h('div', { class: 'br-set-label' }, h('b', { text: def.cn }), h('span', { text: def.en })));
  const arrow = (dir: -1 | 1): HTMLElement => {
    const a = h('i', { class: `br-set-arrow is-${dir < 0 ? 'l' : 'r'}`, text: dir < 0 ? '◀' : '▶' });
    a.addEventListener('click', (e) => {
      e.stopPropagation();
      onPick(dir);
    });
    return a;
  };
  if (def.kind === 'meter') {
    const m = meter(10);
    el.append(h('div', { class: 'br-set-ctl' }, arrow(-1), m.el, arrow(1)));
    const get = (): number => app.save.data.settings[def.key];
    return {
      el,
      sync: () => m.set(get()),
      step: (dir) => {
        const v = Math.round(Math.min(1, Math.max(0, get() + dir * 0.1)) * 10) / 10;
        if (v === get()) return false;
        app.save.update((d) => (d.settings[def.key] = v));
        return true;
      },
    };
  }
  if (def.kind === 'choice') {
    const c = choice(def.options.map(([label]) => label));
    el.append(h('div', { class: 'br-set-ctl' }, arrow(-1), c.el, arrow(1)));
    const index = (): number => Math.max(0, def.options.findIndex(([, v]) => v === app.save.data.settings[def.key]));
    return {
      el,
      sync: () => c.set(index()),
      step: (dir) => {
        const n = def.options.length;
        const next = def.options[(index() + dir + n) % n];
        if (!next) return false;
        app.save.update((d) => Object.assign(d.settings, { [def.key]: next[1] }));
        return true;
      },
    };
  }
  el.append(h('div', { class: 'br-set-ctl' }, h('span', { class: 'br-set-danger', text: '按确定清空' })));
  return { el, sync: () => undefined, step: () => false };
}
