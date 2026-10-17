// createUi: the DOM overlay shell. Layers (HUD / screens / wipe / toasts), a router with latest-wins
// shard-wipe transitions, input routing (one consumed action per key press), audio unlock + music,
// and the 1920×1080 stage scale. Screens live in ./screens (one file each).
import './fonts';
import './p5';
import './screens/screens.css';
import type { Action } from '../core/input';
import type { AppContext, ScreenId, ScreenProps, Session, Ui } from '../core/contracts';
import { h, ShardWipe } from './p5';
import { openConfirm, type Modal } from './confirm';
import { isRaceView, musicFor, useWipe } from './flow-rules';
import { createLazyHud } from './lazy-hud';
import type { Nav } from './nav';
import { RaceTracker } from './race-tracker';
import type { ScreenCtx, ScreenInstance } from './screen';
import { SCREENS, errorScreen } from './screens/registry';
import { Toasts } from './toast';
import type { Hud } from './hud/contract';

/** Directional presses made during a transition are replayed on the new screen (type-ahead);
 * confirm/back during a transition are dropped so a double tap can never act on two screens. */
const BUFFERED = new Set<Action>(['up', 'down', 'left', 'right']);

interface Current {
  id: ScreenId;
  inst: ScreenInstance | null;
  navs: Nav[];
}

class UiShell implements Ui {
  private readonly root: HTMLDivElement;
  private readonly screens: HTMLDivElement;
  private readonly wipe: ShardWipe;
  private readonly toasts: Toasts;
  private readonly hud: Hud;
  private readonly tracker: RaceTracker;
  private cur: Current = { id: 'boot', inst: null, navs: [] };
  private target: ScreenId = 'boot';
  private token = 0;
  private mounting = false;
  private swallow = false;
  private queued: Action[] = [];
  private modal: Modal | null = null;
  private sess: Session | null = null;
  private musicId: string | null = null;
  private announced: ScreenId | null = null;
  private padMode = false;
  private unlocked = false;

  constructor(private readonly app: AppContext) {
    this.root = h('div', { class: 'br-ui' });
    const hudLayer = h('div', { class: 'br-layer br-hud-layer' });
    this.screens = h('div', { class: 'br-layer br-screens' });
    const wipeLayer = h('div', { class: 'br-layer br-wipe' });
    const toastLayer = h('div', { class: 'br-layer br-toasts' });
    this.root.append(hudLayer, this.screens, wipeLayer, toastLayer);
    app.uiRoot.append(this.root);
    this.wipe = new ShardWipe(wipeLayer);
    this.toasts = new Toasts(toastLayer);
    this.hud = createLazyHud(app, hudLayer);
    this.tracker = new RaceTracker(app);
    app.input.onAction((a) => this.onAction(a));
    this.screens.addEventListener('click', (e) => {
      const hint = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-action]') : null;
      const action = hint?.dataset.action;
      if (action === 'back' || action === 'confirm') this.onAction(action);
    });
    app.bus.on('flow:screen', ({ screen }) => (this.announced = screen));
    this.listenForGesture();
    const fit = (): void => this.fit();
    window.addEventListener('resize', fit);
    fit();
  }

  get screen(): ScreenId {
    return this.target;
  }

  /** True while a transition runs (tests wait for this to clear before the next key). */
  get busy(): boolean {
    return this.mounting || this.wipe.busy;
  }

  async show(id: ScreenId, props: ScreenProps = {}): Promise<void> {
    const token = ++this.token;
    const from = this.target;
    this.target = id;
    try {
      if (this.announced !== id) this.app.bus.emit('flow:screen', { screen: id });
      this.hud.setVisible(isRaceView(id));
      this.playMusic(musicFor(id, props, this.sess));
      const leaving = this.cur.inst;
      if (leaving?.leave && from !== id) {
        this.mounting = true;
        await leaving.leave();
        if (token !== this.token) return;
      }
      if (useWipe(from, id)) {
        this.mounting = true;
        await this.wipe.cover();
        if (token !== this.token) return;
      }
      this.mount(id, props, from);
      this.mounting = false;
      for (const a of this.queued.splice(0)) this.onAction(a);
      const inst = this.cur.inst;
      if (inst?.ready) await inst.ready;
      if (token !== this.token) return;
      await this.wipe.reveal();
      if (token !== this.token) return;
      inst?.entered?.();
    } catch (err) {
      console.error(`[ui] show(${id}) failed`, err);
      this.mounting = false;
    }
  }

  attach(session: Session | null): void {
    this.sess = session;
    this.hud.attach(session);
    this.tracker.attach(session);
  }

  update(dtReal: number): void {
    this.hud.update(dtReal);
    const pad = this.app.input.lastDevice === 'gamepad';
    if (pad !== this.padMode) {
      this.padMode = pad;
      this.root.classList.toggle('is-pad', pad);
    }
    const inst = this.cur.inst;
    if (!inst?.update) return;
    try {
      inst.update(dtReal);
    } catch (err) {
      console.error(`[ui] screen ${this.cur.id} update threw`, err);
      inst.update = undefined;
    }
  }

  toast(text: string, kind: 'info' | 'warn' | 'meme' = 'info'): void {
    this.toasts.show(text, kind);
  }

  // ------------------------------------------------------------------ mounting
  private mount(id: ScreenId, props: ScreenProps, from: ScreenId): void {
    this.unmount();
    this.cur = { id, inst: null, navs: [] };
    if (isRaceView(id)) return;
    const ctx = this.context(props, from);
    let inst: ScreenInstance;
    try {
      inst = SCREENS[id](ctx);
    } catch (err) {
      console.error(`[ui] screen ${id} failed to build`, err);
      inst = errorScreen(ctx, id);
    }
    this.cur.inst = inst;
    this.screens.append(inst.root);
  }

  private unmount(): void {
    const { inst, navs } = this.cur;
    this.modal = null;
    for (const n of navs) n.dispose();
    if (!inst) return;
    try {
      inst.dispose?.();
    } catch (err) {
      console.error(`[ui] screen ${this.cur.id} dispose threw`, err);
    }
    inst.root.remove();
  }

  private context(props: ScreenProps, from: ScreenId): ScreenCtx {
    const navs = (): Nav[] => this.cur.navs;
    return {
      app: this.app,
      props,
      from,
      session: () => this.sess,
      tracker: this.tracker,
      sfx: (id) => this.app.audio.sfx(id),
      go: (screen, p) => void this.show(screen, p),
      toast: (text, kind) => this.toast(text, kind),
      confirm: (title, text, yes = '确定', no = '取消') => {
        const host = this.cur.inst?.root ?? this.screens;
        const stage = host.querySelector<HTMLElement>('.br-stage') ?? host;
        const modal = openConfirm(stage, title, text, yes, no, (s) => this.app.audio.sfx(s));
        this.modal = modal;
        void modal.result.then(() => {
          if (this.modal === modal) this.modal = null;
        });
        return modal.result;
      },
      nav: (n) => {
        navs().push(n);
        return n;
      },
    };
  }

  // ------------------------------------------------------------------ input
  private onAction(raw: Action): void {
    const a = this.menuAction(raw);
    if (this.swallow) return;
    if (this.mounting) {
      if (BUFFERED.has(a) && this.queued.length < 4) this.queued.push(a);
      return;
    }
    let used = false;
    try {
      if (this.modal) used = this.modal.handle(a);
      else if (isRaceView(this.cur.id)) used = this.raceAction(a);
      else used = this.cur.inst?.onAction?.(a) ?? false;
    } catch (err) {
      // Input.press() iterates listeners without a guard: a throwing screen must not break the HUD/race.
      console.error(`[ui] action "${a}" on ${this.cur.id} threw`, err);
      used = true;
    }
    if (!used) return;
    // Escape = pause+back, Space = hop+confirm: only the first consumed action of a key press counts.
    this.swallow = true;
    queueMicrotask(() => (this.swallow = false));
  }

  /** Core PADMAP puts the d-pad's up/down on skill2/skill3 (racing): in menus they navigate. */
  private menuAction(a: Action): Action {
    if (this.app.input.lastDevice !== 'gamepad' || isRaceView(this.cur.id)) return a;
    return a === 'skill2' ? 'up' : a === 'skill3' ? 'down' : a;
  }

  /** Race view: Esc/Start pauses; with no session attached (e.g. ?screen=race) any of them leaves. */
  private raceAction(a: Action): boolean {
    const s = this.sess;
    if (!s) {
      if (a !== 'pause' && a !== 'back' && a !== 'confirm') return false;
      void this.show('menu');
      return true;
    }
    if (a !== 'pause' || s.phase === 'finished') return false;
    this.app.bus.emit('flow:pause', { paused: true });
    return true;
  }

  // ------------------------------------------------------------------ audio
  private playMusic(id: string | undefined): void {
    if (id === undefined || id === this.musicId) return;
    this.musicId = id;
    this.app.audio.music(id);
  }

  private listenForGesture(): void {
    const unlock = (): void => {
      if (this.unlocked) return;
      this.app.audio.unlock().then(() => {
        this.unlocked = true;
        window.removeEventListener('keydown', unlock, true);
        window.removeEventListener('pointerdown', unlock, true);
      }).catch((err: unknown) => console.warn('[ui] audio unlock failed, will retry on next input', err));
    };
    window.addEventListener('keydown', unlock, true);
    window.addEventListener('pointerdown', unlock, true);
  }

  private fit(): void {
    const w = this.app.uiRoot.clientWidth || window.innerWidth;
    const hgt = this.app.uiRoot.clientHeight || window.innerHeight;
    this.root.style.setProperty('--s', String(Math.min(w / 1920, hgt / 1080)));
  }
}

export function createUi(app: AppContext): Ui {
  return new UiShell(app);
}
