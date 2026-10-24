"""Generates Patapata app icon, adaptive icon layers, splash mark and favicon.

Concept: a lowercase "p" whose bowl is a speech bubble (conversation), with a
warm accent dot beside it (a person joining in), on deep navy.
Run: python3 scripts/generate-brand-assets.py
"""
from PIL import Image, ImageDraw

NAVY = (11, 31, 58, 255)
TEAL = (22, 193, 207, 255)
OCHRE = (242, 165, 65, 255)
WHITE = (255, 255, 255, 255)
OUT = "assets/brand"
S = 4  # supersampling factor


def mark(draw, cx, cy, scale, bowl=TEAL, accent=OCHRE, hole=NAVY):
    """Draws the mark centred at (cx, cy); scale 1.0 spans roughly 600px."""
    def r(v):
        return v * scale
    stem_w = r(120)
    stem_x0 = cx - r(210)
    # bowl (speech bubble) with a little tail at the lower right
    bx0, by0, bx1, by1 = cx - r(210), cy - r(250), cx + r(200), cy + r(130)
    draw.ellipse([bx0, by0, bx1, by1], fill=bowl)
    draw.polygon([(cx + r(70), cy + r(90)), (cx + r(210), cy + r(190)), (cx + r(150), cy + r(40))], fill=bowl)
    # stem of the "p"
    draw.rectangle([stem_x0, cy - r(60), stem_x0 + stem_w, cy + r(270)], fill=bowl)
    draw.ellipse([stem_x0, cy + r(210), stem_x0 + stem_w, cy + r(330)], fill=bowl)
    # counter (hole) of the "p"
    draw.ellipse([cx - r(80), cy - r(130), cx + r(90), cy + r(20)], fill=hole)
    # accent: a person joining the conversation
    draw.ellipse([cx + r(170), cy - r(330), cx + r(300), cy - r(200)], fill=accent)


def canvas(size, bg):
    img = Image.new("RGBA", (size * S, size * S), bg)
    return img, ImageDraw.Draw(img)


def save(img, size, name):
    img.resize((size, size), Image.LANCZOS).save(f"{OUT}/{name}")


# App icon (iOS / generic): full bleed navy
img, d = canvas(1024, NAVY)
mark(d, 512 * S - 30 * S, 512 * S + 10 * S, 1.0 * S)
save(img, 1024, "icon.png")

# Android adaptive icon: foreground on transparent (safe zone = inner 66%)
img, d = canvas(1024, (0, 0, 0, 0))
mark(d, 500 * S, 530 * S, 0.62 * S, hole=NAVY)
save(img, 1024, "android-icon-foreground.png")
img, d = canvas(1024, NAVY)
save(img, 1024, "android-icon-background.png")
img, d = canvas(1024, (0, 0, 0, 0))
mark(d, 500 * S, 530 * S, 0.62 * S, bowl=WHITE, accent=WHITE, hole=(0, 0, 0, 0))
save(img, 1024, "android-icon-monochrome.png")

# Splash mark (transparent, shown on navy splash background)
img, d = canvas(512, (0, 0, 0, 0))
mark(d, 250 * S, 270 * S, 0.62 * S)
save(img, 512, "splash-icon.png")

# Favicon
img, d = canvas(64, NAVY)
mark(d, 31 * S, 33 * S, 0.075 * S)
save(img, 64, "favicon.png")
print("brand assets written to", OUT)
