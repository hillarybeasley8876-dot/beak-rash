// STUB kept by core for isolation tests (?stub=...) and as load fallback. The ui unit owns index.ts: plain DOM screens and a text HUD, enough to play a race.
// Contract: createUi(app) → Ui (core/contracts.ts).
import './fonts';
import { createHud } from './hud/stub';
import type { AppContext, ScreenId, ScreenProps, Session, Ui } from '../core/contracts';

export function createUi(app: AppContext): Ui {
  const root = app.uiRoot;
  root.style.fontFamily = '"ZCOOL KuaiLe", "PingFang SC", sans-serif';
  root.style.color = '#fff';
  const panel = document.createElement('div');
  panel.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;text-shadow:3px 3px 0 #e5191c;font-size:28px';
  const hudLayer = document.createElement('div');
  hudLayer.style.cssText = 'position:absolute;inset:0';
  root.append(hudLayer, panel);
  const hud = createHud(app, hudLayer);
  let screen: ScreenId = 'boot';
  app.input.onAction((a) => {
    if (screen === 'title' && a === 'confirm') void ui.show('menu');
    else if (screen === 'menu' && a === 'confirm') app.bus.emit('flow:startRace', { config: {} });
    else if (screen === 'race' && a === 'pause') app.bus.emit('flow:pause', { paused: true });
    else if (screen === 'pause' && a === 'pause') app.bus.emit('flow:pause', { paused: false });
    else if (screen === 'pause' && a === 'back') app.bus.emit('flow:quitRace', {});
    else if (screen === 'results' && a === 'confirm') app.bus.emit('flow:quitRace', {});
  });

  const render = (s: ScreenId, props?: ScreenProps): void => {
    const lines: Record<ScreenId, string> = {
      boot: '', title: '<b style="font-size:72px">暴力鹈鹕 BEAK RASH</b><div>按 Enter 开始</div>',
      menu: '<div>▶ 快速比赛（Enter）</div>', career: '巡回赛', garage: '车库', trackSelect: '选择赛道',
      intro: '', loading: '加载中……', race: '', pause: '暂停 — Esc 继续 / Backspace 退出',
      results: '<b>RESULTS</b>' + (props?.results ?? []).map((r) => `<div>${r.place}. ${r.name}${r.isPlayer ? '（你）' : ''}</div>`).join('') + '<div>Enter 返回</div>',
      settings: '设置', howto: '操作说明', credits: '致谢', roster: '选择角色', records: '成就',
      online: '联机', lobby: '房间',
    };
    panel.innerHTML = lines[s] + (props?.message ? `<div>${props.message}</div>` : '');
  };

  const ui: Ui = {
    get screen() {
      return screen;
    },
    async show(s, props) {
      screen = s;
      hud.setVisible(s === 'race');
      render(s, props);
    },
    attach(sess: Session | null) {
      hud.attach(sess);
    },
    update(dtReal: number) {
      hud.update(dtReal);
    },
    toast(text) {
      console.info('[toast]', text);
    },
  };
  return ui;
}
