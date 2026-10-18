# Grid contact sheet from explicit files: python3 sandbox/fx.grid.py out.jpg cols width file1 file2 ...
import sys
from PIL import Image, ImageDraw

out, cols, w = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
files = sys.argv[4:]
first = Image.open(files[0])
h = round(first.height * w / first.width)
rows = (len(files) + cols - 1) // cols
sheet = Image.new("RGB", (cols * w, rows * h), "black")
draw = ImageDraw.Draw(sheet)
for i, f in enumerate(files):
    im = Image.open(f).convert("RGB").resize((w, h), Image.LANCZOS)
    x, y = (i % cols) * w, (i // cols) * h
    sheet.paste(im, (x, y))
    draw.text((x + 4, y + 4), f.split("/")[-1].rsplit(".", 1)[0], fill="yellow")
sheet.save(out, quality=80)
print(out, len(files), "frames", sheet.size)
