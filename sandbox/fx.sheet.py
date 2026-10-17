# Contact sheet for fx frame strips: python3 sandbox/fx.sheet.py "shots/fx/ko-ko-*.png" shots/fx/sheet-ko.png [cols] [width]
import glob, sys
from PIL import Image, ImageDraw

files = sorted(glob.glob(sys.argv[1]))
out = sys.argv[2]
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 6
w = int(sys.argv[4]) if len(sys.argv) > 4 else 320
if not files:
    sys.exit("no frames")
first = Image.open(files[0])
h = round(first.height * w / first.width)
rows = (len(files) + cols - 1) // cols
sheet = Image.new("RGB", (cols * w, rows * h), "black")
draw = ImageDraw.Draw(sheet)
for i, f in enumerate(files):
    im = Image.open(f).convert("RGB").resize((w, h))
    x, y = (i % cols) * w, (i // cols) * h
    sheet.paste(im, (x, y))
    draw.text((x + 4, y + 4), f.split("-")[-1].split(".")[0], fill="yellow")
sheet.save(out)
print(out, len(files), "frames")
