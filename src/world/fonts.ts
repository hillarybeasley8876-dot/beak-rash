// Fonts used by canvas-drawn signs and road paint. The Chinese faces come from the generated subset
// (src/ui/fonts-cjk.css, tools/fonts/subset.py) — the ONE source for those families, so a
// `document.fonts.load()` below never pulls a second @fontsource copy of the same face (SPEC §26).
// ensureFonts() waits (bounded) until the glyphs for the given texts are loaded, so canvases drawn
// right after never fall back to a system font; warmFonts() starts the download early (preload).
import '@fontsource/anton/400.css';
import '../ui/fonts-cjk.css';

export const FONT = {
  en: '"Anton", "Bebas Neue", sans-serif',
  cn: '"ZCOOL QingKe HuangYou", "Noto Sans SC", sans-serif',
  cnFun: '"ZCOOL KuaiLe", "Noto Sans SC", sans-serif',
  heavy: '"Noto Sans SC", sans-serif',
} as const;

/** Start loading the glyph slices for the given texts (no waiting; failures are logged). */
function loadFonts(texts: string[]): Promise<unknown> {
  const sample = Array.from(new Set(texts.join(''))).join('');
  return Promise.all([
    document.fonts.load(`400 64px "Anton"`, 'STARTFINISH0123456789'),
    document.fonts.load(`400 64px "ZCOOL QingKe HuangYou"`, sample),
    document.fonts.load(`400 64px "ZCOOL KuaiLe"`, sample),
    document.fonts.load(`900 64px "Noto Sans SC"`, sample),
  ]);
}

/** Warm the fonts for these texts in the background (world preload). */
export function warmFonts(texts: string[]): void {
  if (typeof document === 'undefined' || !document.fonts) return;
  loadFonts(texts).catch((err: unknown) => console.warn('[track] font warm-up failed', err));
}

/** Wait (bounded) until the glyphs for the given texts are loaded; false when they are not (yet). */
export async function ensureFonts(texts: string[], timeoutMs = 2500): Promise<boolean> {
  if (typeof document === 'undefined' || !document.fonts) return true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<'timeout'>((resolve) => { timer = setTimeout(() => resolve('timeout'), timeoutMs); });
  try {
    const res = await Promise.race([loadFonts(texts), timeout]);
    if (res !== 'timeout') return true;
    console.warn('[track] fonts still loading after', timeoutMs, 'ms; signs use fallback glyphs until they arrive');
    return false;
  } catch (err) {
    console.warn('[track] font load failed; signs use fallback glyphs', err);
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
