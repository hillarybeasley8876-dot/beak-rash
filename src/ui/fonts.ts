// Bundled display fonts (offline). The Latin faces ship whole. The five Chinese display faces are
// subset at build time to the characters the game draws (tools/fonts/subset.py → fonts-cjk.css): one
// file per @fontsource unicode-range slice that holds at least one of them, so the title and the menu
// fetch a few KB of glyphs instead of dozens of 60-110 KB slices (SPEC §26).
// Stacks live in p5/tokens.css (--f-*).
import '@fontsource/anton/400.css';
import '@fontsource/bebas-neue/400.css';
import '@fontsource/bangers/400.css';
import '@fontsource/black-ops-one/400.css';
import '@fontsource/rubik-mono-one/400.css';
import '@fontsource/permanent-marker/400.css';
import './fonts-cjk.css';

/** The five CJK families the generated subset owns (tools/fonts/subset.py FACES). */
const CJK_FAMILIES = new Set(['ZCOOL KuaiLe', 'ZCOOL QingKe HuangYou', 'Ma Shan Zheng', 'Zhi Mang Xing', 'Noto Sans SC']);
/** Only the generated faces live under this prefix, so it tells them from the @fontsource ones. */
const SUBSET_PREFIX = '/fonts/cjk/';

/**
 * Drop the @fontsource faces of the five CJK families from one stylesheet.
 *
 * src/world/fonts.ts and src/ui/hud/fonts.ts still `import '@fontsource/<face>/*.css'` for the same
 * families, and two things then defeat the subset: the browser picks the LAST face of a family that
 * covers a character (their chunk's CSS lands after the entry stylesheet), and
 * `document.fonts.load(family, text)` — which both units call to warm their canvas signs — downloads
 * EVERY face of the family covering the text, subset included. Without this a first visit fetches
 * 3.8 MB of fonts instead of 1.2 MB.
 *
 * Point those two files at './fonts-cjk.css' (status/r6/r6-fonts.md § Requests) and delete this.
 */
function dropSupersededFaces(sheet: CSSStyleSheet): void {
  let rules: CSSRuleList;
  try {
    rules = sheet.cssRules;
  } catch (err: unknown) {
    console.warn('[ui] stylesheet not readable, CJK subsets may be shadowed', err);
    return;
  }
  for (let i = rules.length - 1; i >= 0; i--) {
    const rule = rules[i];
    if (rule.type !== CSSRule.FONT_FACE_RULE) continue;
    const family = (rule as CSSFontFaceRule).style.fontFamily.replace(/["']/g, '');
    if (!CJK_FAMILIES.has(family) || rule.cssText.includes(SUBSET_PREFIX)) continue;
    sheet.deleteRule(i);
  }
}

/** Sweep every stylesheet in the document. */
function dropSupersededFacesEverywhere(): void {
  for (const sheet of document.styleSheets) if (sheet instanceof CSSStyleSheet) dropSupersededFaces(sheet);
}

if (typeof document !== 'undefined') {
  dropSupersededFacesEverywhere();
  // Vite injects a lazily loaded chunk's CSS into <head> at runtime: catch those too, as early as the
  // sheet is readable (its `load` fires before the chunk that asked for it is evaluated).
  new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node instanceof HTMLLinkElement && node.rel === 'stylesheet') node.addEventListener('load', dropSupersededFacesEverywhere);
        else if (node instanceof HTMLStyleElement) dropSupersededFacesEverywhere();
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
}
