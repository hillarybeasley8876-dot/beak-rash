#!/usr/bin/env python3
"""Cut out and export BEAK RASH art (assets unit).

usage: cutout.py RAW.png OUT_BASE [--cut] [--max-h N] [--max-w N] [--png] [--webp] [--colors N] [--flip]
                 [--hole X,Y,R[,RY] ...] [--frame CX,CY,S] [--tint X,Y,RX,RY ...] [--canvas S[,DY]]

--cut   flood-fills the near-white background (plus neutral light greys: sticker edges, soft
        shadows) from the image border to transparency. Dark ink
        is dilated by 2 px first so small outline gaps cannot leak into enclosed whites (pelican
        feathers stay opaque); the fill then regrows into the dilated margin, and a 2 px band
        around the background is un-blended from white (colour-to-alpha) for a soft, clean edge.
        Specks (tiny opaque islands) are removed and the result is trimmed.
--frame re-frames full-bleed art before export: keeps the aspect, crops to S (0..1) of the size
        centred at the fractional point (CX, CY), clamped inside the image (e.g. centre the eyes of an
        eyes strip, which the HUD shows as a thin centred band).
--tint  repaints warm orange/yellow pixels inside an ellipse (raw px, after --flip) crimson, keeping
        their shading: puts the pelican's red hooked beak tip back when a roll painted it orange.
--canvas builds an outpainting canvas instead of export art: the image shrunk by S, bottom-centred on a
        same-size white canvas (DY = extra downward shift as a fraction of the height; the overflow is
        cropped). gen-image.mjs --edit uploads it so the model extends the scene around a poster whose
        subject must sit in the lower part of the frame (billboard text band on top).
Outputs OUT_BASE.png / OUT_BASE.webp, never taller than --max-h (default 900).
Prints one summary line: size, file sizes, opaque coverage, removed specks.
"""
import argparse
import os
import sys

import numpy as np
from PIL import Image

LIGHT = 222        # a pixel is "light" when every channel is >= this...
GREY_MIN = 160     # ...or when it is a neutral light grey (min channel >= this and spread <= GREY_SPREAD):
GREY_SPREAD = 24   # die-cut sticker edges and soft drop shadows, so the fill removes sticker borders too
INK_GROW = 2       # px of ink dilation that seals outline gaps
BAND = 2           # px of colour-to-alpha band around the background
SPECK = 160        # opaque islands smaller than this (px, at raw size) are removed


def dilate(mask, r):
    """Square (Chebyshev) dilation by r px using shifted maxima."""
    out = mask.copy()
    for _ in range(r):
        m = out.copy()
        m[1:, :] |= out[:-1, :]
        m[:-1, :] |= out[1:, :]
        m[:, 1:] |= out[:, :-1]
        m[:, :-1] |= out[:, 1:]
        out = m
    return out


def _run_min_rows(mask, vals):
    """Within every horizontal run of mask, replace vals by the run minimum (in place)."""
    h, w = mask.shape
    fm = mask.ravel()
    fv = vals.ravel()
    idx = np.flatnonzero(fm)
    if idx.size == 0:
        return
    starts = np.ones(idx.size, dtype=bool)
    starts[1:] = (idx[1:] != idx[:-1] + 1) | (idx[1:] % w == 0)
    run_id = np.cumsum(starts) - 1
    run_min = np.minimum.reduceat(fv[idx], np.flatnonzero(starts))
    fv[idx] = run_min[run_id]


def propagate_min(mask, vals):
    """4-connected min propagation of vals over mask (alternating row/column run sweeps)."""
    vals = vals.copy()
    for _ in range(400):
        before = vals.copy()
        _run_min_rows(mask, vals)
        vt = np.ascontiguousarray(vals.T)
        _run_min_rows(np.ascontiguousarray(mask.T), vt)
        vals = np.ascontiguousarray(vt.T)
        if np.array_equal(before, vals):
            return vals
    raise RuntimeError('propagation did not converge')


def flood_from_border(passable):
    """Pixels of `passable` 4-connected to the image border."""
    h, w = passable.shape
    seed = np.zeros_like(passable)
    seed[0, :] = seed[-1, :] = True
    seed[:, 0] = seed[:, -1] = True
    vals = np.where(seed & passable, 0, 1).astype(np.int32)
    return passable & (propagate_min(passable, vals) == 0)


def colour_to_alpha(px):
    """Un-blend Nx3 pixels from a white backdrop: returns (rgb, alpha) with alpha in 0..1."""
    a = np.clip((255.0 - px).max(axis=1) / 255.0, 0.0, 1.0)
    safe = np.maximum(a, 1e-3)[:, None]
    rgb = np.clip((px - (1.0 - a)[:, None] * 255.0) / safe, 0, 255)
    return rgb, a


def remove_specks(alpha):
    """Drop 4-connected opaque islands smaller than SPECK px; returns how many were dropped."""
    solid = alpha > 0
    labels = propagate_min(solid, np.arange(solid.size, dtype=np.int64).reshape(solid.shape))
    ids, counts = np.unique(labels[solid], return_counts=True)
    small = ids[counts < SPECK]
    if small.size:
        alpha[solid & np.isin(labels, small)] = 0
    return int(small.size)


def clear_holes(light, bg, ellipses):
    """Background seen through enclosed gaps (e.g. between wheel spokes): every 4-connected light
    region lying entirely inside one of the (x, y, rx, ry) ellipses becomes background. Regions that
    leave the ellipse (frame tubes, feathers) are kept. Returns the number of regions cleared."""
    h, w = light.shape
    cleared = 0
    for x, y, rx, ry in ellipses:
        x0, x1 = max(0, x - rx), min(w, x + rx + 1)
        y0, y1 = max(0, y - ry), min(h, y + ry + 1)
        yy, xx = np.mgrid[y0:y1, x0:x1]
        inside = ((xx - x) / rx) ** 2 + ((yy - y) / ry) ** 2 <= 1.0
        mask = light[y0:y1, x0:x1] & ~bg[y0:y1, x0:x1]
        labels = propagate_min(mask, np.arange(mask.size, dtype=np.int64).reshape(mask.shape))
        ids = np.unique(labels[mask])
        outside = np.unique(labels[mask & ~inside])
        border = np.zeros_like(mask)
        border[0, :] = border[-1, :] = True
        border[:, 0] = border[:, -1] = True
        keep = np.union1d(outside, np.unique(labels[mask & border]))
        hole_ids = np.setdiff1d(ids, keep)
        if hole_ids.size:
            bg[y0:y1, x0:x1] |= mask & np.isin(labels, hole_ids)
            cleared += int(hole_ids.size)
    return cleared


def cut(rgb, ellipses=()):
    """RGB uint8 HxWx3 -> (RGBA uint8, specks removed, holes cleared)."""
    lo, hi = rgb.min(axis=2), rgb.max(axis=2)
    light = (lo >= LIGHT) | ((lo >= GREY_MIN) & (hi - lo <= GREY_SPREAD))
    bg = flood_from_border(~dilate(~light, INK_GROW))
    for _ in range(INK_GROW + 1):
        bg |= light & dilate(bg, 1)
    holes = clear_holes(light, bg, ellipses)
    band = dilate(bg, BAND) & ~bg
    out = np.dstack([rgb.astype(np.float64), np.full(light.shape, 255.0)])
    out[bg] = 0
    col, a = colour_to_alpha(out[band][:, :3])
    out[band] = np.column_stack([col, a * 255.0])
    rgba = np.round(out).astype(np.uint8)
    specks = remove_specks(rgba[:, :, 3])
    rgba[rgba[:, :, 3] == 0, :3] = 0
    return rgba, specks, holes


TINT = np.array([214.0, 28.0, 36.0])  # crimson beak tip


def tint(rgb, ellipses):
    """Recolour warm (orange/yellow) pixels inside each (x, y, rx, ry) ellipse to TINT, mapping their
    luminance so shadows go deep red and highlights pink-white. Red, pink, white and ink are untouched."""
    out = rgb.astype(np.float64)
    r, g, b = out[..., 0], out[..., 1], out[..., 2]
    mx, mn = out.max(axis=2), out.min(axis=2)
    warm = (r >= mx) & (g - b > 40) & (mx > 70) & ((mx - mn) / np.maximum(mx, 1.0) > 0.18)
    h, w = warm.shape
    yy, xx = np.mgrid[0:h, 0:w]
    sel = np.zeros_like(warm)
    for x, y, rx, ry in ellipses:
        sel |= ((xx - x) / rx) ** 2 + ((yy - y) / ry) ** 2 <= 1.0
    sel &= warm
    k = (0.3 * r + 0.59 * g + 0.11 * b)[sel] / 178.0  # mid-orange luminance maps to TINT
    base = TINT[None, :] * np.minimum(k, 1.0)[:, None]
    lift = (255.0 - TINT)[None, :] * np.clip(k - 1.0, 0.0, 1.0)[:, None] * 1.4
    out[sel] = np.clip(base + lift, 0, 255)
    return np.round(out).astype(np.uint8), int(sel.sum())


def frame(rgb, cx, cy, s):
    """Crop HxWx3 to s of its size (same aspect) centred at fractional (cx, cy), clamped inside."""
    if not (0.1 <= s <= 1.0 and 0.0 <= cx <= 1.0 and 0.0 <= cy <= 1.0):
        raise ValueError('--frame wants CX,CY in 0..1 and S in 0.1..1')
    h, w = rgb.shape[:2]
    fw, fh = round(w * s), round(h * s)
    x0 = min(max(0, round(cx * w - fw / 2)), w - fw)
    y0 = min(max(0, round(cy * h - fh / 2)), h - fh)
    return np.ascontiguousarray(rgb[y0:y0 + fh, x0:x0 + fw])


def make_canvas(rgb, s, dy=0.0):
    """Shrink HxWx3 by s and paste it bottom-centred (shifted down by dy*H) on a white canvas of the same size."""
    if not (0.2 <= s <= 1.0 and -0.5 <= dy <= 0.5):
        raise ValueError('--canvas wants S in 0.2..1 and DY in -0.5..0.5')
    h, w = rgb.shape[:2]
    small = Image.fromarray(rgb).resize((round(w * s), round(h * s)), Image.LANCZOS)
    out = Image.new('RGB', (w, h), (255, 255, 255))
    out.paste(small, ((w - small.width) // 2, h - small.height + round(dy * h)))
    return np.asarray(out)


def trim(im, pad=6):
    a = np.asarray(im)[:, :, 3]
    ys, xs = np.nonzero(a > 8)
    if ys.size == 0:
        raise ValueError('cut-out is empty')
    x0, y0 = max(0, xs.min() - pad), max(0, ys.min() - pad)
    x1, y1 = min(im.width, xs.max() + 1 + pad), min(im.height, ys.max() + 1 + pad)
    return im.crop((x0, y0, x1, y1))


def fit(im, max_h, max_w):
    s = min(1.0, max_h / im.height, max_w / im.width)
    if s >= 1.0:
        return im
    size = (max(1, round(im.width * s)), max(1, round(im.height * s)))
    if im.mode == 'RGBA':
        return im.convert('RGBa').resize(size, Image.LANCZOS).convert('RGBA')
    return im.resize(size, Image.LANCZOS)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('raw')
    ap.add_argument('out_base')
    ap.add_argument('--cut', action='store_true')
    ap.add_argument('--max-h', type=int, default=900)
    ap.add_argument('--max-w', type=int, default=4096)
    ap.add_argument('--png', action='store_true')
    ap.add_argument('--webp', action='store_true')
    ap.add_argument('--colors', type=int, default=0, help='quantize the PNG to N colours (0 = truecolour)')
    ap.add_argument('--flip', action='store_true', help='mirror horizontally (make a portrait face the other way)')
    ap.add_argument('--tint', action='append', default=[], metavar='X,Y,RX,RY',
                    help='repaint warm orange pixels inside this ellipse crimson (raw px, after --flip); repeatable')
    ap.add_argument('--frame', metavar='CX,CY,S', help='re-frame: crop to S of the size around (CX, CY) fractions')
    ap.add_argument('--canvas', metavar='S[,DY]', help='outpainting canvas: shrink by S, bottom-centred on white')
    ap.add_argument('--hole', action='append', default=[], metavar='X,Y,R[,RY]',
                    help='clear enclosed light regions inside this circle/ellipse (raw px, after --flip); repeatable')
    args = ap.parse_args()
    if not (args.png or args.webp):
        ap.error('choose at least one of --png / --webp')
    rgb = np.asarray(Image.open(args.raw).convert('RGB'))
    if args.flip:
        rgb = np.ascontiguousarray(rgb[:, ::-1])
    if args.tint:
        ells = [tuple(int(v) for v in t.split(',')) for t in args.tint]
        if any(len(e) != 4 for e in ells):
            raise ValueError('--tint wants X,Y,RX,RY')
        rgb, tinted = tint(rgb, ells)
        if tinted == 0:
            raise ValueError('--tint matched no orange pixels (check the ellipse)')
    if args.frame:
        parts = [float(v) for v in args.frame.split(',')]
        if len(parts) != 3:
            raise ValueError('--frame wants CX,CY,S')
        rgb = frame(rgb, *parts)
    if args.canvas:
        parts = [float(v) for v in args.canvas.split(',')]
        if len(parts) not in (1, 2):
            raise ValueError('--canvas wants S or S,DY')
        rgb = make_canvas(rgb, *parts)
    specks, holes, coverage = 0, 0, 100.0
    if args.cut:
        ellipses = [tuple(int(v) for v in h.split(',')) for h in args.hole]
        if any(len(e) not in (3, 4) for e in ellipses):
            raise ValueError('--hole wants X,Y,R or X,Y,RX,RY')
        rgba, specks, holes = cut(rgb, [e if len(e) == 4 else e + (e[2],) for e in ellipses])
        coverage = 100.0 * float((rgba[:, :, 3] > 0).mean())
        im = trim(Image.fromarray(rgba))
    else:
        im = Image.fromarray(rgb)
    im = fit(im, args.max_h, args.max_w)
    os.makedirs(os.path.dirname(os.path.abspath(args.out_base)), exist_ok=True)
    sizes = []
    if args.png:
        png = im.quantize(colors=args.colors, method=Image.Quantize.FASTOCTREE) if args.colors else im
        png.save(args.out_base + '.png', optimize=True)
        sizes.append('png %d KB' % (os.path.getsize(args.out_base + '.png') // 1024))
    if args.webp:
        im.save(args.out_base + '.webp', 'WEBP', quality=88, method=6, alpha_quality=92)
        sizes.append('webp %d KB' % (os.path.getsize(args.out_base + '.webp') // 1024))
    warn = ''
    if args.cut and coverage > 80:
        warn = ' WARN no background removed'
    elif args.cut and coverage < 12:
        warn = ' WARN subject is tiny'
    print('%dx%d %s coverage %.0f%% specks %d holes %d%s' % (im.width, im.height, ', '.join(sizes), coverage, specks, holes, warn))


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, RuntimeError) as e:
        print('[cutout] %s' % e, file=sys.stderr)
        sys.exit(1)
