// results: RESULTS slam, standings table, podium, grade stamp + meme title, coin count-up (saved once),
// achievements (unlocked + saved by gameplay/achievements), buttons 再来一局 / 下一站 / 车库 / 主菜单.
// Without race props it shows demo data (no save).
import './results.css';
import type { RaceConfig, RaceResult } from '../../core/contracts';
import type { CharacterId } from '../../core/types';
import { RACER_POOL, ROSTER } from '../../data/roster';
import { TRACKS, TRACK_ORDER } from '../../data/tracks';
import { Nav } from '../nav';
import { HINT_LR, HINT_OK, backdrop, button, h } from '../p5';
import { CAREER, applyRewards, careerEvent, isUnlocked } from '../progress';
import { frame, type ScreenCtx, type ScreenFactory } from '../screen';
import { achievementChips, coinCounter, gradeBlock, podium, standingsTable } from './results-parts';

const DEMO_ACHIEVEMENTS = ['first_ko', 'double', 'goose', 'perfect_start', 'drift3'];

function demoResults(): RaceResult[] {
  const field: CharacterId[] = ['goose', 'pelican', ...RACER_POOL.filter((c) => c !== 'goose').slice(0, 6)];
  return field.map((character, i) => ({
    riderId: i, character, name: ROSTER[character].name, isPlayer: character === 'pelican', place: i + 1,
    time: i < 7 ? 151.37 + i * 2.91 + (i % 3) * 0.47 : null, kos: character === 'pelican' ? 2 : i % 3 === 0 ? 1 : 0,
    wrecked: i % 4 === 1 ? 1 : 0, coins: [500, 300, 200, 120, 80, 50, 30, 10][i]! + (character === 'pelican' ? 100 : 0),
  }));
}

/** The race to run after "下一站": next career event if unlocked, otherwise the next quick track. */
function nextRace(ctx: ScreenCtx, config: RaceConfig | undefined): Partial<RaceConfig> | null {
  const ev = careerEvent(config);
  if (ev) {
    const next = CAREER[ev.index];
    return next && isUnlocked(ctx.app.save, next) ? { trackId: next.trackId, mode: 'career', level: next.tier } : null;
  }
  const i = TRACK_ORDER.indexOf(config?.trackId ?? 'coast');
  return { trackId: TRACK_ORDER[(i + 1) % TRACK_ORDER.length] ?? 'coast', mode: 'quick' };
}

export const resultsScreen: ScreenFactory = (ctx) => {
  const demo = !ctx.props.results?.length;
  const results = demo ? demoResults() : ctx.props.results ?? [];
  const config = ctx.props.config ?? ctx.session()?.config;
  const unlocked = demo ? DEMO_ACHIEVEMENTS : ctx.tracker.unlocked();
  const reward = applyRewards(ctx.app.save, config, results, !demo);
  const seed = config?.seed ?? 0;
  const track = TRACKS[config?.trackId ?? 'coast'];
  const bg = backdrop({ tone: 'red', seed: 'results', star: { x: '78%', y: '34%', size: 1500, color: '#ff1e3c', spin: 50 } });
  bg.append(h('div', { class: 'br-res-slab' }));
  const f = frame({ id: 'results', bg, hints: [HINT_LR, HINT_OK] });
  const counter = coinCounter(reward, ctx.sfx);
  ctx.sfx('ui.cutin'); // RESULTS slam
  const sub = `${config?.mode === 'career' ? `CAREER · TIER ${config.level}` : 'QUICK RACE'} · ${track.name}`;
  f.stage.append(
    h('div', { class: 'br-res-title' }, h('span', { class: 'br-res-word', text: 'RESULTS' }), h('span', { class: 'br-tag is-white br-res-sub', text: sub })),
    standingsTable(results),
    podium(results, seed),
    h('div', { class: 'br-res-reward' }, gradeBlock(reward, seed), counter.el),
    achievementChips(unlocked),
  );
  if (demo) f.stage.append(h('div', { class: 'br-tag is-yellow br-res-demo', text: 'DEMO 示例数据' }));
  if (reward.newBest) f.stage.append(h('div', { class: 'br-tag is-red br-res-best', text: '新纪录 NEW BEST!' }));
  if (reward.unlocked) ctx.toast(`解锁新赛事：${TRACKS[reward.unlocked.trackId].name}（TIER ${reward.unlocked.tier}）`, 'meme');

  const next = nextRace(ctx, config);
  const quit = (): void => ctx.app.bus.emit('flow:quitRace', {});
  const actions = [
    { label: '再来一局', sub: 'RETRY', run: () => ctx.app.bus.emit('flow:restartRace', {}) },
    { label: '下一站', sub: 'NEXT', run: () => next && ctx.app.bus.emit('flow:startRace', { config: next }), disabled: () => next === null },
    { label: '车库', sub: 'GARAGE', run: () => { quit(); ctx.go('garage'); } },
    { label: '主菜单', sub: 'MENU', run: quit },
  ];
  const row = h('div', { class: 'br-res-actions' });
  const items = actions.map((a) => {
    const el = button(a.label, { sub: a.sub, seed: `res-${a.sub}` });
    if (a.disabled?.()) el.classList.add('is-disabled');
    row.append(el);
    return { el, confirm: a.run, disabled: a.disabled };
  });
  f.stage.append(row);
  const nav = ctx.nav(new Nav(items, { layout: 'horizontal', start: next ? 1 : 0, sfx: ctx.sfx }));
  let toldLocked = false;
  return {
    root: f.root,
    update: (dt) => void counter.tick(dt),
    onAction: (a) => {
      if (a === 'back') {
        ctx.sfx('ui.back');
        quit();
        return true;
      }
      if (a === 'confirm' && nav.current?.disabled?.() && !toldLocked) {
        toldLocked = true;
        ctx.toast('前三名才能解锁下一站', 'warn');
      }
      return nav.handle(a);
    },
  };
};
