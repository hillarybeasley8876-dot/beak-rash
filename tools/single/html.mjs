// Assembly step of the single-file build: takes Vite's index.html and replaces the external
// stylesheet and module script with inline copies, adds the asset shim (a classic script, so it
// runs before the deferred module) and the embedded asset blocks. Refuses to write a page that
// still points at another file.
import { BLOCK_TYPE } from './assets.mjs';

const MODULE_TAG = /<script\b[^>]*\btype="module"[^>]*\bsrc="([^"]+)"[^>]*>\s*<\/script>\s*/g;
const STYLE_TAG = /<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"[^>]*>\s*/g;

/** Keeps inline code from ending its <script>/<style> element early. */
const escapeScript = (js) => js.replace(/<\/(script)/gi, '<\\/$1').replaceAll('<!--', '<\\!--');
const escapeStyle = (css) => css.replace(/<\/(style)/gi, '<\\/$1');

/** The external files index.html loads: { scripts: [...src], styles: [...href] }. */
export function externalRefs(html) {
  return {
    scripts: [...html.matchAll(MODULE_TAG)].map((m) => m[1]),
    styles: [...html.matchAll(STYLE_TAG)].map((m) => m[1]),
  };
}

export function assembleHtml({ html, css, js, shim, assetBlocks }) {
  let out = html.replace(MODULE_TAG, '').replace(STYLE_TAG, '');
  const stray = /<script\b[^>]*\bsrc=|<link\b[^>]*\brel="(?:stylesheet|modulepreload|preload)"/i.exec(out);
  if (stray) throw new Error(`index.html still loads an external file: ${out.slice(stray.index, stray.index + 120)}`);
  if (!out.includes('</head>') || !out.includes('</body>')) throw new Error('index.html has no </head> or </body>');
  const shimJs = shim.replaceAll('__BLOCK_TYPE__', JSON.stringify(BLOCK_TYPE));
  const head = `<style>${escapeStyle(css)}</style>\n<script>${escapeScript(shimJs)}</script>\n`;
  const body = `${assetBlocks}<script type="module">${escapeScript(js)}</script>\n`;
  // Function replacers: the bundle is full of `$&`-like sequences a string replacement would expand.
  // </body> first: the inserted code then sits after the page's real </head>.
  out = out.replace('</body>', () => `${body}</body>`);
  out = out.replace('</head>', () => `${head}</head>`);
  return out;
}
