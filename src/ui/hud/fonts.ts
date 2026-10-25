// Fonts the HUD uses (bundled @fontsource, offline) and a warm-up so the first cut-in never shows
// fallback glyphs: CJK families are split into unicode-range subsets that load only on first use.
import '@fontsource/anton/400.css';
import '@fontsource/bebas-neue/400.css';
import '@fontsource/bangers/400.css';
import '@fontsource/black-ops-one/400.css';
import '@fontsource/zcool-kuaile/400.css';
import '@fontsource/zcool-qingke-huangyou/400.css';
import '@fontsource/ma-shan-zheng/400.css';
import '@fontsource/noto-sans-sc/900.css';
import { ACHIEVEMENTS } from '../../data/achievements';
import { POLICE_LINES, ROSTER } from '../../data/roster';
import { SKILLS } from '../../data/skills';
import { R4_HUD } from '../../data/strings';
import { WEAPONS } from '../../data/weapons';
import { HINT_CN } from './hints';

const LATIN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!?/:.%+-×▲▼°−·';
const FIXED_CN = '名次时间击倒双杀三连完美落地漂移擦肩而过尾流最后冲刺被抓了罚款小鱼干翻车终点第一二三四五六七八名冷却中不足冲鹈鹕天降复活中警察出没前方注意' +
  '罚停靠边秒起步加速成就解锁咕嘟叮弹射超车被超了段四杀五杀超神你无目标还有个赛后看';

/** Every string under `obj` (nested objects included). */
function collectStrings(obj: unknown, out: string[] = []): string[] {
  if (typeof obj === 'string') out.push(obj);
  else if (Array.isArray(obj)) for (const v of obj) collectStrings(v, out);
  else if (obj && typeof obj === 'object') for (const v of Object.values(obj)) collectStrings(v, out);
  return out;
}

function hudCnText(): string {
  const parts = [FIXED_CN, HINT_CN, '跳过'];
  // The r4 HUD copy (SPEC §14–§19): police, tricks, STYLE, weapons, rivals, track events.
  parts.push(...collectStrings(R4_HUD));
  // Bubbles show every roster line race / combat may shout: idle taunts, KO / hurt lines, skill shouts, and
  // the police corgi's chase lines (npc:say).
  for (const def of Object.values(ROSTER)) {
    parts.push(def.name, def.title, def.tagline, ...def.taunts, ...def.koLines, ...def.hurtLines, ...def.skillLines);
  }
  parts.push(...Object.values(POLICE_LINES).flat());
  for (const a of ACHIEVEMENTS) parts.push(a.name, a.desc, a.icon);
  for (const s of Object.values(SKILLS)) parts.push(s.name, s.glyph);
  for (const wpn of Object.values(WEAPONS)) parts.push(wpn.name);
  return Array.from(new Set(Array.from(parts.join('')))).join('');
}

/** Ask the browser to fetch every subset the HUD will need. Failures only cost a fallback font. */
export function preloadHudFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return Promise.resolve();
  const cn = hudCnText();
  const loads = [
    document.fonts.load('400 40px "Anton"', LATIN),
    document.fonts.load('400 40px "Bebas Neue"', LATIN),
    document.fonts.load('400 40px "Bangers"', LATIN),
    document.fonts.load('400 40px "Black Ops One"', LATIN),
    document.fonts.load('400 40px "ZCOOL QingKe HuangYou"', cn),
    document.fonts.load('400 40px "ZCOOL KuaiLe"', cn),
    document.fonts.load('400 40px "Ma Shan Zheng"', cn),
    document.fonts.load('900 40px "Noto Sans SC"', cn),
  ];
  return Promise.all(loads).then(
    () => undefined,
    (err: unknown) => console.warn('[ui-hud] font preload failed (fallback fonts in use)', err),
  );
}
