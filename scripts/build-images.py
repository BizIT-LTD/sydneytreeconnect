"""Build the site's responsive WebP images (plus JPEG fallbacks) and the
1200 x 630 social sharing image from the original PNGs.

The originals are AI-generated (ChatGPT image generation; see
docs/image-prompts.md) and are kept with their C2PA content credentials in
scripts/source/images/, which is not served by the website.

Usage:  python scripts/build-images.py
Needs:  Pillow
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "scripts" / "source" / "images"
OUT = ROOT / "assets" / "images"

# name: (source file, output folder, crop box or None, widths, fallback width)
JOBS = {
    "hero-garden": ("hero-garden.png", "hero", None, [640, 960, 1280, 1448], 960),
    # Service cards use a 3:2 frame; crops keep the trunk and canopy.
    "tree-removal": ("tree-removal.png", "services", (0, 50, 1448, 1015), [480, 800, 1200], 800),
    "tree-pruning": ("tree-pruning.png", "services", (230, 0, 1642, 941), [480, 800, 1200], 800),
}


def build_responsive():
    for name, (src, folder, crop, widths, fallback) in JOBS.items():
        im = Image.open(SRC / src).convert("RGB")
        if crop:
            im = im.crop(crop)
        dest = OUT / folder
        dest.mkdir(parents=True, exist_ok=True)
        for w in widths:
            w = min(w, im.width)
            h = round(w * im.height / im.width)
            r = im.resize((w, h), Image.LANCZOS) if w != im.width else im
            r.save(dest / f"{name}-{w}.webp", quality=70, method=6)
            if w == fallback:
                r.save(dest / f"{name}-{w}.jpg", quality=76, optimize=True, progressive=True)
        print(f"{name}: {im.width}x{im.height} -> {', '.join(str(min(w, im.width)) for w in widths)}")


def build_social():
    """Logo and headline on a warm-white card over the open sky of tree-pruning."""
    im = Image.open(SRC / "tree-pruning.png").convert("RGB")
    # Crop to 1200:630 from the full width, keeping the lower garden in view.
    w = im.width
    h = round(w * 630 / 1200)
    top = im.height - h - 40
    im = im.crop((0, top, w, top + h)).resize((1200, 630), Image.LANCZOS)

    card = Image.new("RGBA", (1200, 630), (0, 0, 0, 0))
    d = ImageDraw.Draw(card)
    box = (56, 150, 600, 480)
    d.rounded_rectangle((box[0], box[1] + 8, box[2], box[3] + 8), 22, fill=(20, 56, 35, 40))
    d.rounded_rectangle(box, 22, fill=(250, 247, 240, 255))
    im = Image.alpha_composite(im.convert("RGBA"), card)

    logo = Image.open(OUT / "brand" / "stc-logo-horizontal@3x.png").convert("RGBA")
    lw = 470
    logo = logo.resize((lw, round(logo.height * lw / logo.width)), Image.LANCZOS)
    im.alpha_composite(logo, (box[0] + 36, box[1] + 40))

    font = ImageFont.truetype(str(ROOT / "scripts" / "source" / "Figtree[wght].ttf"), 34)
    font.set_variation_by_axes([680])
    d = ImageDraw.Draw(im)
    y = box[1] + 40 + logo.height + 30
    for line in ["Tree removal and pruning", "enquiries across Sydney"]:
        d.text((box[0] + 40, y), line, font=font, fill=(35, 39, 42))
        y += 46
    small = ImageFont.truetype(str(ROOT / "scripts" / "source" / "Figtree[wght].ttf"), 17)
    small.set_variation_by_axes([500])
    d.text((box[0] + 40, box[3] - 44), "AI-generated illustrative image", font=small, fill=(74, 81, 87))

    (OUT / "social").mkdir(exist_ok=True)
    im.convert("RGB").save(OUT / "social" / "sydney-tree-connect-social.jpg", quality=84, optimize=True)
    print("social: 1200x630")


if __name__ == "__main__":
    build_responsive()
    build_social()
