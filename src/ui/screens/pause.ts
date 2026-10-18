// pause: overlay on the frozen race. 继续 / 重新开始 / 设置 / 退出比赛, live standings, controls sheet.
// Esc / Start / B resume. Restart and quit ask first.
import './pause.css';
import type { Session } from '../../core/contracts';
import { TRACKS } from '../../data/tracks';
import { Nav } from '../nav';
import { HINT_BACK, HINT_NAV, HINT_OK, button, h, headSvg, jagged, ransom, svg } from '../p5';
import { ordinal } from '../progress';
import { frame, type ScreenCtx, type ScreenFactory } from '../screen';
import { fmtTime } from './results-parts';

const CONTROLS: Array<[string, string]> = [
  ['W / ↑', '踩踏'], ['S / ↓', '刹车'], ['A D / ← →', '转向'], ['SHIFT', '漂移'],
  ['SPACE', '跳跃'], ['J / L', '左挥 / 右挥'], ['K', '重击'], ['U I O', '技能'],
  ['P', 'SHOWTIME'], ['B', '打铃嘲讽'], ['C', '回头看'], ['ESC', '暂停'],
];

function standings(session: Session | null): HTMLDivElement {
  const box = h('div', { class: 'br-pz-stand br-panel is-black', vars: { '--clip': jagged('stand', { jx: 2, jy: 3, notches: 2 }) } },
    h('div', { class: 'br-pz-stand-title' }, h('b', { text: 'STANDINGS' }), h('span', { text: '当前名次' })));
  if (!session) {
    box.append(h('div', { class: 'br-pz-empty', text: '还没开赛呢。' }));
    return box;
  }
  const me = session.player;
  const sorted = [...session.riders].sort((a, b) => a.place - b.place);
  for (const r of sorted) {
    const gap = Math.round(r.s - me.s);
    box.append(h('div', { class: `br-pz-row${r.isPlayer ? ' is-player' : ''}` },
      h('span', { class: 'c-place', text: ordinal(r.place) }),
      svg(headSvg(r.character), 'br-pz-head'),
      h('b', { text: r.name }),
      h('span', { class: 'c-gap', text: r.isPlayer ? 'YOU' : `${gap > 0 ? '+' : ''}${gap} m` })));
  }
  return box;
}

function controlsSheet(): HTMLDivElement {
  const el = h('div', { class: 'br-pz-keys' });
  for (const [k, label] of CONTROLS) el.append(h('div', { class: 'br-pz-key' }, h('kbd', { text: k }), h('span', { text: label })));
  return el;
}

function resume(ctx: ScreenCtx): void {
  if (!ctx.session()) {
    ctx.go('menu');
    return;
  }
  ctx.app.input.consumeEdges(); // menu presses (Space/J/K…) must not fire as race actions on resume
  ctx.app.bus.emit('flow:pause', { paused: false });
}

async function leaveRace(ctx: ScreenCtx, kind: 'restart' | 'quit'): Promise<void> {
  const ok = await ctx.confirm(kind === 'restart' ? '重新开始？' : '退出比赛？', kind === 'restart' ? '这一局的进度会清零。' : '本局不计成绩，小鱼干也不发。', kind === 'restart' ? '重来' : '退出', '再想想');
  if (!ok) return;
  ctx.app.bus.emit(kind === 'restart' ? 'flow:restartRace' : 'flow:quitRace', {});
}

export const pauseScreen: ScreenFactory = (ctx) => {
  const session = ctx.session();
  const f = frame({ id: 'pause', bg: h('div', { class: 'br-pz-veil' }, h('div', { class: 'br-pz-slab' }), h('div', { class: 'br-halftone', vars: { '--dot': 'rgba(0,0,0,.35)' } })), hints: [HINT_NAV, HINT_OK, HINT_BACK] });
  const track = session ? TRACKS[session.config.trackId] : null;
  const list = h('div', { class: 'br-pz-list' });
  const entries = [
    { label: '继续', sub: 'RESUME', run: () => resume(ctx) },
    { label: '重新开始', sub: 'RESTART', run: () => void leaveRace(ctx, 'restart') },
    { label: '设置', sub: 'CONFIG', run: () => ctx.go('settings') },
    { label: '退出比赛', sub: 'QUIT', run: () => void leaveRace(ctx, 'quit') },
  ];
  const items = entries.map((e, i) => {
    const el = button(e.label, { sub: e.sub, seed: `pz${i}`, className: 'is-inv' });
    el.style.setProperty('--i', String(i));
    list.append(el);
    return { el, confirm: e.run };
  });
  f.stage.append(
    h('div', { class: 'br-pz-title' }, h('span', { class: 'br-pz-word', text: 'PAUSE' }), ransom('暂停一下', { seed: 'pz', slam: true, fonts: 'block', first: 'wb' })),
    list,
    standings(session),
    h('div', { class: 'br-pz-info' },
      h('span', { class: 'br-tag is-red', text: track ? track.nameEn : 'NO RACE' }),
      h('b', { text: track ? track.name : '—' }),
      h('span', { class: 'br-pz-time', text: session ? fmtTime(session.time) : '0:00.00' })),
    controlsSheet(),
  );
  const nav = ctx.nav(new Nav(items, { layout: 'vertical', sfx: ctx.sfx }));
  if (ctx.from !== 'settings') ctx.sfx('ui.cutin'); // PAUSE slam (not when backing out of settings)
  return {
    root: f.root,
    onAction: (a) => {
      if (a === 'back' || a === 'pause') {
        ctx.sfx('ui.back');
        resume(ctx);
        return true;
      }
      return nav.handle(a);
    },
  };
};
