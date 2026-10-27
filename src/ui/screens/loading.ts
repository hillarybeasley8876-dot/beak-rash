// loading: P5 calendar date card (today, 宜/忌 of the day, track weather), track title, meme tip, road-shaped progress
// bar with a pedalling pelican. Stays up ≥ 2 s so the tip can be read (leave()), 0.5 s when the same track
// restarts (pause 重新开始 / results 再来一局); the new race's sim clock is held meanwhile, so its intro starts
// when the card goes. Bar + runner glide on CSS transform transitions (compositor), so they keep moving
// through the long main-thread tasks of the race build; JS only sets targets and the % text.
import './loading.css';
import type { TrackId } from '../../core/types';
import { LOADING_ART } from '../../data/assets';
import { calendarFor } from '../../data/strings';
import { PAD_TIPS, TIPS } from '../../data/tips';
import { TRACKS, TRACK_ORDER, TRACK_WEATHER } from '../../data/tracks';
import { WEATHER_CN } from '../copy';
import { preloadHudFonts } from '../hud/fonts';
import { artImage, artReady, backdrop, h, jagged, ransom, riderIconSvg, svg, torn, wait } from '../p5';
import { frame, type ScreenFactory } from '../screen';
import { WEATHER_ICON as GOBI_ICON } from '../tracks/gobi';
import { WEATHER_ICON as WATERTOWN_ICON } from '../tracks/watertown';

const WEEK_EN = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const WEEK_CN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const MONTH_EN = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const WEATHER_ICON: Record<TrackId, string> = {
  coast: '<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="13" fill="#e5191c" stroke="#0b0b0f" stroke-width="4"/><g stroke="#0b0b0f" stroke-width="5" stroke-linecap="round"><path d="M32 4v8M32 52v8M4 32h8M52 32h8M12 12l6 6M46 46l6 6M12 52l6-6M46 18l6-6"/></g></svg>',
  city: '<svg viewBox="0 0 64 64"><path d="M40 8a22 22 0 1 0 16 34A18 18 0 0 1 40 8z" fill="#0b0b0f"/><g stroke="#e5191c" stroke-width="5" stroke-linecap="round"><path d="M14 46l-4 10M26 48l-4 10M38 48l-4 10"/></g></svg>',
  mountain: '<svg viewBox="0 0 64 64"><path d="M14 40a18 18 0 0 1 36 0z" fill="#e5191c" stroke="#0b0b0f" stroke-width="4"/><path d="M4 44h56M10 52h44" stroke="#0b0b0f" stroke-width="5" stroke-linecap="round"/></svg>',
  watertown: WATERTOWN_ICON,
  gobi: GOBI_ICON,
};

/** One 宜/忌 row; long entries shrink so they never run into the weekday box. */
const luckRow = (kind: 'good' | 'bad', mark: string, text: string): HTMLDivElement =>
  h('div', { class: `is-${kind}${[...text].length > 4 ? ' is-long' : ''}` }, h('i', { text: mark }), h('span', { text }));

/** Tips that name keyboard keys (按 P, 刹车键在 S, J 往左扇…): a gamepad player gets their PAD_TIPS wording,
 *  and a key tip without one is left out. */
const KEYBOARD_TIP = /(按住?|键在)\s?(Shift|[A-Z])(?![A-Za-z])|^[A-Z] 往/;

/** From mount (under the cover wipe): long enough to read the tip after it lands. */
const MIN_SHOW_MS = 2000;
/** Clock layer that keeps the freshly built race (intro flyover, countdown) frozen behind the card. */
const HOLD_LAYER = 'ui:loading';
const MIN_SHOW_DIRECT_MS = 250;
/** Restarting the track that was just loaded: the player has read this card already. */
const MIN_SHOW_AGAIN_MS = 500;
const GLIDE = 'cubic-bezier(0.2, 0.7, 0.3, 1)';
let lastTrack: TrackId | null = null;

export const loadingScreen: ScreenFactory = (ctx) => {
  // The race fonts (the HUD's CJK subsets) load with the race: this card is up while the track builds.
  void preloadHudFonts();
  const trackId: TrackId = ctx.props.config?.trackId ?? 'coast';
  const info = TRACKS[trackId];
  const now = new Date();
  const bg = backdrop({
    tone: 'black', seed: 'loading', star: { x: '82%', y: '38%', size: 1300, color: '#16161d', spin: 40 },
    bands: [{ top: '58%', height: 260, color: '#e5191c', rotate: -8 }, { top: '74%', height: 18, color: '#ffffff', rotate: -8 }],
    dots: { color: 'rgba(229,25,28,.45)', size: 16, mask: 'linear-gradient(200deg, #000 0%, transparent 45%)' },
  });
  const f = frame({ id: 'loading', bg });
  const course = String(TRACK_ORDER.indexOf(trackId) + 1).padStart(2, '0');
  const day = calendarFor(trackId, now);
  // The race's modifiers (SPEC §20): a weather other than the track's own, a reversed run, a seeded
  // route. A plain race shows nothing.
  const cfg = ctx.props.config;
  const own = TRACK_WEATHER[trackId][0] ?? 'clear';
  const mods: string[] = [];
  if (cfg?.weather && cfg.weather !== own) mods.push(WEATHER_CN[cfg.weather]);
  if (cfg?.reverse) mods.push('反向');
  if (cfg?.route) mods.push(`路线 #${cfg.route}`);

  const card = h('div', { class: 'br-cal br-anim-slam', vars: { '--clip': torn('cal', 'bottom', 5, 30) } },
    h('div', { class: 'br-cal-top' }, h('b', { text: String(now.getFullYear()) }), h('span', { text: MONTH_EN[now.getMonth()] ?? '' })),
    h('div', { class: 'br-cal-date' },
      h('span', { class: 'br-cal-m', text: String(now.getMonth() + 1) }),
      h('i', { class: 'br-cal-slash', text: '/' }),
      h('span', { class: 'br-cal-d', text: String(now.getDate()) })),
    h('div', { class: 'br-cal-week' }, h('b', { text: WEEK_EN[now.getDay()] ?? '' }), h('span', { text: WEEK_CN[now.getDay()] ?? '' })),
    h('div', { class: 'br-cal-luck' }, luckRow('good', '宜', day.good), luckRow('bad', '忌', day.bad)),
    h('div', { class: 'br-cal-weather' }, svg(WEATHER_ICON[trackId], 'br-cal-icon'), h('span', { text: info.weather })),
    mods.length ? h('div', { class: 'br-cal-mods', data: { line: 'mods' }, text: mods.join(' · ') }) : null);

  const title = h('div', { class: 'br-load-title' },
    h('div', { class: 'br-load-course', text: `COURSE ${course}` }),
    ransom(info.name, { seed: `ld-${trackId}`, slam: true, fonts: 'block', first: 'wr', className: 'br-load-name' }),
    h('div', { class: 'br-load-en', text: info.nameEn }),
    h('div', { class: 'br-load-blurb', text: info.blurb }));

  const tips = ctx.app.input.lastDevice === 'gamepad'
    ? TIPS.flatMap((t) => PAD_TIPS[t] ?? (KEYBOARD_TIP.test(t) ? [] : [t]))
    : TIPS;
  const tip = tips[Math.floor(Math.random() * tips.length)] ?? '';
  const tipBox = h('div', { class: 'br-load-tip br-anim-rise', vars: { '--clip': jagged('tip', { jx: 1.5, jy: 7, notches: 2 }), '--delay': '0ms' } },
    h('span', { class: 'br-tag is-red br-load-tip-tag', text: 'TIPS 小贴士' }),
    h('p', { text: tip }));

  const runner = h('div', { class: 'br-road-runner' }, h('div', { class: 'br-road-rider' }, svg(riderIconSvg())));
  const pctEl = h('b', { class: 'br-road-pct', text: '0%' });
  const label = h('span', { class: 'br-road-label', text: 'LOADING' });
  const road = h('div', { class: 'br-road' },
    h('div', { class: 'br-road-strip' }, h('i', { class: 'br-road-dash' }), h('i', { class: 'br-road-fill' })),
    h('div', { class: 'br-road-flag' }),
    runner,
    h('div', { class: 'br-road-text' }, label, pctEl));
  const vignette = artImage(LOADING_ART[Math.floor(Math.random() * LOADING_ART.length)], 'br-load-art br-anim-pop');
  if (vignette) {
    f.root.classList.add('has-art');
    f.stage.append(vignette);
  }
  f.stage.append(card, title, tipBox, road);

  const fill = road.querySelector<HTMLElement>('.br-road-fill');
  let goal = 0;
  let started = false;
  /** Glide bar + runner to p over secs (a running transition restarts from where it is). */
  const glide = (p: number, secs: number): void => {
    goal = Math.max(goal, Math.min(1, p));
    for (const el of [fill, runner]) {
      if (el) el.style.transition = `transform ${secs}s ${GLIDE}`;
    }
    fill?.style.setProperty('transform', `scaleX(${goal.toFixed(4)})`);
    runner.style.transform = `translateX(${(goal * 100).toFixed(2)}%)`;
  };
  const off = ctx.app.bus.on('flow:loading', ({ progress, label: text }) => {
    glide(progress, 0.5);
    if (text) label.textContent = text;
  });
  const t0 = performance.now();
  const again = trackId === lastTrack && (ctx.from === 'pause' || ctx.from === 'results');
  lastTrack = trackId;
  const minShow = ctx.from === 'boot' ? MIN_SHOW_DIRECT_MS : again ? MIN_SHOW_AGAIN_MS : MIN_SHOW_MS;
  return {
    root: f.root,
    ready: artReady(vignette, 300),
    update() {
      if (!started && f.root.isConnected) {
        started = true;
        void runner.offsetWidth; // resolve the 0 % start so the first glide animates
        glide(0.9, 6); // creeps on the compositor until real progress or leave() moves it on
      }
      const shown = fill ? new DOMMatrixReadOnly(getComputedStyle(fill).transform).a : goal;
      pctEl.textContent = `${Math.round(shown * 100)}%`;
    },
    async leave() {
      const left = minShow - (performance.now() - t0);
      glide(0.98, 0.3);
      ctx.app.clock.setScale(HOLD_LAYER, 0);
      try {
        await wait(Math.max(120, left));
      } finally {
        ctx.app.clock.clearScale(HOLD_LAYER);
      }
      glide(1, 0.12);
    },
    dispose: () => {
      off();
      ctx.app.clock.clearScale(HOLD_LAYER);
    },
  };
};
