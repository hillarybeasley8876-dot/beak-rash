// garage: bike shop. Live 3D turntable, bike list with price / owned / equipped (+ 整活 tag on joke bikes),
// stat bars with ± deltas against the equipped bike (repeated in the buy modal), meme blurb, 小鱼干 balance.
// Enter buys (with confirm) or equips; saves to app.save. Esc → menu.
// The Konami unlock (SPEC §21 #2) lists the 大模型限定款 last; finding every duck (SPEC §21 #1) adds the
// 小黄鸭乘客 toggle row under the bikes.
import './garage.css';
import type { BikeId } from '../../core/types';
import { ART } from '../../data/assets';
import { BIKES, BIKE_ORDER } from '../../data/bikes';
import { Nav } from '../nav';
import { HINT_BACK, HINT_NAV, HINT_OK, artImage, artReady, backdrop, coinBadge, h, jagged, keyGlyph, ransom, riderIconSvg, statBar, svg } from '../p5';
import { frame, type ScreenFactory } from '../screen';
import { Turntable } from './garage-turntable';
import { recall, remember } from './memory';

const STATS: Array<[keyof typeof BIKES.roadbike.bars, string]> = [
  ['speed', '速度'], ['accel', '加速'], ['handling', '操控'], ['weight', '重量'], ['durability', '耐久'],
];
/** Speed bar at or below this = a fun bike, not an upgrade (tagged 整活 in the list and the buy modal). */
const JOKE_SPEED = 2;
const isJoke = (id: BikeId): boolean => BIKES[id].bars.speed <= JOKE_SPEED;
/** The duck toggle row (SPEC §21 #1): the rubber duck rides on the player's handlebar. */
const DUCK_ROW = '小黄鸭乘客 DUCK RIDER';

/** "对比 风之翼：速度 −3、操控 +2。" for the buy modal (only the stats that change). */
function deltaLine(id: BikeId, current: BikeId): string {
  const a = BIKES[id].bars;
  const b = BIKES[current].bars;
  const parts = STATS.filter(([k]) => a[k] !== b[k]).map(([k, label]) => `${label} ${a[k] > b[k] ? '+' : '−'}${Math.abs(a[k] - b[k])}`);
  return parts.length ? `对比${BIKES[current].name}：${parts.join('、')}。` : '';
}

export const garageScreen: ScreenFactory = (ctx) => {
  const { save } = ctx.app;
  // The workshop art lives in the stage (not the full-bleed bg) so the drawn repair stand stays aligned
  // with the turntable's clamp at 16:10 too; the dark backdrop fills any letterbox.
  const bg = backdrop({ tone: 'black', seed: 'garage', star: { x: '30%', y: '52%', size: 1400, color: '#15151b', spin: 60 } });
  const f = frame({ id: 'garage', bg, title: { cn: '车库', en: 'GARAGE' }, hints: [HINT_NAV, HINT_OK, HINT_BACK] });
  const art = artImage(ART.garage, 'br-gar-art');
  const coins = coinBadge(save.data.coins);
  coins.el.classList.add('br-gar-coins');
  const show = h('div', { class: 'br-gar-show' }, h('div', { class: 'br-gar-glow' }));
  const table = new Turntable(ctx.app, () => {
    show.classList.add('is-flat');
    if (!show.querySelector('.br-gar-flat')) show.append(svg(riderIconSvg(), 'br-gar-flat'));
  });
  show.append(table.canvas);
  const nameBox = h('div', { class: 'br-gar-name' });
  const blurb = h('div', { class: 'br-gar-blurb', vars: { '--clip': jagged('garblurb', { jx: 1.5, jy: 7, notches: 2 }) } });
  const list = h('div', { class: 'br-gar-list' });
  const stats = h('div', { class: 'br-gar-stats' });
  const action = h('div', { class: 'br-gar-action', attrs: { role: 'button' } });
  f.stage.prepend(...(art ? [art] : []), h('div', { class: 'br-gar-slab' }), show);
  f.stage.append(nameBox, blurb, list, stats, action, coins.el);

  // The Konami unlock (SPEC §21 #2) lists the 大模型限定款 last; finding every duck (SPEC §21 #1) adds
  // the 小黄鸭乘客 toggle row under the bikes.
  const bikeIds: BikeId[] = save.data.unlocks.includes('llm') ? [...BIKE_ORDER, 'llm'] : BIKE_ORDER;
  const entries: Array<{ el: HTMLDivElement; bike: BikeId | null }> = bikeIds.map((id, i) => {
    const row = h('div', { class: 'br-gar-row', vars: { '--i': i } }, h('b', { text: BIKES[id].name }),
      isJoke(id) ? h('i', { class: 'br-gar-joke', text: '整活' }) : null, h('span', { class: 'br-gar-tag' }));
    list.append(row);
    return { el: row, bike: id };
  });
  if (save.data.unlocks.includes('duck')) {
    const row = h('div', { class: 'br-gar-row br-gar-duck', vars: { '--i': entries.length } },
      h('b', { text: DUCK_ROW }), h('span', { class: 'br-gar-tag' }));
    list.append(row);
    entries.push({ el: row, bike: null });
  }
  list.classList.toggle('is-long', entries.length > 7);
  const state = (id: BikeId): 'equipped' | 'owned' | 'shop' =>
    save.data.bike === id ? 'equipped' : save.data.ownedBikes.includes(id) || (id === 'llm' && save.data.unlocks.includes('llm')) ? 'owned' : 'shop';
  const refreshRows = (): void => entries.forEach((entry) => {
    const row = entry.el;
    const tag = row.querySelector('.br-gar-tag');
    if (!entry.bike) {
      if (tag) tag.textContent = save.data.settings.duckRider ? '开' : '关';
      row.classList.toggle('is-on', save.data.settings.duckRider);
      return;
    }
    const st = state(entry.bike);
    if (tag) tag.textContent = st === 'equipped' ? '装备中' : st === 'owned' ? '已拥有' : `${BIKES[entry.bike].price}`;
    row.classList.toggle('is-equipped', st === 'equipped');
    row.classList.toggle('is-shop', st === 'shop');
  });
  const focus = (id: BikeId): void => {
    const b = BIKES[id];
    table.show(id);
    nameBox.replaceChildren(ransom(b.name, { seed: `bike-${id}`, fonts: 'block', first: 'wb', className: 'br-gar-rn' }));
    blurb.textContent = b.blurb;
    const cur = save.data.bike;
    const ref = id === cur ? null : BIKES[cur].bars;
    stats.replaceChildren(
      h('span', { class: 'br-gar-vs', text: ref ? `对比当前：${BIKES[cur].name}` : '当前座驾' }),
      ...STATS.map(([k, label]) => statBar(label, b.bars[k], 5, ref?.[k])));
    const st = state(id);
    const afford = save.data.coins >= b.price;
    action.className = `br-gar-action is-${st}${st === 'shop' && !afford ? ' is-poor' : ''}`;
    if (st === 'equipped') action.replaceChildren(h('b', { text: '装备中' }));
    else action.replaceChildren(...keyGlyph('ENTER', 'A'), h('b', { text: st === 'owned' ? '装备' : '购买' }));
    if (st === 'shop') action.append(h('span', { text: `${b.price} 小鱼干${afford ? '' : '（不够）'}` }));
  };
  /** The duck row: the rubber duck rides on the player's handlebar (SPEC §21 #1). */
  const focusDuck = (): void => {
    const on = save.data.settings.duckRider;
    table.show(save.data.bike);
    nameBox.replaceChildren(ransom('小黄鸭乘客', { seed: 'gar-duck', fonts: 'block', className: 'br-gar-rn' }));
    blurb.textContent = '五只小黄鸭都找到了。鹈鹕的车头从此多了一位乘客。';
    stats.replaceChildren(h('span', { class: 'br-gar-vs', text: on ? '乘客在车上' : '乘客不在车上' }));
    action.className = 'br-gar-action is-owned';
    action.replaceChildren(...keyGlyph('ENTER', 'A'), h('b', { text: on ? '关' : '开' }));
  };
  const toggleDuck = (): void => {
    save.update((d) => { d.settings.duckRider = !d.settings.duckRider; });
    ctx.sfx('ui.move');
    ctx.toast(save.data.settings.duckRider ? '小黄鸭乘客已上车：哔。' : '小黄鸭乘客已下车。', 'info');
  };
  const buy = async (id: BikeId): Promise<void> => {
    const b = BIKES[id];
    if (save.data.coins < b.price) {
      ctx.toast('小鱼干不够，再去赛道上撞几个吧。', 'warn');
      return;
    }
    const joke = isJoke(id) ? '（整活向，比赛不一定更快）' : '';
    const ok = await ctx.confirm(`购买 ${b.name}？`, `花费 ${b.price} 小鱼干${joke}。${deltaLine(id, save.data.bike)}${b.blurb}`, '买了', '再看看');
    if (!ok) return;
    save.update((d) => {
      d.coins -= b.price;
      if (!d.ownedBikes.includes(id)) d.ownedBikes.push(id);
      d.bike = id;
    });
    ctx.sfx('ui.coin');
    ctx.toast(`${b.name} 到手！已装备。`, 'meme');
  };
  const nav = ctx.nav(new Nav(entries.map((entry, i) => ({
    el: entry.el,
    confirm: () => {
      const id = entry.bike;
      if (!id) {
        toggleDuck();
        return;
      }
      const st = state(id);
      if (st === 'shop') void buy(id);
      else if (st === 'owned') {
        save.update((d) => (d.bike = id));
        ctx.toast(`换上了 ${BIKES[id].name}`, 'info');
      }
    },
    onFocus: () => {
      remember('garage', i);
      if (entry.bike) focus(entry.bike);
      else focusDuck();
    },
  })), { layout: 'vertical', start: recall('garage', Math.max(0, bikeIds.indexOf(save.data.bike))), sfx: ctx.sfx }));
  refreshRows();
  action.addEventListener('click', () => {
    if (!action.classList.contains('is-equipped')) nav.pointerActivate();
  });
  const offSave = save.onChange((d) => {
    coins.set(d.coins);
    refreshRows();
    const entry = entries[nav.index];
    if (entry?.bike) focus(entry.bike);
    else if (entry) focusDuck();
  });
  return {
    root: f.root,
    ready: artReady(art),
    update: (dt) => table.update(dt),
    onAction: (a) => {
      if (a === 'back') {
        ctx.sfx('ui.back');
        ctx.go('menu');
        return true;
      }
      return nav.handle(a === 'left' ? 'up' : a === 'right' ? 'down' : a);
    },
    dispose: () => {
      offSave();
      table.dispose();
    },
  };
};
