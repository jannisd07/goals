#!/usr/bin/env python3
"""
Pixel sprites for the island buildings, catalog v1 (island/WACHSTUM.md §14.2).

Same palette, light and projection as the plants: the drawing primitives come
from plants.py, only the building materials are added here.
- 16 art pixels per metre on the ground (a 1 m cell is a 16 x 8 px diamond).
- 10 art pixels per metre of height. Light from the top left.
- Every building has 10 stages: stage 1 is the building site, stage 10 the
  finished building. Buildings exist once per island (Jannis, 2026-09-14).

Usage, from the repo root:
    python3 island/pixel/buildings.py island/pixel
Writes island/pixel/buildings/*.png and manifest.json. Spec: island/SPRITES.md.
"""

import json
import math
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from plants import COLORS, MATERIALS, OUTLINE_PRIORITY, Sprite, opaque_colors  # noqa: E402

COLORS.update({
    "wall_outline": "#4A3A2E", "wall_dark": "#C0A181", "wall_mid": "#DFC6A2", "wall_light": "#F3E5C8",
    "roof_outline": "#5A2A22", "roof_dark": "#9C4034", "roof_mid": "#C25543", "roof_light": "#DC7C61",
    "stone_outline": "#3F443E", "stone_dark": "#767C72", "stone_mid": "#98A090", "stone_light": "#C0C7B6",
    "glass_outline": "#2E5C6B", "glass_dark": "#79B3CB", "glass_mid": "#A9D8E8", "glass_light": "#DCF2F9",
    "dark_outline": "#2A2622", "dark_dark": "#4C453D", "dark_mid": "#6A6157", "dark_light": "#8A8074",
})
MATERIALS.update({
    "wall": ["wall_outline", "wall_dark", "wall_dark", "wall_mid", "wall_light"],
    "roof": ["roof_outline", "roof_dark", "roof_dark", "roof_mid", "roof_light"],
    "stone": ["stone_outline", "stone_dark", "stone_dark", "stone_mid", "stone_light"],
    "glass": ["glass_outline", "glass_dark", "glass_dark", "glass_mid", "glass_light"],
    "dark": ["dark_outline", "dark_dark", "dark_dark", "dark_mid", "dark_light"],
})
OUTLINE_PRIORITY.update({"wall": 3, "roof": 5, "stone": 2, "glass": 3, "dark": 4})

# Stages per building: small and plain ones need fewer steps, big and detailed
# ones more (Jannis, 2026-09-14: "8 bis 12, je nach Größe und Detail").
STAGES_DEFAULT = 10
PX_PER_M_X = 8.0   # half a 1 m diamond: one metre along an axis is 8 px sideways
PX_PER_M_Y = 4.0   # ... and 4 px up the screen
PX_PER_M_H = 10.0  # height


def at(w, d, h):
    """Ground metres (w along the right axis, d along the left axis) plus height, in sprite px."""
    return (w * PX_PER_M_X - d * PX_PER_M_X, -w * PX_PER_M_Y - d * PX_PER_M_Y - h * PX_PER_M_H)


def shift(point, du, dv):
    return (point[0] + du, point[1] + dv)


def origin_for(w, d):
    """Front corner in sprite coordinates so the footprint centre sits on the anchor."""
    return (-(4 * w - 4 * d), (2 * w + 2 * d))


def canvas(sp, u, v):
    """Sprite (u, v) to raw canvas pixels, for the few details drawn pixel by pixel."""
    return sp.bx + u * sp.s, sp.by + v * sp.s


def box(sp, origin, w, d, h, mat, levels=(4, 3, 1), base=0.0):
    """A box from `base` metres up to `base + h`: top face, left face, right face."""
    top_l, left_l, right_l = levels
    ou, ov = origin
    p = lambda a, b, c: shift(at(a, b, c), ou, ov)
    if h > 0:
        sp.poly([p(0, 0, base), p(w, 0, base), p(w, 0, base + h), p(0, 0, base + h)], mat, lambda x, y: right_l)
        sp.poly([p(0, 0, base), p(0, d, base), p(0, d, base + h), p(0, 0, base + h)], mat, lambda x, y: left_l)
    sp.poly([p(0, 0, base + h), p(w, 0, base + h), p(w, d, base + h), p(0, d, base + h)], mat, lambda x, y: top_l)


def hip_roof(sp, origin, w, d, base_h, rise, mat, overhang=0.18):
    """Four slopes meeting in one point; the back ones are drawn first."""
    ou, ov = origin
    o = overhang
    p = lambda a, b, c: shift(at(a, b, c), ou, ov)
    apex = p(w / 2, d / 2, base_h + rise)
    corners = [p(-o, -o, base_h), p(w + o, -o, base_h), p(w + o, d + o, base_h), p(-o, d + o, base_h)]
    faces = [
        ([corners[1], corners[2], apex], 2),   # back right
        ([corners[2], corners[3], apex], 2),   # back left
        ([corners[0], corners[1], apex], 1),   # front right, away from the light
        ([corners[3], corners[0], apex], 4),   # front left, lit
    ]
    for pts, level in faces:
        sp.poly(pts, mat, lambda x, y, lv=level: lv)


def flat_roof(sp, origin, w, d, base_h, mat, thickness=0.12):
    box(sp, origin, w, d, base_h + thickness, mat, levels=(4, 3, 1))


def post(sp, origin, w, d, h, mat="wall"):
    box(sp, origin, w, d, h, mat, levels=(4, 3, 1))


def panel(sp, origin, a0, b0, h0, a1, b1, h1, mat, level):
    """A flat quad on a wall, given as two corners in building coordinates."""
    ou, ov = origin
    p = lambda a, b, c: shift(at(a, b, c), ou, ov)
    sp.poly([p(a0, b0, h0), p(a1, b1, h0), p(a1, b1, h1), p(a0, b0, h1)], mat, lambda x, y: level)


def ground_plate(sp, origin, w, d, mat="stone", level=3, h=0.08):
    box(sp, origin, w, d, h, mat, levels=(level, level - 1, level - 2))


# ---------------------------------------------------------------------------
# Detail helpers
# ---------------------------------------------------------------------------


def wall_lines(sp, o, w, d, h, count, level=2, mat="wall", front=True):
    """Plank or stone courses across a wall face."""
    for i in range(1, count + 1):
        hh = h * i / (count + 1)
        if front:
            panel(sp, o, 0, 0, hh, w, 0, hh + 0.05, mat, level)
        else:
            panel(sp, o, 0, 0, hh, 0, d, hh + 0.05, mat, level)


def roof_rows(sp, o, w, d, base_h, rise, rows=2, mat="roof", level=2, overhang=0.18):
    """Tile courses on the two visible roof slopes."""
    ou, ov = o
    p = lambda a, b, c: shift(at(a, b, c), ou, ov)
    apex = p(w / 2, d / 2, base_h + rise)
    fl, fr = p(-overhang, d + overhang, base_h), p(-overhang, -overhang, base_h)
    br = p(w + overhang, -overhang, base_h)
    lerp = lambda a, b, t: (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)
    for i in range(1, rows + 1):
        t = i / (rows + 1)
        for c0, c1 in ((fl, fr), (fr, br)):
            a, b = lerp(c0, apex, t), lerp(c1, apex, t)
            sp.poly([a, b, (b[0], b[1] + 1.2), (a[0], a[1] + 1.2)], mat, lambda x, y: level)


def window(sp, o, a0, h0, a1, h1, stage, b=0.0, cross=True):
    """Glass with a frame, and a bar across it once the building is big enough."""
    panel(sp, o, a0 - 0.06, b, h0 - 0.06, a1 + 0.06, b, h1 + 0.06, "wall", 1)
    panel(sp, o, a0, b, h0, a1, b, h1, "glass", 3)
    if cross and stage >= 7:
        mid = (h0 + h1) / 2
        panel(sp, o, a0, b, mid, a1, b, mid + 0.05, "wall", 2)
        am = (a0 + a1) / 2
        panel(sp, o, am, b, h0, am + 0.05, b, h1, "wall", 2)


def door(sp, o, a0, a1, h, stage, b=0.0):
    panel(sp, o, a0 - 0.07, b, 0, a1 + 0.07, b, h + 0.07, "wall", 1)
    panel(sp, o, a0, b, 0, a1, b, h, "dark", 2)
    if stage >= 6:  # handle
        panel(sp, o, a1 - 0.16, b, h * 0.45, a1 - 0.06, b, h * 0.55, "wall", 4)


def steps(sp, o, w, depth, count, mat="stone"):
    for i in range(count):
        t = (i + 1) / count
        ground_plate(sp, shift(at(w * 0.5 - w * 0.5 * t, -depth * (1 - i / count), 0), *o),
                     w * t, depth / count + 0.12, mat, 4 - i, h=0.06 + 0.05 * i)


def centred(o, w, d, w2, d2):
    """Origin for a box of size w2 x d2 centred on a footprint of w x d."""
    return shift(at((w - w2) / 2, (d - d2) / 2, 0), *o)


# A boat is too small for boxes and too specific for ellipses, so it is drawn as art:
# w = gunwale, d = open inside, R = hull, r = hull in shade.
BOAT_ART = [
    "......wwwwwwwww.....",
    "...wwwdddddddddww...",
    "..wddddddddddddddw..",
    ".wRddddddddddddddRw.",
    "wRRRRRRRRRRRRRRRRRRw",
    ".rRRRRRRRRRRRRRRRRr.",
    "..rrRRRRRRRRRRRRr...",
    "....rrrrrrrrrrr.....",
]
BOAT_PIXELS = {"w": ("wall", 4), "d": ("dark", 1), "R": ("roof", 3), "r": ("roof", 1)}


def boat(sp, o, a, b, length, stage):
    """The boat beside the ramp, sampled from BOAT_ART to the width the house has earned."""
    src_w, src_h = len(BOAT_ART[0]), len(BOAT_ART)
    target = max(10, round(length * PX_PER_M_X * 1.15))
    scale = target / src_w
    u, v = shift(at(a, b, 0.1), *o)
    cu, cv = canvas(sp, u, v)
    for y in range(round(src_h * scale)):
        for x in range(target):
            ch = BOAT_ART[min(src_h - 1, int(y / scale))][min(src_w - 1, int(x / scale))]
            if ch == ".":
                continue
            mat, level = BOAT_PIXELS[ch]
            sp.put(math.floor(cu + x), math.floor(cv - round(src_h * scale) + y), mat, level)
    if stage >= 8:  # oars leaning over the side
        for t in range(round(target * 0.35)):
            sp.put(math.floor(cu + target * 0.24 - t), math.floor(cv - round(src_h * scale) * 0.55 - t * 0.5), "wall", 3)


def plinth(sp, o, w, d, mat="stone", h=0.16):
    box(sp, shift((0, 0), *o), w, d, h, mat, levels=(3, 2, 1))


# ---------------------------------------------------------------------------
# Signs, emblems and round walls
# ---------------------------------------------------------------------------

# Small badges so a building says what it is at a glance. g = gold, w = light,
# x = dark, a = accent red, l = leaf green, b = blue.
EMBLEMS = {
    "book": ["ggg.ggg", "gggggggg", "ggg.ggg", "ggg.ggg", ".gg.gg."],
    "cup": ["ggggg..", "ggggg.g", "ggggggg", ".ggg.g.", "ggggg.."],
    "hammer": ["...gggg", "...gggg", ".ggg.g.", "gg...g.", "....g.."],
    "leaf": ["...gg..", "..gggg.", ".gggggg", ".ggggg.", "..g...."],
    "dumbbell": ["gg...gg", "gggggggg", "gg...gg", ".......", "......."],
    "anchor": ["..gg...", ".gggg..", "ggggggg", "g..gg..g", ".gggggg"],
    "lotus": [".g.g.g.", "gggggg.", ".ggggg.", "..ggg..", "..ggg.."],
    "star": ["...g...", "..ggg..", "ggggggg", "..ggg..", ".g...g."],
}
EMBLEM_COLORS = {
    # gold level 3 is the pale blossom tone, so the symbols use level 2, the real gold.
    "g": ("gold", 2), "w": ("wall", 4), "x": ("dark", 2),
    "a": ("roof", 3), "l": ("leaf", 3), "b": ("glass", 3),
}


def roof_icon(sp, o, a, b, height, key, scale=1):
    """The building's symbol standing above the roof, where nothing competes with it.

    A badge on the wall disappears at 25 px; a silhouette against the sky reads,
    and outline() gives it its dark edge for free.
    """
    emblem(sp, o, a, b, height, key, scale)


def emblem(sp, o, a, b, height, key, scale=1):
    """A flat badge, drawn in screen pixels."""
    art = EMBLEMS[key]
    cu, cv = canvas(sp, *shift(at(a, b, height), *o))
    for y, row in enumerate(art):
        for x, ch in enumerate(row):
            if ch == ".":
                continue
            mat, level = EMBLEM_COLORS[ch]
            for sy in range(scale):
                for sx in range(scale):
                    sp.put(math.floor(cu + x * scale + sx), math.floor(cv + y * scale + sy), mat, level)


def sign_board(sp, o, a, b, height, key, board_w=0.7, board_h=0.5):
    """Shop sign: a dark board with a frame, symbol in cream and gold on top."""
    panel(sp, o, a - 0.05, b, height - 0.05, a + board_w + 0.05, b, height + board_h + 0.05, "dark", 1)
    panel(sp, o, a, b, height, a + board_w, b, height + board_h, "dark", 3)
    emblem(sp, o, a + 0.1, b, height + board_h * 0.92, key)


def banner(sp, o, a, b, top_h, height, key=None, mat="roof"):
    """Cloth hanging on the front, optionally with a badge on it."""
    width = 0.72
    panel(sp, o, a - 0.05, b, top_h - height - 0.05, a + width + 0.05, b, top_h + 0.05, "dark", 1)
    panel(sp, o, a, b, top_h - height, a + width, b, top_h, mat, 3)
    panel(sp, o, a, b, top_h - height, a + width, b, top_h - height + 0.08, mat, 1)
    if key:
        emblem(sp, o, a + 0.1, b, top_h - height * 0.2, key)


def lantern(sp, o, a, b, height):
    box(sp, shift(at(a, b, 0), *o), 0.16, 0.16, 0.2, "gold", levels=(4, 3, 2), base=height)


def cylinder(sp, o, w, d, h, mat, base=0.0):
    """A round wall: the top is an ellipse, the side is shaded around the curve."""
    cu, cv = canvas(sp, *shift(at(w / 2, d / 2, base + h), *o))
    rx = (w + d) * PX_PER_M_X * 0.5
    ry = rx * 0.5
    for x in range(math.floor(cu - rx), math.ceil(cu + rx) + 1):
        dx = (x + 0.5 - cu) / rx
        if abs(dx) > 1:
            continue
        dy = math.sqrt(max(0.0, 1 - dx * dx)) * ry
        side = 4 if dx < -0.45 else (3 if dx < 0.2 else (2 if dx < 0.68 else 1))
        for y in range(math.floor(cv + dy), math.floor(cv + dy + h * PX_PER_M_H)):
            sp.put(x, y, mat, side)
        for y in range(math.floor(cv - dy), math.floor(cv + dy)):   # top face
            sp.put(x, y, mat, 4 if dx < 0 else 3)


def ring(sp, o, w, d, height, mat, level, base=0.0):
    """A course line running around a round wall."""
    cu, cv = canvas(sp, *shift(at(w / 2, d / 2, base + height), *o))
    rx = (w + d) * PX_PER_M_X * 0.5
    ry = rx * 0.5
    for x in range(math.floor(cu - rx), math.ceil(cu + rx) + 1):
        dx = (x + 0.5 - cu) / rx
        if abs(dx) > 1:
            continue
        y = math.floor(cv + math.sqrt(max(0.0, 1 - dx * dx)) * ry)
        if (x, y) in sp.px:
            sp.put(x, y, mat, level)


def curved_opening(sp, o, w, d, base_h, top_h, half_width, mat, level, at_base=0.0):
    """Door or window set into a round wall, following its curve."""
    cu, cv = canvas(sp, *shift(at(w / 2, d / 2, at_base + base_h), *o))
    rx = (w + d) * PX_PER_M_X * 0.5
    ry = rx * 0.5
    height_px = (top_h - base_h) * PX_PER_M_H
    for x in range(math.floor(cu - rx * half_width), math.ceil(cu + rx * half_width)):
        dx = (x + 0.5 - cu) / rx
        if abs(dx) > 1:
            continue
        front = cv + math.sqrt(max(0.0, 1 - dx * dx)) * ry
        edge = abs(dx) > half_width * 0.75
        for y in range(math.floor(front - height_px), math.floor(front)):
            if (x, y) in sp.px:
                sp.put(x, y, mat if not edge else "wall", level if not edge else 4)


def pier(sp, o, a, b, length, width):
    """Planked jetty reaching towards the water."""
    ground_plate(sp, shift(at(a, b - length, 0), *o), width, length, "wall", 3, h=0.12)
    for i in range(max(2, int(length / 0.45))):
        panel(sp, o, a, b - length + i * 0.45, 0.13, a + width, b - length + i * 0.45, 0.15, "wall", 1)
    for i in (0, 1):  # mooring posts at the end
        box(sp, shift(at(a + i * (width - 0.18), b - length, 0), *o), 0.18, 0.18, 0.42, "dark")


def buoy(sp, o, a, b, size=0.34):
    box(sp, shift(at(a, b, 0), *o), size, size, size * 0.7, "roof", levels=(4, 3, 1), base=0.02)
    panel(sp, o, a, b, size * 0.4, a + size, b, size * 0.52, "wall", 4)


# ---------------------------------------------------------------------------
# The ten buildings
# ---------------------------------------------------------------------------


def house(sp, o, w, d, h, stage):
    plinth(sp, o, w, d)
    box(sp, o, w, d, h, "wall", base=0.14)
    if stage >= 5:
        wall_lines(sp, o, w, d, h, 2, level=2)
    hip_roof(sp, o, w, d, h + 0.14, h * 0.5, "roof")
    if stage >= 6:
        roof_rows(sp, o, w, d, h + 0.14, h * 0.5, rows=2)
    door(sp, o, w * 0.36, w * 0.64, h * 0.68, stage)
    if stage >= 4:
        window(sp, o, w * 0.06, h * 0.36, w * 0.26, h * 0.68, stage)
    if stage >= 6:
        window(sp, o, w * 0.74, h * 0.36, w * 0.94, h * 0.68, stage)
    if stage >= 7:
        box(sp, shift(at(w * 0.62, d * 0.3, 0), *o), 0.3, 0.3, h * 0.5, "stone", base=h * 0.95)
    if stage >= 9:  # window box and a path stone
        panel(sp, o, w * 0.06, 0, h * 0.32, w * 0.26, 0, h * 0.36, "dark", 3)
        ground_plate(sp, shift(at(w * 0.4, -0.55, 0), *o), w * 0.25, 0.45, "stone", 4, h=0.05)


def windmill(sp, o, w, d, h, stage):
    plinth(sp, o, w, d)
    box(sp, o, w, d, h * 0.45, "stone", base=0.14)
    box(sp, o, w, d, h * 0.55, "wall", base=h * 0.45)
    if stage >= 5:
        wall_lines(sp, o, w, d, h * 0.95, 3, level=2)
    hip_roof(sp, o, w, d, h, h * 0.34, "roof")
    if stage >= 7:
        roof_rows(sp, o, w, d, h, h * 0.34, rows=1)
    door(sp, o, w * 0.36, w * 0.64, h * 0.42, stage)
    if stage >= 6:
        window(sp, o, w * 0.35, h * 0.58, w * 0.6, h * 0.78, stage, cross=False)
    if stage >= 4:  # blades
        cu, cv = canvas(sp, *shift(at(w / 2, -0.25, h * 0.78), *o))
        arm = 6 + 10 * (h / 3.4)
        for dx, dy in ((0.95, -0.5), (-0.95, 0.5), (0.5, 0.95), (-0.5, -0.95)):
            for t in range(1, int(arm)):
                x, y = math.floor(cu + dx * t), math.floor(cv + dy * t)
                sp.put(x, y, "dark", 2)
                if t > arm * 0.3:
                    sp.put(math.floor(x - dy * 1.6), math.floor(y + dx * 1.6), "wall", 4)
                    if stage >= 7:
                        sp.put(math.floor(x - dy * 2.6), math.floor(y + dx * 2.6), "wall", 3)
                    if stage >= 9:
                        sp.put(math.floor(x - dy * 3.6), math.floor(y + dx * 3.6), "wall", 4)
        sp.put(math.floor(cu), math.floor(cv), "dark", 3)
    if stage >= 8:  # sack of flour by the door
        box(sp, shift(at(w + 0.25, d * 0.35, 0), *o), 0.35, 0.35, 0.3, "wall")


def cafe(sp, o, w, d, h, stage):
    plinth(sp, o, w, d)
    box(sp, o, w, d, h, "wall", base=0.14)
    flat_roof(sp, o, w, d, h + 0.14, "roof")
    window(sp, o, w * 0.08, h * 0.26, w * 0.46, h * 0.78, stage)
    door(sp, o, w * 0.58, w * 0.86, h * 0.72, stage)
    if stage >= 6:  # striped awning sticking out over the pavement
        for i in range(5):
            a0 = w * i / 5
            light = i % 2 == 0
            box(sp, shift(at(a0, -0.42, 0), *o), w / 5, 0.42, 0.16, "roof",
                levels=(4 if light else 1, 3 if light else 1, 2), base=h * 0.82)
            panel(sp, o, a0, -0.42, h * 0.72, a0 + w / 5, -0.42, h * 0.82, "roof",
                  4 if light else 1)
    if stage >= 7:  # sign board over the door
        panel(sp, o, w * 0.52, 0, h * 0.84, w * 0.92, 0, h * 0.96, "dark", 2)
        panel(sp, o, w * 0.56, 0, h * 0.87, w * 0.88, 0, h * 0.93, "wall", 4)
        roof_icon(sp, o, w * 0.34, d * 0.5, h * 1.3, "cup")
    if stage >= 8:  # table with two chairs
        post(sp, shift(at(w + 0.45, d * 0.3, 0), *o), 0.34, 0.34, 0.38, "wall")
        post(sp, shift(at(w + 0.3, d * 0.02, 0), *o), 0.18, 0.18, 0.24, "dark")
        if stage >= 9:
            post(sp, shift(at(w + 0.9, d * 0.35, 0), *o), 0.18, 0.18, 0.24, "dark")


def library(sp, o, w, d, h, stage):
    plinth(sp, o, w, d, h=0.28)
    box(sp, o, w, d, h, "stone", base=0.26)
    if stage >= 5:
        wall_lines(sp, o, w, d, h, 2, level=2, mat="stone")
    hip_roof(sp, o, w, d, h + 0.26, h * 0.3, "roof")
    if stage >= 6:
        roof_rows(sp, o, w, d, h + 0.26, h * 0.3, rows=2)
    door(sp, o, w * 0.42, w * 0.58, h * 0.6, stage)
    if stage >= 4:  # columns across the front
        for i in range(3 if stage < 8 else 4):
            a = w * (0.08 + 0.28 * i)
            panel(sp, o, a, -0.05, 0.26, a + 0.14, -0.05, h * 0.92, "wall", 4)
    if stage >= 6:  # pediment over the entrance
        panel(sp, o, w * 0.3, -0.05, h * 0.92, w * 0.7, -0.05, h * 1.06, "wall", 3)
    if stage >= 5:
        window(sp, o, w * 0.14, h * 0.38, w * 0.3, h * 0.78, stage, cross=False)
        window(sp, o, w * 0.7, h * 0.38, w * 0.86, h * 0.78, stage, cross=False)
    if stage >= 7:
        steps(sp, o, w * 0.7, 0.5, 2)
    if stage >= 5:  # red banner beside the entrance
        banner(sp, o, w * 0.72, -0.06, h * 0.95, h * 0.55)
    if stage >= 6:  # golden book over the roof
        roof_icon(sp, o, w * 0.28, d * 0.5, h * 1.5, "book")
    if stage >= 8:  # stack of books by the door
        box(sp, shift(at(w * 0.2, -0.42, 0), *o), 0.36, 0.3, 0.12, "roof", levels=(4, 3, 1))
        box(sp, shift(at(w * 0.2, -0.42, 0), *o), 0.34, 0.28, 0.1, "glass", levels=(4, 3, 1), base=0.12)
        box(sp, shift(at(w * 0.22, -0.4, 0), *o), 0.3, 0.26, 0.1, "gold", levels=(4, 3, 1), base=0.22)
    if stage >= 9:
        lantern(sp, o, w * 0.06, -0.05, h * 0.7)


def workshop(sp, o, w, d, h, stage):
    plinth(sp, o, w, d)
    box(sp, o, w, d, h * 0.78, "wall", base=0.14)
    flat_roof(sp, o, w, d, h * 0.78 + 0.14, "roof")
    if stage >= 6:  # skylight on the roof
        box(sp, shift(at(w * 0.22, d * 0.3, 0), *o), w * 0.5, d * 0.4, h * 0.16,
            "glass", levels=(4, 3, 2), base=h * 0.78 + 0.26)
    if stage >= 5:
        wall_lines(sp, o, w, d, h * 0.78, 3, level=2)
    door(sp, o, w * 0.12, w * 0.5, h * 0.62, stage)
    if stage >= 5:
        window(sp, o, w * 0.62, h * 0.3, w * 0.9, h * 0.6, stage)
    if stage >= 8:
        box(sp, shift(at(w * 0.82, d * 0.75, 0), *o), 0.28, 0.28, h * 0.55, "stone", base=h * 0.82)
    if stage >= 7:  # workbench and log pile outside
        post(sp, shift(at(w + 0.35, d * 0.2, 0), *o), 0.5, 0.3, 0.35, "wall")
        roof_icon(sp, o, w * 0.3, d * 0.5, h * 1.45, "hammer")
    if stage >= 9:
        post(sp, shift(at(w + 0.3, d * 0.7, 0), *o), 0.3, 0.3, 0.22, "dark")


def greenhouse(sp, o, w, d, h, stage):
    plinth(sp, o, w, d)
    box(sp, o, w, d, h, "glass", levels=(4, 3, 2), base=0.14)
    hip_roof(sp, o, w, d, h + 0.14, h * 0.28, "glass")
    bars = 3 if stage >= 6 else 2
    for i in range(bars):  # frame uprights
        a = w * (0.12 + (0.76 / max(1, bars - 1)) * i)
        panel(sp, o, a, 0, 0.14, a + 0.08, 0, h, "wall", 3)
    if stage >= 5:  # horizontal glazing bar
        panel(sp, o, 0, 0, h * 0.55, w, 0, h * 0.6, "wall", 3)
    if stage >= 6:  # plants behind the glass
        for i in range(3):
            a = w * (0.2 + 0.28 * i)
            panel(sp, o, a, 0, 0.16, a + w * 0.12, 0, h * 0.34, "leaf", 3)
    if stage >= 7:
        door(sp, o, w * 0.42, w * 0.6, h * 0.55, stage)
    if stage >= 7:
        roof_icon(sp, o, w * 0.3, d * 0.5, h * 1.5, "leaf")
    if stage >= 9:  # ridge vent
        panel(sp, o, w * 0.3, d * 0.5, h + h * 0.28, w * 0.7, d * 0.5, h + h * 0.33, "wall", 4)


def training_ground(sp, o, w, d, h, stage):
    ground_plate(sp, o, w, d, "wall", 4, h=0.16)          # wooden deck
    ground_plate(sp, shift(at(w * 0.1, d * 0.1, 0), *o), w * 0.8, d * 0.8, "stone", 3, h=0.18)
    bar_h = max(0.7, h * 1.1)
    for a in (w * 0.18, w * 0.72):                         # pull-up frame
        post(sp, shift(at(a, d * 0.2, 0), *o), 0.16, 0.16, bar_h, "dark")
    panel(sp, o, w * 0.18, d * 0.2, bar_h, w * 0.72 + 0.16, d * 0.2, bar_h + 0.14, "dark", 3)
    if stage >= 5:  # bench
        post(sp, shift(at(w * 0.18, d * 0.65, 0), *o), 0.7, 0.3, 0.3, "wall")
    if stage >= 6:  # weight rack
        post(sp, shift(at(w * 0.62, d * 0.6, 0), *o), 0.5, 0.4, 0.45, "wall")
        panel(sp, o, w * 0.62, d * 0.6, 0.45, w * 0.62 + 0.5, d * 0.6, 0.55, "dark", 2)
    if stage >= 8:  # punching bag on the frame
        panel(sp, o, w * 0.45, d * 0.2, bar_h - 0.55, w * 0.58, d * 0.2, bar_h, "dark", 2)
    if stage >= 9:
        post(sp, shift(at(w * 0.82, d * 0.82, 0), *o), 0.3, 0.3, 0.2, "dark")
    if stage >= 7:  # dumbbell on a post, tall enough to stand against the sky
        box(sp, shift(at(w * 0.08, d * 0.08, 0), *o), 0.12, 0.12, 1.15, "dark")
        roof_icon(sp, o, w * 0.02, d * 0.08, 1.5, "dumbbell")


def yoga_pavilion(sp, o, w, d, h, stage):
    ground_plate(sp, o, w, d, "wall", 4, h=0.22)
    if stage >= 6:
        steps(sp, o, w * 0.5, 0.4, 2, mat="wall")
    for a, b in ((0.08, 0.08), (w - 0.26, 0.08), (0.08, d - 0.26), (w - 0.26, d - 0.26)):
        post(sp, shift(at(a, b, 0), *o), 0.2, 0.2, h, "dark")
    hip_roof(sp, o, w, d, h, h * 0.26, "roof", overhang=0.16)
    if stage >= 6:
        roof_rows(sp, o, w, d, h, h * 0.26, rows=2, overhang=0.16)
    if stage >= 5:  # mat on the platform
        panel(sp, o, w * 0.28, d * 0.3, 0.23, w * 0.72, d * 0.72, 0.23, "dark", 3)
    if stage >= 7:  # rail between the back posts
        panel(sp, o, 0.16, d - 0.2, h * 0.45, w - 0.16, d - 0.2, h * 0.52, "dark", 3)
    if stage >= 8:  # curtain between the front posts
        panel(sp, o, 0.3, 0.06, h * 0.42, w * 0.45, 0.06, h * 0.9, "glass", 4)
        panel(sp, o, 0.3, 0.06, h * 0.86, w * 0.45, 0.06, h * 0.9, "glass", 2)
    if stage >= 7:  # lotus on the roof peak
        roof_icon(sp, o, w * 0.3, d * 0.5, h * 1.45, "lotus")
    if stage >= 9:  # lanterns at two corners
        lantern(sp, o, 0.1, 0.1, h * 0.74)
        lantern(sp, o, w - 0.26, 0.1, h * 0.74)


def observatory(sp, o, w, d, h, stage):
    """A round tower, so the dome sits on it instead of balancing on a box."""
    lower_h = h * 0.58
    up_w, up_d = w * 0.82, d * 0.82
    up_o = centred(o, w, d, up_w, up_d)
    ground_plate(sp, centred(o, w, d, w * 1.26, d * 1.26), w * 1.26, d * 1.26, "stone", 3, h=0.12)
    cylinder(sp, o, w, d, lower_h, "stone", base=0.1)
    cylinder(sp, up_o, up_w, up_d, h - lower_h, "stone", base=lower_h)
    if stage >= 5:  # stone courses around the tower
        for frac in (0.34, 0.68):
            ring(sp, o, w, d, lower_h * frac, "stone", 2, base=0.1)
    if stage >= 7:  # gallery ring with posts
        cylinder(sp, centred(o, w, d, w * 1.04, d * 1.04), w * 1.04, d * 1.04, 0.06, "stone", base=lower_h)
        ring(sp, centred(o, w, d, w * 1.04, d * 1.04), w * 1.04, d * 1.04, 0.06, "wall", 4, base=lower_h)
    if stage >= 5:  # dome, exactly as wide as the upper tower
        cu, cv = canvas(sp, *shift(at(up_w / 2, up_d / 2, h), *up_o))
        r = (up_w + up_d) * PX_PER_M_X * 0.5
        for y in range(math.floor(cv - r) - 2, math.ceil(cv) + 2):
            for x in range(math.floor(cu - r) - 2, math.ceil(cu + r) + 2):
                dx = (x + 0.5 - cu) / r
                dy = (y + 0.5 - cv) / (r * 0.8)
                if dy > 0.06 or dx * dx + dy * dy > 1.0:
                    continue
                sp.put(x, y, "wall", 4 if (dx + dy) < -0.5 else (3 if dx < 0.2 else (2 if dx < 0.65 else 1)))
        if stage >= 6:  # slit
            for y in range(math.floor(cv - r * 0.7), math.floor(cv - r * 0.06)):
                sp.put(math.floor(cu), y, "dark", 2)
                sp.put(math.floor(cu) + 1, y, "dark", 3)
        if stage >= 8:  # telescope with a lens
            for t in range(int(r * 0.85)):
                x = math.floor(cu + 1 + t * 0.9)
                y = math.floor(cv - r * 0.4 - t * 0.42)
                sp.put(x, y, "dark", 3)
                sp.put(x, y + 1, "dark", 2)
            sp.put(math.floor(cu + 1 + r * 0.8), math.floor(cv - r * 0.4 - r * 0.36), "glass", 4)
        if stage >= 10:  # stars over the dome
            for dx, dy in ((-r * 0.95, -r * 0.9), (r * 0.6, -r * 1.1), (-r * 0.15, -r * 1.25)):
                sp.put(math.floor(cu + dx), math.floor(cv + dy), "gold", 3)
    else:
        cylinder(sp, up_o, up_w, up_d, 0.12, "stone", base=h)
    curved_opening(sp, o, w, d, 0.1, h * 0.34, 0.22, "dark", 2)          # door
    if stage >= 6:
        curved_opening(sp, o, w, d, h * 0.4, h * 0.5, 0.16, "glass", 3)  # window
    if stage >= 9:  # star over the dome, the sign of the place
        roof_icon(sp, o, w * 0.34, d * 0.5, h * 1.62, "star")


def boathouse(sp, o, w, d, h, stage):
    plinth(sp, o, w, d, mat="wall")
    box(sp, o, w, d, h * 0.85, "wall", base=0.14)
    if stage >= 5:
        wall_lines(sp, o, w, d, h * 0.85, 3, level=2)
    hip_roof(sp, o, w, d, h * 0.85 + 0.14, h * 0.4, "roof")
    if stage >= 6:
        roof_rows(sp, o, w, d, h * 0.85 + 0.14, h * 0.4, rows=2)
    panel(sp, o, w * 0.18, 0, 0.14, w * 0.82, 0, h * 0.6, "dark", 1)      # open boat door
    panel(sp, o, w * 0.14, 0, 0.14, w * 0.18, 0, h * 0.64, "wall", 4)     # door frame
    panel(sp, o, w * 0.82, 0, 0.14, w * 0.86, 0, h * 0.64, "wall", 2)
    if stage >= 5:  # ramp with planks
        ground_plate(sp, shift(at(w * 0.18, -0.95, 0), *o), w * 0.64, 0.95, "wall", 3, h=0.07)
        for i in range(3):
            panel(sp, o, w * 0.18, -0.85 + i * 0.3, 0.08, w * 0.82, -0.85 + i * 0.3, 0.1, "wall", 1)
    if stage >= 7:  # side window
        window(sp, o, 0, h * 0.4, 0, h * 0.62, stage, b=d * 0.35, cross=False)
    if stage >= 4:  # the boat, in front of the ramp so nothing overlaps the door
        boat(sp, o, -2.15, -0.75, max(1.1, w * 0.72), stage)
    if stage >= 6:  # jetty into the water
        pier(sp, o, w * 0.25, -1.1, 1.5, w * 0.5)
    if stage >= 7:
        lantern(sp, o, w * 0.9, 0.05, h * 0.5)
        buoy(sp, o, w * 0.86, -1.25)
    if stage >= 8:  # life ring on the wall and an anchor sign over the door
        panel(sp, o, w * 0.02, 0, h * 0.4, w * 0.16, 0, h * 0.64, "dark", 1)     # life ring
        panel(sp, o, w * 0.03, 0, h * 0.42, w * 0.15, 0, h * 0.62, "roof", 4)
        panel(sp, o, w * 0.06, 0, h * 0.47, w * 0.12, 0, h * 0.57, "wall", 4)
        roof_icon(sp, o, w * 0.3, d * 0.5, h * 1.5, "anchor")
    if stage >= 9:
        buoy(sp, o, w * 0.12, -1.55, 0.28)


SPEC = [
    # key, label, builder, full footprint (w, d) in metres, full height, stages
    ("house", "House", house, (2.0, 2.0), 2.4, 10),
    ("windmill", "Windmill", windmill, (1.8, 1.8), 3.4, 11),        # tall, with blades
    ("cafe", "Café", cafe, (2.8, 2.0), 2.2, 10),
    ("library", "Library", library, (3.0, 2.6), 2.8, 12),           # biggest and most detailed
    ("workshop", "Workshop", workshop, (2.8, 2.0), 2.3, 10),
    ("greenhouse", "Greenhouse", greenhouse, (2.8, 2.0), 2.2, 9),   # one clear shape
    ("training_ground", "Training ground", training_ground, (3.0, 3.0), 1.1, 8),  # flat, plain
    ("yoga_pavilion", "Yoga pavilion", yoga_pavilion, (2.6, 2.6), 2.2, 9),
    ("observatory", "Observatory", observatory, (1.8, 1.8), 3.0, 12),  # tower plus dome
    ("boathouse", "Boathouse", boathouse, (2.8, 2.2), 2.3, 11),     # house, ramp, boat, jetty
]


def render(builder, w, d, h, stage, site=False):
    """One stage on its own sprite; the anchor stays the bottom tip of the footprint."""
    sp = Sprite(1.0)
    sp.set_footprint(max(1, round(w)), max(1, round(d)))
    origin = origin_for(w, d)
    if site:
        ground_plate(sp, origin, w, d, "stone", 3, h=0.12)
        for a, b in ((0.0, 0.0), (w - 0.2, 0.0), (0.0, d - 0.2), (w - 0.2, d - 0.2)):
            post(sp, shift(at(a, b, 0), *origin), 0.2, 0.2, 0.45, "dark")
    else:
        builder(sp, origin, w, d, h, stage)
    sp.outline()
    sp.ground_shadow(0.0, max(w, d) * 5.2)
    return sp


def growth_plan(w, d, h, stages=STAGES_DEFAULT):
    """The site, then the building from about a third to full size, in `stages` steps."""
    plan = [{"stage": 1, "site": True, "w": w * 0.55, "d": d * 0.55, "h": 0.12}]
    start = 0.34
    ratio = (1.0 / start) ** (1 / (stages - 2))
    for i in range(stages - 1):
        f = start * (ratio ** i)
        plan.append({"stage": i + 2, "site": False, "w": w * f, "d": d * f, "h": h * f})
    return plan


def build(out_dir):
    target = os.path.join(out_dir, "buildings")
    os.makedirs(target, exist_ok=True)
    for name in os.listdir(target):
        if name.endswith(".png"):
            os.remove(os.path.join(target, name))
    manifest = []
    for key, label, builder, (w, d), h, stages in SPEC:
        previous = 0
        for step in growth_plan(w, d, h, stages):
            # Detail thresholds are written for ten stages, so they are mapped onto
            # however many this building has.
            step["ref"] = round(1 + (step["stage"] - 1) * 9 / (stages - 1))
            sprite = render(builder, step["w"], step["d"], step["h"], step["ref"], step["site"])
            img, anchor = sprite.image()
            for _ in range(6):  # never shorter than the stage before
                if img.height > previous or step["site"]:
                    break
                step["w"] *= 1.06
                step["d"] *= 1.06
                step["h"] *= 1.06
                sprite = render(builder, step["w"], step["d"], step["h"], step["ref"], step["site"])
                img, anchor = sprite.image()
            previous = img.height
            name = f"{key}_{step['stage']:02d}.png"
            img.save(os.path.join(target, name))
            manifest.append({
                "key": key, "label": label, "level": step["stage"], "stages": stages, "file": name,
                "size": [img.width, img.height], "anchorPx": list(anchor),
                "footprint": [max(1, round(step["w"])), max(1, round(step["d"]))],
                "heightM": round(step["h"], 2), "maxCount": 1, "layer": "object",
                "colors": len(opaque_colors(img)),
            })
    with open(os.path.join(target, "manifest.json"), "w") as handle:
        json.dump(manifest, handle, indent=2)
    return manifest


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "island/pixel"
    result = build(out)
    print(f"{len(result)} sprites")
    for key in dict.fromkeys(e["key"] for e in result):
        rows = [e for e in result if e["key"] == key]
        print(f'{key:<16} {[e["size"][1] for e in rows]}')
