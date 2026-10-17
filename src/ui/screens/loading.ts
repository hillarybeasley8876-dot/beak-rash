// loading: P5 calendar date card (today + track weather), track title, meme tip, road-shaped progress
// bar with a pedalling pelican. Stays up a short beat so the card can be read (leave()).
import './loading.css';
import type { TrackId } from '../../core/types';
import { LOADING_ART } from '../../data/assets';
import { TIPS } from '../../data/tips';
import { TRACKS, TRACK_ORDER } from '../../data/tracks';
import { artImage, backdrop, h, jagged, ransom, riderIconSvg, svg, torn, wait } from '../p5';
import { frame, type ScreenFactory } from '../screen';

const WEEK_EN = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const WEEK_CN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const MONTH_EN = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const WEATHER_ICON: Record<TrackId, string> = {
  coast: '<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="13" fill="#e5191c" stroke="#0b0b0f" stroke-width="4"/><g stroke="#0b0b0f" stroke-width="5" stroke-linecap="round"><path d="M32 4v8M32 52v8M4 32h8M52 32h8M12 12l6 6M46 46l6 6M12 52l6-6M46 18l6-6"/></g></svg>',
  city: '<svg viewBox="0 0 64 64"><path d="M40 8a22 22 0 1 0 16 34A18 18 0 0 1 40 8z" fill="#0b0b0f"/><g stroke="#e5191c" stroke-width="5" stroke-linecap="round"><path d="M14 46l-4 10M26 48l-4 10M38 48l-4 10"/></g></svg>',
  mountain: '<svg viewBox="0 0 64 64"><path d="M14 40a18 18 0 0 1 36 0z" fill="#e5191c" stroke="#0b0b0f" stroke-width="4"/><path d="M4 44h56M10 52h44" stroke="#0b0b0f" stroke-width="5" stroke-linecap="round"/></svg>',
};

const MIN_SHOW_MS = 900;
const MIN_SHOW_DIRECT_MS = 250;

export const loadingScreen: ScreenFactory = (ctx) => {
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

  const card = h('div', { class: 'br-cal br-anim-slam', vars: { '--clip': torn('cal', 'bottom', 5, 30) } },
    h('div', { class: 'br-cal-top' }, h('b', { text: String(now.getFullYear()) }), h('span', { text: MONTH_EN[now.getMonth()] ?? '' })),
    h('div', { class: 'br-cal-date' },
      h('span', { class: 'br-cal-m', text: String(now.getMonth() + 1) }),
      h('i', { class: 'br-cal-slash', text: '/' }),
      h('span', { class: 'br-cal-d', text: String(now.getDate()) })),
    h('div', { class: 'br-cal-week' }, h('b', { text: WEEK_EN[now.getDay()] ?? '' }), h('span', { text: WEEK_CN[now.getDay()] ?? '' })),
    h('div', { class: 'br-cal-weather' }, svg(WEATHER_ICON[trackId], 'br-cal-icon'), h('span', { text: info.weather })));

  const title = h('div', { class: 'br-load-title' },
    h('div', { class: 'br-load-course', text: `COURSE ${course}` }),
    ransom(info.name, { seed: `ld-${trackId}`, slam: true, fonts: 'block', first: 'wr', className: 'br-load-name' }),
    h('div', { class: 'br-load-en', text: info.nameEn }),
    h('div', { class: 'br-load-blurb', text: info.blurb }));

  const tip = TIPS[Math.floor(Math.random() * TIPS.length)] ?? '';
  const tipBox = h('div', { class: 'br-load-tip br-anim-rise', vars: { '--clip': jagged('tip', { jx: 1.5, jy: 7, notches: 2 }), '--delay': '120ms' } },
    h('span', { class: 'br-tag is-red br-load-tip-tag', text: 'TIPS 小贴士' }),
    h('p', { text: tip }));

  const rider = h('div', { class: 'br-road-rider' }, svg(riderIconSvg()));
  const pctEl = h('b', { class: 'br-road-pct', text: '0%' });
  const label = h('span', { class: 'br-road-label', text: 'LOADING' });
  const road = h('div', { class: 'br-road' },
    h('div', { class: 'br-road-strip' }, h('i', { class: 'br-road-dash' }), h('i', { class: 'br-road-fill' })),
    h('div', { class: 'br-road-flag' }),
    rider,
    h('div', { class: 'br-road-text' }, label, pctEl));
  const vignette = artImage(LOADING_ART[Math.floor(Math.random() * LOADING_ART.length)], 'br-load-art br-anim-pop');
  if (vignette) {
    f.root.classList.add('has-art');
    f.stage.append(vignette);
  }
  f.stage.append(card, title, tipBox, road);

  const fill = road.querySelector<HTMLElement>('.br-road-fill');
  let shown = 0;
  let target = 0.15;
  let reported = false;
  const setBar = (p: number): void => {
    shown = p;
    fill?.style.setProperty('transform', `scaleX(${p.toFixed(4)})`);
    rider.style.left = `${(p * 100).toFixed(2)}%`;
    pctEl.textContent = `${Math.round(p * 100)}%`;
  };
  setBar(0);
  const off = ctx.app.bus.on('flow:loading', ({ progress, label: text }) => {
    reported = true;
    target = Math.max(target, Math.min(1, progress));
    if (text) label.textContent = text;
  });
  const t0 = performance.now();
  const minShow = ctx.from === 'boot' ? MIN_SHOW_DIRECT_MS : MIN_SHOW_MS;
  return {
    root: f.root,
    update(dt) {
      if (!reported) target += (0.92 - target) * (1 - Math.exp(-dt * 1.6));
      setBar(shown + (target - shown) * (1 - Math.exp(-dt * 10)));
    },
    async leave() {
      const left = minShow - (performance.now() - t0);
      target = 1;
      setBar(Math.max(shown, 0.98));
      await wait(Math.max(120, left));
      setBar(1);
    },
    dispose: off,
  };
};
