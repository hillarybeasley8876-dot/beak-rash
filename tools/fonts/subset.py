#!/usr/bin/env python3
"""Subset the five CJK display faces to the characters the game itself draws (SPEC §26).

@fontsource ships every Chinese face as ~90 unicode-range slices of 60-110 KB, each holding hundreds of
glyphs. The title and the menu touch dozens of slices per face and each one is fetched whole, so a first
visit pulled 2.67 MB of fonts for a handful of glyphs. This rewrites every slice that holds at least one
game character into `public/fonts/cjk/<face>-<n>.woff2` with ONLY those characters, and regenerates
`src/ui/fonts-cjk.css` (same family / weight / font-display, one rule per new slice, an exact
unicode-range). Run it whenever the game's text changes:

    python tools/fonts/subset.py            # regenerate
    python tools/fonts/subset.py --check    # verify the generated files still cover the game's text
"""
import glob
import os
import re
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT_DIR = os.path.join(ROOT, 'public', 'fonts', 'cjk')
OUT_CSS = os.path.join(ROOT, 'src', 'ui', 'fonts-cjk.css')
URL_PREFIX = '/fonts/cjk/'

# The five Chinese faces the UI stacks use (p5/tokens.css --f-*): @fontsource dir, weight css, weight.
FACES = [
    ('zcool-kuaile', '400.css', 400),
    ('zcool-qingke-huangyou', '400.css', 400),
    ('ma-shan-zheng', '400.css', 400),
    ('zhi-mang-xing', '400.css', 400),
    ('noto-sans-sc', '900.css', 900),
]

# Ranges of interest: CJK ideographs (+ext A), kana, CJK punctuation / radicals, fullwidth forms, and the
# enclosed / emoji-ish symbols the signs use. Latin is kept too, so a CJK face set on mixed text still works.
KEEP_RANGES = [
    (0x0020, 0x007E),  # ASCII letters, digits, punctuation
    (0x00A0, 0x00FF),
    (0x2000, 0x206F),  # general punctuation
    (0x2190, 0x21FF),  # arrows
    (0x2460, 0x24FF),  # enclosed alphanumerics
    (0x25A0, 0x25FF),  # geometric shapes
    (0x3000, 0x303F),  # CJK symbols and punctuation
    (0x3040, 0x30FF),  # kana
    (0x3105, 0x312F),  # bopomofo
    (0x31C0, 0x31EF),  # strokes
    (0x3200, 0x33FF),  # enclosed CJK, compat, CJK compat
    (0x3400, 0x4DBF),  # CJK ext A
    (0x4E00, 0x9FFF),  # CJK unified
    (0xF900, 0xFAFF),  # compatibility ideographs
    (0xFE30, 0xFE4F),  # CJK compatibility forms
    (0xFF00, 0xFFEF),  # halfwidth and fullwidth forms
    (0x1F300, 0x1FAFF),  # symbols and pictographs
]


def in_keep(cp):
    return any(lo <= cp <= hi for lo, hi in KEEP_RANGES)


# --- the game's characters ---------------------------------------------------------------------------------------
LINE_COMMENT = '/' + '/'
BLOCK_COMMENT = '/' + '*'
QUOTES = '"\'`'


def literals(text):
    """Every string / template literal of a JS-TS source (comments and code dropped)."""
    out = []
    i, n, quote = 0, len(text), ''
    while i < n:
        c = text[i]
        two = text[i:i + 2]
        if not quote and two == LINE_COMMENT:
            j = text.find('\n', i)
            i = n if j < 0 else j
        elif not quote and two == BLOCK_COMMENT:
            j = text.find('*/', i + 2)
            i = n if j < 0 else j + 2
        elif quote:
            if c == '\\':
                i += 2
                continue
            if c == quote:
                quote = ''
            else:
                out.append(c)
            i += 1
        elif c in QUOTES:
            quote = c
            i += 1
        else:
            i += 1
    return ''.join(out)


def html_text(text):
    """Text nodes of an HTML file (comments, tags and attribute values dropped)."""
    text = re.sub(r'<!--.*?-->', ' ', text, flags=re.S)
    return ' '.join(re.sub(r'<[^>]*>', ' ', text, flags=re.S).split())


def game_chars():
    """Every character the game can draw: the string literals of src/**/*.{ts,css} plus index.html's text."""
    chars = set()
    files = sorted(glob.glob(os.path.join(ROOT, 'src', '**', '*.ts'), recursive=True))
    files += sorted(glob.glob(os.path.join(ROOT, 'src', '**', '*.css'), recursive=True))
    for path in files:
        with open(path, encoding='utf-8') as fh:
            chars.update(literals(fh.read()))
    with open(os.path.join(ROOT, 'index.html'), encoding='utf-8') as fh:
        chars.update(html_text(fh.read()))
    return {ord(c) for c in chars if in_keep(ord(c))}


# --- the @fontsource slice map ----------------------------------------------------------------------------------
FACE_RE = re.compile(r'@font-face\s*\{(.*?)\}', re.S)


def field(block, name):
    m = re.search(r'%s\s*:\s*([^;]+);' % name, block)
    return m.group(1).strip() if m else ''


def parse_range(spec):
    """`U+4e00-9fff,U+ff01` -> a set of code points."""
    cps = set()
    for part in spec.split(','):
        part = part.strip().lower().replace('u+', '')
        if not part:
            continue
        if '-' in part:
            lo, hi = part.split('-', 1)
            cps.update(range(int(lo, 16), int(hi, 16) + 1))
        elif '?' in part:
            cps.update(range(int(part.replace('?', '0'), 16), int(part.replace('?', 'f'), 16) + 1))
        else:
            cps.add(int(part, 16))
    return cps


def slices(face, css_name):
    """Every slice of one face, sorted by slice number: key, woff2 path, family, display, range."""
    css_path = os.path.join(ROOT, 'node_modules', '@fontsource', face, css_name)
    with open(css_path, encoding='utf-8') as fh:
        css = fh.read()
    out = []
    for block in FACE_RE.findall(css):
        m = re.search(r'url\(\./files/([^)]+\.woff2)\)', block)
        if not m:
            continue
        src = os.path.join(ROOT, 'node_modules', '@fontsource', face, 'files', m.group(1))
        # the slice token: `22` of zcool-kuaile-22-400-normal, `latin-ext` of noto-sans-sc-latin-ext-900-normal
        token = m.group(1)[:-len('.woff2')].replace('-normal', '')
        token = token[len(face) + 1:]
        token = re.sub(r'-%s$' % css_name.replace('.css', ''), '', token)
        out.append({
            'key': token,
            'sort': (0, int(token), '') if token.isdigit() else (1, 0, token),
            'file': '%s-%s.woff2' % (face, token),
            'src': src,
            'family': field(block, 'font-family').strip("'\""),
            'display': field(block, 'font-display') or 'swap',
            'cps': parse_range(field(block, 'unicode-range')),
        })
    out.sort(key=lambda s: s['sort'])
    return out


# --- build ------------------------------------------------------------------------------------------------------
def subset_options():
    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.glyph_names = True          # keep the glyph names (devtools / debugging)
    opts.layout_features = ['*']     # keep every layout feature the face needs
    opts.name_IDs = ['*']
    opts.name_legacy = True
    opts.name_languages = ['*']
    opts.notdef_outline = True
    opts.recalc_bounds = True
    opts.recalc_timestamp = False   # keep head.modified: regenerating must give byte-identical files
    opts.prune_unicode_ranges = True
    return opts


def write_slice(slice_, cps, opts):
    """Subset one @fontsource slice down to `cps` and return the code points that really made it in."""
    keep = sorted(cps)
    font = subset.load_font(slice_['src'], opts)
    subsetter = subset.Subsetter(options=opts)
    subsetter.populate(unicodes=keep)
    subsetter.subset(font)
    dst = os.path.join(OUT_DIR, slice_['file'])
    subset.save_font(font, dst, opts)
    font.close()
    with TTFont(dst) as out:
        cmap = out.getBestCmap()
        have = set(cmap) if cmap else set()
    return {c for c in cps if c in have}


def range_spec(cps):
    """`U+4e00,U+4e8c-4e8d` — the exact characters of one new slice."""
    parts, run = [], []
    for cp in sorted(cps):
        if run and cp == run[-1] + 1:
            run.append(cp)
            continue
        if run:
            parts.append(run)
        run = [cp]
    if run:
        parts.append(run)
    return ','.join('U+%x' % r[0] if len(r) == 1 else 'U+%x-%x' % (r[0], r[-1]) for r in parts)


def rule(face, slice_, cps, weight):
    return ('/* %s %s */\n@font-face {\n  font-family: \'%s\';\n  font-style: normal;\n'
            '  font-display: %s;\n  font-weight: %d;\n  src: url(\'%s%s\') format(\'woff2\');\n'
            '  unicode-range: %s;\n}\n' % (face, slice_['key'], slice_['family'], slice_['display'],
                                           weight, URL_PREFIX, slice_['file'], range_spec(cps)))


def build(chars):
    """Regenerate every subset file and the stylesheet. Returns (faces, files, bytes, css)."""
    opts = subset_options()
    os.makedirs(OUT_DIR, exist_ok=True)
    css, files, total, written = [], 0, 0, set()
    for face, css_name, weight in FACES:
        for slice_ in slices(face, css_name):
            want = chars & slice_['cps']
            if not want:
                continue
            got = write_slice(slice_, want, opts)
            if not got:
                print('[fonts] %s %s: the face has none of the %d characters, skipped'
                      % (face, slice_['key'], len(want)))
                continue
            css.append(rule(face, slice_, got, weight))
            files += 1
            written.add(slice_['file'])
            total += os.path.getsize(os.path.join(OUT_DIR, slice_['file']))
    for stale in sorted(glob.glob(os.path.join(OUT_DIR, '*.woff2'))):
        if os.path.basename(stale) not in written:
            os.remove(stale)
    header = ('/* GENERATED by tools/fonts/subset.py — do not edit.\n'
              '   The five CJK display faces, subset to the characters the game draws: one file per\n'
              '   @fontsource unicode-range slice that holds at least one of them (SPEC §26). */\n')
    return len(FACES), files, total, header + '\n'.join(css)


# --- check ------------------------------------------------------------------------------------------------------
def check(chars):
    """Re-read the generated CSS + woff2 files: every game character every face used to cover is still there."""
    with open(OUT_CSS, encoding='utf-8') as fh:
        css = fh.read()
    covered, bad, total, used = {}, [], 0, set()
    for block in FACE_RE.findall(css):
        m = re.search(r"url\('%s([^']+)'\)" % re.escape(URL_PREFIX), block)
        if not m:
            bad.append('a rule has no %s url' % URL_PREFIX)
            continue
        used.add(m.group(1))
        family = field(block, 'font-family').strip("'\"")
        path = os.path.join(OUT_DIR, m.group(1))
        if not os.path.isfile(path):
            bad.append('%s is missing' % m.group(1))
            continue
        total += os.path.getsize(path)
        declared = parse_range(field(block, 'unicode-range'))
        with TTFont(path) as font:
            cmap = font.getBestCmap()
            have = set(cmap) if cmap else set()
        if not declared <= have:
            bad.append('%s declares %d code points it does not hold'
                       % (m.group(1), len(declared - have)))
        covered.setdefault(family, set()).update(declared & have)
    for orphan in sorted(os.path.basename(p) for p in glob.glob(os.path.join(OUT_DIR, '*.woff2'))):
        if orphan not in used:
            bad.append('%s is in public/fonts/cjk but no rule uses it (regenerate)' % orphan)
    # what each face really has to keep: the game characters its ORIGINAL slices actually hold
    for face, css_name, _ in FACES:
        original, family = set(), ''
        for slice_ in slices(face, css_name):
            want = chars & slice_['cps']
            if not want:
                continue
            family = slice_['family']
            with TTFont(slice_['src']) as font:
                cmap = font.getBestCmap()
                original.update(want & set(cmap) if cmap else set())
        miss = original - covered.get(family, set())
        if miss:
            bad.append('%s: %d of %d game characters lost (U+%s)'
                       % (family, len(miss), len(original),
                          ',U+'.join('%x' % c for c in sorted(miss)[:8])))
    for line in bad:
        print('[fonts] %s' % line)
    return bad, len(covered), total


def main(argv):
    chars = game_chars()
    cjk = sum(1 for c in chars if c >= 0x3000)
    if '--check' in argv:
        bad, faces, total = check(chars)
        if bad or faces != len(FACES):
            print('subset FAILED (%d problems, %d/%d faces)' % (len(bad), faces, len(FACES)))
            return 1
        print('subset OK (%d faces, %d files, %d KB)' % (faces, len(glob.glob(os.path.join(OUT_DIR, '*.woff2'))), total // 1024))
        return 0
    faces, files, total, css = build(chars)
    with open(OUT_CSS, 'w', encoding='utf-8', newline='\n') as fh:
        fh.write(css)
    print('subset: %d game characters (%d CJK), %d faces, %d files, %d KB -> %s'
          % (len(chars), cjk, faces, files, total // 1024, os.path.relpath(OUT_CSS, ROOT).replace('\\', '/')))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
