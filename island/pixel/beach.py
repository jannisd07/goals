#!/usr/bin/env python3
"""
Pixel sprites for the beach objects, catalog v1 (island/WACHSTUM.md §14.2).

Same palette, light and projection as the plants: the Sprite class comes from
plants.py, only the beach materials are added here. 16 art pixels per metre on
the ground, 10 per metre of height, light from the top left, 1 px outline.

Every object grows in 8 to 12 stages, depending on how much there is to show:
stage 1 is the first hint of it, the last stage the full thing.

Usage, from the repo root:
    python3 island/pixel/beach.py island/pixel
Writes island/pixel/beach/*.png and manifest.json. Spec: island/SPRITES.md.
"""

import json
import math
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import plants  # noqa: E402
from plants import Sprite, rnd  # noqa: E402

plants.COLORS.update({
    "sand_outline": "#A2803F", "sand_dark": "#D9BF83", "sand_mid": "#EDD9A6", "sand_light": "#F7EAC6",
    "cloth_outline": "#7A2B22", "cloth_dark": "#C2453A", "cloth_mid": "#E0685A", "cloth_light": "#F3A192",
    "linen_outline": "#8A7A5E", "linen_dark": "#D9CBA8", "linen_mid": "#F0E6CC", "linen_light": "#FBF5E4",
    "flame_outline": "#8A3B12", "flame_dark": "#E2711D", "flame_mid": "#F2A541", "flame_light": "#F9DC7C",
    "shell_outline": "#9A6070", "shell_dark": "#E39CAE", "shell_mid": "#F4C3CE", "shell_light": "#FCE6EC",
    "rock_outline": "#3F443E", "rock_dark": "#767C72", "rock_mid": "#98A090", "rock_light": "#C0C7B6",
    "straw_outline": "#7A5A24", "straw_dark": "#B98F3E", "straw_mid": "#D9AE58", "straw_light": "#EFCE84",
    "star_outline": "#8C2E22", "star_dark": "#D4472F", "star_mid": "#EE6A45", "star_light": "#F7A06F",
})
plants.MATERIALS.update({
    "sand": ["sand_outline", "sand_dark", "sand_dark", "sand_mid", "sand_light"],
    "cloth": ["cloth_outline", "cloth_dark", "cloth_dark", "cloth_mid", "cloth_light"],
    "linen": ["linen_outline", "linen_dark", "linen_dark", "linen_mid", "linen_light"],
    "flame": ["flame_outline", "flame_dark", "flame_mid", "flame_light", "flame_light"],
    "shell": ["shell_outline", "shell_dark", "shell_dark", "shell_mid", "shell_light"],
    "rock": ["rock_outline", "rock_dark", "rock_dark", "rock_mid", "rock_light"],
    "straw": ["straw_outline", "straw_dark", "straw_dark", "straw_mid", "straw_light"],
    "star": ["star_outline", "star_dark", "star_mid", "star_mid", "star_light"],
})
plants.OUTLINE_PRIORITY.update(
    {"sand": 1, "cloth": 3, "linen": 2, "flame": 4, "shell": 3, "rock": 2, "straw": 3, "star": 3}
)

PX_M = 8.0  # half a 1 m diamond sideways


def post(sp, u, v, height, mat="wood", width=1):
    """A thin upright, drawn from the ground up."""
    x0 = math.floor(sp.bx + u * sp.s + 0.5)
    y0 = math.floor(sp.by + v * sp.s + 0.5)
    for y in range(y0 - math.floor(height * sp.s), y0):
        for x in range(x0, x0 + max(1, round(width * sp.s))):
            sp.put(x, y, mat, 2 if x == x0 else 1)


def board(sp, u0, v0, u1, v1, mat, level=3, thickness=1):
    """A straight plank or rope between two points."""
    steps = max(1, int(max(abs(u1 - u0), abs(v1 - v0)) * sp.s))
    for i in range(steps + 1):
        t = i / steps
        x = math.floor(sp.bx + (u0 + (u1 - u0) * t) * sp.s + 0.5)
        y = math.floor(sp.by + (v0 + (v1 - v0) * t) * sp.s + 0.5)
        for k in range(max(1, round(thickness * sp.s))):
            sp.put(x, y + k, mat, level)


def sand_mound(sp, u, v, ru, rv):
    sp.blob(u, v, ru, rv, "sand")


def scatter(count, spread_u, spread_v, seed):
    """Positions along a row with jitter, spaced so nothing lands on top of anything."""
    spots = []
    for i in range(count):
        t = (i + 0.5) / max(1, count) - 0.5              # -0.5 .. 0.5 across the width
        jitter_u = (rnd(seed, i, 1) - 0.5) * spread_u * 0.28
        jitter_v = (rnd(seed, i, 2) - 0.5) * spread_v
        spots.append((t * 2 * spread_u + jitter_u, jitter_v))
    spots.sort(key=lambda p: p[1])
    return spots


# ---------------------------------------------------------------------------
# The eight beach objects
# ---------------------------------------------------------------------------


def block(sp, u, v, half_w, height, mat, top_level=4, front_level=2, side_level=1):
    """An upright block with a lit top, a front face and a darker right side."""
    sp.poly([(u - half_w, v), (u + half_w, v), (u + half_w, v - height), (u - half_w, v - height)],
            mat, lambda x, y: front_level)
    sp.poly([(u + half_w, v), (u + half_w + half_w * 0.22, v - half_w * 0.34),
             (u + half_w + half_w * 0.22, v - height - half_w * 0.34), (u + half_w, v - height)],
            mat, lambda x, y: side_level)
    sp.poly([(u - half_w, v - height), (u + half_w, v - height),
             (u + half_w + half_w * 0.22, v - height - half_w * 0.34),
             (u - half_w + half_w * 0.22, v - height - half_w * 0.34)], mat, lambda x, y: top_level)


def crenellations(sp, u, v, half_w, mat, step=2.0):
    """Battlement teeth along the top of a wall."""
    x = -half_w
    tooth = 0
    while x < half_w - step * 0.5:
        if tooth % 2 == 0:
            sp.poly([(u + x, v), (u + x + step, v), (u + x + step, v - 2.0), (u + x, v - 2.0)],
                    mat, lambda px, py: 4)
        x += step
        tooth += 1


def cone(sp, u, v, half_w, height, mat, level=3):
    """A pointed roof, used on the castle towers."""
    sp.poly([(u - half_w, v), (u + half_w, v), (u, v - height)], mat, lambda x, y: level)
    sp.poly([(u, v), (u + half_w, v), (u, v - height)], mat, lambda x, y: max(1, level - 2))


# ---------------------------------------------------------------------------
# The eight beach objects. Sizes are metres: 16 px across the ground, 10 px up.
# ---------------------------------------------------------------------------


def sandcastle(level, s=1.0):
    """1.7 m wide, 2 m tall at the end: wall with battlements, two towers, gate, flags."""
    sp = Sprite(s)
    t = (level - 2) / 8  # 0 at stage 2, 1 at stage 10
    if level <= 2:
        sand_mound(sp, 0, -1.2 - level * 0.6, 5.0 + level * 1.2, 2.2 + level * 0.5)
        sp.outline()
        sp.ground_shadow(0.0, 6.0)
        return sp
    wall_w = 6.0 + 5.0 * t
    wall_h = 6.0 + 7.0 * t
    sand_mound(sp, 0, -1.0, wall_w + 3.0, 2.2)
    block(sp, 0, -0.6, wall_w, wall_h, "sand")
    crenellations(sp, 0, -0.6 - wall_h, wall_w, "sand", step=2.4 + t)
    if level >= 5:  # towers left and right, taller than the wall
        for side in (-1, 1):
            tower_h = wall_h + 4.0 + 3.0 * t
            tower_w = 2.4 + 0.9 * t
            block(sp, side * (wall_w + tower_w * 0.8), -0.4, tower_w, tower_h, "sand",
                  front_level=3 if side < 0 else 2)
            if level >= 7:
                cone(sp, side * (wall_w + tower_w * 0.8), -0.4 - tower_h, tower_w + 0.6, 4.0, "cloth")
            else:
                crenellations(sp, side * (wall_w + tower_w * 0.8), -0.4 - tower_h, tower_w, "sand", step=1.8)
    if level >= 6:  # gate with a step
        gate_h = wall_h * 0.5
        sp.poly([(-1.8, -0.6), (1.8, -0.6), (1.8, -gate_h), (0, -gate_h - 1.4), (-1.8, -gate_h)],
                "wood", lambda x, y: 1)
        board(sp, -2.4, -0.4, 2.4, -0.4, "sand", 4, thickness=1.2)
    if level >= 8:  # banner on the keep
        mast = wall_h + 5.0
        post(sp, -0.5, -0.6 - wall_h, 5.0, "wood")
        sp.poly([(0.2, -0.6 - mast), (5.0, -0.6 - mast + 1.6), (0.2, -0.6 - mast + 3.2)],
                "cloth", lambda x, y: 3)
    if level >= 9:  # windows in the wall
        for u in (-wall_w * 0.5, wall_w * 0.5):
            sp.poly([(u - 0.7, -wall_h * 0.55), (u + 0.7, -wall_h * 0.55),
                     (u + 0.7, -wall_h * 0.78), (u - 0.7, -wall_h * 0.78)], "wood", lambda x, y: 1)
    sp.outline()
    sp.ground_shadow(0.0, wall_w + 4.0)
    return sp


def campfire(level, s=1.0):
    """A 1.4 m stone ring with crossed logs and a flame that grows to 1.2 m."""
    sp = Sprite(s)
    ring = 5.0 + 0.35 * level
    for i in range(9):  # stones, bigger at the front so the ring reads as a ring
        a = i / 9 * math.tau
        front = 1.0 + 0.35 * math.sin(a)
        sp.blob(math.cos(a) * ring, -0.6 + math.sin(a) * ring * 0.45, 1.5 * front, 1.0 * front, "rock")
    if level >= 3:  # crossed logs
        board(sp, -3.6, -1.4, 3.6, -2.6, "wood", 3, thickness=2.0)
        board(sp, -3.2, -2.8, 3.8, -1.2, "wood", 2, thickness=1.8)
        for end_u, end_v in ((-3.6, -1.4), (3.6, -2.6)):
            sp.blob(end_u, end_v, 0.9, 0.7, "wood", bias=0.4)
    if level >= 4:  # flame in three layers
        flame_h = 3.0 + 1.5 * (level - 3)
        sp.poly([(-2.4, -2.6), (2.4, -2.6), (1.2, -2.6 - flame_h * 0.55), (0, -2.6 - flame_h),
                 (-1.4, -2.6 - flame_h * 0.5)], "flame", lambda x, y: 2)
        sp.poly([(-1.5, -3.0), (1.5, -3.0), (0.6, -3.0 - flame_h * 0.5), (0, -3.0 - flame_h * 0.78),
                 (-0.9, -3.0 - flame_h * 0.45)], "flame", lambda x, y: 3)
        if level >= 6:
            sp.poly([(-0.7, -3.4), (0.8, -3.4), (0.2, -3.4 - flame_h * 0.5)], "flame", lambda x, y: 4)
    if level >= 7:  # sparks rising
        for i, (du, dv) in enumerate(scatter(level - 4, 3.6, 2.4, 31)):
            sp.put(math.floor(sp.bx + du * s),
                   math.floor(sp.by - (7.0 + abs(dv) * 2.4 + i * 0.8) * s), "gold", 3)
    sp.outline()
    sp.ground_shadow(0.0, ring + 1.6)
    return sp


def deck_chair(sp, u, v, stripe):
    """One chair in side view: two legs, a solid seat and a tall slanted back."""
    board(sp, u - 3.2, v, u + 1.0, v - 6.0, "wood", 2, thickness=1.6)          # rear leg
    board(sp, u + 3.2, v, u - 0.8, v - 5.6, "wood", 1, thickness=1.6)          # front leg
    sp.poly([(u - 3.6, v - 5.4), (u + 3.2, v - 6.2), (u + 3.2, v - 8.4), (u - 3.6, v - 7.6)],
            stripe, lambda x, y: 3)                                            # seat
    board(sp, u - 3.0, v - 5.8, u + 2.6, v - 6.6, "linen", 4, thickness=1.4)   # one bright stripe
    sp.poly([(u - 3.8, v - 7.4), (u - 1.0, v - 7.8), (u - 1.8, v - 14.2), (u - 4.6, v - 13.6)],
            stripe, lambda x, y: 4)                                            # backrest
    board(sp, u - 4.2, v - 10.2, u - 1.4, v - 10.6, "linen", 4, thickness=1.4)
    board(sp, u - 3.6, v - 5.4, u + 3.2, v - 6.2, "wood", 3)                   # front rail


def deck_chairs(level, s=1.0):
    """One to three chairs, from stage 6 with a 2.2 m umbrella standing between them."""
    sp = Sprite(s)
    count = max(1, min(3, round(level / 3)))
    spots = [(-10.0, 2.0), (10.0, 1.0), (0.0, -4.5)][:count]
    for index, (u, v) in enumerate(spots):
        deck_chair(sp, u, v, "cloth" if index % 2 == 0 else "shell")
    if level >= 6:  # umbrella behind the chairs
        pole_h = 22.0 + 0.5 * level
        post(sp, 0.0, -3.0, pole_h, "wood", width=1.6)
        top = -pole_h - 3.0
        radius = 12.0 + 0.5 * level
        for i in range(8):
            a0, a1 = i / 8 * math.tau, (i + 1) / 8 * math.tau
            sp.poly([(0.2, top),
                     (0.2 + math.cos(a0) * radius, top + 4.4 + math.sin(a0) * radius * 0.32),
                     (0.2 + math.cos(a1) * radius, top + 4.4 + math.sin(a1) * radius * 0.32)],
                    "cloth" if i % 2 == 0 else "linen", lambda x, y, i=i: 3 if i % 2 == 0 else 4)
        for i in range(8):
            a = (i + 0.5) / 8 * math.tau
            sp.blob(0.2 + math.cos(a) * radius * 0.95, top + 4.6 + math.sin(a) * radius * 0.31, 1.3, 0.8,
                    "cloth" if i % 2 == 0 else "linen")
        sp.put(math.floor(sp.bx + 0.2 * s), math.floor(sp.by + (top - 1.6) * s), "wood", 3)
    sp.outline()
    sp.ground_shadow(0.0, 5.0 + 2.2 * count)
    return sp


def scallop(sp, u, v, mat="shell"):
    """A fan shell seen from above: wide, flat, ribbed, with the hinge towards the viewer."""
    sp.poly([(u - 0.9, v + 1.0), (u + 0.9, v + 1.0), (u + 3.0, v - 0.8), (u + 2.2, v - 2.8),
             (u, v - 3.4), (u - 2.2, v - 2.8), (u - 3.0, v - 0.8)], mat, lambda x, y: 3)
    sp.poly([(u - 0.9, v + 1.0), (u - 3.0, v - 0.8), (u - 2.2, v - 2.8), (u, v - 3.4)],
            mat, lambda x, y: 4)                                    # lit half
    for rib in (-2.0, -1.0, 0.0, 1.0, 2.0):
        board(sp, u + rib * 0.2, v + 0.8, u + rib, v - 2.6, mat, 1)
    sp.poly([(u - 1.0, v + 1.2), (u + 1.0, v + 1.2), (u + 0.6, v + 0.2), (u - 0.6, v + 0.2)],
            mat, lambda x, y: 4)
    board(sp, u - 3.4, v - 0.8, u + 3.4, v - 0.8, mat, 1)


def starfish(sp, u, v):
    """Five thick arms, 30 cm across, in the warm red of the fruit palette."""
    for a in range(5):
        ang = a / 5 * math.tau - math.pi / 2
        tip_u = u + math.cos(ang) * 4.4
        tip_v = v + math.sin(ang) * 4.4 * 0.62
        # Level 2 is the real red; level 3 of this material is the pale blossom tone.
        sp.poly([(u + math.cos(ang - 0.5) * 1.5, v + math.sin(ang - 0.5) * 1.5 * 0.62),
                 (tip_u, tip_v),
                 (u + math.cos(ang + 0.5) * 1.5, v + math.sin(ang + 0.5) * 1.5 * 0.62)],
                "star", lambda x, y: 2)
    sp.blob(u, v, 1.5, 1.0, "star", bias=-0.2)
    sp.put(math.floor(sp.bx + u * sp.s), math.floor(sp.by + (v - 0.6) * sp.s), "star", 4)


def shells(level, s=1.0):
    """Shells and starfish on the sand, up to seven of them, never in a row."""
    sp = Sprite(s)
    count = max(1, min(8, round(level * 0.8)))
    # Two staggered rows keep the patch compact instead of a long line, and each
    # item gets its own 9 px so they do not merge into one pink mass.
    columns = math.ceil(count / 2)
    for index in range(count):
        row, col = index % 2, index // 2
        u = (col - (columns - 1) / 2) * 9.0 + (4.5 if row else 0.0)
        v = (1.8 if row else -1.8) + (rnd(17, index, 1) - 0.5) * 1.2
        if index % 3 == 2:
            starfish(sp, u, v)
        else:
            scallop(sp, u, v, "shell" if index % 2 == 0 else "linen")
    sp.outline()
    sp.ground_shadow(0.0, 5.0)
    return sp


def surfboards(level, s=1.0):
    """Up to four boards, 2.2 m long and 0.5 m wide, leaning apart so each reads."""
    sp = Sprite(s)
    count = max(1, min(4, round(level / 2.2)))
    colours = ["cloth", "linen", "leaf", "shell"]
    spacing = 6.0
    for index in range(count):
        u = -spacing * (count - 1) / 2 + index * spacing
        lean = (index - (count - 1) / 2) * 1.6
        height = 21.0 + 0.4 * level + (index % 2) * 1.5
        mat = colours[index % len(colours)]
        nose = u + lean
        sp.poly([(u - 2.4, -0.6), (u + 2.4, -0.6), (u + 2.6 + lean * 0.35, -height * 0.5),
                 (u + 1.6 + lean * 0.75, -height * 0.85), (nose, -height),
                 (u - 1.6 + lean * 0.75, -height * 0.85), (u - 2.6 + lean * 0.35, -height * 0.5)],
                mat, lambda x, y: 3)
        board(sp, u, -1.4, nose, -height * 0.9, mat, 4, thickness=1.2)          # stripe
        board(sp, u - 1.4 + lean * 0.2, -height * 0.3, u - 1.4 + lean * 0.2, -height * 0.7, mat, 1)
        sp.poly([(u + 1.8, -1.2), (u + 3.4, -0.4), (u + 1.8, -4.0)], mat, lambda x, y: 1)  # fin
    sp.outline()
    sp.ground_shadow(0.0, 3.0 + 2.4 * count)
    return sp


def hammock(level, s=1.0):
    """Two posts 2.6 m apart, 1.7 m tall, with a woven cloth hanging between them."""
    sp = Sprite(s)
    span = 9.0 + 0.5 * level
    height = 12.0 + 0.6 * level
    for side in (-1, 1):
        post(sp, side * span, 0.8 * side, height, "wood", width=1.6)
        board(sp, side * span, -height, side * (span - 2.0), -height + 1.2, "wood", 2)  # brace
    if level >= 3:
        sag = 4.0 + 0.5 * level
        steps = 26
        points = []
        for i in range(steps + 1):
            t = i / steps
            u = -span + 2 * span * t
            v = -height + 2.0 + sag * math.sin(math.pi * t)
            points.append((u, v))
        for i, (u, v) in enumerate(points):  # cloth body
            thickness = 1 if i in (0, steps) else (3 if 0.2 < i / steps < 0.8 else 2)
            for k in range(thickness):
                sp.put(math.floor(sp.bx + u * s), math.floor(sp.by + (v + k) * s),
                       "linen", 4 if k == 0 else 3)
        if level >= 5:  # weave lines across it
            for i in range(3, steps, 4):
                u, v = points[i]
                sp.put(math.floor(sp.bx + u * s), math.floor(sp.by + (v + 1) * s), "linen", 1)
        for side, i in ((-1, 0), (1, steps)):  # ropes to the posts
            u, v = points[i]
            board(sp, u, v, side * span, -height + 0.5, "linen", 2)
    if level >= 6:  # pillow
        sp.blob(-span * 0.5, -height + 3.4, 2.4, 1.3, "cloth")
    if level >= 8:  # book lying on it
        sp.blob(span * 0.35, -height + 4.2, 1.8, 0.9, "leaf")
        board(sp, span * 0.2, -height + 3.8, span * 0.5, -height + 3.8, "linen", 4)
    sp.outline()
    sp.ground_shadow(0.0, span * 0.5)
    return sp


def volleyball_net(level, s=1.0):
    """Posts 2.2 m tall, 3 m apart, with a real mesh, court lines and a ball."""
    sp = Sprite(s)
    span = 10.0 + 0.5 * level
    height = 14.0 + 0.7 * level
    for side in (-1, 1):
        post(sp, side * span, 0.8 * side, height, "wood", width=1.6)
    if level >= 3:
        depth = 6.0 + 0.5 * level
        top = -height + 1.5
        board(sp, -span, top - 1.0, span, top - 1.0, "linen", 4, thickness=1.6)   # top band
        for row in range(int(depth)):
            v = top + row
            for col in range(int(span * 2)):
                u = -span + col
                if (row + col) % 2 == 0:
                    sp.put(math.floor(sp.bx + u * s), math.floor(sp.by + v * s), "linen", 3)
        board(sp, -span, top + depth, span, top + depth, "linen", 4)              # bottom band
    if level >= 6:  # court markings
        board(sp, -span - 2.5, 4.0, span + 2.5, 4.0, "sand", 4, thickness=1.2)
        for side in (-1, 1):
            board(sp, side * (span + 2.5), 1.5, side * (span + 2.5), 4.0, "sand", 4, thickness=1.2)
    if level >= 8:  # ball with seams
        cu, cv = span * 0.5, 2.6
        sp.blob(cu, cv, 2.4, 1.5, "linen")
        board(sp, cu - 1.8, cv - 0.6, cu + 1.8, cv - 0.2, "cloth", 3)
        board(sp, cu - 0.6, cv - 1.4, cu + 0.2, cv + 1.2, "cloth", 3)
    sp.outline()
    sp.ground_shadow(0.0, span * 0.55)
    return sp


def beach_bar(level, s=1.0):
    """A 2.6 m counter under a straw roof: open bar, bottles on the top, stools in front."""
    sp = Sprite(s)
    width = 8.0 + 0.5 * level
    counter_h = 4.0 + 0.2 * level          # waist high, not a wall
    block(sp, 0, 1.4, width, counter_h, "wood", top_level=4, front_level=2)
    for i in range(int(width * 0.7)):      # plank lines
        u = -width + 1.6 + i * 2.6
        board(sp, u, 1.2, u, 1.4 - counter_h, "wood", 1)
    board(sp, -width - 0.8, 1.4 - counter_h, width + 0.8, 1.4 - counter_h, "wood", 4, thickness=1.6)
    if level >= 4:
        post_h = counter_h + 12.0
        for side in (-1, 1):
            post(sp, side * (width + 1.0), 1.2, post_h, "wood", width=1.6)
        eaves = 1.4 - post_h
        ridge = eaves - 5.5
        span = width + 5.5
        sp.poly([(-span, eaves + 2.2), (0, ridge), (span, eaves + 2.2)], "straw", lambda x, y: 3)
        sp.poly([(0, ridge), (span, eaves + 2.2), (span, eaves + 4.0), (0, ridge + 1.8)],
                "straw", lambda x, y: 1)
        sp.poly([(-span, eaves + 2.2), (0, ridge), (0, ridge + 1.8), (-span, eaves + 4.0)],
                "straw", lambda x, y: 4)
        for i in range(4):                 # straw courses
            t = (i + 1) / 5
            w_t = span * (1 - t * 0.9)
            v_t = eaves + 2.2 - (eaves + 2.2 - ridge) * t
            board(sp, -w_t, v_t, w_t, v_t, "straw", 2)
        # the dark opening between counter and roof makes it read as a bar
        sp.poly([(-width + 0.6, 1.4 - counter_h - 1.2), (width - 0.6, 1.4 - counter_h - 1.2),
                 (width - 0.6, eaves + 3.0), (-width + 0.6, eaves + 3.0)], "wood", lambda x, y: 1)
    if level >= 6:  # bottles standing on the counter
        for i in range(min(4, level - 4)):
            u = -width + 2.4 + i * 2.8
            post(sp, u, 1.4 - counter_h - 1.0, 3.0, "leaf" if i % 2 == 0 else "shell")
            sp.put(math.floor(sp.bx + u * s), math.floor(sp.by + (1.4 - counter_h - 4.2) * s), "linen", 4)
    if level >= 8:  # stools standing in front of the counter
        for i in range(2 if level < 11 else 3):
            u = -width + 4.2 + i * 6.4
            for leg in (-1.0, 1.0):  # two legs, so they stand instead of floating
                board(sp, u + leg * 0.5, 9.0, u + leg, 5.6, "wood", 2, thickness=1.2)
            sp.poly([(u - 1.6, 5.8), (u + 1.6, 5.8), (u + 1.2, 4.6), (u - 1.2, 4.6)],
                    "cloth", lambda x, y: 3)
            board(sp, u - 1.6, 5.8, u + 1.6, 5.8, "cloth", 1)
    if level >= 10:  # lantern hanging from the roof
        board(sp, width * 0.5, 1.4 - counter_h - 9.0, width * 0.5, 1.4 - counter_h - 7.0, "wood", 2)
        sp.blob(width * 0.5, 1.4 - counter_h - 6.2, 1.5, 1.7, "gold")
    sp.outline()
    sp.ground_shadow(0.0, width + 2.0)
    return sp


BEACH = [
    # key, label, builder, stages, note
    ("sandcastle", "Sandburg", sandcastle, 10, "Haufen → Burg mit Türmen, Fahne, Graben"),
    ("campfire", "Lagerfeuer", campfire, 9, "Steinring → Scheite → Flamme mit Funken"),
    ("deck_chairs", "Liegestühle", deck_chairs, 9, "1 bis 4 Stühle, ab Stufe 6 mit Schirm"),
    ("shells", "Muscheln", shells, 10, "1 bis 11 Muscheln und Seesterne"),
    ("surfboards", "Surfbretter", surfboards, 8, "1 bis 5 Bretter im Sand"),
    ("hammock", "Hängematte", hammock, 9, "Pfosten → Tuch → Kissen und Buch"),
    ("volleyball_net", "Volleyballnetz", volleyball_net, 9, "Pfosten → Netz → Linien und Ball"),
    ("beach_bar", "Strandbar", beach_bar, 12, "Theke → Palmendach → Flaschen, Hocker, Laterne"),
]

# Weltmassstab. Zwei Grenzen zugleich:
#
#   1. Neben den Pflanzen. Ein ausgewachsener Laubbaum ist 26x34 px (2.6 m breit,
#      3.4 m hoch). Was in Wirklichkeit kleiner ist als ein Baum, muss auch
#      kleiner gezeichnet sein — die erste Fassung war durchweg baumgross.
#   2. Auf den Sand. Das Sandband der Insel ist nur 0.5 bis 1.7 m breit und die
#      nutzbare Uferlinie auf Stufe 5 rund 218 px lang. Alle acht Objekte in
#      Endstufe zusammen duerfen nicht breiter sein als das, sonst steht etwas
#      im Gras oder haengt ueber der Wasserkante.
#
# Die Bauplaene bleiben unveraendert, sie werden nur im richtigen Massstab
# gerastert, damit kein Detail verwaschen resampled wird.
SCALE = {
    "beach_bar": 0.72,       # Huette 1.9 m breit, 2.5 m hoch
    "campfire": 0.78,        # Steinring 1.0 m
    "deck_chairs": 0.60,     # Schirm 1.3 m breit, 2.3 m hoch
    "hammock": 0.69,         # 1.4 m zwischen den Pfosten
    "sandcastle": 0.55,      # 1.3 m breit, 1.9 m hoch
    "shells": 0.56,          # Muschelfeld 1.5 m
    "surfboards": 0.68,      # Bretter 2.3 m lang
    "volleyball_net": 0.64,  # Netz 1.8 m hoch
}


def build(out_dir):
    target = os.path.join(out_dir, "beach")
    os.makedirs(target, exist_ok=True)
    for name in os.listdir(target):
        if name.endswith(".png"):
            os.remove(os.path.join(target, name))
    manifest = []
    for key, label, builder, stages, note in BEACH:
        previous = 0
        for level in range(1, stages + 1):
            sprite = builder(level, SCALE.get(key, 1.0))
            img, anchor = sprite.image()
            name = f"{key}_{level:02d}.png"
            img.save(os.path.join(target, name))
            manifest.append({
                "key": key, "label": label, "level": level, "stages": stages, "file": name,
                "size": [img.width, img.height], "anchorPx": list(anchor),
                "zone": "beach", "layer": "object", "note": note,
            })
            previous = img.height
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
