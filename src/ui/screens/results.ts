// results: RESULTS slam, standings table, podium, grade stamp + meme title, coin count-up (saved once),
// achievements (unlocked + saved by gameplay/achievements), buttons 再来一局 / 下一站 / 车库 / 主菜单 (巡回赛
// after a career race; 下一站 becomes 通关! after the career's last event). A top-3 finish on a cup's last
// event stamps CUP CLEAR / CAREER CLEAR in the title row. The button row slides in (armed) only after the
// show (stamp + count-up) and a quiet beat with no key / pad press / click, so finish-line hop or swing
// rhythms never pick a button; presses before that (or a click anywhere) only skip the show. Without race
// props the screen shows demo data (no save).
import './results.css';
import { TRACKS } from '../../data/tracks';
import { Nav, isDirection, type NavItem } from '../nav';
import { HINT_BACK, HINT_LR, HINT_OK, backdrop, button, h, reducedMotion } from '../p5';
import { applyRewards, careerEvent, cupName, isCareerFinal, type Reward } from '../progress';
import { frame, type ScreenFactory } from '../screen';
import { achievementChips, achievementPanel } from './results-achievements';
import { DEMO_ACHIEVEMENTS, backToRoom, demoResults, leaveRace, nextRace } from './results-flow';
import { coinCounter, gradeBlock, podium, raceReport, standingsTable } from './results-parts';

const LOCK_MS = 900;   // after the reveal: the RESULTS slam lands before the row can arm
const QUIET_MS = 700;  // the row arms only after this long without a key / pad press (a 450 ms hop rhythm
                       // or 220 ms swing mash never arms it; a deliberate choice comes after a pause)
const STAMP_AT = 1.22; // s after mount: the grade stamp lands (results.css: br-stamp-in at 0.95 s)
const UNLOCK_AT = 1.5; // s after mount: the "unlocked" / CLEAR tag pops (results.css .br-res-unlock)
const CLICK_ARM_MS = 350; // clicks on the row wait for its slide-in after arming
const HOP_CONFIRM_GAP = 1000; // the first Space / pad A (hop twin) confirm after arming needs this long since
                              // the last press before arming (else it is the finish-line hop rhythm)
const HOP_RETRY_MS = 350;     // after that one ignored hop-twin confirm, the next one this much later counts

export const resultsScreen: ScreenFactory = (ctx) => {
  const demo = !ctx.props.results?.length;
  const results = demo ? demoResults() : ctx.props.results ?? [];
  const config = ctx.props.config ?? ctx.session()?.config;
  const unlocked = demo ? DEMO_ACHIEVEMENTS : ctx.tracker.unlocked();
  const reward = applyRewards(ctx.app.save, config, results, !demo);
  const seed = config?.seed ?? 0;
  const track = TRACKS[config?.trackId ?? 'coast'];
  const career = config?.mode === 'career';
  // r6 (SPEC §28): an online race ends in the room, not in a new local race.
  const online = !!config?.online;
  const bg = backdrop({ tone: 'red', seed: 'results', star: { x: '78%', y: '34%', size: 1500, color: '#ff1e3c', spin: 50 } });
  bg.append(h('div', { class: 'br-res-slab' }));
  const home = career ? 'career' : 'menu';
  const f = frame({ id: 'results', bg, hints: [HINT_LR, HINT_OK, { ...HINT_BACK, label: online ? '回到房间' : career ? '巡回赛' : '主菜单' }] });
  const counter = coinCounter(reward, ctx.sfx);
  ctx.sfx('ui.cutin'); // RESULTS slam
  const sub = `${online ? 'ONLINE ROOM' : career ? `CAREER · TIER ${config.level}` : 'QUICK RACE'} · ${track.name}`;
  const best = reward.newBest ? '新纪录 NEW BEST!' : reward.firstFinish ? '首次完赛 FIRST FINISH' : null;
  const unlock = reward.unlocked ? `解锁 ${TRACKS[reward.unlocked.trackId].name} · TIER ${reward.unlocked.tier}` : null;
  const clear = clearText(reward);
  const ach = achievementChips(unlocked);
  const panel = ach.more ? achievementPanel(unlocked) : null;
  f.stage.append(
    h('div', { class: 'br-res-title' }, h('span', { class: 'br-res-word', text: 'RESULTS' }),
      h('div', { class: `br-res-tags${clear ? ' has-clear' : unlock && best ? ' is-three' : ''}` },
        clear ? h('span', { class: 'br-tag is-red br-res-unlock br-res-clear', text: clear }) : null,
        !clear && unlock ? h('span', { class: 'br-tag is-white br-res-unlock', text: unlock }) : null,
        !clear && best ? h('span', { class: 'br-tag is-red br-res-best', text: best }) : null,
        h('span', { class: 'br-tag is-white br-res-sub', text: sub }))),
    standingsTable(results),
    podium(results, seed),
    h('div', { class: 'br-res-reward' }, gradeBlock(reward, seed), counter.el),
    ach.el,
  );
  // The race report (nemesis / STYLE / police): only the lines whose thing happened.
  const report = raceReport(ctx.tracker.raceReport(), results);
  if (report) f.stage.append(report);
  if (demo) f.stage.append(h('div', { class: 'br-tag is-yellow br-res-demo', text: 'DEMO 示例数据' }));

  const next = nextRace(ctx, config);
  const ev = careerEvent(config);
  const finalEvent = ev !== null && isCareerFinal(ev);
  const actions = online
    ? [{ label: '回到房间', sub: 'ROOM', run: () => backToRoom(ctx) }]
    : [
      { label: '再来一局', sub: 'RETRY', run: () => ctx.app.bus.emit('flow:restartRace', {}) },
      reward.clear?.career
        ? { label: '通关！', sub: 'FINALE', run: () => leaveRace(ctx, config, 'finale') }
        : { label: '下一站', sub: 'NEXT', run: () => next && ctx.app.bus.emit('flow:startRace', { config: next }),
          disabled: () => next === null,
          onDenied: () => ctx.toast(finalEvent ? '已经是最后一站了：前三名即可通关' : '前三名才能解锁下一站', 'warn') },
      { label: '车库', sub: 'GARAGE', run: () => leaveRace(ctx, config, 'garage') },
      career
        ? { label: '巡回赛', sub: 'CAREER', run: () => leaveRace(ctx, config, 'career') }
        : { label: '主菜单', sub: 'MENU', run: () => leaveRace(ctx, config, 'menu') },
    ];
  const row = h('div', { class: 'br-res-actions' });
  const items: NavItem[] = actions.map((a) => {
    const el = button(a.label, { sub: a.sub, seed: `res-${a.sub}` });
    if (a.disabled?.()) el.classList.add('is-disabled');
    if (online) el.classList.add('br-res-choice');
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
  // Default focus moves on (下一站 / 通关! / 巡回赛 in a career, 主菜单 after a quick race), never RETRY:
  // a stray press does not throw the result screen away for a reload of the same race.
  const nav = ctx.nav(new Nav(items, { layout: 'horizontal', start: online ? 0 : (career && next !== null) || reward.clear?.career ? 1 : 3, sfx: ctx.sfx }));
  let enteredAt = Infinity;
  let armed = false;
  let armedAt = Infinity;
  let counting = true;
  let hopTwin = false;
  let quietFrom = -Infinity;    // the last press before the row armed
  let hopFirst = true;          // no hop-twin confirm (and no menu move) since arming yet
  let hopIgnoredAt = -Infinity; // when the first hop-twin confirm was ignored
  const shellGate = nav.gate;
  nav.gate = () => shellGate() && armed && !panelOpen && performance.now() - armedAt >= CLICK_ARM_MS;
  const arm = (): void => {
    armed = true;
    armedAt = performance.now();
    quietFrom = armedAt - ctx.sincePress();
    row.classList.add('is-armed');
    ctx.sfx('ui.move');
  };
  let elapsed = 0;
  let stamped = false;
  let unlockSounded = unlock === null && clear === null;
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
  /** Space / pad A send hop + confirm. The first such confirm right after arming may still be the finish-line
   * hop rhythm: unless the player had paused HOP_CONFIRM_GAP, it is ignored with a deny + a nudge of the focused
   * button (the row is live), and the next one HOP_RETRY_MS later goes through. */
  const hopConfirmOk = (): boolean => {
    const now = performance.now();
    if (hopFirst) {
      hopFirst = false;
      if (now - quietFrom >= HOP_CONFIRM_GAP) return true;
      hopIgnoredAt = now;
    } else if (now - hopIgnoredAt >= HOP_RETRY_MS) return true;
    ctx.sfx('ui.deny');
    if (!reducedMotion()) nav.current?.el.animate([{ scale: 1 }, { scale: 1.12, offset: 0.35 }, { scale: 1 }], { duration: 240, easing: 'ease-out' });
    return false;
  };
  // The overlay lets clicks on bare stage through to the canvas: listen on the window to skip the show.
  const onPointer = (): void => {
    if (!armed) skipShow();
  };
  window.addEventListener('pointerdown', onPointer);
  // The show runs on the screen's own clock as well: the game may be frozen (the tests step a race by
  // hand), so the stamp, the coin count-up and the arming must not wait for the game's frame loop.
  let lastAdvance = performance.now();
  const advance = (dt: number): void => {
    elapsed += dt;
    counting = counter.tick(dt);
    if (elapsed >= STAMP_AT) stamp();
    if (elapsed >= UNLOCK_AT) soundUnlock();
    if (!armed && stamped && !counting && performance.now() - enteredAt >= LOCK_MS && ctx.sincePress() >= QUIET_MS) arm();
  };
  const showClock = window.setInterval(() => {
    const now = performance.now();
    if (now - lastAdvance < 120) return;   // the game's loop is driving the show
    advance((now - lastAdvance) / 1000);
    lastAdvance = now;
  }, 50);
  return {
    root: f.root,
    dispose: () => {
      window.removeEventListener('pointerdown', onPointer);
      window.clearInterval(showClock);
    },
    entered: () => {
      enteredAt = performance.now();
    },
    update: (dt) => {
      lastAdvance = performance.now();
      advance(dt);
    },
    onAction: (a) => {
      if (panelOpen) {
        if (a === 'back' || a === 'confirm' || a === 'pause') setPanel(false);
        return a === 'back' || a === 'confirm' || a === 'pause' || isDirection(a);
      }
      if (!armed) {
        if (!isDirection(a)) skipShow();
        return true;
      }
      if (a === 'back') {
        ctx.sfx('ui.back');
        if (online) backToRoom(ctx);
        else leaveRace(ctx, config, home);
        return true;
      }
      if (a === 'hop') {
        hopTwin = true;
        queueMicrotask(() => (hopTwin = false));
        return false;
      }
      if (a === 'confirm' && hopTwin && !hopConfirmOk()) return true;
      if (isDirection(a)) {
        hopFirst = false; // a deliberate menu move: no rhythm guard after it
        hopIgnoredAt = -Infinity;
      }
      return nav.handle(a);
    },
  };
};

/** Title-row stamp for a top-3 finish on a cup's last event. */
function clearText(reward: Reward): string | null {
  const c = reward.clear;
  if (!c) return null;
  return c.career ? '★ 巡回赛通关 CAREER CLEAR!' : `★ ${cupName(c.tier)} CUP CLEAR!`;
}
