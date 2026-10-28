// lobby (SPEC §28): the room before the race — the room code, the members, the host's setup (track, weather,
// direction), 准备 / 换角色 / 开始比赛. Like the online screen it talks only to `ctx.app.net` and reads it fresh
// every time: the net unit may be swapped under the screen.
import './lobby.css';
import type { BikeId, CharacterId, TrackId, Weather } from '../../core/types';
import type { NetMember, NetRoom, NetSystem } from '../../core/contracts';
import type { RoomSetup } from '../../net/protocol';
import { TRACKS, TRACK_ORDER, TRACK_WEATHER } from '../../data/tracks';
import { ROSTER } from '../../data/roster';
import { validLoadout } from '../../data/loadouts';
import { Nav } from '../nav';
import { HINT_BACK, HINT_NAV, HINT_OK, backdrop, button, h, jagged, portrait, ransom } from '../p5';
import { frame, type ScreenFactory } from '../screen';
import { LOBBY, ONLINE, WEATHER_CN } from '../copy';

/** The setup a room starts with (the host's first pick). */
const DEFAULT_SETUP: RoomSetup = { trackId: 'coast', weather: null, reverse: false };

/** The bikes that fit every racer (the rest are a racer's own). */
const NEUTRAL_BIKES: readonly BikeId[] = ['roadbike', 'shared'];

/** Two setups are the same pick. */
function sameSetup(a: RoomSetup, b: RoomSetup): boolean {
  return a.trackId === b.trackId && a.weather === b.weather && a.reverse === b.reverse;
}

/** The bike a racer rides: its own, or a neutral one; anything else is the wrong bike for it. */
function suitableBike(c: CharacterId, saved: BikeId): BikeId {
  const def = ROSTER[c] ?? ROSTER.pelican;
  if (saved === def.defaultBike || NEUTRAL_BIKES.includes(saved)) return saved;
  return def.defaultBike;
}

/** A member's character as one the game knows (a relay may carry a stale id). */
function knownCharacter(id: string): CharacterId {
  return (id in ROSTER ? id : 'pelican') as CharacterId;
}

export const lobbyScreen: ScreenFactory = (ctx) => {
  const bg = backdrop({ tone: 'split', seed: 'lobby', star: { x: '80%', y: '24%', size: 1400, color: '#ff1e3c', spin: 70 } });
  const f = frame({ id: 'lobby', bg, title: LOBBY.title, hints: [HINT_NAV, HINT_OK, HINT_BACK] });

  // ---- the room code, big and plain
  const codeBox = h('div', { class: 'br-lb-code', data: { netCode: '1' } });
  const codeNote = h('div', { class: 'br-lb-share', text: LOBBY.share });

  // ---- the members
  const memberList = h('div', { class: 'br-lb-members' });
  const memberTitle = h('div', { class: 'br-lb-mtitle', text: LOBBY.members });

  // ---- the host's setup
  const trackBox = h('div', { class: 'br-lb-track', data: { netTrack: '1' } });
  const prevBtn = h('div', { class: 'br-lb-ctl', data: { netTrackPrev: '1' }, attrs: { role: 'button', 'aria-label': '上一条赛道' }, text: '◀' });
  const nextBtn = h('div', { class: 'br-lb-ctl', data: { netTrackNext: '1' }, attrs: { role: 'button', 'aria-label': '下一条赛道' }, text: '▶' });
  const weatherBtn = h('div', { class: 'br-lb-ctl is-wide', data: { netWeather: '1' }, attrs: { role: 'button', 'aria-label': LOBBY.weather }, text: LOBBY.weather });
  const reverseBtn = h('div', { class: 'br-lb-ctl is-wide', data: { netReverse: '1' }, attrs: { role: 'button', 'aria-label': LOBBY.reverse }, text: LOBBY.reverse });
  const setupPanel = h('div', { class: 'br-lb-setup br-panel is-black', vars: { '--clip': jagged('lb-setup', { jx: 2, jy: 6, notches: 2 }) } },
    h('div', { class: 'br-lb-stitle' }, h('span', { text: LOBBY.title.cn }), h('b', { text: LOBBY.track })),
    trackBox,
    h('div', { class: 'br-lb-ctls' }, prevBtn, nextBtn, weatherBtn, reverseBtn),
    h('div', { class: 'br-lb-snote', text: '← → 换赛道；房主说了算。' }));

  // ---- the three actions
  const readyBtn = button(LOBBY.readyBtn, { sub: 'READY', seed: 'lb-ready' });
  readyBtn.dataset.netReady = '1';
  const readyLabel = readyBtn.querySelector<HTMLElement>('.br-btn-label');
  const changeBtn = button(LOBBY.change, { sub: 'PICK', seed: 'lb-change' });
  changeBtn.dataset.netChange = '1';
  const startBtn = button(LOBBY.start, { sub: 'START', seed: 'lb-start' });
  startBtn.dataset.netStart = '1';
  const actionRow = h('div', { class: 'br-lb-actions' }, readyBtn, changeBtn, startBtn);

  f.stage.append(
    h('div', { class: 'br-lb-left' }, codeBox, codeNote, memberTitle, memberList),
    setupPanel,
    actionRow,
  );

  // ---- the net system: read fresh, subscribe again when it is swapped
  const net = (): NetSystem => ctx.app.net;
  let bound: NetSystem | null = null;
  let offNet: (() => void) | null = null;
  let setup: RoomSetup = { ...DEFAULT_SETUP };
  /** The setup the local host just sent (the relay's echo is a moment away). */
  let pending: RoomSetup | null = null;
  let leaving = false;
  let entered = false;
  let asking = false;

  /** The racer and the kit this player rides (sent when the lobby opens and after every change). */
  const sendPick = (): void => {
    const save = ctx.app.save;
    const c = save.data.character;
    const bike = suitableBike(c, save.data.bike);
    const loadout = validLoadout(save.data.loadouts[c], c);
    net().pick({ character: c, bike, loadout });
  };

  const room = (): NetRoom | null => net().room;
  /** The local player hosts the room (the host may change the setup and start). */
  const isHost = (): boolean => { const r = room(); return !!r && r.host === r.you; };
  /** The local member's row. */
  const myMember = (): NetMember | undefined => { const r = room(); return r?.members.find((m) => m.id === r.you); };
  /** Everybody in the room is ready. */
  const allReady = (): boolean => { const r = room(); return !!r && r.members.length > 0 && r.members.every((m) => m.ready); };
  /** The race may start: the host's call, and everybody is ready. */
  const canStart = (): boolean => isHost() && allReady();

  /** The room code, big. */
  const paintCode = (code: string): void => {
    codeBox.replaceChildren(
      h('span', { class: 'br-lb-codelabel', text: LOBBY.codeLabel }),
      ransom(code, { seed: `lb-${code}`, fonts: 'block', styles: ['wr', 'bw', 'wb'], first: 'wr', className: 'br-lb-rn' }),
    );
  };

  /** One row per member: portrait, name, the racer they ride, the badges. */
  const paintMembers = (r: NetRoom): void => {
    memberList.replaceChildren(...r.members.map((m) => {
      const cid = knownCharacter(m.character);
      const def = ROSTER[cid];
      const badges: HTMLElement[] = [];
      if (m.id === r.you) badges.push(h('span', { class: 'br-lb-badge is-you', text: LOBBY.you }));
      if (m.id === r.host) badges.push(h('span', { class: 'br-lb-badge is-host', text: LOBBY.host }));
      if (m.ready) badges.push(h('span', { class: 'br-lb-badge is-ready', text: LOBBY.ready }));
      return h('div', { class: 'br-lb-member', data: { netMember: String(m.id) } },
        h('div', { class: 'br-lb-pic' }, portrait(cid, { mood: 'main' })),
        h('div', { class: 'br-lb-who' },
          h('b', { class: 'br-lb-name', text: m.name || ONLINE.defaultName }),
          h('span', { class: 'br-lb-char', text: def.name })),
        h('div', { class: 'br-lb-badges' }, ...badges));
    }));
  };

  /** The setup the host picked: the track, its weather and the direction. */
  const paintSetup = (): void => {
    const track = TRACKS[setup.trackId as TrackId] ?? TRACKS.coast;
    const weather = setup.weather ? (WEATHER_CN[setup.weather as Weather] ?? setup.weather) : '原图';
    const direction = setup.reverse ? LOBBY.backward : LOBBY.forward;
    trackBox.replaceChildren(
      h('b', { class: 'br-lb-tname', text: track.name }),
      h('span', { class: 'br-lb-sep', text: '·' }),
      h('span', { text: weather }),
      h('span', { class: 'br-lb-sep', text: '·' }),
      h('span', { text: direction }));
    weatherBtn.textContent = `${LOBBY.weather} ${weather}`;
    reverseBtn.textContent = `${LOBBY.reverse} ${direction}`;
    const host = isHost();
    for (const el of [prevBtn, nextBtn, weatherBtn, reverseBtn]) el.classList.toggle('is-disabled', !host);
  };

  /** The three actions: ready, change racer, start. */
  const paintActions = (): void => {
    const ready = !!myMember()?.ready;
    readyLabel?.replaceChildren(document.createTextNode(ready ? LOBBY.cancelReady : LOBBY.readyBtn));
    readyBtn.classList.toggle('is-on', ready);
    startBtn.classList.toggle('is-disabled', !canStart());
  };

  /** Any change of the net system (the room, its members, the setup). */
  const onNet = (): void => {
    const r = room();
    if (!r) {
      if (entered && !leaving) {
        ctx.toast(LOBBY.gone, 'warn');
        ctx.go('online');
      }
      return;
    }
    // The host's own pick shows at once; the relay's echo replaces it a moment later.
    if (!r.setup) setup = { ...DEFAULT_SETUP };
    else if (!pending) setup = r.setup;
    else if (sameSetup(r.setup, pending)) { setup = r.setup; pending = null; }
    paintCode(r.code);
    paintMembers(r);
    paintSetup();
    paintActions();
  };

  /** (Re)subscribe when the net object changes under the screen. */
  const bind = (): void => {
    const n = net();
    if (n === bound) return;
    offNet?.();
    bound = n;
    offNet = n.onChange(onNet);
    onNet();
    sendPick();
  };

  // ---- the host's setup
  /** Send a new setup (host only). */
  const sendSetup = (s: RoomSetup): void => {
    if (!isHost()) return;
    setup = s;
    pending = s;
    paintSetup();
    net().setup(s);
  };

  /** Another track (the weather follows the new track). */
  const changeTrack = (dir: number): void => {
    const i = TRACK_ORDER.indexOf(setup.trackId as TrackId);
    const next = TRACK_ORDER[(i + dir + TRACK_ORDER.length) % TRACK_ORDER.length] ?? DEFAULT_SETUP.trackId;
    sendSetup({ ...setup, trackId: next, weather: null });
  };

  /** The next weather of this track (null = the track's own). */
  const changeWeather = (): void => {
    const opts: Array<string | null> = [null, ...(TRACK_WEATHER[setup.trackId as TrackId] ?? [])];
    const i = Math.max(0, opts.indexOf(setup.weather));
    sendSetup({ ...setup, weather: opts[(i + 1) % opts.length] ?? null });
  };

  /** Forward or backward. */
  const toggleReverse = (): void => sendSetup({ ...setup, reverse: !setup.reverse });

  // ---- the actions
  /** 准备: this player is ready (or not yet). */
  const toggleReady = (): void => {
    const me = myMember();
    if (!me) return;
    net().ready(!me.ready);
  };

  /** Esc: ask before the room is left. */
  const askLeave = async (): Promise<void> => {
    if (asking) return;
    asking = true;
    const asked = ctx.confirm(LOBBY.leave.ask, LOBBY.leave.text, LOBBY.leave.yes, LOBBY.leave.no);
    // The confirm opens on the safe answer; move the focus to 「离开」 so Enter leaves the room.
    ctx.app.input.press('left');
    const ok = await asked;
    asking = false;
    if (!ok) return;
    leaving = true;
    net().leave();
    ctx.go('menu');
  };

  // ---- the controls
  prevBtn.addEventListener('click', () => changeTrack(-1));
  nextBtn.addEventListener('click', () => changeTrack(1));
  weatherBtn.addEventListener('click', () => changeWeather());
  reverseBtn.addEventListener('click', () => toggleReverse());

  const nav = ctx.nav(new Nav([
    { el: trackBox, confirm: () => changeWeather() },
    { el: readyBtn, confirm: () => toggleReady() },
    { el: changeBtn, confirm: () => ctx.go('roster') },
    {
      el: startBtn,
      confirm: () => { if (canStart()) net().start(); },
      disabled: () => !canStart(),
      onDenied: () => ctx.toast(isHost() ? LOBBY.waitOthers : LOBBY.waitHost, 'warn'),
    },
  ], { layout: 'vertical', sfx: ctx.sfx }));

  bind();
  entered = true;

  return {
    root: f.root,
    update: () => bind(),
    onAction: (a) => {
      if (a === 'back' || a === 'pause') {
        ctx.sfx('ui.back');
        void askLeave();
        return true;
      }
      // ← → change the track (the host's call).
      if (a === 'left' || a === 'right') {
        if (isHost()) changeTrack(a === 'left' ? -1 : 1);
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
