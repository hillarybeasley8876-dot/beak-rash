#!/usr/bin/env python3
"""Shrink screenshots before an agent Reads them (cross-platform stand-in for macOS `sips`).

  python tools/thumb.py in.png                          # -> in.jpg, at most 1280 px wide
  python tools/thumb.py a.png b.png c.png -o sheet.jpg  # one labelled contact sheet
  options: --width 1280 (sheet / single width) --cols 3 (sheet columns) --quality 70
"""
import argparse
import math
import os

from PIL import Image, ImageDraw


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('files', nargs='+')
    ap.add_argument('-o', '--out')
    ap.add_argument('--width', type=int, default=1280)
    ap.add_argument('--cols', type=int, default=0)
    ap.add_argument('--quality', type=int, default=70)
    a = ap.parse_args()
    if len(a.files) == 1 and not a.out:
        a.out = os.path.splitext(a.files[0])[0] + '.jpg'
    if len(a.files) == 1:
        im = Image.open(a.files[0]).convert('RGB')
        if im.width > a.width:
            im = im.resize((a.width, round(im.height * a.width / im.width)), Image.LANCZOS)
        im.save(a.out, quality=a.quality)
        print(a.out)
        return
    ims = [Image.open(f).convert('RGB') for f in a.files]
    cols = a.cols or min(len(ims), 3)
    rows = math.ceil(len(ims) / cols)
    tw = a.width // cols
    th = round(tw * ims[0].height / ims[0].width)
    sheet = Image.new('RGB', (tw * cols, (th + 18) * rows), (24, 24, 24))
    draw = ImageDraw.Draw(sheet)
    for i, (f, im) in enumerate(zip(a.files, ims)):
        x, y = (i % cols) * tw, (i // cols) * (th + 18)
        sheet.paste(im.resize((tw, th), Image.LANCZOS), (x, y + 18))
        draw.text((x + 4, y + 3), os.path.basename(f), fill=(255, 230, 120))
    sheet.save(a.out or 'sheet.jpg', quality=a.quality)
    print(a.out or 'sheet.jpg')


if __name__ == '__main__':
    main()
