// online (SPEC §28): the 联机 screen — a name, a room to create, a room to join. The screen talks only to
// `ctx.app.net` (the NetSystem contract) and never caches it: the net unit may be swapped under the screen
// (the acceptance installs a scripted fake), so every call reads `ctx.app.net` fresh.
import './online.css';
import type { NetSystem } from '../../core/contracts';
import { CODE_LENGTH, NAME_MAX, normaliseCode } from '../../net/protocol';
import { Nav } from '../nav';
import { HINT_BACK, HINT_NAV, HINT_OK, backdrop, button, h, jagged, ransom } from '../p5';
import { frame, type ScreenFactory } from '../screen';
import { ONLINE } from '../copy';

/** Where the player's name is remembered between visits. */
const NAME_KEY = 'beak-rash.net.name';

/** The stored name (empty when there is none). */
function loadName(): string {
  try {
    return (globalThis.localStorage?.getItem(NAME_KEY) ?? '').trim().slice(0, NAME_MAX);
  } catch (err) {
    console.warn('[ui] the stored name is unreadable', err);
    return '';
  }
}

/** Remember the name for the next visit. */
function saveName(name: string): void {
  try {
    globalThis.localStorage?.setItem(NAME_KEY, name);
  } catch (err) {
    console.warn('[ui] the name could not be stored', err);
  }
}

export const onlineScreen: ScreenFactory = (ctx) => {
  const bg = backdrop({ tone: 'black', seed: 'online', star: { x: '74%', y: '32%', size: 1500, color: '#191921', spin: 80 } });
  const f = frame({ id: 'online', bg, title: ONLINE.title, hints: [HINT_NAV, HINT_OK, HINT_BACK] });

  // ---- the two fields and the two buttons
  const nameInput = h('input', {
    class: 'br-on-input',
    data: { netName: '1' },
    attrs: { type: 'text', maxlength: String(NAME_MAX), placeholder: ONLINE.defaultName, 'aria-label': ONLINE.name, autocomplete: 'off', spellcheck: 'false' },
  });
  nameInput.value = loadName() || ONLINE.defaultName;
  const codeInput = h('input', {
    class: 'br-on-input is-code',
    data: { netCodeInput: '1' },
    attrs: { type: 'text', maxlength: String(CODE_LENGTH), placeholder: 'ABCD', 'aria-label': ONLINE.code, autocomplete: 'off', spellcheck: 'false' },
  });
  const createBtn = button(ONLINE.create, { sub: 'CREATE', seed: 'on-create' });
  createBtn.dataset.netCreate = '1';
  const joinBtn = button(ONLINE.join, { sub: 'JOIN', seed: 'on-join' });
  joinBtn.dataset.netJoin = '1';
  const message = h('div', { class: 'br-on-msg', data: { netMessage: '1' } });

  const nameRow = h('div', { class: 'br-on-row' }, h('span', { class: 'br-on-label', text: ONLINE.name }), nameInput);
  const codeRow = h('div', { class: 'br-on-row' }, h('span', { class: 'br-on-label', text: ONLINE.code }), codeInput);

  const card = h('div', { class: 'br-on-card br-panel is-black', vars: { '--clip': jagged('on-card', { jx: 2, jy: 8, notches: 2 }) } },
    nameRow,
    h('div', { class: 'br-on-hint', text: ONLINE.nameHint }),
    createBtn,
    h('div', { class: 'br-on-gap' }),
    codeRow,
    h('div', { class: 'br-on-hint', text: ONLINE.codeHint }),
    joinBtn);
  const side = h('div', { class: 'br-on-side' },
    h('div', { class: 'br-on-big' }, ransom('一起骑', { seed: 'on-big', fonts: 'block', first: 'wr' })),
    h('p', { class: 'br-on-note', text: '2–4 个朋友，一个房间号，一起开跑。剩下的车位 AI 来填。' }),
    h('p', { class: 'br-on-note is-dim', text: ONLINE.hint }));
  f.stage.append(card, message, side);

  // ---- the net system: read fresh, subscribe again when it is swapped
  const net = (): NetSystem => ctx.app.net;
  let bound: NetSystem | null = null;
  let offNet: (() => void) | null = null;
  let busy = false;

  /** The code is ready to be sent when it has CODE_LENGTH letters. */
  const codeOk = (): boolean => codeInput.value.trim().length === CODE_LENGTH;
  /** The code is a real room code (letters of the relay's alphabet). */
  const codeValid = (): boolean => normaliseCode(codeInput.value) !== null;

  /** Repaint everything that depends on the net system's state. */
  const paint = (): void => {
    const n = net();
    const ping = n.ping;
    const text = n.message
      ? (ping !== null ? `${n.message} · ${ping} ms` : n.message)
      : (ping !== null ? `已连上联机服务器 · ${ping} ms` : ONLINE.hint);
    if (message.textContent !== text) message.textContent = text;
    message.classList.toggle('is-warn', n.state === 'error');
    const ok = codeOk();
    joinBtn.classList.toggle('is-disabled', !ok);
    codeInput.classList.toggle('is-bad', ok && !codeValid());
  };

  /** The room appeared: the lobby takes over. */
  const toLobby = (): void => {
    if (ctx.app.ui.screen !== 'online') return;
    ctx.go('lobby');
  };

  /** Any change of the net system (state, message, ping, room). */
  const onNet = (): void => {
    paint();
    if (net().room) toLobby();
  };

  /** (Re)subscribe when the net object changes under the screen. */
  const bind = (): void => {
    const n = net();
    if (n === bound) return;
    offNet?.();
    bound = n;
    offNet = n.onChange(onNet);
    onNet();
  };

  /** Connect under the typed name; false when the relay is out of reach. */
  const connect = async (): Promise<boolean> => {
    const name = nameInput.value.trim().slice(0, NAME_MAX) || ONLINE.defaultName;
    nameInput.value = name;
    saveName(name);
    try {
      const ok = await net().connect(name);
      paint();
      return ok;
    } catch (err) {
      console.warn('[ui] the relay refused the connection', err);
      paint();
      return false;
    }
  };

  /** 创建房间: connect, then open a room. */
  const createRoom = async (): Promise<void> => {
    if (busy) return;
    busy = true;
    const ok = await connect();
    busy = false;
    if (!ok) return;
    net().createRoom();
  };

  /** 加入房间: connect, then join the typed room code. */
  const joinRoom = async (): Promise<void> => {
    if (busy) return;
    const code = normaliseCode(codeInput.value);
    if (!code) {
      message.textContent = `房间号不对：${CODE_LENGTH} 个字母，字母表里没有 I O 0 1 L。`;
      message.classList.add('is-warn');
      return;
    }
    busy = true;
    const ok = await connect();
    busy = false;
    if (!ok) return;
    net().joinRoom(code);
  };

  /** Esc: back to the menu (and out of the relay when we are in it). */
  const leave = (): void => {
    const n = net();
    if (n.room || n.state === 'online' || n.state === 'connecting') n.leave();
    ctx.go('menu');
  };

  // ---- typing in a field is text, not a menu action: the key never reaches the core input.
  const typeGuard = (e: KeyboardEvent): void => {
    if (e.ctrlKey || e.metaKey || e.altKey) { e.stopPropagation(); return; }  // Ctrl+A selects, it is not a menu action
    if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete') e.stopPropagation();
  };
  nameInput.addEventListener('keydown', typeGuard);
  codeInput.addEventListener('keydown', typeGuard);
  nameInput.addEventListener('blur', () => saveName(nameInput.value.trim().slice(0, NAME_MAX)));
  nameInput.addEventListener('input', paint);
  codeInput.addEventListener('input', () => {
    const up = codeInput.value.toUpperCase();
    if (up !== codeInput.value) codeInput.value = up;
    paint();
  });

  // ---- the four rows: the name, 创建房间, the code, 加入房间
  /** A button takes the keyboard back: the fields let go of the focus. */
  const blurFields = (): void => {
    if (document.activeElement === nameInput) nameInput.blur();
    if (document.activeElement === codeInput) codeInput.blur();
  };
  const nav = ctx.nav(new Nav([
    { el: nameRow, confirm: () => nameInput.focus(), onFocus: () => nameInput.focus() },
    { el: createBtn, confirm: () => void createRoom(), onFocus: blurFields },
    { el: codeRow, confirm: () => codeInput.focus(), onFocus: () => codeInput.focus() },
    { el: joinBtn, confirm: () => void joinRoom(), disabled: () => !codeOk(), onDenied: () => ctx.toast(`房间号是 ${CODE_LENGTH} 个字母`, 'warn'), onFocus: blurFields },
  ], { layout: 'vertical', sfx: ctx.sfx }));

  bind();
  return {
    root: f.root,
    update: () => bind(),
    onAction: (a) => {
      if (a === 'back' || a === 'pause') {
        ctx.sfx('ui.back');
        leave();
        return true;
      }
      return nav.handle(a);
    },
    dispose: () => {
      offNet?.();
      offNet = null;
    },
  };
};
