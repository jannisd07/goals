#!/usr/bin/env python3
"""
Pixel sprites for the island's water objects, catalogue v1 (WACHSTUM.md §14.2).

Same rules and the same drawing engine as the plants (plants.py): 2:1 isometric,
16 art pixels per metre, light from the top left, flat tones, 1 px outline, no
anti-aliasing. Water objects float, so instead of a ground shadow they get a
foam ripple at the water line.

Every object grows in 8 to 12 steps. Boats and the dock become bigger and get
more parts; buoys, kayaks, rocks, dolphins and gulls come in groups that fill up,
so one image holds the whole group of that stage.

Usage, from the repo root:
    python3 island/pixel/water.py island/pixel
Writes island/pixel/water/<key>_<level>.png, manifest.json and a preview sheet.
"""

import json
import math
import os
import sys

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import plants  # noqa: E402
from plants import Sprite, font, rnd  # noqa: E402

# --- palette ----------------------------------------------------------------
plants.COLORS.update({
    "ink": "#33485C",
    "hull_white": "#F2F6F8",
    "hull_grey": "#B9C6CF",
    "hull_red": "#D8503F",
    "sea_grey": "#6B8AA3",
    "sea_grey_light": "#94B0C4",
    "buoy_orange": "#E8632F",
    "stone_light": "#C3CFD6",
    "stone_mid": "#94A3AD",
    "stone_dark": "#5F6E79",
    "foam": "#E2FCFF",
})
plants.MATERIALS.update({
    "hull": ["ink", "hull_grey", "hull_white", "hull_white", "foam"],
    "hull_red": ["ink", "hull_red", "hull_red", "hull_white", "foam"],
    "sail": ["ink", "hull_grey", "hull_white", "foam", "foam"],
    "buoy": ["ink", "buoy_orange", "buoy_orange", "hull_white", "foam"],
    "dolphin": ["ink", "sea_grey", "sea_grey", "sea_grey_light", "hull_white"],
    "gull": ["ink", "hull_grey", "hull_white", "hull_white", "foam"],
    "rock": ["stone_dark", "stone_dark", "stone_mid", "stone_light", "hull_white"],
    "foam": ["ink", "foam", "foam", "foam", "foam"],
    "ink": ["ink", "ink", "ink", "ink", "ink"],  # eyes, tips, single dark pixels
})
plants.OUTLINE_PRIORITY.update({
    "hull": 5, "hull_red": 5, "sail": 4, "buoy": 5, "dolphin": 5, "gull": 4,
    "rock": 3, "foam": 1, "ink": 6,
})

WATER_LINE = 0.0  # v = 0 is the water surface at the anchor


def ripple(sp, u, v, ru, dense=True):
    """Foam ring on the water, drawn before the object so it stays behind it."""
    cx, cy = sp.at(u, v)
    rx = ru * sp.s
    ry = max(1.0, rx / 2)
    for y in range(math.floor(cy - ry) - 1, math.ceil(cy + ry) + 2):
        for x in range(math.floor(cx - rx) - 1, math.ceil(cx + rx) + 2):
            dx = (x + 0.5 - cx) / rx
            dy = (y + 0.5 - cy) / ry
            distance = dx * dx + dy * dy
            if 0.74 < distance <= 1.0 and (dense or rnd(x, y, 3) > 0.42):
                sp.put(x, y, "foam", 2)


def cluster(count, spread_u, spread_v, seed):
    """Deterministic scatter, sorted back to front."""
    spots = []
    for k in range(count):
        angle = k * 2.39996 + rnd(seed, k) * 0.6
        radius = math.sqrt((k + 0.55) / max(1, count))
        spots.append((math.cos(angle) * radius * spread_u, math.sin(angle) * radius * spread_v))
    return sorted(spots, key=lambda spot: spot[1])


# ---------------------------------------------------------------------------
# Single pieces. Both the group pictures and the island layout draw these.
# ---------------------------------------------------------------------------


def item_buoy(sp, u, v):
    ripple(sp, u, v + 0.4, 2.6)
    one = sp.part()
    one.blob(u, v - 2.0, 1.5, 2.0, "buoy")
    x, y = one.at(u, v - 2.6)
    one.put(math.floor(x), math.floor(y), "buoy", 3)
    x, y = one.at(u, v - 4.2)
    one.put(math.floor(x), math.floor(y), "ink", 0)
    sp.merge(one)


KAYAK_COLORS = ["buoy", "hull_red", "hull"]


def item_kayak(sp, u, v, index=0):
    ripple(sp, u, v + 0.2, 6.5)
    one = sp.part()
    material = KAYAK_COLORS[index % len(KAYAK_COLORS)]
    for t in range(-6, 7):  # long hull with pointed ends
        f = abs(t) / 6.0
        x, y = one.at(u + t * 0.92, v - 1.4)
        one.put(math.floor(x), math.floor(y), material, 3 if t < 0 else 2)
        if f < 0.72:
            one.put(math.floor(x), math.floor(y) + 1, material, 1)
    x, y = one.at(u, v - 1.4)
    one.put(math.floor(x), math.floor(y), "ink", 0)  # cockpit
    one.put(math.floor(x) + 1, math.floor(y), "ink", 0)
    sp.merge(one)
    paddle = sp.part()
    for t in range(-3, 4):
        x, y = paddle.at(u + t * 1.1, v - 2.2)
        paddle.put(math.floor(x), math.floor(y) - (1 if t < 0 else 0), "wood", 2)
    sp.merge(paddle, outline=False)


def item_rock(sp, u, v, size_index=0):
    size = (2.4, 3.4, 4.6)[size_index % 3]
    ripple(sp, u, v + 0.2, size * 1.6)
    one = sp.part()
    one.blob(u, v - size * 0.55, size, size * 0.8, "rock")
    waterline = one.at(u, v - size * 0.15)[1]
    for (x, y), (mat, lvl) in list(one.px.items()):
        if y > waterline:
            one.px[(x, y)] = ("rock", 1)
    sp.merge(one)


def item_dolphin(sp, u, v):
    ripple(sp, u, v + 0.2, 5.4)
    one = sp.part()
    steps = 26
    for t in range(steps + 1):  # the back, arching out of the water
        f = t / steps
        bu = u - 5.0 + f * 10.0
        arc = math.sin(math.pi * f) ** 0.75
        bv = v - 0.6 - 4.0 * arc
        x, y = one.at(bu, bv)
        for k in range(1 + int(2.4 * arc)):
            one.put(math.floor(x), math.floor(y) + k, "dolphin", 3 if k == 0 else 2)
    one.poly(  # dorsal fin
        [(u - 0.6, v - 4.4), (u + 0.4, v - 7.0), (u + 1.8, v - 4.2)], "dolphin", lambda x, y: 3
    )
    one.poly(  # tail fluke
        [(u - 5.2, v - 1.2), (u - 7.0, v - 3.4), (u - 4.4, v - 2.6)], "dolphin", lambda x, y: 2
    )
    x, y = one.at(u + 4.4, v - 1.4)
    one.put(math.floor(x), math.floor(y), "dolphin", 2)
    x, y = one.at(u + 3.2, v - 2.6)
    one.put(math.floor(x), math.floor(y), "ink", 0)
    sp.merge(one)


def item_gull(sp, u, v, height=20, big=False):
    one = sp.part()
    body = [(-1, 0), (0, 0), (1, 0)]
    wings = [(-3, -1), (-2, -1), (2, -1), (3, -1)]
    if big:
        wings += [(-4, -1), (4, -1)]
    for dx, dy in body:
        x, y = one.at(u + dx, v - height + dy)
        one.put(math.floor(x), math.floor(y), "gull", 2)
    for dx, dy in wings:
        x, y = one.at(u + dx, v - height + dy)
        one.put(math.floor(x), math.floor(y), "gull", 3)
    sp.merge(one)


def draw_boat(sp, level):
    """Rowboat to yacht, drawn into an existing sprite at its anchor."""
    length = 9.0 + level * 3.2
    depth = 2.6 + level * 0.42
    ripple(sp, 0, 0.5, length * 0.52)

    hull = sp.part()
    hull.blob(0, -depth * 0.45, length / 2, depth * 0.85, "hull")
    waterline = hull.at(0, -depth * 0.45)[1] + depth * 0.25 * sp.s
    for (x, y), (mat, lvl) in list(hull.px.items()):
        if y > waterline:
            hull.px[(x, y)] = ("hull_red" if level >= 3 else "hull", max(1, lvl - 1))
    sp.merge(hull)

    deck = sp.part()
    deck.blob(0, -depth * 0.75, length / 2 - 1.4, depth * 0.42, "wood")
    sp.merge(deck, outline=False)

    if level <= 2:  # oars
        for side in (-1, 1):
            oar = sp.part()
            for t in range(int(6 * sp.s) + 4):
                f = t / (6 * sp.s + 3)
                x = sp.at(-length * 0.1 + f * length * 0.42, 0)[0]
                y = sp.at(0, -depth * 0.8 + side * 0.2 + f * depth * 1.1)[1]
                oar.put(math.floor(x), math.floor(y), "wood", 2)
            sp.merge(oar, outline=False)
        return
    mast_height = depth + 3.5 + level * 1.5
    mast = sp.part()
    mast.trunk(-0.5, -mast_height, -depth * 0.7, 1, mat="wood")
    sp.merge(mast)
    sail = sp.part()
    sail.poly(
        [(0.6, -mast_height + 1), (0.6, -depth * 0.9), (length * 0.32, -depth * 0.9)],
        "sail",
        lambda x, y: 2 if x % 2 or y % 2 else 3,
    )
    if level >= 5:  # jib
        sail.poly(
            [(-0.6, -mast_height * 0.78), (-0.6, -depth * 0.9), (-length * 0.24, -depth * 0.9)],
            "sail",
            lambda x, y: 2,
        )
    sp.merge(sail)
    if level >= 7:  # cabin
        cabin = sp.part()
        cabin.blob(-length * 0.12, -depth * 1.25, length * 0.16, depth * 0.5, "hull")
        sp.merge(cabin)
    if level >= 9:  # upper deck and flag
        top = sp.part()
        top.blob(-length * 0.12, -depth * 1.9, length * 0.1, depth * 0.35, "hull")
        sp.merge(top)
        flag = sp.part()
        flag.poly(
            [(0.6, -mast_height + 1), (3.2, -mast_height + 2.2), (0.6, -mast_height + 3.4)],
            "hull_red",
            lambda x, y: 2,
        )
        sp.merge(flag)


def iso_quad(sp, cells_a, cells_b, mat, shade, lift=0.0):
    """Fill the diamond of a cells_a x cells_b footprint, lifted by `lift` pixels."""
    cw, ch = 4 * sp.s, 2 * sp.s
    ax, ay = sp.ax, sp.ay - lift * sp.s
    for y in range(math.floor(ay - ch * (cells_a + cells_b)) - 2, math.ceil(ay) + 2):
        for x in range(math.floor(ax - cw * cells_a) - 2, math.ceil(ax + cw * cells_b) + 2):
            dx = x + 0.5 - ax
            dy = y + 0.5 - ay
            j = (dx / cw - dy / ch) / 2
            i = (-dy / ch - dx / cw) / 2
            if 0 <= i <= cells_a and 0 <= j <= cells_b:
                sp.put(x, y, mat, shade(i, j))


def draw_dock(sp, level, angle=None, mirror=False):
    """Walkway running away from the shore, drawn into an existing sprite."""
    width = 2
    length = 3 + level
    ripple(sp, 2, 1.0, 3 + length * 0.7, dense=False)
    deck = sp.part()
    iso_quad(deck, width, length, "wood", lambda i, j: 3 if int(j) % 2 == 0 else 2, lift=1.2)
    sp.merge(deck)
    posts = sp.part()
    for j in range(1, length, 2):
        for i in (0, width):
            x = math.floor(sp.ax + (-i + j) * 4 * sp.s)
            y = math.floor(sp.ay - (i + j) * 2 * sp.s)
            for dy in range(0, max(2, int(3 * sp.s))):
                posts.put(x, y + dy, "wood", 1)
    sp.merge(posts, outline=False)
    if level >= 6:  # T shaped head
        head = sp.part()
        head.ax = sp.ax + round((length - 1) * 4 * sp.s)
        head.ay = sp.ay - round((length - 1) * 2 * sp.s)
        iso_quad(head, 4, 2, "wood", lambda i, j: 3 if int(i) % 2 == 0 else 2, lift=1.2)
        sp.merge(head)
    if level >= 8:  # mooring post
        mooring = sp.part()
        x = math.floor(sp.ax + (length + 0.5) * 4 * sp.s)
        y = math.floor(sp.ay - (length + 0.5) * 2 * sp.s)
        for dy in range(-int(4 * sp.s), 1):
            mooring.put(x, y + dy, "wood", 3 if dy < -1 else 2)
        sp.merge(mooring)


    if mirror:  # run towards the upper left instead
        flipped = {}
        for (x, y), value in sp.px.items():
            flipped[(2 * sp.ax - x, y)] = value
        sp.px = flipped
        shadow = {(2 * sp.ax - x, y) for x, y in sp.shadow}
        sp.shadow = shadow


# ---------------------------------------------------------------------------
# Group pictures, one per growth stage (used by the reveal screen and the timer)
# ---------------------------------------------------------------------------


# Beyond stage 10 the hull is finished and the fleet grows instead: one more boat
# joins per stage, at the size it has on the island (layout.py).
FLEET_MATES = [(-40, -10, 4), (48, -6, 7), (-36, 12, 2), (46, 17, 5)]


def boat(level, s=1.0):
    sp = Sprite(s)
    hull = min(10, level)
    sp.set_footprint(min(4, 2 + hull // 4), min(8, 3 + hull // 2))
    mates = FLEET_MATES[: max(0, level - 10)]

    def mate_at(du, dv, mate_level):
        origin = (sp.bx, sp.by)
        sp.bx, sp.by = origin[0] + du * s, origin[1] + dv * s
        draw_boat(sp, mate_level)
        sp.bx, sp.by = origin

    for du, dv, mate_level in mates:  # the ones further away go in first
        if dv < 0:
            mate_at(du, dv, mate_level)
    draw_boat(sp, hull)
    for du, dv, mate_level in mates:
        if dv >= 0:
            mate_at(du, dv, mate_level)
    return sp


def dock(level, s=1.0):
    sp = Sprite(s)
    sp.set_footprint(2, 3 + level)
    draw_dock(sp, level)
    return sp


def buoys(level, s=1.0):
    sp = Sprite(s)
    sp.set_footprint(1 + level // 4, 1 + level // 4)
    for u, v in cluster(level, 7 + level * 1.6, 3.5 + level * 0.8, seed=11):
        item_buoy(sp, u, v)
    return sp


def kayaks(level, s=1.0):
    sp = Sprite(s)
    sp.set_footprint(1 + level // 3, 3 + level // 2)
    for index, (u, v) in enumerate(cluster(level, 9 + level * 1.8, 4 + level * 0.9, seed=23)):
        item_kayak(sp, u, v, index)
    return sp


def rocks(level, s=1.0):
    sp = Sprite(s)
    sp.set_footprint(2 + level // 3, 2 + level // 3)
    for index, (u, v) in enumerate(cluster(level, 8 + level * 1.9, 4 + level, seed=31)):
        item_rock(sp, u, v, index)
    return sp


# Dolphins swim in schools of 3, 5, 7 and 9; when one is full the next starts,
# up to three schools (layout.py). These are the dolphins in the water at each
# stage, and the app reads the same numbers out of growRewards.ts.
DOLPHIN_PIECES = [3, 5, 7, 9, 12, 14, 16, 18, 21, 23, 25, 27]


def dolphins(level, s=1.0):
    sp = Sprite(s)
    sp.set_footprint(0, 0)
    count = DOLPHIN_PIECES[max(1, min(level, len(DOLPHIN_PIECES))) - 1]
    # the school spreads with the square root of its size, so it never clumps
    for u, v in cluster(count, 10 + count * 1.45, 5 + count * 0.8, seed=41):
        item_dolphin(sp, u, v)
    return sp


def gulls(level, s=1.0):
    sp = Sprite(s)
    sp.set_footprint(0, 0)
    for index, (u, v) in enumerate(cluster(level, 12 + level * 1.6, 6 + level * 0.9, seed=53)):
        item_gull(sp, u, v, 16 + (index % 4) * 6 + rnd(index, 9) * 5, index % 3 == 0)
    return sp


# ---------------------------------------------------------------------------
# Catalogue and export
# ---------------------------------------------------------------------------

WATER = [
    ("boat", "Boot", boat, 14, "Ruderboot → Yacht, ab Stufe 11 kommt die Flotte dazu", "shallow"),
    ("dock", "Steg", dock, 10, "wächst ins Wasser, ab Stufe 6 mit T-Kopf", "coast"),
    ("buoys", "Bojen", buoys, 10, "1 bis 10 Bojen", "shallow"),
    ("kayaks", "Kajaks", kayaks, 8, "1 bis 8 Kajaks", "shallow"),
    ("rocks", "Felsen", rocks, 9, "1 bis 9 Felsen", "shallow"),
    ("dolphins", "Delfine", dolphins, 12, "Schulen zu 3, 5, 7, 9 — bis 3 Schulen, 27 Delfine", "deep"),
    ("gulls", "Möwen", gulls, 12, "Schwarm von 1 bis 12, eigene Luftebene", "air"),
]

SEA = (34, 136, 220)
SEA_DARK = (24, 110, 186)
PAPER = (244, 241, 234, 255)


def build(out_dir):
    water_dir = os.path.join(out_dir, "water")
    preview_dir = os.path.join(out_dir, "previews")
    os.makedirs(water_dir, exist_ok=True)
    os.makedirs(preview_dir, exist_ok=True)

    manifest = []
    rows = []
    for key, label, builder, levels, note, zone in WATER:
        items = []
        for level in range(1, levels + 1):
            img, anchor = builder(level).image()
            name = f"{key}_{level}.png"
            img.save(os.path.join(water_dir, name))
            manifest.append({
                "key": key,
                "level": level,
                "file": name,
                "size": [img.width, img.height],
                "anchorPx": list(anchor),
                "zone": zone,
                "layer": "air" if zone == "air" else "object",
            })
            items.append((img, anchor, name))
        rows.append((label, key, levels, note, items))
    with open(os.path.join(water_dir, "manifest.json"), "w") as handle:
        json.dump(manifest, handle, indent=2)

    # preview sheet on water, 1x then 5x nearest neighbour
    pad, title_h, caption_h, scale = 8, 8, 6, 5
    layout, sheet_w, y = [], 0, pad
    for label, key, levels, note, items in rows:
        above = max(anchor[1] for _, anchor, _ in items) + 2
        below = max(img.height - anchor[1] for img, anchor, _ in items) + 2
        x, cells = pad, []
        for img, anchor, name in items:
            cell_w = img.width + pad
            cells.append((x, cell_w, img, anchor, name))
            x += cell_w
        sheet_w = max(sheet_w, x + pad)
        layout.append((label, key, note, y, above, below, cells))
        y += title_h + above + below + caption_h + pad
    sheet = Image.new("RGBA", (sheet_w, y), PAPER)
    for label, key, note, top, above, below, cells in layout:
        baseline = top + title_h + above
        for x, cell_w, img, anchor, name in cells:
            for yy in range(baseline - above, baseline + below):
                for xx in range(x - pad // 2, x + cell_w - pad // 2):
                    if 0 <= xx < sheet.width and 0 <= yy < sheet.height:
                        sheet.putpixel((xx, yy), SEA if (yy // 3) % 2 == 0 else SEA_DARK)
            layer = Image.new("RGBA", sheet.size, (0, 0, 0, 0))
            layer.paste(img, (x + (cell_w - pad) // 2 - anchor[0], baseline - anchor[1]))
            sheet = Image.alpha_composite(sheet, layer)
    big = sheet.resize((sheet.width * scale, sheet.height * scale), Image.NEAREST)
    draw = ImageDraw.Draw(big)
    title_font, caption_font = font(28), font(18)
    for label, key, note, top, above, below, cells in layout:
        draw.text(
            (pad * scale, top * scale + 2),
            f"{label}  ·  {key}  ·  {len(cells)} Stufen  ·  {note}",
            fill=(40, 40, 40, 255),
            font=title_font,
        )
        baseline = top + title_h + above
        for x, cell_w, img, anchor, name in cells:
            text = name.replace(".png", "").split("_")[-1]
            draw.text(
                ((x + (cell_w - pad) / 2) * scale - 6, (baseline + below + 1) * scale),
                text,
                fill=(90, 90, 90, 255),
                font=caption_font,
            )
    path = os.path.join(preview_dir, "water-sheet.png")
    big.save(path)
    return manifest, path


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "out"
    entries, sheet_path = build(out)
    print(f"{len(entries)} Sprites, Vorschau {sheet_path}")
    for key, label, _, levels, _, _ in WATER:
        sizes = [e["size"] for e in entries if e["key"] == key]
        print(f"  {label:<10} {levels:2d} Stufen  {sizes[0][0]}×{sizes[0][1]} → {sizes[-1][0]}×{sizes[-1][1]} px")
