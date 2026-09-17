#!/usr/bin/env python3
"""
Pixel sprites for the island plants, catalog v1 (island/WACHSTUM.md §14.2).

Every sprite is drawn in code, so all stages share one palette, one light and
one scale:
- 16 art pixels per metre on the ground: a 0.5 m sub-cell is an 8 x 4 px diamond.
- 10 art pixels per metre of height.
- Light from the top left. 1 px outline in the darkest tone of each material.
- No anti-aliasing, gradients or dithering. The only semi-transparent pixels are
  the ground shadow (black at 25 %).

Usage, from the repo root:
    python3 island/pixel/plants.py island/pixel assets/home/ocean-pixel-1.png
Writes island/pixel/plants/*.png and manifest.json, plus previews in
island/pixel/previews/: plants-sheet.png (every plant at 6x, the Home scale on
an iPhone), plants-scene.png (a stage I island at 6x) and plants-density.png
(three pixel densities side by side). Spec: island/SPRITES.md.
"""

import json
import math
import os
import sys

from PIL import Image, ImageDraw, ImageFont

# ---------------------------------------------------------------------------
# Palette
# ---------------------------------------------------------------------------

COLORS = {
    "leaf_outline": "#1E4A2C",
    "leaf_dark": "#2F7239",
    "leaf_mid": "#4F9E4B",
    "leaf_light": "#7EC15A",
    "leaf_highlight": "#B8E070",
    "wood_outline": "#4A2E1A",
    "wood_dark": "#7A4E2B",
    "wood_light": "#B9834F",
    "blossom": "#F1A8BC",
    "blossom_light": "#FCE4EA",
    "fruit": "#E9605A",
    "gold": "#F6CF4C",
}

# Tone ramps per material: 0 outline, 1 shadow, 2 base, 3 light, 4 highlight.
MATERIALS = {
    "leaf": ["leaf_outline", "leaf_dark", "leaf_mid", "leaf_light", "leaf_highlight"],
    "fir": ["leaf_outline", "leaf_dark", "leaf_dark", "leaf_mid", "leaf_light"],
    "wood": ["wood_outline", "wood_dark", "wood_dark", "wood_light", "wood_light"],
    "soil": ["wood_outline", "wood_outline", "wood_dark", "wood_light", "wood_light"],
    "blossom": ["leaf_outline", "blossom", "blossom", "blossom_light", "blossom_light"],
    "fruit": ["leaf_outline", "fruit", "fruit", "blossom_light", "blossom_light"],
    "gold": ["wood_outline", "gold", "gold", "blossom_light", "blossom_light"],
}
OUTLINE_PRIORITY = {"leaf": 4, "fir": 4, "blossom": 3, "fruit": 3, "gold": 3, "wood": 2, "soil": 1}
SHADOW = (0, 0, 0, 64)

_L = (-0.55, -0.72, 0.42)
_N = math.sqrt(sum(c * c for c in _L))
LIGHT = tuple(c / _N for c in _L)


def tone(nx, ny, nz, bias=0.0):
    i = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2] + bias
    if i > 0.88:
        return 4
    if i > 0.50:
        return 3
    if i > 0.02:
        return 2
    return 1


def rnd(*values):
    """Deterministic 0..1 noise, so every run draws the same pixels."""
    h = 2166136261
    for value in values:
        h ^= int(value) & 0xFFFFFFFF
        h = (h * 16777619) & 0xFFFFFFFF
    h ^= h >> 13
    h = (h * 0x5BD1E995) & 0xFFFFFFFF
    h ^= h >> 15
    return h / 4294967296


def rgba(hex_color):
    return (int(hex_color[1:3], 16), int(hex_color[3:5], 16), int(hex_color[5:7], 16), 255)


def opaque_colors(img):
    return {color[:3] for _, color in img.getcolors(maxcolors=1 << 16) if color[3] == 255}


# ---------------------------------------------------------------------------
# Drawing
# ---------------------------------------------------------------------------


class Sprite:
    """Pixels keyed by (x, y) on a large work canvas; cropped on export.

    (ax, ay) is the anchor: the pixel edge under the bottom tip of the footprint
    diamond. (bx, by) is the footprint centre on the ground, the origin for the
    (u, v) coordinates the builders use (px at 16 px/m, v negative = up).
    """

    def __init__(self, scale=1.0):
        self.s = scale
        self.ax, self.ay = 128, 200
        self.px = {}
        self.shadow = set()
        self.set_footprint(1, 1)

    def set_footprint(self, a, b):
        self.fp = (a, b)
        cw, ch = 4 * self.s, 2 * self.s
        self.bx = self.ax + cw * (b - a) / 2
        self.by = self.ay - ch * (a + b) / 2

    def part(self):
        """An empty layer in the same coordinates, merged later with its own outline."""
        layer = Sprite(self.s)
        layer.ax, layer.ay, layer.bx, layer.by, layer.fp = self.ax, self.ay, self.bx, self.by, self.fp
        return layer

    def merge(self, layer, outline=True):
        if outline:
            layer.outline()
        self.px.update(layer.px)

    def at(self, u, v):
        return self.bx + u * self.s, self.by + v * self.s

    def put(self, x, y, mat, level):
        self.px[(x, y)] = (mat, level)

    def blob(self, u, v, ru, rv, mat, group=None, bias=0.0):
        cx, cy = self.at(u, v)
        rx, ry = ru * self.s, rv * self.s
        for y in range(math.floor(cy - ry) - 1, math.ceil(cy + ry) + 2):
            for x in range(math.floor(cx - rx) - 1, math.ceil(cx + rx) + 2):
                dx = (x + 0.5 - cx) / rx
                dy = (y + 0.5 - cy) / ry
                d2 = dx * dx + dy * dy
                if d2 > 1.0:
                    continue
                nx, ny, nz = dx, dy, math.sqrt(1.0 - d2)
                if group is not None:
                    gx = (x + 0.5 - group[0]) / group[2]
                    gy = (y + 0.5 - group[1]) / group[3]
                    gd = min(1.0, gx * gx + gy * gy)
                    w = group[4]
                    nx = nx * (1 - w) + gx * w
                    ny = ny * (1 - w) + gy * w
                    nz = nz * (1 - w) + math.sqrt(1.0 - gd) * w
                    n = math.sqrt(nx * nx + ny * ny + nz * nz) or 1.0
                    nx, ny, nz = nx / n, ny / n, nz / n
                self.put(x, y, mat, tone(nx, ny, nz, bias))

    def crown(self, blobs, group, mat="leaf", bias=0.0):
        """Clumps drawn bottom first, so every upper clump casts its edge on the one below."""
        gx, gy = self.at(group[0], group[1])
        g = (gx, gy, group[2] * self.s, group[3] * self.s, group[4])
        for u, v, ru, rv in sorted(blobs, key=lambda b: -b[1]):
            self.blob(u, v, ru, rv, mat, g, bias)

    def trunk(self, u0, v_top, v_bottom, width, mat="wood", flare=0):
        x0 = math.floor(self.bx + u0 * self.s + 0.5)
        w = max(1, math.floor(width * self.s + 0.5))
        y0 = math.floor(self.by + v_top * self.s + 0.5)
        y1 = math.floor(self.by + v_bottom * self.s + 0.5)
        for y in range(y0, y1):
            extra = flare if y >= y1 - 2 else 0
            cols = list(range(x0 - extra, x0 + w + extra))
            for index, x in enumerate(cols):
                if len(cols) == 1:
                    level = 2
                elif index == 0:
                    level = 3
                elif index == len(cols) - 1:
                    level = 1
                else:
                    level = 2
                self.put(x, y, mat, level)

    def poly(self, pts, mat, shade):
        points = [self.at(u, v) for u, v in pts]
        y_min = math.floor(min(p[1] for p in points))
        y_max = math.ceil(max(p[1] for p in points))
        for y in range(y_min, y_max + 1):
            yc = y + 0.5
            xs = []
            for i in range(len(points)):
                x1, y1 = points[i]
                x2, y2 = points[(i + 1) % len(points)]
                if (y1 <= yc < y2) or (y2 <= yc < y1):
                    xs.append(x1 + (yc - y1) * (x2 - x1) / (y2 - y1))
            xs.sort()
            for k in range(0, len(xs) - 1, 2):
                for x in range(math.ceil(xs[k] - 0.5), math.floor(xs[k + 1] - 0.5) + 1):
                    self.put(x, y, mat, shade(x, y))

    def sprinkle(self, mat, count, seed, level=2, size=1, gap=2, host=("leaf",), host_levels=(2, 3, 4)):
        """Dots (blossoms, fruit) inside the crown, never on its silhouette or touching each other."""
        candidates = []
        for (x, y), (m, lvl) in self.px.items():
            if m not in host or lvl not in host_levels:
                continue
            inside = all(
                (self.px.get((x + dx, y + dy)) or (None,))[0] in host
                for dx in range(-1, size + 1)
                for dy in range(-1, size + 1)
            )
            if inside:
                candidates.append((rnd(seed, x, y), x, y))
        candidates.sort()
        placed = []
        for _, x, y in candidates:
            if len(placed) >= count:
                break
            if any(max(abs(x - px), abs(y - py)) < gap + size for px, py in placed):
                continue
            placed.append((x, y))
        for x, y in placed:
            for dx in range(size):
                for dy in range(size):
                    self.put(x + dx, y + dy, mat, level)
            if size > 1:
                self.put(x, y, mat, 3)
        return placed

    def sparkle(self, x, y):
        for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)):
            if (x + dx, y + dy) not in self.px:
                self.put(x + dx, y + dy, "gold", 3 if (dx, dy) == (0, 0) else 2)

    def contact_shade(self):
        """Dark line where the crown meets the trunk."""
        for (x, y), (m, _) in list(self.px.items()):
            if m != "wood":
                continue
            above = self.px.get((x, y - 1))
            if above and above[0] in ("leaf", "fir"):
                self.px[(x, y - 1)] = (above[0], 0)
                self.px[(x, y)] = ("wood", 1)

    def outline(self):
        add = {}
        for (x, y), (m, _) in self.px.items():
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                q = (x + dx, y + dy)
                if q in self.px:
                    continue
                current = add.get(q)
                if current is None or OUTLINE_PRIORITY[m] > OUTLINE_PRIORITY[current]:
                    add[q] = m
        for q, m in add.items():
            self.px[q] = (m, 0)

    def ground_shadow(self, u, ru):
        cx = self.bx + u * self.s
        cy = self.by + 0.5 * self.s
        rx = ru * self.s * 0.85
        ry = rx / 2
        for y in range(math.floor(cy - ry) - 1, math.ceil(cy + ry) + 2):
            for x in range(math.floor(cx - rx) - 1, math.ceil(cx + rx) + 2):
                dx = (x + 0.5 - cx) / rx
                dy = (y + 0.5 - cy) / ry
                if dx * dx + dy * dy <= 1.0 and (x, y) not in self.px:
                    self.shadow.add((x, y))

    def image(self):
        points = set(self.px) | self.shadow | {(self.ax - 1, self.ay - 1), (self.ax, self.ay - 1)}
        x0 = min(p[0] for p in points)
        y0 = min(p[1] for p in points)
        x1 = max(p[0] for p in points)
        y1 = max(p[1] for p in points)
        img = Image.new("RGBA", (x1 - x0 + 1, y1 - y0 + 1), (0, 0, 0, 0))
        for x, y in self.shadow:
            img.putpixel((x - x0, y - y0), SHADOW)
        for (x, y), (m, level) in self.px.items():
            img.putpixel((x - x0, y - y0), rgba(COLORS[MATERIALS[m][level]]))
        return img, (self.ax - x0, self.ay - y0)


def stretch(blobs, group, top, k=1.12, kr=1.08):
    """Pull a crown down towards the trunk while keeping its top, so trunks look less like sticks."""
    moved = [(u, top + (v - top) * k, ru, rv * kr) for u, v, ru, rv in blobs]
    gu, gv, gru, grv, gw = group
    return moved, (gu, top + (gv - top) * k, gru, grv * k, gw)


# ---------------------------------------------------------------------------
# Plants
# ---------------------------------------------------------------------------

SPROUT = {
    (0, 0): 1, (0, -1): 2, (0, -2): 2, (0, -3): 2,
    (-1, -3): 3, (-2, -3): 3, (-2, -4): 4, (-3, -4): 3,
    (1, -3): 2, (2, -3): 1, (2, -4): 2, (3, -4): 2,
}


def leafy_tree(level, s=1.0):
    sp = Sprite(s)
    if level == 1:  # sprout
        x0 = math.floor(sp.bx)
        y0 = math.floor(sp.by + 0.5)
        for (dx, dy), lvl in SPROUT.items():
            sp.put(x0 + math.floor(dx * s), y0 + math.floor(dy * s), "leaf", lvl)
        shadow = (0.5, 2.4)
    elif level == 2:  # sapling
        sp.trunk(-0.5, -5, 1, 1)
        sp.crown([(0, -7.0, 3.6, 3.1)], (0, -7.0, 3.6, 3.1, 0.0))
        shadow = (0.8, 3.2)
    elif level == 3:  # young tree
        sp.trunk(-1, -9, 1, 2)
        blobs, group = stretch(
            [(-2.8, -10.6, 3.6, 3.1), (2.8, -10.9, 3.6, 3.1), (0, -13.9, 4.2, 3.5)],
            (0, -12.2, 6.6, 5.4, 0.45),
            top=-17.4,
        )
        sp.crown(blobs, group)
        shadow = (1.2, 4.6)
    elif level == 4:  # tree
        sp.trunk(-1, -12, 1, 2)
        blobs, group = stretch(
            [
                (-5.0, -13.2, 4.2, 3.5), (5.0, -13.6, 4.2, 3.5), (0, -12.6, 4.4, 3.4),
                (-3.0, -18.0, 4.6, 3.9), (3.2, -18.4, 4.6, 3.9), (0, -20.6, 3.8, 3.0),
            ],
            (0, -16.5, 9.2, 7.4, 0.45),
            top=-23.6,
        )
        sp.crown(blobs, group)
        shadow = (1.8, 6.4)
    else:  # grand tree
        sp.trunk(-1.5, -15, 1, 3, flare=1)
        blobs, group = stretch(
            [
                (-7.4, -16.2, 4.8, 3.9), (7.2, -16.6, 4.8, 3.9), (-2.6, -15.2, 5.0, 3.9),
                (3.0, -15.6, 5.0, 3.9), (-5.0, -21.6, 5.2, 4.3), (4.8, -22.0, 5.2, 4.3),
                (0.0, -20.4, 5.0, 4.0), (-1.6, -26.0, 4.6, 3.5), (3.0, -25.6, 4.2, 3.3),
            ],
            (0, -20.5, 12.2, 9.2, 0.45),
            top=-29.6,
        )
        sp.crown(blobs, group)
        shadow = (2.4, 8.4)
    sp.contact_shade()
    sp.outline()
    sp.ground_shadow(*shadow)
    return sp


def bush(level, s=1.0):
    sp = Sprite(s)
    if level == 1:
        blobs = [(-2.0, -2.0, 2.8, 2.3), (2.0, -2.2, 2.8, 2.3), (0.0, -3.6, 2.7, 2.2)]
        group = (0, -2.6, 4.6, 3.2, 0.5)
        shadow = (0.8, 3.4)
    else:
        sp.set_footprint(2, 2)
        g = 0.35 if level == 3 else 0.0
        blobs = [
            (-4.6, -2.6, 3.4 + g, 2.8 + g), (4.6, -2.8, 3.4 + g, 2.8 + g), (0.0, -2.2, 3.7 + g, 3.0 + g),
            (-2.3, -5.2, 3.5 + g, 2.9 + g), (2.5, -5.4, 3.5 + g, 2.9 + g),
        ]
        group = (0, -3.8, 7.8, 5.2, 0.5)
        shadow = (1.2, 6.0)
    sp.crown(blobs, group)
    if level == 3:
        sp.sprinkle("blossom", 6, seed=31, level=2)
        sp.sprinkle("blossom", 3, seed=32, level=3)
    sp.outline()
    sp.ground_shadow(*shadow)
    return sp


def fruit_tree(level, s=1.0):
    sp = Sprite(s)
    if level == 1:  # young tree, first blossoms
        sp.trunk(-1, -7, 1, 2)
        sp.crown(
            [(-2.7, -9.6, 3.4, 3.0), (2.7, -9.9, 3.4, 3.0), (0, -12.4, 3.8, 3.1)],
            (0, -10.8, 6.2, 4.8, 0.5),
            bias=0.08,
        )
        sp.sprinkle("blossom", 4, seed=11)
        shadow = (1.0, 4.2)
    else:
        g = 0.4 if level == 3 else 0.0
        sp.trunk(-1, -9, 1, 2)
        blobs, group = stretch(
            [
                (-4.8, -13.0, 3.9 + g, 3.2 + g), (4.8, -13.2, 3.9 + g, 3.2 + g), (0.0, -12.4, 4.2 + g, 3.3 + g),
                (-2.7, -17.2, 4.3 + g, 3.6 + g), (2.9, -17.5, 4.3 + g, 3.6 + g), (0.0, -19.4, 3.5 + g, 2.8 + g),
            ],
            (0, -15.6, 8.8 + g, 6.8 + g, 0.5),
            top=-22.2 - g,
        )
        sp.crown(blobs, group, bias=0.08)
        if level == 2:  # full blossom
            sp.sprinkle("blossom", 12, seed=12, level=2, gap=1)
            sp.sprinkle("blossom", 6, seed=14, level=3, gap=1)
        else:  # fruit
            sp.sprinkle("fruit", 7, seed=13, size=2, gap=2)
        shadow = (1.6, 6.2)
    sp.contact_shade()
    sp.outline()
    sp.ground_shadow(*shadow)
    return sp


def fir_tree(level, s=1.0):
    sp = Sprite(s)
    tiers = {1: 2, 2: 3, 3: 4}[level]
    top = {1: 10.0, 2: 20.0, 3: 31.0}[level]
    stem = {1: 2.0, 2: 3.0, 3: 4.0}[level]
    width = {1: 8.0, 2: 12.0, 3: 16.0}[level]
    if level == 1:
        sp.trunk(-0.5, -stem - 2, 1, 1)
    else:
        sp.trunk(-1, -stem - 2, 1, 2)
    step = (top - stem) / (tiers + 0.6)
    for k in range(tiers):
        yb = -stem - k * step
        yt = -top if k == tiers - 1 else yb - step * 1.6
        half = width / 2 * (1 - k / (tiers + 0.8))
        ab = sp.by + yb * s
        at = sp.by + yt * s
        hh = half * s

        def shade(x, y, ab=ab, at=at, hh=hh):
            ty = (y + 0.5 - at) / max(1e-6, ab - at)
            row_half = max(0.5, hh * ty)
            fx = (x + 0.5 - sp.bx) / row_half
            if ty > 0.86:
                return 1
            if fx < -0.7 and ty > 0.4:
                return 4
            if fx < -0.1:
                return 3
            if fx > 0.35:
                return 1
            return 2

        sp.poly([(0, yt), (half, yb), (-half, yb)], "fir", shade)
        # a ragged lower edge: every other needle tip hangs one pixel lower
        last_row = math.floor(ab - 0.5)
        for x in range(math.ceil(sp.bx - hh) + 1, math.floor(sp.bx + hh) - 1):
            if x % 2 == 0 and (x, last_row) in sp.px:
                sp.put(x, last_row + 1, "fir", 1)
    sp.contact_shade()
    sp.outline()
    sp.ground_shadow(0.8, width * 0.42)
    return sp


def palm_tree(level, s=1.0):
    sp = Sprite(s)
    height = {1: 10.0, 2: 19.0, 3: 28.0}[level]
    lean = {1: 1.0, 2: 2.5, 3: 4.0}[level]
    tw = 1 if level == 1 else 2
    length = {1: 5.5, 2: 9.0, 3: 12.0}[level]
    angles = {
        1: [-155, -25, 170, 10],
        2: [-150, -105, -60, -20, 170, 12],
        3: [-160, -122, -88, -55, -18, 168, 14],
    }[level]

    trunk = sp.part()
    y_bottom = math.floor(sp.by + 1 * s + 0.5)
    y_top = math.floor(sp.by - height * s + 0.5)
    for y in range(y_top, y_bottom):
        v = (y + 0.5 - sp.by) / s
        t = (1 - v) / (1 + height)
        u = lean * t * t
        x0 = math.floor(sp.bx + u * s - tw / 2 + 0.5)
        ring = (y_bottom - 1 - y) % 3 == 2
        for i in range(tw):
            trunk.put(x0 + i, y, "wood", 1 if ring or (tw > 1 and i == tw - 1) else 3)
    sp.merge(trunk)

    def frond_tone(angle):
        if -170 <= angle <= -80:
            return 3
        if -10 <= angle <= 150:
            return 1
        return 2

    cu, cv = lean, -height
    ordered = sorted(angles, key=lambda a: math.sin(math.radians(a)))
    for angle in ordered:
        rad = math.radians(angle)
        dx, dy = math.cos(rad), math.sin(rad)
        base = frond_tone(angle)
        droop = 0.45 if dy < -0.8 else 0.75
        frond = sp.part()
        steps = int(length * 4 * s) + 4
        for i in range(steps + 1):
            t = i / steps
            u = cu + dx * length * t
            v = cv + dy * length * 0.8 * t + droop * length * t * t
            x, y = frond.at(u, v)
            px, py = math.floor(x), math.floor(y)
            frond.put(px, py, "leaf", 4 if base == 3 and 0.2 < t < 0.5 else base)
            # thick near the crown, then single leaflets on every other column
            if t < 0.45 or (t < 0.9 and px % 2 == 0):
                frond.put(px, py + 1, "leaf", max(1, base - 1))
        sp.merge(frond, outline=level > 1)
    if level == 3:
        nuts = sp.part()
        for u, v in ((-1.2, 2.0), (1.0, 2.6), (2.4, 1.6)):
            nuts.blob(cu + u, cv + v, 1.1, 1.1, "wood")
        sp.merge(nuts)
    if level == 1:
        sp.outline()
    sp.ground_shadow(lean + 0.5, length * 0.6)
    return sp


def world_tree(level, s=1.0):
    sp = Sprite(s)
    fp = {1: 2, 2: 3, 3: 4}[level]
    sp.set_footprint(fp, fp)
    top = {1: 34.0, 2: 44.0, 3: 54.0}[level]
    rx = {1: 17.0, 2: 21.5, 3: 26.0}[level]
    ry = {1: 10.0, 2: 12.0, 3: 14.0}[level]
    tb = {1: 7.0, 2: 9.0, 3: 11.0}[level]
    tt = {1: 4.0, 2: 5.0, 3: 6.0}[level]
    cy = -(top - ry)
    fork = cy + ry * 0.95

    def bark(x, y):
        fx = (x + 0.5 - sp.bx) / (tb * s / 2)
        if fx < -0.45:
            return 3
        if fx > 0.35:
            return 1
        return 1 if x % 3 == 0 and rnd(7, x, y) < 0.45 else 2

    sp.poly([(-tb / 2, 1), (tb / 2, 1), (tt / 2, fork), (-tt / 2, fork)], "wood", bark)
    for side in (-1, 1):  # two big branches into the crown
        sp.poly(
            [
                (side * tt * 0.1, fork + 1.5), (side * tt * 0.6, fork + 1.5),
                (side * (rx * 0.42 + 1.4), cy + 1.0), (side * (rx * 0.42 - 0.6), cy + 0.2),
            ],
            "wood",
            lambda x, y, side=side: 3 if side < 0 else 1,
        )
    reach = tb / 2 + 3.5 + level
    for side in (-1, 1):
        sp.poly(
            [(side * tb * 0.25, -2.5), (side * reach, 1.6), (side * (reach - 2.5), 2.2), (side * tb * 0.45, 0.8)],
            "wood",
            lambda x, y, side=side: 3 if side < 0 else 1,
        )
    sp.poly([(-1.3, -1), (1.3, -1), (0.7, 3.0), (-0.7, 3.0)], "wood", lambda x, y: 2)
    if level >= 2:  # a hollow in the trunk
        hx, hy = sp.at(0.2, fork * 0.45)
        hrx, hry = (1.0 + 0.3 * level) * s, (1.5 + 0.3 * level) * s
        for (x, y), (m, _) in list(sp.px.items()):
            if m == "wood" and ((x + 0.5 - hx) / hrx) ** 2 + ((y + 0.5 - hy) / hry) ** 2 <= 1:
                sp.px[(x, y)] = ("wood", 0)

    rows = {1: [4, 5, 3], 2: [5, 6, 4], 3: [5, 7, 6, 3]}[level]
    blobs = []
    for r, count in enumerate(rows):
        fy = 1 - 2 * (r + 0.5) / len(rows)
        vy = cy + fy * ry * 0.6
        span = rx * math.sqrt(max(0.2, 1 - (fy * 0.85) ** 2)) * 0.8
        for k in range(count):
            fx = 0 if count == 1 else -1 + 2 * k / (count - 1)
            jitter_u = (rnd(level, r, k) - 0.5) * 1.8
            jitter_v = (rnd(k, r, level, 3) - 0.5) * 1.4
            blobs.append((fx * span + jitter_u, vy + jitter_v, rx * 0.27, ry * 0.42))
    sp.crown(blobs, (0, cy, rx, ry, 0.5))
    if level == 2:
        sp.sprinkle("gold", 5, seed=21)
    if level == 3:
        sp.sprinkle("gold", 12, seed=22)
    sp.contact_shade()
    sp.outline()
    gx, gy = sp.at(0, cy)
    sparks = {
        2: [(rx + 2, -ry * 0.4)],
        3: [(-rx - 3, -1), (rx + 2, -ry * 0.5), (-rx * 0.45, -ry - 4), (rx * 0.55, -ry - 3)],
    }.get(level, [])
    for u, v in sparks:
        sp.sparkle(math.floor(gx + u * s), math.floor(gy + v * s))
    sp.ground_shadow(rx * 0.15, rx * 0.7)
    return sp


def flower_bed(level, s=1.0):
    sp = Sprite(s)
    n = level + 1
    sp.set_footprint(n, n)
    cw, ch = 4 * s, 2 * s
    for y in range(sp.ay - math.ceil(ch * 2 * n) - 2, sp.ay + 2):
        for x in range(sp.ax - math.ceil(cw * n) - 2, sp.ax + math.ceil(cw * n) + 2):
            dx = x + 0.5 - sp.ax
            dy = y + 0.5 - sp.ay
            j = (dx / cw - dy / ch) / 2
            i = (-dy / ch - dx / cw) / 2
            if 0 <= i <= n and 0 <= j <= n:
                edge = min(i, j, n - i, n - j) < 0.3
                if level == 3 and (i < 0.45 or j < 0.45):
                    sp.put(x, y, "soil", 3)
                elif edge:
                    sp.put(x, y, "soil", 0)
                else:
                    sp.put(x, y, "soil", 0 if rnd(5, x, y) < 0.12 else 2)
    if level == 3:  # the wooden frame has a visible front edge
        for (x, y), (m, lvl) in list(sp.px.items()):
            if m == "soil" and lvl == 3 and (x, y + 1) not in sp.px:
                sp.put(x, y + 1, "soil", 0)
    colors = ["fruit", "gold", "blossom"]
    for i in range(n):
        for j in range(n):
            x = math.floor(sp.ax + (-(i + 0.5) + (j + 0.5)) * cw)
            y = math.floor(sp.ay - ((i + 0.5) + (j + 0.5)) * ch)
            c = colors[(i + 2 * j + level) % 3]
            sp.put(x, y, "leaf", 2)
            sp.put(x - 1, y, "leaf", 3)
            sp.put(x, y - 1, c, 2)
            sp.put(x + 1, y - 1, c, 2)
            sp.put(x, y - 2, c, 3)
    return sp


def grass_tufts(variant, s=1.0):
    sp = Sprite(s)
    blades = {
        1: [(-3, -1.2, 4), (-1, -0.5, 5), (0, 0.2, 6), (2, 0.7, 5), (3, 1.3, 3)],
        2: [(-2, -1.0, 5), (0, -0.2, 4), (1, 0.6, 6), (3, 1.2, 4)],
        3: [(-2, -1.0, 3), (-1, -0.4, 5), (1, 0.4, 5), (2, 1.0, 3)],
    }[variant]
    for offset, lean, h in blades:
        for t in range(h):
            x = math.floor(sp.bx + (offset + lean * t / 2) * s + 0.5)
            y = math.floor(sp.by + 0.5) - t
            sp.put(x, y, "leaf", 1 if t == 0 else (4 if t == h - 1 else 2))
    return sp


# ---------------------------------------------------------------------------
# Growth stages
# ---------------------------------------------------------------------------

STAGES = 10
SPROUT_HEIGHT_M = 0.45
# The seed and the seedling use the plant's own green, so a fir starts dark.
STAGE_MATERIAL = {"fir_tree": "fir"}


def seed_sprite(mat, s=1.0):
    """Stage 1 of every plant: a soil mound with the first shoot breaking through."""
    sp = Sprite(s)
    sp.blob(0, -0.4, 2.2, 0.9, "soil")
    x = math.floor(sp.bx + 0.5)
    y = math.floor(sp.by + 0.5)
    sp.put(x, y - max(1, math.ceil(1.0 * s)), mat, 3)
    sp.outline()
    sp.ground_shadow(0.0, 2.0)
    return sp


def sprout_sprite(mat, s=1.0):
    """Seedling: a thin stem with two leaves, drawn parametrically so it stays clean at any size."""
    sp = Sprite(s)
    sp.trunk(-0.3, -3.6, 1, 1)
    sp.blob(-2.0, -3.8, 2.1, 1.3, mat)
    sp.blob(2.0, -4.4, 2.1, 1.3, mat)
    sp.blob(0.0, -5.0, 1.5, 1.2, mat)
    sp.contact_shade()
    sp.outline()
    sp.ground_shadow(0.2, 2.6)
    return sp


def grass_group(count, s=1.0):
    """One to three tufts side by side: grass grows by multiplying (WACHSTUM.md §14.4)."""
    sp = Sprite(s)
    spots = [(0, 0)], [(-3.2, 0.4), (3.0, -0.6)], [(-4.2, 0.6), (0.2, -0.8), (4.4, 0.2)]
    for (ox, oy), variant in zip(spots[count - 1], (1, 2, 3)):
        blades = {
            1: [(-3, -1.2, 4), (-1, -0.5, 5), (0, 0.2, 6), (2, 0.7, 5), (3, 1.3, 3)],
            2: [(-2, -1.0, 5), (0, -0.2, 4), (1, 0.6, 6), (3, 1.2, 4)],
            3: [(-2, -1.0, 3), (-1, -0.4, 5), (1, 0.4, 5), (2, 1.0, 3)],
        }[variant]
        for offset, lean, h in blades:
            for t in range(h):
                x = math.floor(sp.bx + (ox + offset + lean * t / 2) * s + 0.5)
                y = math.floor(sp.by + (0.5 + oy * 0.5) * s) - math.floor(t * s)
                sp.put(x, y, "leaf", 1 if t == 0 else (4 if t == h - 1 else 2))
    return sp


# Up to this stage a plant may still be a seed or a seedling; from the next one on
# it has to be the real thing, scaled down (Jannis, 2026-09-14: a leafy tree is a
# small tree from stage 4, not a sprout until stage 5).
SPROUT_STAGES = {"leafy_tree": 3}
# Hand-drawn stages that are really just a sprout, so they follow the same rule.
SPROUT_LIKE = {("leafy_tree", 1)}

# A world tree starts as an ordinary tree: without this the step from seedling to
# its smallest own stage (3.4 m) would be a jump.
EXTRA_YOUNG = {"world_tree": (leafy_tree, [(2, 1.0), (3, 1.8), (4, 2.4), (5, 3.0)], (1, 1))}


def growth_plan(key, builder, levels, footprints, heights):
    """Ten stages from seed to full size.

    The heights follow one geometric ramp, so every step adds about the same
    percentage instead of jumping. Each stage renders the tallest hand-drawn
    stage that still fits, scaled to the target height; below half of the
    smallest one the seedling is used.
    """
    if key == "flower_bed":  # grows in area, not height
        plan = [{"kind": "seed", "scale": 1.0, "height": 0.05, "footprint": (1, 1)}]
        for level, scale in zip((1, 1, 1, 2, 2, 2, 3, 3, 3), (0.6, 0.8, 1.0, 0.85, 0.93, 1.0, 0.9, 0.95, 1.0)):
            plan.append({"kind": "frame", "builder": builder, "level": level, "scale": scale,
                         "height": heights[level - 1], "footprint": footprints[level - 1]})
        return plan
    if key == "grass_tufts":  # grows by multiplying
        plan = [{"kind": "seed", "scale": 1.0, "height": 0.05, "footprint": (1, 1)}]
        for count, scale in zip((1, 1, 1, 2, 2, 2, 3, 3, 3), (0.7, 0.85, 1.0, 1.0, 1.05, 1.1, 1.1, 1.15, 1.2)):
            plan.append({"kind": "grass", "count": count, "scale": scale,
                         "height": 0.5 * min(1.0, scale), "footprint": (1, 1)})
        return plan

    frames = []
    young = EXTRA_YOUNG.get(key)
    if young:
        y_builder, y_levels, y_fp = young
        frames += [{"builder": y_builder, "level": lvl, "height": h, "footprint": y_fp} for lvl, h in y_levels]
    frames += [{"builder": builder, "level": lvl, "height": heights[lvl - 1], "footprint": footprints[lvl - 1]}
               for lvl in range(1, levels + 1)]
    # Measured once at scale 1, so the ramp works in real pixels.
    for frame in frames:
        frame["px"] = rendered_height(key, {"kind": "frame", "builder": frame["builder"],
                                            "level": frame["level"], "scale": 1.0})
    frames.sort(key=lambda f: f["px"])
    sprout_px = rendered_height(key, {"kind": "sprout", "scale": 1.0})

    top_px = frames[-1]["px"]
    start_px = max(6.0, top_px / 8.0)
    ratio = (top_px / start_px) ** (1 / (STAGES - 2))
    plan = [{"kind": "seed", "scale": 1.0, "height": 0.05, "footprint": (1, 1)}]
    previous = 0
    for i in range(STAGES - 1):
        target = start_px * (ratio ** i)
        stage_no = i + 2  # stage 1 is the seed
        allow_sprout = stage_no <= SPROUT_STAGES.get(key, STAGES)
        usable = [f for f in frames if allow_sprout or (key, f["level"]) not in SPROUT_LIKE]
        fit = None
        for frame in usable:
            if frame["px"] <= target * 1.02:
                fit = frame
        if fit is None and not allow_sprout:
            fit = usable[0]  # smallest real plant, scaled down to the target height
        if fit is None or (allow_sprout and target < fit["px"] * 0.5):
            step = {"kind": "sprout", "scale": max(0.5, target / sprout_px),
                    "height": target / 10, "footprint": (1, 1)}
        else:
            step = {"kind": "frame", "builder": fit["builder"], "level": fit["level"],
                    "scale": target / fit["px"], "height": target / 10, "footprint": fit["footprint"]}
        # Never let a stage come out shorter than the one before it.
        for _ in range(8):
            height = rendered_height(key, step)
            if height > previous:
                break
            step["scale"] *= 1.08
        previous = height
        plan.append(step)
    return plan


def rendered_height(key, step):
    """Real pixel height of a stage: the metre values in PLANTS are rough, and
    scaling by them alone can make a later stage come out shorter."""
    img, _ = render_stage(key, step).image()
    return img.height


def render_stage(key, step):
    mat = STAGE_MATERIAL.get(key, "leaf")
    if step["kind"] == "seed":
        return seed_sprite(mat, step["scale"])
    if step["kind"] == "sprout":
        return sprout_sprite(mat, step["scale"])
    if step["kind"] == "grass":
        return grass_group(step["count"], step["scale"])
    return step["builder"](step["level"], step["scale"])


# ---------------------------------------------------------------------------
# Catalog, export, previews
# ---------------------------------------------------------------------------

PLANTS = [
    # key, label, builder, levels, footprint per level, height in metres per level, layer
    ("leafy_tree", "Leafy tree", leafy_tree, 5, [(1, 1)] * 5, [0.4, 1.0, 1.8, 2.4, 3.0], "object"),
    ("bush", "Bush", bush, 3, [(1, 1), (2, 2), (2, 2)], [0.45, 0.65, 0.75], "object"),
    ("fruit_tree", "Fruit tree", fruit_tree, 3, [(1, 1)] * 3, [1.6, 2.2, 2.3], "object"),
    ("fir_tree", "Fir tree", fir_tree, 3, [(1, 1)] * 3, [1.0, 2.0, 3.1], "object"),
    ("palm_tree", "Palm tree", palm_tree, 3, [(1, 1)] * 3, [1.2, 2.2, 3.2], "object"),
    ("world_tree", "World tree", world_tree, 3, [(2, 2), (3, 3), (4, 4)], [3.4, 4.4, 5.4], "object"),
    ("flower_bed", "Flower bed", flower_bed, 3, [(2, 2), (3, 3), (4, 4)], [0.3, 0.3, 0.3], "ground"),
    ("grass_tufts", "Grass tufts", grass_tufts, 3, [(1, 1)] * 3, [0.5, 0.5, 0.5], "ground"),
]

PAPER = (244, 241, 234, 255)
GRASS = [rgba("#A3CF4F"), rgba("#9AC849")]
GRASS_FOOTPRINT = rgba("#86B843")
SAND = rgba("#EDD9A6")
SHALLOW = rgba("#7FD0F2")
WATER = rgba("#2B93E6")


def file_name(key, stage):
    """Stage 1 is the seed, stage 10 the full plant."""
    return f"{key}_{stage:02d}.png"


def font(size):
    for path in ("/System/Library/Fonts/Helvetica.ttc", "/System/Library/Fonts/Supplemental/Arial.ttf"):
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def draw_patch(canvas, tip_x, tip_y, m, fp):
    """Grass diamond of m x m sub-cells with its bottom tip at (tip_x, tip_y); the footprint is darker."""
    border = (m - fp[0]) // 2
    for y in range(tip_y - 4 * m, tip_y):
        for x in range(tip_x - 4 * m, tip_x + 4 * m):
            dx = x + 0.5 - tip_x
            dy = y + 0.5 - tip_y
            j = (dx / 4 - dy / 2) / 2
            i = (-dy / 2 - dx / 4) / 2
            if 0 <= i < m and 0 <= j < m:
                if border <= i < border + fp[0] and border <= j < border + fp[1]:
                    color = GRASS_FOOTPRINT
                else:
                    color = GRASS[(math.floor(i) + math.floor(j)) % 2]
                canvas.putpixel((x, y), color)


def paste(canvas, img, x, y):
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    layer.paste(img, (x, y))
    return Image.alpha_composite(canvas, layer)


def build(out_dir, ocean_png=None):
    plant_dir = os.path.join(out_dir, "plants")
    preview_dir = os.path.join(out_dir, "previews")
    os.makedirs(plant_dir, exist_ok=True)
    os.makedirs(preview_dir, exist_ok=True)
    manifest = []
    rows = []
    images = {}
    for name in os.listdir(plant_dir):  # stale files from an earlier stage count
        if name.endswith(".png"):
            os.remove(os.path.join(plant_dir, name))
    for key, label, builder, levels, footprints, heights, layer in PLANTS:
        items = []
        for stage, step in enumerate(growth_plan(key, builder, levels, footprints, heights), start=1):
            img, anchor = render_stage(key, step).image()
            name = file_name(key, stage)
            img.save(os.path.join(plant_dir, name))
            images[name] = (img, anchor)
            manifest.append({
                "key": key,
                "level": stage,
                "file": name,
                "size": [img.width, img.height],
                "anchorPx": list(anchor),
                "footprint": list(step["footprint"]),
                "heightM": round(img.height / 10, 2),
                "scale": round(step["scale"], 2),
                "layer": layer,
                "colors": len(opaque_colors(img)),
            })
            items.append((img, anchor, step["footprint"], name, layer))
        rows.append((label, key, items))
    with open(os.path.join(plant_dir, "manifest.json"), "w") as handle:
        json.dump(manifest, handle, indent=2)

    # --- sheet: every plant on a grass patch, 1x then 6x nearest neighbour ---
    pad, title_h, caption_h, scale = 8, 7, 5, 6
    layout = []
    sheet_w = 0
    y = pad
    for label, key, items in rows:
        cells = []
        x = pad
        above = below = 0
        for img, anchor, fp, name, layer in items:
            m = fp[0] + (2 if layer == "ground" else 4)
            border = (m - fp[0]) // 2
            above = max(above, anchor[1], 4 * m - 4 * border)
            below = max(below, img.height - anchor[1], 4 * border)
            cell_w = max(img.width, 8 * m) + pad
            cells.append((x, cell_w, img, anchor, fp, m, border, name))
            x += cell_w
        sheet_w = max(sheet_w, x + pad)
        layout.append((label, key, y, above, below, cells))
        y += title_h + above + below + caption_h + pad
    sheet = Image.new("RGBA", (sheet_w, y), PAPER)
    for label, key, top, above, below, cells in layout:
        baseline = top + title_h + above
        for x, cell_w, img, anchor, fp, m, border, name in cells:
            cx = x + cell_w // 2
            draw_patch(sheet, cx, baseline + 4 * border, m, fp)
            sheet = paste(sheet, img, cx - anchor[0], baseline - anchor[1])
    big = sheet.resize((sheet.width * scale, sheet.height * scale), Image.NEAREST)
    draw = ImageDraw.Draw(big)
    title_font, caption_font = font(30), font(20)
    for label, key, top, above, below, cells in layout:
        what = "sizes" if key == "flower_bed" else ("variants" if key == "grass_tufts" else "stages")
        draw.text((pad * scale, top * scale + 4), f"{label}  ·  {key}  ·  {len(cells)} {what}", fill=(40, 40, 40, 255), font=title_font)
        baseline = top + title_h + above
        for x, cell_w, img, anchor, fp, m, border, name in cells:
            text = f"{name.replace('.png', '')}  {img.width}×{img.height}"
            tw = draw.textlength(text, font=caption_font)
            draw.text(((x + cell_w / 2) * scale - tw / 2, (baseline + below + 1) * scale), text, fill=(90, 90, 90, 255), font=caption_font)
    big.save(os.path.join(preview_dir, "plants-sheet.png"))

    # --- scene: a stage I island (12 x 12 m) as it would appear on Home, at 6x ---
    water = WATER
    if ocean_png and os.path.exists(ocean_png):
        ocean = Image.open(ocean_png).convert("RGBA")
        water = ocean.getpixel((ocean.width // 2, int(ocean.height * 0.72)))
    width, height = 220, 168
    tip = (110, 58)  # back corner of the grass diamond
    scene = Image.new("RGBA", (width, height), water)
    for yy in range(height):
        for xx in range(width):
            dx = xx + 0.5 - tip[0]
            dy = yy + 0.5 - tip[1]
            gx = (dx / 4 + dy / 2) / 2
            gy = (dy / 2 - dx / 4) / 2
            outside = max(-gx, -gy, gx - 24, gy - 24)
            if outside <= 0:
                scene.putpixel((xx, yy), GRASS[(math.floor(gx / 2) + math.floor(gy / 2)) % 2])
            elif outside <= 0.7:
                scene.putpixel((xx, yy), SAND)
            elif outside <= 1.7:
                scene.putpixel((xx, yy), SHALLOW)
    placements = [
        ("flower_bed_10.png", 14, 10, 4), ("grass_tufts_04.png", 1, 2, 1), ("grass_tufts_07.png", 6, 20, 1),
        ("grass_tufts_09.png", 17, 3, 1), ("grass_tufts_04.png", 21, 16, 1), ("grass_tufts_07.png", 12, 22, 1),
        ("world_tree_09.png", 8, 8, 3),
        ("leafy_tree_10.png", 4, 3, 1), ("leafy_tree_09.png", 18, 5, 1), ("leafy_tree_07.png", 5, 16, 1),
        ("leafy_tree_05.png", 16, 19, 1), ("leafy_tree_03.png", 10, 19, 1),
        ("fir_tree_10.png", 2, 10, 1), ("fir_tree_08.png", 3, 13, 1), ("fir_tree_05.png", 21, 11, 1),
        ("palm_tree_10.png", 21, 20, 1), ("palm_tree_08.png", 19, 22, 1),
        ("fruit_tree_10.png", 13, 3, 1), ("fruit_tree_08.png", 19, 14, 1),
        ("bush_10.png", 7, 21, 2), ("bush_08.png", 11, 15, 2), ("bush_05.png", 22, 7, 1),
    ]
    ground = [p for p in placements if p[0].startswith(("flower_bed", "grass_tufts"))]
    objects = sorted(
        (p for p in placements if p not in ground),
        key=lambda p: (p[1] + p[2] + 2 * p[3], p[1]),
    )
    for name, gx, gy, fp in ground + objects:
        img, anchor = images[name]
        sx = tip[0] + (gx - gy) * 4
        sy = tip[1] + (gx + gy + 2 * fp) * 2
        scene = paste(scene, img, sx - anchor[0], sy - anchor[1])
    scene.resize((width * scale, height * scale), Image.NEAREST).save(os.path.join(preview_dir, "plants-scene.png"))

    # --- density: the grand leafy tree at three pixel densities, shown at about the same size ---
    panels = []
    for s, factor, text in ((0.75, 8, "12 px per metre"), (1.0, 6, "16 px per metre (planned)"), (1.5, 4, "24 px per metre")):
        img, anchor = leafy_tree(5, s).image()
        panel = Image.new("RGBA", (img.width + 8, img.height + 6), PAPER)
        for yy in range(2 + anchor[1] - 3, panel.height):
            for xx in range(panel.width):
                panel.putpixel((xx, yy), GRASS[0])
        panel = paste(panel, img, 4, 2)
        panels.append((panel.resize((panel.width * factor, panel.height * factor), Image.NEAREST), text, img.size))
    label_font = font(24)
    probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    slots = [max(p.width, probe.textlength(t, font=label_font)) for p, t, _ in panels]
    width = int(sum(slots) + 50 * (len(panels) + 1))
    height = max(p.height for p, _, _ in panels) + 120
    compare = Image.new("RGBA", (width, height), PAPER)
    draw = ImageDraw.Draw(compare)
    x = 50
    for (panel, text, size), slot in zip(panels, slots):
        compare.paste(panel, (int(x), 30 + (height - 120 - panel.height)))
        draw.text((x, height - 76), f"{text}\n{size[0]}×{size[1]} px", fill=(40, 40, 40, 255), font=label_font)
        x += slot + 50
    compare.save(os.path.join(preview_dir, "plants-density.png"))
    return manifest


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "out"
    ocean = sys.argv[2] if len(sys.argv) > 2 else None
    result = build(out, ocean)
    palette = set()
    for entry in result:
        palette |= opaque_colors(Image.open(os.path.join(out, "plants", entry["file"])).convert("RGBA"))
    print(f"{len(result)} sprites, {len(palette)} colors")
    for entry in result:
        print(f'{entry["file"]:<22} {entry["size"][0]:>3}×{entry["size"][1]:<3} anchor {entry["anchorPx"]}')
