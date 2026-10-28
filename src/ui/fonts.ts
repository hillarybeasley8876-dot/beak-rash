// Bundled display fonts (offline). The Latin faces ship whole. The five Chinese display faces are
// subset at build time to the characters the game draws (tools/fonts/subset.py → fonts-cjk.css): one
// file per @fontsource unicode-range slice that holds at least one of them, so the title and the menu
// fetch a few KB of glyphs instead of dozens of 60-110 KB slices (SPEC §26).
// This generated stylesheet is the ONE source for those five families: src/world/fonts.ts (canvas signs
// and road paint) and src/ui/hud/fonts.ts (the HUD warm-up) import it too, so no module declares a second
// @fontsource copy of a family — the browser would then use whichever face covers a character last, and
// `document.fonts.load(family, text)` would download every face of the family covering the text.
// Stacks live in p5/tokens.css (--f-*).
import '@fontsource/anton/400.css';
import '@fontsource/bebas-neue/400.css';
import '@fontsource/bangers/400.css';
import '@fontsource/black-ops-one/400.css';
import '@fontsource/rubik-mono-one/400.css';
import '@fontsource/permanent-marker/400.css';
import './fonts-cjk.css';
