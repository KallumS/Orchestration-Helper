"""Draws the app icon, macos/AppIcon.icns: two notes an octave apart on a
staff - a doubling, the thing the app is about - in the window's own
colours (COLOUR.md): the ground, the edge grey for the staff, the body text
for the lower note and the accent for the upper one.

    python3 macos/make_icon.py      (needs Pillow)
"""
from pathlib import Path
from PIL import Image, ImageDraw

S = 4096                      # drawn large, then scaled down smoothly
img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

# Apple's icon grid: an 824-point rounded square centred on 1024
k = S / 1024
inset, radius = 100 * k, 185 * k
d.rounded_rectangle((inset, inset, S - inset, S - inset), radius,
                    fill=(0x23, 0x27, 0x2E, 255))
# the staff
gap = 92 * k
top = 330 * k
top += 0.25 * gap
x0, x1 = inset + 110 * k, S - inset - 110 * k
for i in range(5):
    y = top + i * gap
    d.rectangle((x0, y - 7 * k, x1, y + 7 * k), fill=(0x6D, 0x75, 0x81, 255))

def whole_note(cx, cy, colour):
    """A whole note: a wide oval with a tilted hollow."""
    rx, ry = 0.80 * gap, 0.52 * gap
    note = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    nd = ImageDraw.Draw(note)
    nd.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=colour)
    hole = Image.new("L", (S, S), 0)
    hr, hy = 0.30 * gap, 0.46 * gap
    ImageDraw.Draw(hole).ellipse((cx - hr, cy - hy, cx + hr, cy + hy), fill=255)
    hole = hole.rotate(-35, center=(cx, cy))
    note.putalpha(Image.composite(Image.new("L", (S, S), 0), note.getchannel("A"), hole))
    img.alpha_composite(note)

cx = S / 2
# the octave: a space below the staff's middle, and the same letter above it
lower = top + 3.5 * gap
upper = lower - 3.5 * gap
whole_note(cx, lower, (0xDD, 0xE1, 0xE7, 255))
whole_note(cx, upper, (0xFF, 0xF2, 0x00, 255))

out = Path(__file__).with_name("AppIcon.icns")
img.resize((1024, 1024), Image.LANCZOS).save(
    out, sizes=[(16, 16), (32, 32), (64, 64), (128, 128), (256, 256), (512, 512), (1024, 1024)])
print("wrote", out)
