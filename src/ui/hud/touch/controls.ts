// Two-thumb touch controls (grounded HUD v1.9f). Every button goes through Input.press / hold / release.
// There is no second control path. The track centre stays empty.
//
//   left thumb     steer disc (TouchLeft / TouchRight) + AUTO-PEDAL
//   right thumb    2×2 skills (U I / O P) tight against a vertical stack:
//                  跳 hop, 漂移 drift, 攻击 (largest, bottom-right)
//                  tap attack → flap; hold ≥ 340 ms → heavy / throw
//   暂停           small stamp, not in either thumb cluster
import '../css/touch.css';
import type { AppContext, Session } from '../../../core/contracts';
import type { Action } from '../../../core/input';
import type { CharacterId } from '../../../core/types';
import { playerKit } from '../skills';
import { el, svg } from '../dom';
import {
  ATTACK_HOLD_MS, flapSide, touchPrimary, wantsTouchHud, steerAxis,
} from '../../touch-device';

const SKILL_ACTIONS = ['skill1', 'skill2', 'skill3'] as const;
const SKILL_KEYS = ['U', 'I', 'O'] as const;

interface AttackTouch { id: number; t0: number; heavy: boolean }

export class TouchControls {
  /** The bar is on screen (device, ?touch=1, or a real touch during the race). */
  shown = false;
  private enabled: boolean;
  private visible = false;
  private session: Session | null = null;
  private pedalDone = false;
  private steerId: number | null = null;
  private steerDir: -1 | 0 | 1 = 0;
  private driftId: number | null = null;
  private attack: AttackTouch | null = null;
  private readonly root: HTMLElement;
  private readonly pedalBtn: HTMLButtonElement;
  private readonly pedalMark: HTMLElement;
  private readonly steerBtn: HTMLButtonElement;
  private readonly attackBtn: HTMLButtonElement;
  private readonly attackCn: HTMLElement;
  private readonly attackSub: HTMLElement;
  private readonly skillHost: HTMLElement;
  private ultCost = 100;
  private pedalText = '';
  private readonly onProbe: (e: PointerEvent) => void;
  private readonly onBlur = (): void => this.releaseAll();
  private readonly onOrient: () => void;

  constructor(parent: HTMLElement, private readonly app: AppContext) {
    this.enabled = wantsTouchHud(app.params);
    this.root = el('div', 'brh-touch', parent);
    this.root.setAttribute('data-touch-hud', '');

    const pause = button('tch-hit tch-pause', '暂停', '暂停');
    pause.dataset.touch = 'pause';
    this.root.append(pause);
    bindTap(pause, () => this.tap('pause'));

    const left = el('div', 'tch-left', this.root);
    this.steerBtn = button('tch-hit tch-steer', '', '转向');
    this.steerBtn.dataset.touch = 'steer';
    this.steerBtn.append(steerGraphic(), el('span', 'tch-steer-label', undefined));
    const label = this.steerBtn.querySelector('.tch-steer-label') as HTMLElement;
    el('b', '', label, '转向');
    el('i', '', label, 'STEER');
    left.append(this.steerBtn);
    this.bindSteer();

    this.pedalBtn = button('tch-hit tch-pedal', '', '自动踩踏');
    this.pedalBtn.dataset.touch = 'pedal';
    el('span', '', this.pedalBtn, 'AUTO-PEDAL');
    this.pedalMark = el('b', '', this.pedalBtn, '关');
    left.append(this.pedalBtn);
    bindTap(this.pedalBtn, () => this.togglePedal());

    const right = el('div', 'tch-right', this.root);
    this.skillHost = el('div', 'tch-skills', right);
    const stack = el('div', 'tch-stack', right);

    const jump = round('tch-jump', '跳', 'JUMP', '跳跃');
    jump.dataset.touch = 'hop';
    stack.append(jump);
    bindTap(jump, () => this.tap('hop'));

    const drift = round('tch-drift', '漂移', 'DRIFT', '漂移');
    drift.dataset.touch = 'drift';
    stack.append(drift);
    this.bindDrift(drift);

    this.attackBtn = button('tch-hit tch-atk', '', '攻击。点按扇翅，长按重击或投掷');
    this.attackBtn.dataset.touch = 'attack';
    const face = el('span', 'tch-atk-cn', this.attackBtn);
    this.attackCn = el('b', '', face, '攻击');
    el('i', '', face, 'ATTACK');
    this.attackSub = el('small', '', face, '长按重击');
    el('span', 'tch-hold', this.attackBtn);
    stack.append(this.attackBtn);
    this.bindAttack();

    const rotate = el('div', 'tch-rotate', this.root);
    rotate.setAttribute('role', 'status');
    el('b', '', rotate, '横屏');
    el('span', '', rotate, '把手机横过来再骑');

    this.onProbe = (e: PointerEvent) => {
      if (e.pointerType !== 'touch' || app.params.get('touch') === '0') return;
      this.enabled = true;
      window.removeEventListener('pointerdown', this.onProbe, true);
      this.apply();
      if (this.session) this.primePedal();
    };
    if (app.params.get('touch') !== '0' && !this.enabled) {
      window.addEventListener('pointerdown', this.onProbe, true);
    }
    window.addEventListener('blur', this.onBlur);
    const orient = window.matchMedia?.('(orientation: portrait)');
    this.onOrient = () => { if (orient?.matches) this.releaseAll(); };
    orient?.addEventListener?.('change', this.onOrient);
    this.syncPedal();
    this.apply();
  }

  attach(session: Session | null): void {
    this.session = session;
    this.rebuildSkills(session?.player.character ?? null);
    if (session && this.enabled) this.primePedal();
  }

  setVisible(v: boolean): void {
    this.visible = v;
    if (!v) this.releaseAll();
    this.apply();
  }

  update(): void {
    this.syncPedal();
    this.syncAttackHold();
    this.syncSkills();
  }

  dispose(): void {
    this.releaseAll();
    window.removeEventListener('pointerdown', this.onProbe, true);
    window.removeEventListener('blur', this.onBlur);
    window.matchMedia?.('(orientation: portrait)')?.removeEventListener?.('change', this.onOrient);
    this.root.remove();
  }

  private apply(): void {
    this.shown = this.enabled && this.visible;
    this.root.classList.toggle('is-on', this.shown);
    // The layout shifts (speedo / cluster) live on the HUD root, even between races, once touch is wanted.
    this.root.parentElement?.classList.toggle('is-touch', this.enabled);
  }

  /** Phone has no W. Turn auto-pedal on once per page and write it through the normal save. */
  private primePedal(): void {
    if (this.pedalDone || !touchPrimary()) return;
    this.pedalDone = true;
    if (this.app.input.autoPedal) return;
    this.app.input.autoPedal = true;
    this.app.save.update((d) => { d.settings.autoPedal = true; });
    this.syncPedal();
  }

  private togglePedal(): void {
    this.pedalDone = true;
    const next = !this.app.input.autoPedal;
    this.app.input.autoPedal = next;
    this.app.save.update((d) => { d.settings.autoPedal = next; });
    this.syncPedal();
  }

  private syncPedal(): void {
    const on = this.app.input.autoPedal;
    const text = on ? '开' : '关';
    if (text === this.pedalText) return;
    this.pedalText = text;
    this.pedalMark.textContent = text;
    this.pedalBtn.classList.toggle('is-on', on);
    this.pedalBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  private tap(action: Action): void {
    this.app.input.lastDevice = 'keyboard';
    this.app.input.press(action);
  }

  private bindSteer(): void {
    const elBtn = this.steerBtn;
    const down = (e: PointerEvent): void => {
      if (!primary(e) || this.steerId !== null) return;
      e.preventDefault();
      capture(elBtn, e);
      this.steerId = e.pointerId;
      this.applySteer(e.clientX);
    };
    const move = (e: PointerEvent): void => {
      if (e.pointerId !== this.steerId) return;
      this.applySteer(e.clientX);
    };
    const up = (e: PointerEvent): void => {
      if (e.pointerId !== this.steerId) return;
      this.steerId = null;
      this.setSteer(0);
    };
    elBtn.addEventListener('pointerdown', down);
    elBtn.addEventListener('pointermove', move);
    elBtn.addEventListener('pointerup', up);
    elBtn.addEventListener('pointercancel', up);
    blockMenu(elBtn);
  }

  private applySteer(clientX: number): void {
    const rect = this.steerBtn.getBoundingClientRect();
    this.setSteer(steerAxis(clientX, rect));
  }

  private setSteer(dir: -1 | 0 | 1): void {
    if (dir === this.steerDir) return;
    this.steerDir = dir;
    if (dir < 0) this.app.input.hold('left');
    else this.app.input.release('left');
    if (dir > 0) this.app.input.hold('right');
    else this.app.input.release('right');
    this.steerBtn.classList.toggle('is-left', dir < 0);
    this.steerBtn.classList.toggle('is-right', dir > 0);
  }

  private bindDrift(btn: HTMLButtonElement): void {
    const down = (e: PointerEvent): void => {
      if (!primary(e) || this.driftId !== null) return;
      e.preventDefault();
      capture(btn, e);
      this.driftId = e.pointerId;
      btn.classList.add('is-down');
      this.app.input.hold('drift');
    };
    const up = (e: PointerEvent): void => {
      if (e.pointerId !== this.driftId) return;
      this.driftId = null;
      btn.classList.remove('is-down');
      this.app.input.release('drift');
    };
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    blockMenu(btn);
  }

  private bindAttack(): void {
    const btn = this.attackBtn;
    const down = (e: PointerEvent): void => {
      if (!primary(e) || this.attack) return;
      e.preventDefault();
      capture(btn, e);
      this.attack = { id: e.pointerId, t0: performance.now(), heavy: false };
      btn.classList.add('is-down');
      btn.style.setProperty('--hold', '0');
    };
    const up = (e: PointerEvent): void => {
      const a = this.attack;
      if (!a || e.pointerId !== a.id) return;
      if (e.type !== 'pointerup') this.finishAttack('cancel');
      else this.finishAttack(performance.now() - a.t0 >= ATTACK_HOLD_MS ? 'heavy' : 'flap');
    };
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    blockMenu(btn);
  }

  /** Called every HUD frame so a held finger becomes a heavy without waiting for pointerup. */
  private syncAttackHold(): void {
    const a = this.attack;
    if (!a) return;
    const held = performance.now() - a.t0;
    const k = Math.min(1, held / ATTACK_HOLD_MS);
    this.attackBtn.style.setProperty('--hold', k.toFixed(3));
    if (!a.heavy && held >= ATTACK_HOLD_MS) this.beginHeavy();
  }

  private beginHeavy(): void {
    const a = this.attack;
    if (!a || a.heavy) return;
    a.heavy = true;
    this.attackBtn.classList.add('is-heavy');
    this.attackCn.textContent = '重击';
    this.attackSub.textContent = '松手投掷';
    this.app.input.hold('heavy');
  }

  private finishAttack(kind: 'flap' | 'heavy' | 'cancel'): void {
    const a = this.attack;
    this.attack = null;
    this.attackBtn.classList.remove('is-down', 'is-heavy');
    this.attackBtn.style.setProperty('--hold', '0');
    this.attackCn.textContent = '攻击';
    this.attackSub.textContent = '长按重击';
    if (kind === 'cancel') {
      if (a?.heavy) this.app.input.release('heavy');
      return;
    }
    if (a?.heavy) {
      this.app.input.release('heavy');
      return;
    }
    if (kind === 'heavy') {
      // The frame loop hadn't crossed the threshold yet; still a heavy, released immediately (a swing).
      this.app.input.hold('heavy');
      this.app.input.release('heavy');
      return;
    }
    const session = this.session;
    const side = session ? flapSide(session.player, session.riders) : 'attackR';
    this.tap(side);
  }

  private rebuildSkills(character: CharacterId | null): void {
    this.skillHost.replaceChildren();
    if (!character) return;
    const kit = playerKit(character);
    kit.slots.forEach((skill, i) => {
      const action = SKILL_ACTIONS[i] ?? 'skill1';
      const wrap = el('div', 'tch-sk', this.skillHost);
      const btn = button('tch-hit tch-skill', '', skill ? `${skill.name}（${SKILL_KEYS[i] ?? ''}）` : '空技能');
      btn.dataset.touch = action;
      el('span', 'tch-sweep', btn);
      el('span', 'tch-g', btn, skill?.glyph ?? '·');
      wrap.append(btn);
      el('i', 'tch-key', wrap, SKILL_KEYS[i] ?? '');
      if (!skill) btn.disabled = true;
      else bindTap(btn, () => this.tap(action));
    });
    if (kit.ult) {
      this.ultCost = kit.ult.spCost > 0 ? kit.ult.spCost : 100;
      const wrap = el('div', 'tch-sk is-ult', this.skillHost);
      const btn = button('tch-hit tch-skill', '', `${kit.ult.name}（P）`);
      btn.dataset.touch = 'ult';
      const fill = el('span', 'tch-fill', btn);
      el('span', 'tch-g', btn, kit.ult.glyph);
      wrap.append(btn);
      el('i', 'tch-key', wrap, 'P');
      bindTap(btn, () => this.tap('ult'));
      fill.dataset.role = 'ult-fill';
    }
  }

  private syncSkills(): void {
    const r = this.session?.player;
    if (!r) return;
    const buttons = this.skillHost.querySelectorAll<HTMLButtonElement>('.tch-skill');
    buttons.forEach((btn, i) => {
      if (btn.dataset.touch === 'ult') {
        const fill = btn.querySelector<HTMLElement>('[data-role="ult-fill"]');
        const amount = Math.max(0, Math.min(1, r.sp / this.ultCost));
        fill?.style.setProperty('--fill', amount.toFixed(3));
        btn.classList.toggle('is-ready', amount >= 1 && r.ultTarget);
        return;
      }
      const cd = r.cooldowns[i] ?? 0;
      const prev = Number(btn.dataset.cd ?? '0');
      if (cd > prev + 0.05) btn.dataset.full = String(Math.max(cd, 0.1));
      btn.dataset.cd = String(cd);
      const full = Number(btn.dataset.full ?? '1') || 1;
      const sweep = btn.querySelector<HTMLElement>('.tch-sweep');
      const cooling = cd > 0;
      btn.classList.toggle('is-cd', cooling);
      btn.classList.toggle('is-ready', !cooling && !btn.disabled);
      sweep?.style.setProperty('--cd', cooling ? Math.min(1, cd / full).toFixed(3) : '0');
    });
  }

  private releaseAll(): void {
    this.steerId = null;
    this.driftId = null;
    this.steerDir = 0;
    this.app.input.release('left');
    this.app.input.release('right');
    this.steerBtn.classList.remove('is-left', 'is-right');
    this.app.input.release('drift');
    this.app.input.release('heavy');
    this.attack = null;
    this.attackBtn.classList.remove('is-down', 'is-heavy');
    this.attackBtn.style.setProperty('--hold', '0');
    this.attackCn.textContent = '攻击';
    this.attackSub.textContent = '长按重击';
    this.root.querySelectorAll('.is-down').forEach((n) => n.classList.remove('is-down'));
  }
}

function button(cls: string, text: string, label: string): HTMLButtonElement {
  const b = el('button', cls);
  b.type = 'button';
  if (text) b.textContent = text;
  b.setAttribute('aria-label', label);
  return b;
}

function round(cls: string, cn: string, en: string, label: string): HTMLButtonElement {
  const b = button(`tch-hit tch-round ${cls}`, '', label);
  el('b', '', b, cn);
  if (en) el('i', '', b, en);
  return b;
}

function bindTap(btn: HTMLButtonElement, fire: () => void): void {
  btn.addEventListener('pointerdown', (e) => {
    if (!primary(e)) return;
    e.preventDefault();
    capture(btn, e);
    btn.classList.add('is-down');
    const up = (ev: PointerEvent): void => {
      if (ev.pointerId !== e.pointerId) return;
      btn.removeEventListener('pointerup', up);
      btn.removeEventListener('pointercancel', up);
      btn.classList.remove('is-down');
      if (ev.type === 'pointerup') fire();
    };
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
  });
  blockMenu(btn);
}

function steerGraphic(): SVGSVGElement {
  const g = svg('svg', { viewBox: '0 0 140 140', class: 'tch-steer-svg' });
  g.setAttribute('aria-hidden', 'true');
  svg('circle', {
    cx: 70, cy: 70, r: 48, fill: '#ffffff', stroke: '#0b0b0f', 'stroke-width': 4,
    'stroke-dasharray': '7 6',
  }, g);
  bolt(g, 'tch-bolt tch-bolt-l', 'M22 24 L30 40 L22 40 L32 58 L16 38 L24 38 Z');
  bolt(g, 'tch-bolt tch-bolt-r', 'M118 24 L110 40 L118 40 L108 58 L124 38 L116 38 Z');
  bolt(g, 'tch-bolt tch-bolt-l', 'M22 116 L30 100 L22 100 L32 82 L16 102 L24 102 Z');
  bolt(g, 'tch-bolt tch-bolt-r', 'M118 116 L110 100 L118 100 L108 82 L124 102 L116 102 Z');
  return g;
}

function bolt(parent: SVGSVGElement, cls: string, d: string): void {
  const p = svg('path', { d, class: cls }, parent);
  p.setAttribute('class', cls);
}

function primary(e: PointerEvent): boolean {
  return e.button === 0 || e.pointerType === 'touch' || e.pointerType === 'pen';
}

function capture(el: HTMLElement, e: PointerEvent): void {
  try { el.setPointerCapture(e.pointerId); } catch { /* synthetic events have nothing to capture */ }
}

/** Long-press must not become the browser menu, which the input layer reads as Back. */
function blockMenu(el: HTMLElement): void {
  el.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
}
