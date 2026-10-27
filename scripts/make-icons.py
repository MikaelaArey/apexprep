#!/usr/bin/env python3
"""Draws the ApexPrep app icon and splash mark.

The mark is a bold upward chevron (the apex) over a lighter one (progress),
white on the app's deep green. Regenerate with:
    python3 -m pip install pillow && python3 scripts/make-icons.py
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent / 'assets' / 'images'
GREEN_TOP = (16, 140, 98)
GREEN_BOTTOM = (8, 98, 70)
GREEN = (11, 122, 85)
SS = 4  # supersampling for smooth edges


def chevron(draw, cx, cy, half_width, height, stroke, fill):
    """An upward chevron with rounded ends and a rounded apex."""
    left = (cx - half_width, cy + height / 2)
    apex = (cx, cy - height / 2)
    right = (cx + half_width, cy + height / 2)
    for a, b in ((left, apex), (apex, right)):
        draw.line([a, b], fill=fill, width=int(stroke))
    r = stroke / 2
    for x, y in (left, apex, right):
        draw.ellipse([x - r, y - r, x + r, y + r], fill=fill)


def mark(size, color, ghost):
    """Transparent canvas with the two chevrons, centered."""
    big = size * SS
    img = Image.new('RGBA', (big, big), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    stroke = big * 0.115
    chevron(d, big / 2, big * 0.40, big * 0.27, big * 0.25, stroke, color)
    chevron(d, big / 2, big * 0.64, big * 0.27, big * 0.25, stroke, ghost)
    return img.resize((size, size), Image.LANCZOS)


def icon(size=1024):
    bg = Image.new('RGB', (size, size))
    px = bg.load()
    for y in range(size):
        t = y / (size - 1)
        row = tuple(round(GREEN_TOP[i] + (GREEN_BOTTOM[i] - GREEN_TOP[i]) * t) for i in range(3))
        for x in range(size):
            px[x, y] = row
    m = mark(size, (255, 255, 255, 255), (255, 255, 255, 110))
    bg.paste(m, (0, 0), m)
    return bg


def main():
    ROOT.mkdir(parents=True, exist_ok=True)
    icon().save(ROOT / 'icon.png')
    mark(1024, GREEN + (255,), GREEN + (110,)).save(ROOT / 'splash-icon.png')
    small = icon(256)
    small.save(ROOT / 'icon-small.png')
    print('wrote icon.png, splash-icon.png, icon-small.png')


if __name__ == '__main__':
    main()
