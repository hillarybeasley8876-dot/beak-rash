// Track-event lines (SPEC §19): the banner copy for each event, the market-stall owner's shouts and the
// roadworks sign. The HUD banner and the audio stinger are wired later; the race event director only
// emits 'race:event' with the kind, so the copy lives here where the HUD can read it.
export type EventKind = 'fishSpill' | 'geese' | 'roadworks' | 'stalls';

export interface EventLine {
  /** Short banner label (P5 style, 2–5 字). */
  title: string;
  /** The warning the HUD shows while the event arms. */
  warn: string;
  /** A one-liner for the event card. */
  note: string;
}

/** Per-kind copy. 'stalls' has no warning: the market is just there (SPEC §19). */
export const EVENT_LINES: Record<EventKind, EventLine> = {
  fishSpill: {
    title: '鱼车侧翻',
    warn: '前方鱼车侧翻！',
    note: '一辆海鲜车横在路中间，地上全是鱼。',
  },
  geese: {
    title: '大鹅过马路',
    warn: '前方鹅群过马路！',
    note: '七只大鹅排成一列，摇摇摆摆。',
  },
  roadworks: {
    title: '施工改道',
    warn: '前方施工！',
    note: '施工围栏只留一条道，中间还要换边。',
  },
  stalls: {
    title: '水果摊',
    warn: '',
    note: '路边的水果摊，撞上去就没了。',
  },
};

/** The sign the roadworks crew stands next to. */
export const ROADWORKS_SIGN = '前方施工 请绕行';

/** The fruit-stall owner's shout when a rider smashes the stall (all of them name the watermelons). */
export const STALL_LINES: string[] = [
  '我的西瓜！',
  '我的西瓜啊！',
  '赔我西瓜！',
  '西瓜都摔碎了！',
  '谁撞的！我的西瓜！',
];

/** The fish-truck driver's line, shouted when the truck goes over (npc:say on the truck obstacle). */
export const FISH_TRUCK_LINES: string[] = [
  '我的鱼……全完了！',
  '刹车坏了！不是我的错！',
  '咸鱼干，撒一地了！',
];

/** The banner copy for a kind (empty when the event has no warning). */
export const eventWarn = (kind: EventKind): string => EVENT_LINES[kind].warn;
