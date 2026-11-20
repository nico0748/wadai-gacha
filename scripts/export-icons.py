"""
Writes the app icons and favicon from Nico's MEKURI icon
(docs/brand/mekuri_app_icon_opaque.png): three cards fanned out on a deep
navy tile.

    python3 scripts/export-icons.py

Needs Pillow. The source is an AI-generated image whose dark background
carries faint noise, so the background is evened out first; then the mark is
cut out square around its centre and set on that colour at each size.
"""

import io
import struct
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "docs/brand/mekuri_app_icon_opaque.png"
# The tile colour in the source, and the box around the three cards in it.
BG = (10, 11, 33)
MARK_BOX = (219, 243, 1025, 969)  # left, top, right, bottom

src = np.asarray(Image.open(SOURCE).convert("RGB")).astype(np.int16)
bg = np.array(BG, dtype=np.int16)
flat = np.where((np.abs(src - bg).max(axis=2) < 9)[..., None], bg, src).astype(np.uint8)
left, top, right, bottom = MARK_BOX
cx, cy = (left + right) / 2, (top + bottom) / 2
mark_w = right - left + 1
HALF = 470
mark = Image.fromarray(flat).crop((int(cx - HALF), int(cy - HALF), int(cx + HALF), int(cy + HALF)))


def full_bleed(size: int, width: float, lift: float = 0.015, ss: int = 4) -> Image.Image:
    """A square of the tile colour with the cards `width` of it wide, a touch above centre."""
    s = size * ss
    canvas = Image.new("RGB", (s, s), BG)
    scaled = mark.resize((round(mark.width * width * s / mark_w),) * 2, Image.LANCZOS)
    canvas.paste(scaled, (round(s / 2 - scaled.width / 2), round(s / 2 - scaled.height / 2 - lift * s)))
    return canvas.resize((size, size), Image.LANCZOS)


def rounded_tile(size: int, width: float, radius: float = 0.225) -> Image.Image:
    """The same on a rounded tile with transparent corners, for browser tabs."""
    s = size * 8
    tile = full_bleed(s, width, lift=0.012, ss=1).convert("RGBA")
    mask = Image.new("L", (s, s), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, s - 1, s - 1), radius=radius * s, fill=255)
    tile.putalpha(mask)
    return tile.resize((size, size), Image.LANCZOS)


def ico(images: list[Image.Image]) -> bytes:
    """An .ico holding PNG images."""
    data = []
    for im in images:
        buf = io.BytesIO()
        im.save(buf, "PNG")
        data.append(buf.getvalue())
    header = struct.pack("<HHH", 0, 1, len(images))
    offset = 6 + 16 * len(images)
    entries = b""
    for im, d in zip(images, data):
        entries += struct.pack("<BBBBHHII", im.width % 256, im.height % 256, 0, 0, 1, 32, len(d), offset)
        offset += len(d)
    return header + entries + b"".join(data)


# Home-screen icons: full-bleed squares (the phone rounds the corners).
full_bleed(512, 0.68).save(ROOT / "public/icons/icon-512.png")
full_bleed(192, 0.68).save(ROOT / "public/icons/icon-192.png")
full_bleed(180, 0.68).save(ROOT / "src/app/apple-icon.png")
# Maskable: the farthest corner of the cards stays inside the 80% safe circle.
full_bleed(512, 0.66).save(ROOT / "public/icons/icon-maskable-512.png")
# Browser tabs: the cards fill more of the tile the smaller it gets, so 16px still reads as cards.
rounded_tile(256, 0.72).save(ROOT / "src/app/icon.png")
(ROOT / "src/app/favicon.ico").write_bytes(
    ico([rounded_tile(16, 0.86, radius=0.2), rounded_tile(32, 0.84, radius=0.21), rounded_tile(48, 0.8)])
)
