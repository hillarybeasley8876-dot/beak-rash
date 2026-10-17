// Fonts used by canvas-drawn signs and road paint (bundled @fontsource, unicode-range slices).
// ensureFonts() waits (bounded) until the glyphs for the given texts are loaded, so canvases drawn
// right after never fall back to a system font.
import '@fontsource/anton/400.css';
import '@fontsource/noto-sans-sc/900.css';
import '@fontsource/zcool-qingke-huangyou/400.css';
import '@fontsource/zcool-kuaile/400.css';

export const FONT = {
  en: '"Anton", "Bebas Neue", sans-serif',
  cn: '"ZCOOL QingKe HuangYou", "Noto Sans SC", sans-serif',
  cnFun: '"ZCOOL KuaiLe", "Noto Sans SC", sans-serif',
  heavy: '"Noto Sans SC", sans-serif',
} as const;

export async function ensureFonts(texts: string[], timeoutMs = 2500): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  const sample = Array.from(new Set(texts.join(''))).join('');
  const loads = [
    document.fonts.load(`400 64px "Anton"`, 'STARTFINISH0123456789'),
    document.fonts.load(`400 64px "ZCOOL QingKe HuangYou"`, sample),
    document.fonts.load(`400 64px "ZCOOL KuaiLe"`, sample),
    document.fonts.load(`900 64px "Noto Sans SC"`, sample),
  ];
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<'timeout'>((resolve) => { timer = setTimeout(() => resolve('timeout'), timeoutMs); });
  try {
    const res = await Promise.race([Promise.all(loads), timeout]);
    if (res === 'timeout') console.warn('[track] fonts still loading after', timeoutMs, 'ms; signs may use fallback glyphs');
  } catch (err) {
    console.warn('[track] font load failed; signs use fallback glyphs', err);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
