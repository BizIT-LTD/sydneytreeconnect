"""Build the Sydney Tree Connect logo SVGs.

The wordmark is converted from the Figtree typeface (SIL Open Font License)
into vector outlines, so the logo never depends on a font being installed.

Usage:  python scripts/build-brand.py
Needs:  fontTools (pip install fonttools)
Output: assets/images/brand/*.svg and favicon.svg (PNG/ICO files are made by
        scripts/render-brand-png.mjs from these SVGs).
"""
from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = Path(__file__).resolve().parent.parent
FONT = ROOT / "scripts" / "source" / "Figtree[wght].ttf"
OUT = ROOT / "assets" / "images" / "brand"

# Brand palette (also documented in README.md)
GREEN = "#1F5135"       # Forest green
GREEN_LEAF = "#2F6B45"  # Leaf green (symbol on light backgrounds)
CHARCOAL = "#23272A"
WARM_WHITE = "#FAF7F0"
SAGE = "#A9C8A4"        # Light-version accent on dark backgrounds

# Symbol, drawn on a 64 x 64 grid. A single leaf whose veins end in small
# nodes: a plain leaf at small sizes, a quiet "connection" idea up close.
LEAF = "M12 54C7 33 22 10 55 9C56 39 36 58 12 54Z"
STEM = "M6.5 59.5L15 51"
VEINS = "M15 51L41 24M21.5 44.5L19.5 32M29.5 35.5L41 37"
NODES = [(19.5, 32), (41, 37)]


def symbol_group(leaf_fill, line_colour, transform=""):
    t = f' transform="{transform}"' if transform else ""
    nodes = "".join(
        f'<circle cx="{x}" cy="{y}" r="3.4" fill="{line_colour}"/>' for x, y in NODES
    )
    return (
        f"<g{t}>"
        f'<path d="{LEAF}" fill="{leaf_fill}"/>'
        f'<path d="{STEM}" stroke="{leaf_fill}" stroke-width="4.2" stroke-linecap="round"/>'
        f'<path d="{VEINS}" fill="none" stroke="{line_colour}" stroke-width="3.6" '
        f'stroke-linecap="round" stroke-linejoin="round"/>'
        f"{nodes}</g>"
    )


def load_font(weight):
    font = TTFont(FONT)
    return instantiateVariableFont(font, {"wght": weight}, inplace=False)


def pair_kerning(font):
    """Read simple GPOS pair adjustments (format 1 and 2) into a lookup."""
    kern = {}
    if "GPOS" not in font:
        return kern
    gpos = font["GPOS"].table
    for lookup in gpos.LookupList.Lookup:
        subtables = lookup.SubTable
        if lookup.LookupType == 9:  # extension
            subtables = [s.ExtSubTable for s in subtables]
        for st in subtables:
            if getattr(st, "LookupType", 2) != 2 and lookup.LookupType != 9:
                continue
            if not hasattr(st, "Format") or not hasattr(st, "Coverage"):
                continue
            cov = st.Coverage.glyphs
            if st.Format == 1:
                for i, first in enumerate(cov):
                    for rec in st.PairSet[i].PairValueRecord:
                        v = getattr(rec.Value1, "XAdvance", 0) if rec.Value1 else 0
                        if v:
                            kern.setdefault((first, rec.SecondGlyph), v)
            elif st.Format == 2:
                cd1 = st.ClassDef1.classDefs
                cd2 = st.ClassDef2.classDefs
                for first in cov:
                    c1 = cd1.get(first, 0)
                    row = st.Class1Record[c1].Class2Record
                    for second, c2 in list(cd2.items()):
                        v1 = row[c2].Value1
                        v = getattr(v1, "XAdvance", 0) if v1 else 0
                        if v:
                            kern.setdefault((first, second), v)
    return kern


def text_path(font, text, size, x, baseline, tracking=0):
    """Return (svg path data, advance width) for text at a font size in px."""
    cmap = font.getBestCmap()
    gs = font.getGlyphSet()
    hmtx = font["hmtx"]
    upem = font["head"].unitsPerEm
    scale = size / upem
    kern = pair_kerning(font)
    pen = SVGPathPen(gs)
    cursor = 0
    prev = None
    for ch in text:
        name = cmap[ord(ch)]
        if prev:
            cursor += kern.get((prev, name), 0)
        tpen = TransformPen(pen, (scale, 0, 0, -scale, x + cursor * scale, baseline))
        gs[name].draw(tpen)
        cursor += hmtx[name][0] + tracking
        prev = name
    return pen.getCommands(), cursor * scale


def round_path(d):
    out, num = [], ""
    for c in d + " ":
        if c in "0123456789.-":
            if c == "-" and num:
                out.append(f"{float(num):.2f}".rstrip("0").rstrip("."))
                num = ""
            num += c
        else:
            if num:
                out.append(f"{float(num):.2f}".rstrip("0").rstrip("."))
                num = ""
            out.append(c)
    return "".join(out).strip()


def svg(width, height, body, title):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width:.0f} {height:.0f}" '
        f'width="{width:.0f}" height="{height:.0f}" role="img" aria-labelledby="t">'
        f'<title id="t">{title}</title>{body}</svg>\n'
    )


def build():
    OUT.mkdir(parents=True, exist_ok=True)
    bold = load_font(720)
    size = 30
    h = 64
    baseline = 42.5
    text_x = 70
    p1, w1 = text_path(bold, "Sydney Tree ", size, text_x, baseline, tracking=-6)
    p2, w2 = text_path(bold, "Connect", size, text_x + w1, baseline, tracking=-6)
    width = text_x + w1 + w2 + 4
    p1, p2 = round_path(p1), round_path(p2)

    variants = {
        # name: (leaf, vein lines, wordmark part 1, wordmark part 2)
        "stc-logo-horizontal": (GREEN_LEAF, WARM_WHITE, CHARCOAL, GREEN),
        "stc-logo-horizontal-light": (SAGE, GREEN, WARM_WHITE, SAGE),
    }
    for name, (leaf, lines, c1, c2) in variants.items():
        body = (
            symbol_group(leaf, lines)
            + f'<path fill="{c1}" d="{p1}"/><path fill="{c2}" d="{p2}"/>'
        )
        (OUT / f"{name}.svg").write_text(
            svg(width, h, body, "Sydney Tree Connect"), encoding="utf-8"
        )

    (OUT / "stc-symbol.svg").write_text(
        svg(64, 64, symbol_group(GREEN_LEAF, WARM_WHITE), "Sydney Tree Connect"),
        encoding="utf-8",
    )
    (OUT / "stc-symbol-light.svg").write_text(
        svg(64, 64, symbol_group(SAGE, GREEN), "Sydney Tree Connect"),
        encoding="utf-8",
    )
    # App/favicon tile: symbol on a forest-green rounded square so it reads on
    # both light and dark browser tabs.
    tile = (
        f'<rect width="64" height="64" rx="14" fill="{GREEN}"/>'
        + symbol_group(WARM_WHITE, GREEN, "translate(6.4 6.4) scale(0.8)")
    )
    tile_svg = svg(64, 64, tile, "Sydney Tree Connect")
    (OUT / "stc-app-icon.svg").write_text(tile_svg, encoding="utf-8")
    (ROOT / "favicon.svg").write_text(tile_svg, encoding="utf-8")
    # Maskable icon keeps the symbol inside the 80% safe zone.
    mask = (
        f'<rect width="64" height="64" fill="{GREEN}"/>'
        + symbol_group(WARM_WHITE, GREEN, "translate(12.8 12.8) scale(0.6)")
    )
    (OUT / "stc-app-icon-maskable.svg").write_text(
        svg(64, 64, mask, "Sydney Tree Connect"), encoding="utf-8"
    )
    print(f"Logo width at 64px height: {width:.1f}px")


if __name__ == "__main__":
    build()
