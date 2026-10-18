// createUi: the DOM overlay shell. Layers (HUD / screens / wipe / toasts), a router with latest-wins
// shard-wipe transitions, input routing (one consumed action per key press; confirm/back wait until the
// new screen is revealed), audio unlock + music, and the 1920×1080 stage scale. Screens: ./screens.
import './fonts';
import './p5';
import './screens/screens.css';
import './shell.css';
import type { Action } from '../core/input';
import type { AppContext, ScreenId, ScreenProps, Session, Ui } from '../core/contracts';
import { h, ShardWipe } from './p5';
import { AudioUnlock } from './audio-unlock';
import { AutoPause, type PauseReason } from './auto-pause';
import { openConfirm, type Modal } from './confirm';
import { isRaceView, musicFor, useWipe } from './flow-rules';
import { KeyRepeat } from './key-repeat';
import { createLazyHud } from './lazy-hud';
import type { Nav } from './nav';
import { PadMenu } from './pad-menu';
import { RaceTracker } from './race-tracker';
import type { ScreenCtx, ScreenInstance } from './screen';
import { SCREENS, errorScreen } from './screens/registry';
import { Toasts } from './toast';
import type { Hud } from './hud/contract';

/** Directional presses made while a screen leaves are replayed on the new one (type-ahead); confirm /
 * back are dropped until the new screen is fully revealed, so a double tap never acts on two screens. */
const BUFFERED = new Set<Action>(['up', 'down', 'left', 'right']);
const SOUND_HINT_SCREENS = new Set<ScreenId>(['title', 'menu']);

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
  private readonly sound: AudioUnlock;
  private readonly pad: PadMenu;
  private cur: Current = { id: 'boot', inst: null, navs: [] };
  private target: ScreenId = 'boot';
  private token = 0;
  private inFlight: Promise<void> | null = null;
  /** The old screen is on its way out: directions are buffered, everything else dropped. */
  private mounting = false;
  /** The new screen is mounted but still under the wipe: confirm / back / clicks are dropped. */
  private settling = false;
  private swallow = false;
  private queued: Action[] = [];
  private modal: Modal | null = null;
  private sess: Session | null = null;
  private musicId: string | null = null;
  private announced: ScreenId | null = null;
  private padMode = false;
  /** A KO cinematic runs (cine:ko start … end): in-race toasts go quiet with the HUD. */
  private cine = false;
  private soundHint = false;
  /** Start of the latest key / pad press (the twin actions of one press share it). */
  private lastPressAt = -Infinity;
  private pressOpen = false;

  constructor(private readonly app: AppContext) {
    this.root = h('div', { class: 'br-ui' });
    const hudLayer = h('div', { class: 'br-layer br-hud-layer' });
    this.screens = h('div', { class: 'br-layer br-screens' });
    const wipeLayer = h('div', { class: 'br-layer br-wipe' });
    const toastLayer = h('div', { class: 'br-layer br-toasts' });
    this.sound = new AudioUnlock(() => app.audio);
    this.root.append(hudLayer, this.screens, wipeLayer, toastLayer, this.sound.chip);
    app.uiRoot.append(this.root);
    this.wipe = new ShardWipe(wipeLayer, () => app.audio.sfx('ui.slash', { volume: 0.5 }));
    this.toasts = new Toasts(toastLayer);
    this.hud = createLazyHud(app, hudLayer);
    this.tracker = new RaceTracker(app);
    this.pad = new PadMenu((a) => this.onAction(a));
    new KeyRepeat((a) => this.onAction(a), () => !isRaceView(this.cur.id) && !this.busy && this.modal === null);
    new AutoPause((why) => this.autoPause(why));
    app.input.onAction((a) => this.onAction(a));
    this.screens.addEventListener('click', (e) => {
      const hint = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-action]') : null;
      const action = hint?.dataset.action;
      if (action === 'back' || action === 'confirm') this.onAction(action);
    });
    app.bus.on('flow:screen', ({ screen }) => (this.announced = screen));
    app.bus.on('cine:ko', ({ phase }) => (this.cine = phase !== 'end'));
    const fit = (): void => this.fit();
    window.addEventListener('resize', fit);
    fit();
  }

  get screen(): ScreenId {
    return this.target;
  }

  /** True while a transition runs (tests wait for this to clear before the next key). */
  get busy(): boolean {
    return this.mounting || this.settling || this.wipe.busy;
  }

  show(id: ScreenId, props: ScreenProps = {}): Promise<void> {
    // A second request for the screen already on its way (double click, repeated event) joins it.
    if (id === this.target && this.inFlight) return this.inFlight;
    const run = this.transition(id, props);
    this.inFlight = run;
    void run.finally(() => {
      if (this.inFlight === run) this.inFlight = null;
    });
    return run;
  }

  attach(session: Session | null): void {
    this.sess = session;
    this.cine = false;
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
    const hint = pad && !this.sound.unlocked && SOUND_HINT_SCREENS.has(this.target);
    if (hint !== this.soundHint) {
      this.soundHint = hint;
      this.root.classList.toggle('needs-sound', hint);
    }
    if (!isRaceView(this.cur.id)) this.pad.update(dtReal);
    this.toasts.setQuiet(this.cine && isRaceView(this.cur.id));
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

  // ------------------------------------------------------------------ transitions
  private async transition(id: ScreenId, props: ScreenProps): Promise<void> {
    const token = ++this.token;
    const from = this.target;
    this.target = id;
    this.mounting = true;
    this.settling = false;
    try {
      if (this.announced !== id) this.app.bus.emit('flow:screen', { screen: id });
      this.hud.setVisible(isRaceView(id));
      this.playMusic(musicFor(id, props, this.sess));
      const leaving = this.cur.inst;
      if (leaving?.leave && from !== id) {
        await leaving.leave();
        if (token !== this.token) return;
      }
      if (useWipe(from, id)) {
        await this.wipe.cover();
        if (token !== this.token) return;
      }
      this.mount(id, props, from);
      this.mounting = false;
      this.settling = true;
      for (const a of this.queued.splice(0)) this.onAction(a);
      const inst = this.cur.inst;
      if (inst?.ready) await inst.ready;
      if (token !== this.token) return;
      await this.wipe.reveal();
      if (token !== this.token) return;
      this.settling = false;
      inst?.entered?.();
    } catch (err) {
      console.error(`[ui] show(${id}) failed`, err);
      if (token === this.token) this.mounting = this.settling = false;
    }
  }

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

  /** Mouse activation is allowed only on a settled screen with no modal on top. */
  private acceptsPointer(): boolean {
    return !this.mounting && !this.settling && this.modal === null;
  }

  private context(props: ScreenProps, from: ScreenId): ScreenCtx {
    return {
      app: this.app,
      props,
      from,
      session: () => this.sess,
      tracker: this.tracker,
      sfx: (id) => this.app.audio.sfx(id),
      go: (screen, p) => void this.show(screen, p),
      toast: (text, kind) => this.toast(text, kind),
      confirm: (title, text, yes = '确定', no = '取消') => this.openModal(title, text, yes, no),
      sincePress: () => performance.now() - this.lastPressAt,
      nav: (n) => {
        n.gate = () => this.acceptsPointer();
        this.cur.navs.push(n);
        return n;
      },
    };
  }

  private openModal(title: string, text: string, yes: string, no: string): Promise<boolean> {
    const host = this.cur.inst?.root ?? this.screens;
    const stage = host.querySelector<HTMLElement>('.br-stage') ?? host;
    const modal = openConfirm(stage, title, text, yes, no, (s) => this.app.audio.sfx(s));
    this.modal = modal;
    void modal.result.then(() => {
      if (this.modal === modal) this.modal = null;
    });
    return modal.result;
  }

  // ------------------------------------------------------------------ input
  private onAction(raw: Action): void {
    const a = this.menuAction(raw);
    this.notePress();
    if (this.swallow) return;
    const pad = this.app.input.lastDevice === 'gamepad';
    if (pad && !this.sound.unlocked) this.sound.attempt();
    if (pad && !isRaceView(this.cur.id) && this.pad.fromTrigger(a)) return;
    if (this.mounting) {
      if (BUFFERED.has(a) && this.queued.length < 4) this.queued.push(a);
      return;
    }
    if (this.settling && !BUFFERED.has(a)) return;
    let used = false;
    try {
      if (this.modal) used = this.modal.handle(a);
      else if (isRaceView(this.cur.id)) used = this.raceAction(a);
      else used = this.cur.inst?.onAction?.(a) ?? false;
    } catch (err) {
      // A throwing screen is logged and counts as consumed, so the same key press cannot act twice.
      console.error(`[ui] action "${a}" on ${this.cur.id} threw`, err);
      used = true;
    }
    if (!used) return;
    // Escape = pause+back, Space = hop+confirm: only the first consumed action of a key press counts.
    this.swallow = true;
    queueMicrotask(() => (this.swallow = false));
  }

  /** One timestamp per key / pad press: core emits its actions (Space = hop + confirm) in one task. */
  private notePress(): void {
    if (this.pressOpen) return;
    this.pressOpen = true;
    this.lastPressAt = performance.now();
    queueMicrotask(() => (this.pressOpen = false));
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

  /** Focus loss / hidden tab / pad unplugged during a live race: pause like Esc would (not in attract mode). */
  private autoPause(why: PauseReason): void {
    const s = this.sess;
    if (!s || s.phase === 'finished' || s.config.autopilot || !isRaceView(this.cur.id) || this.busy) return;
    this.app.bus.emit('flow:pause', { paused: true });
    if (why === 'pad') this.toast('手柄断开了，已暂停', 'warn');
  }

  // ------------------------------------------------------------------ audio + layout
  private playMusic(id: string | undefined): void {
    if (id === undefined || id === this.musicId) return;
    this.musicId = id;
    this.app.audio.music(id);
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
