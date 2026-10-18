// results: RESULTS slam, standings table, podium, grade stamp + meme title, coin count-up (saved once),
// achievements (unlocked + saved by gameplay/achievements), buttons 再来一局 / 下一站 / 车库 / 主菜单 (巡回赛
// after a career race). The button row slides in (armed) only after the show (stamp + count-up) and a
// quiet beat with no key / pad press, so finish-line hop or swing rhythms never pick a button; presses
// before that only skip the show. Without race props the screen shows demo data (no save).
import './results.css';
import { TRACKS } from '../../data/tracks';
import { Nav, type NavItem } from '../nav';
import { HINT_BACK, HINT_LR, HINT_OK, backdrop, button, h } from '../p5';
import { applyRewards } from '../progress';
import { frame, type ScreenFactory } from '../screen';
import { achievementChips, achievementPanel } from './results-achievements';
import { DEMO_ACHIEVEMENTS, demoResults, leaveRace, nextRace } from './results-flow';
import { coinCounter, gradeBlock, podium, standingsTable } from './results-parts';

const LOCK_MS = 900;   // after the reveal: the RESULTS slam lands before the row can arm
const QUIET_MS = 700;  // the row arms only after this long without a key / pad press (a 450 ms hop rhythm
                       // or 220 ms swing mash never arms it; a deliberate choice comes after a pause)
const STAMP_AT = 1.22; // s after mount: the grade stamp lands (results.css: br-stamp-in at 0.95 s)
const UNLOCK_AT = 1.5; // s after mount: the "unlocked" tag pops (results.css .br-res-unlock)
const DIRECTIONS = new Set(['up', 'down', 'left', 'right']);

export const resultsScreen: ScreenFactory = (ctx) => {
  const demo = !ctx.props.results?.length;
  const results = demo ? demoResults() : ctx.props.results ?? [];
  const config = ctx.props.config ?? ctx.session()?.config;
  const unlocked = demo ? DEMO_ACHIEVEMENTS : ctx.tracker.unlocked();
  const reward = applyRewards(ctx.app.save, config, results, !demo);
  const seed = config?.seed ?? 0;
  const track = TRACKS[config?.trackId ?? 'coast'];
  const career = config?.mode === 'career';
  const bg = backdrop({ tone: 'red', seed: 'results', star: { x: '78%', y: '34%', size: 1500, color: '#ff1e3c', spin: 50 } });
  bg.append(h('div', { class: 'br-res-slab' }));
  const home = career ? 'career' : 'menu';
  const f = frame({ id: 'results', bg, hints: [HINT_LR, HINT_OK, { ...HINT_BACK, label: career ? '巡回赛' : '主菜单' }] });
  const counter = coinCounter(reward, ctx.sfx);
  ctx.sfx('ui.cutin'); // RESULTS slam
  const sub = `${career ? `CAREER · TIER ${config.level}` : 'QUICK RACE'} · ${track.name}`;
  const best = reward.newBest ? '新纪录 NEW BEST!' : reward.firstFinish ? '首次完赛 FIRST FINISH' : null;
  const unlock = reward.unlocked ? `解锁 ${TRACKS[reward.unlocked.trackId].name} · TIER ${reward.unlocked.tier}` : null;
  const ach = achievementChips(unlocked);
  const panel = ach.more ? achievementPanel(unlocked) : null;
  f.stage.append(
    h('div', { class: 'br-res-title' }, h('span', { class: 'br-res-word', text: 'RESULTS' }),
      h('div', { class: `br-res-tags${unlock && best ? ' is-three' : ''}` },
        unlock ? h('span', { class: 'br-tag is-white br-res-unlock', text: unlock }) : null,
        best ? h('span', { class: 'br-tag is-red br-res-best', text: best }) : null,
        h('span', { class: 'br-tag is-white br-res-sub', text: sub }))),
    standingsTable(results),
    podium(results, seed),
    h('div', { class: 'br-res-reward' }, gradeBlock(reward, seed), counter.el),
    ach.el,
  );
  if (demo) f.stage.append(h('div', { class: 'br-tag is-yellow br-res-demo', text: 'DEMO 示例数据' }));

  const next = nextRace(ctx, config);
  const actions = [
    { label: '再来一局', sub: 'RETRY', run: () => ctx.app.bus.emit('flow:restartRace', {}) },
    { label: '下一站', sub: 'NEXT', run: () => next && ctx.app.bus.emit('flow:startRace', { config: next }),
      disabled: () => next === null, onDenied: () => ctx.toast('前三名才能解锁下一站', 'warn') },
    { label: '车库', sub: 'GARAGE', run: () => leaveRace(ctx, config, 'garage') },
    career
      ? { label: '巡回赛', sub: 'CAREER', run: () => leaveRace(ctx, config, 'career') }
      : { label: '主菜单', sub: 'MENU', run: () => leaveRace(ctx, config, 'menu') },
  ];
  const row = h('div', { class: 'br-res-actions' });
  const items: NavItem[] = actions.map((a) => {
    const el = button(a.label, { sub: a.sub, seed: `res-${a.sub}` });
    if (a.disabled?.()) el.classList.add('is-disabled');
    row.append(el);
    return { el, confirm: a.run, disabled: a.disabled, onDenied: a.onDenied };
  });
  let panelOpen = false;
  const setPanel = (open: boolean): void => {
    panelOpen = open;
    panel?.classList.toggle('is-open', open);
    ctx.sfx(open ? 'ui.cutin' : 'ui.back');
  };
  if (ach.more && panel) {
    items.push({ el: ach.more, confirm: () => setPanel(true) });
    panel.addEventListener('click', () => setPanel(false));
    f.stage.append(panel);
  }
  f.stage.append(row);
  // Default focus 再来一局: the first accepted press never sends the player to a different track.
  const nav = ctx.nav(new Nav(items, { layout: 'horizontal', start: 0, sfx: ctx.sfx }));
  let enteredAt = Infinity;
  let armed = false;
  let counting = true;
  const shellGate = nav.gate;
  nav.gate = () => shellGate() && armed && !panelOpen;
  const arm = (): void => {
    armed = true;
    row.classList.add('is-armed');
    ctx.sfx('ui.move');
  };
  let elapsed = 0;
  let stamped = false;
  let unlockSounded = unlock === null;
  const stamp = (): void => {
    if (stamped) return;
    stamped = true;
    ctx.sfx('ui.stamp');
    f.stage.classList.add('is-thump');
  };
  const soundUnlock = (): void => {
    if (unlockSounded) return;
    unlockSounded = true;
    ctx.sfx('ui.unlock');
  };
  /** Finish every one-shot animation (slams, stamp, chips) and the count-up at once. */
  const skipShow = (): void => {
    counter.skip();
    for (const an of f.root.getAnimations({ subtree: true })) {
      if (an.effect?.getTiming().iterations !== Infinity) an.finish();
    }
    stamp();
    soundUnlock();
  };
  return {
    root: f.root,
    entered: () => {
      enteredAt = performance.now();
    },
    update: (dt) => {
      elapsed += dt;
      counting = counter.tick(dt);
      if (elapsed >= STAMP_AT) stamp();
      if (elapsed >= UNLOCK_AT) soundUnlock();
      if (!armed && stamped && !counting && performance.now() - enteredAt >= LOCK_MS && ctx.sincePress() >= QUIET_MS) arm();
    },
    onAction: (a) => {
      if (panelOpen) {
        if (a === 'back' || a === 'confirm' || a === 'pause') setPanel(false);
        return a === 'back' || a === 'confirm' || a === 'pause' || a === 'up' || a === 'down' || a === 'left' || a === 'right';
      }
      if (!armed) {
        if (!DIRECTIONS.has(a)) skipShow();
        return true;
      }
      if (a === 'back') {
        ctx.sfx('ui.back');
        leaveRace(ctx, config, home);
        return true;
      }
      return nav.handle(a);
    },
  };
};
