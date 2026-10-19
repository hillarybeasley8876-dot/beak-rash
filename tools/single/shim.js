// Runtime half of the single-file build, inlined as a classic script that runs before the game.
// The game asks for files under assets/ by relative URL: image src (portraits, key art,
// billboards, three.js textures) and fetch() (voice lines). In the one-file build those files
// live in inert base64 script elements of type __BLOCK_TYPE__ (keyed by data-path); this shim
// serves them from there — images get a data: URL, fetch() gets a Response. Other URLs are left
// untouched.
(() => {
  'use strict';
  const TYPE = __BLOCK_TYPE__;
  const baseDir = new URL('./', location.href).href;
  const blocks = new Map();
  const dataUrls = new Map();
  const warned = new Set();
  let indexed = false;

  function block(rel) {
    if (!indexed || document.readyState === 'loading') {
      for (const el of document.querySelectorAll(`script[type="${TYPE}"]`)) blocks.set(el.dataset.path, el);
      indexed = document.readyState !== 'loading';
    }
    return blocks.get(rel) ?? null;
  }

  /** { rel, href } when `url` points at an embedded file next to the page, else null. */
  function lookup(url) {
    let href;
    try { href = new URL(url, document.baseURI).href; } catch { return null; }
    if (!href.startsWith(baseDir)) return null;
    let rel;
    try { rel = decodeURIComponent(href.slice(baseDir.length).replace(/[?#].*$/, '')); } catch { return null; }
    if (block(rel)) return { rel, href };
    if (rel.startsWith('assets/') && !warned.has(rel)) {
      warned.add(rel);
      console.warn(`[single-file] ${rel} is not embedded in this file`);
    }
    return null;
  }

  function dataUrl(rel) {
    let url = dataUrls.get(rel);
    if (!url) {
      const el = block(rel);
      url = `data:${el.dataset.type};base64,${el.textContent.trim()}`;
      dataUrls.set(rel, url);
    }
    return url;
  }

  function bytes(rel) {
    const b64 = block(rel).textContent.trim();
    if (typeof Uint8Array.fromBase64 === 'function') return Uint8Array.fromBase64(b64);
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  const nativeFetch = window.fetch;
  window.fetch = function fetch(input, init) {
    const hit = lookup(input instanceof Request ? input.url : String(input));
    if (!hit) return nativeFetch.call(this, input, init);
    const type = block(hit.rel).dataset.type;
    const body = new Blob([bytes(hit.rel)], { type });
    return Promise.resolve(new Response(body, { status: 200, headers: { 'Content-Type': type } }));
  };

  // Image src: the element loads the data: URL but keeps reporting the URL the game asked for.
  const srcDesc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  const asked = new WeakMap();
  Object.defineProperty(HTMLImageElement.prototype, 'src', {
    configurable: true,
    enumerable: srcDesc.enumerable,
    get() {
      const a = asked.get(this);
      const real = srcDesc.get.call(this);
      return a && a.data === real ? a.href : real;
    },
    set(value) {
      const hit = lookup(String(value));
      if (!hit) {
        asked.delete(this);
        srcDesc.set.call(this, value);
        return;
      }
      const data = dataUrl(hit.rel);
      asked.set(this, { href: hit.href, data });
      srcDesc.set.call(this, data);
    },
  });
  const nativeSetAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function setAttribute(name, value) {
    if (this instanceof HTMLImageElement && String(name).toLowerCase() === 'src') {
      this.src = value;
      return undefined;
    }
    return nativeSetAttribute.call(this, name, value);
  };
})();
