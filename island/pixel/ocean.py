#!/usr/bin/env python3
"""
Home background as pixel art: sky, clouds, sea, island, beach, shallows, foam.

Third pass. After Jannis' feedback the sea was rebuilt (smooth gradient instead
of colour bands, waves as shapes in loose groups, cumulus clouds), and the
island got what it was missing:
- a visible edge at the front, so the land has thickness instead of looking like
  a sticker,
- a meadow with large patches and fine speckle instead of one flat green,
- rocks on the grass, pebbles and driftwood on the beach, rocks in the shallows,
- a ragged grass-to-sand line instead of a clean curve.

The island keeps the plants' rules (island/SPRITES.md): 2:1 isometric, 16 art
pixels per metre, light from the top left, hard pixel edges, whole-number
scaling only.

Usage, from the repo root:
    python3 island/pixel/ocean.py island/pixel [stage...]
Writes island/pixel/backgrounds/home-<stage>.png (1x) and previews at 6x, with
and without plants.
"""

import json
import math
import os
import sys

from PIL import Image

# The picture is always 1320 x 2868 device pixels on the phone. A bigger island
# is drawn on a bigger art canvas and scaled up less, so objects keep their pixel
# size and the sea looks further away — the camera steps of WACHSTUM.md §15.2.
DEVICE_W, DEVICE_H = 1320, 2868
# One metre along a ground axis is 8 px right and 4 px down, so in the un-squashed
# circle the island radius counts sqrt(8² + 8²) = 11.31 px per metre. (The 16 px per
# metre in SPRITES.md are the width of the tile diamond, not the axis step.)
PX_PER_M = math.sqrt(128)
W, H = 220, 478  # set per stage in build()
HORIZON = round(H * 0.205)

# --- colours ----------------------------------------------------------------
# Lagoon palette: turquoise at the horizon, deep blue in front, and a bright
# ring of water around the island. Chosen to sit next to the plant greens
# rather than to be true to nature.
SKY_TOP = (44, 127, 227)
SKY_HORIZON = (189, 237, 245)
SEA_TOP = (63, 190, 214)      # turquoise haze at the horizon
SEA_BOTTOM = (18, 86, 140)    # deep blue closest to the viewer
LAGOON = (86, 206, 214)       # the water lights up around the island
FOAM_WHITE = (226, 252, 255)

CLOUD_LIGHT = (253, 254, 255)
CLOUD_MID = (220, 242, 250)
CLOUD_SHADE = (183, 214, 232)

SHALLOW_LIGHT = (167, 246, 236)
SHALLOW = (94, 216, 216)
FOAM = (226, 252, 255)
SAND = (243, 224, 174)
SAND_LIGHT = (250, 237, 200)
SAND_WET = (220, 192, 132)
EARTH = (199, 156, 98)        # the side of the island at the front
EARTH_DARK = (156, 117, 70)
GRASS = (163, 207, 79)
GRASS_LIGHT = (185, 220, 99)
GRASS_DARK = (134, 184, 67)
GRASS_DEEP = (109, 156, 55)
COAST = (111, 158, 55)
STONE_LIGHT = (195, 207, 214)  # cool grey, so the rocks belong to the water
STONE = (148, 163, 173)
STONE_DARK = (95, 110, 121)
DRIFTWOOD = (156, 117, 79)

# `seed` shapes the coastline. 23 is variant B, picked by Jannis on 2026-09-14:
# two separate beaches, rock everywhere else. Every stage uses it, so this is one
# island that grows, not five different ones.
#
# `rx` is the island radius in art pixels (16 px = 1 m), `d` the zoom the phone
# uses. Land area grows by about half per step. Stage 5 (24 m across, ~450 m²)
# holds the whole catalogue: the ten buildings at full size need ~77 m², the
# plants ~20 m², the roadmap objects ~13 m², and with paths and clearance that is
# roughly 200 m² of the ~290 m² of grass it has.
# The island always covers the same share of the screen: rx * d is constant
# (2 * rx * d = 1104 of 1320 device pixels, about 84 %). Growth shows in the
# camera: the further it steps back, the smaller the objects and the more room
# the island has. Stage 2 is the island Jannis approved.
STAGES = {
    1: {"d": 8, "rx": 69.0, "seed": 23},   # 12.2 m across, ~117 m² of land
    2: {"d": 6, "rx": 92.0, "seed": 23},   # 16.3 m, ~208 m²
    3: {"d": 5, "rx": 110.4, "seed": 23},  # 19.5 m, ~299 m²
    4: {"d": 4, "rx": 138.0, "seed": 23},  # 24.4 m, ~467 m²
    5: {"d": 3, "rx": 184.0, "seed": 23},  # 32.5 m, ~831 m²: holds the catalogue
}
# Beach and shallows grow with the island, so the coast keeps its proportions.
# 2026-09-14: 4.2 -> 5.2. The sand was only 0.5 to 1.7 m wide, and the beach
# objects (island/pixel/beach.py) did not fit on it without standing half in the
# grass. Widening the band is the cheaper fix than shrinking every sprite again.
# Changing this regenerates every island picture: run ocean.py --sizes, copy the
# upscaled results to assets/home/pixel-island-N.png, then zones.py and layout.py.
BEACH_AT_92 = 5.2
SHALLOW_AT_92 = 11.0


def rnd(*values):
    """Deterministic 0..1 noise, so every run draws the same picture."""
    h = 2166136261
    for value in values:
        h ^= int(value) & 0xFFFFFFFF
        h = (h * 16777619) & 0xFFFFFFFF
    h ^= h >> 13
    h = (h * 0x5BD1E995) & 0xFFFFFFFF
    h ^= h >> 15
    return h / 4294967296


def patches(x, y, seed=0):
    """Slow wobble, for meadow patches and a ragged shoreline. Roughly -1..1."""
    return (
        math.sin(x * 0.13 + y * 0.23 + seed * 1.7) * 0.5
        + math.sin(x * 0.07 - y * 0.13 + seed * 3.1) * 0.35
        + math.sin(x * 0.31 + y * 0.09 + seed * 0.9) * 0.15
    )


def lerp(a, b, t):
    t = max(0.0, min(1.0, t))
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def tint(color, t):
    """Towards foam white: crests and caps."""
    return lerp(color, FOAM_WHITE, t)


def shade(color, f):
    return tuple(max(0, min(255, round(c * f))) for c in color)


def sky_color(y):
    return lerp(SKY_TOP, SKY_HORIZON, (y / HORIZON) ** 1.35)


ISLAND_FOR_WATER = None  # set in build(), so the lagoon knows where the island is
SEA_SEED = 0  # set in build(): every stage gets its own waves and clouds
SWELL_PHASE = 0.0


def sea_color(x, y):
    """Gradient, a slow swell and a turquoise lagoon around the island."""
    t = (y - HORIZON) / (H - HORIZON)
    base = lerp(SEA_TOP, SEA_BOTTOM, t ** 0.85)
    if ISLAND_FOR_WATER is not None:
        distance, _ = ISLAND_FOR_WATER.polar(x, y)
        glow = max(0.0, 1.0 - distance / (ISLAND_FOR_WATER.rx * 2.7)) ** 1.6
        base = lerp(base, LAGOON, 0.5 * glow)
    swell = math.sin(x * 0.045 + y * 0.115 + SWELL_PHASE) * 0.5 + math.sin(
        x * 0.017 - y * 0.05 + 1.7 + SWELL_PHASE
    ) * 0.5
    amount = 1 + 4 * t
    return tuple(max(0, min(255, round(c + swell * amount))) for c in base)


# ---------------------------------------------------------------------------
# Island
# ---------------------------------------------------------------------------


class Island:
    """Organic 2:1 blob with wide bays at the front and a thin rim elsewhere."""

    def __init__(self, cx, cy, rx, beach, shallow, seed=0):
        self.cx, self.cy, self.rx, self.beach, self.shallow = cx, cy, rx, beach, shallow
        self.seed = seed
        self.phase = [rnd(seed, k) * 2 * math.pi for k in range(5)]
        self.amp = (
            0.09 + 0.07 * rnd(seed, 10),
            0.04 + 0.05 * rnd(seed, 11),
            0.02 + 0.03 * rnd(seed, 12),
        )
        # the widest bay gets a sand bar running into the water
        self.spit_angle, widest = 0.0, 0.0
        for step in range(160):
            a = step / 160 * 2 * math.pi
            bay = max(0.0, self.bend(a))
            if bay > widest:
                self.spit_angle, widest = a, bay

    def polar(self, x, y):
        u = x - self.cx
        v = (y - self.cy) * 2.0
        return math.hypot(u, v), math.atan2(v, u)

    def radius(self, angle):
        return self.rx * (
            1.0
            + self.amp[0] * math.sin(3 * angle + self.phase[0])
            + self.amp[1] * math.sin(5 * angle + self.phase[1])
            + self.amp[2] * math.sin(7 * angle + self.phase[2])
        )

    def bend(self, angle, step=0.16):
        """Curvature of the coast: positive inside a bay, negative on a headland."""
        middle = self.radius(angle)
        return (self.radius(angle - step) + self.radius(angle + step) - 2 * middle) / (
            self.rx * step * step
        )

    def bend_smooth(self, angle):
        """Curvature averaged along the shore, so the sand never jumps in width."""
        return sum(self.bend(angle + offset) for offset in (-0.3, -0.15, 0.0, 0.15, 0.3)) / 5

    def coast(self, angle):
        """Bays collect sand, headlands stay bare rock, as on a real coast."""
        bend = self.bend_smooth(angle)
        bay = max(0.0, min(1.0, bend * 1.1))
        headland = max(0.0, min(1.0, -bend * 1.2))
        wobble = 0.5 + 0.5 * math.sin(2 * angle + self.phase[3])
        rocky = max(0.0, min(1.0, headland * 1.15 - 0.05))
        front = max(0.0, math.sin(angle))
        # a band along the shore, never a wedge pointing at the middle
        width = 0.45 + 2.4 * bay * (0.5 + 0.8 * wobble) + 0.8 * front * front * bay
        return rocky, min(3.2, width) * (1.0 - 0.92 * rocky)

    def sand_reach(self, x, y, angle):
        """Sand bar running out of the widest bay into the shallows."""
        delta = abs((angle - self.spit_angle + math.pi) % (2 * math.pi) - math.pi)
        if delta > 0.28:
            return 0.0
        taper = (1.0 - delta / 0.28) ** 1.6
        return (1.0 + self.beach * 0.9) * taper * (1.0 + 0.35 * patches(x * 0.9, y * 1.8, 5))

    def beach_width(self, x, y, angle):
        """From a wide bay to almost nothing, ragged where sand meets grass."""
        _, width = self.coast(angle)
        return self.beach * width * (1.0 + 0.22 * patches(x * 0.8, y * 1.6, 3))

    def side_height(self, angle):
        """Thickness of the land, visible on the side facing the viewer."""
        front = math.sin(angle)
        return 3.8 * max(0.0, front) ** 0.45 if front > -0.05 else 0.0

    def zone(self, x, y):
        r, angle = self.polar(x, y)
        land_end = self.radius(angle) + max(
            self.side_height(angle), self.sand_reach(x, y, angle)
        )
        if r < land_end:
            return "land"
        if r < land_end + self.shallow * 1.8:
            return "shallow"
        return "sea"


# ---------------------------------------------------------------------------
# Sky and sea
# ---------------------------------------------------------------------------


def draw_sky(px):
    for y in range(HORIZON + 1):
        color = sky_color(y)
        for x in range(W):
            px[x, y] = color


def draw_cloud(px, cx, base_y, width, height, seed):
    """Cumulus: a few overlapping bubbles on a flat bottom, lit from the top left."""
    bubbles = []
    count = 3 + int(rnd(seed, 1) * 3)
    for k in range(count):
        f = k / max(1, count - 1) - 0.5
        r = height * (0.75 + rnd(seed, k, 2) * 0.5)
        if k in (0, count - 1):
            r *= 0.62
        bubbles.append((cx + f * width * 0.9, base_y - r * 0.72 - rnd(seed, k, 3) * height * 0.3, r * 1.25, r))
    left = min(b[0] - b[2] for b in bubbles)
    right = max(b[0] + b[2] for b in bubbles)
    top = min(b[1] - b[3] for b in bubbles)
    for y in range(int(top) - 1, base_y + 1):
        for x in range(int(left) - 1, int(right) + 2):
            if not (0 <= x < W and 0 <= y <= HORIZON):
                continue
            inside = False
            top_lit = False
            for bx, by, brx, bry in bubbles:
                dx = (x + 0.5 - bx) / brx
                dy = (y + 0.5 - by) / bry
                if dx * dx + dy * dy <= 1.0:
                    inside = True
                    if dy < -0.25 or (dx < -0.1 and dy < 0.15):
                        top_lit = True
            if not inside:
                continue
            depth = (base_y - y) / max(1.0, height * 2.2)
            if top_lit and depth > 0.35:
                color = CLOUD_LIGHT
            elif depth > 0.2:
                color = CLOUD_MID
            else:
                color = CLOUD_SHADE
            px[x, y] = color


def draw_clouds(px):
    """A fresh sky per stage.

    On the phone the sky is almost completely covered by the header: status bar,
    greeting, the three round buttons, date and streak pill reach down to the
    horizon. The clouds therefore sit as a distant bank just above the water line,
    and never in the left third where the streak pill ends.
    """
    for k in range(4 + int(rnd(SEA_SEED, 1) * 3)):
        big = rnd(SEA_SEED, k, 10) > 0.55
        draw_cloud(
            px,
            round(W * (0.3 + 0.68 * rnd(SEA_SEED, k, 2))),
            round(HORIZON * (0.78 + 0.19 * rnd(SEA_SEED, k, 3))),
            round(W * ((0.09 if big else 0.05) + 0.06 * rnd(SEA_SEED, k, 4))),
            max(2, round(HORIZON * ((0.045 if big else 0.025) + 0.02 * rnd(SEA_SEED, k, 5)))),
            SEA_SEED * 31 + k,
        )


def draw_sea(px):
    for y in range(HORIZON, H):
        for x in range(W):
            px[x, y] = sea_color(x, y)


def wave_rows():
    """Rows of crests, further apart the closer they are to the viewer."""
    rows = []
    y = HORIZON + 2.0
    while y < H:
        rows.append(round(y))
        y += 2.0 + (y - HORIZON) * 0.075
    return rows


def draw_crest(px, island, x0, y0, length, depth, seed):
    """One crest: lifted in the middle, trough below, foam cap when it is long."""
    if y0 <= HORIZON or y0 >= H - 1:
        return
    for i in range(length):
        x = x0 + i
        if not 0 <= x < W:
            continue
        lift = 1 if length >= 5 and length * 0.3 <= i <= length * 0.72 else 0
        y = y0 - lift
        if not HORIZON < y < H - 1:
            continue
        zone = island.zone(x, y)
        if zone == "land":
            continue
        if zone == "shallow":
            if i % 2 == 0 and length >= 3:  # calm water near the island
                px[x, y] = tint(sea_color(x, y), 0.42)
            continue
        px[x, y] = tint(sea_color(x, y), 0.10 + 0.30 * depth + 0.10 * rnd(seed, i))
        if depth > 0.3 and length >= 4 and island.zone(x, y + 1) == "sea":
            px[x, y + 1] = shade(sea_color(x, y + 1), 0.87)
    if length >= 7 and depth > 0.2:
        cap = x0 + int(length * 0.45)
        for x in (cap, cap + 1):
            if 0 <= x < W and island.zone(x, y0 - 1) == "sea":
                px[x, y0 - 1] = tint(sea_color(x, y0 - 1), 0.72)


def draw_waves(px, island):
    for row, y in enumerate(wave_rows()):
        depth = (y - HORIZON) / (H - HORIZON)
        if depth < 0.10:
            continue  # far away the sea reads as smooth water
        base_length = 1.6 + depth * 9.0
        x = -int(rnd(SEA_SEED, row, 7) * 30)
        while x < W:
            group = 1 + int(rnd(SEA_SEED, row, x, 8) * 3)  # crests travel in loose groups
            if depth < 0.25 and rnd(SEA_SEED, row, x, 13) < 0.55:
                x += 8 + int(rnd(SEA_SEED, row, x, 14) * 20)
                continue
            for k in range(group):
                length = max(1, int(base_length * (0.55 + rnd(SEA_SEED, row, x, k, 9) * 1.0)))
                jitter = int((rnd(SEA_SEED, row, x, k, 10) - 0.5) * (1.2 + depth * 5))
                if depth < 0.12 and length > 2:
                    length = 2
                draw_crest(px, island, x, y + jitter, length, depth, SEA_SEED + row * 31 + k)
                x += length + 1 + int(rnd(SEA_SEED, row, x, k, 11) * 3)
            x += 5 + int(rnd(SEA_SEED, row, x, 12) * (9 + depth * 42))


# ---------------------------------------------------------------------------
# The island itself
# ---------------------------------------------------------------------------


def grass_color(x, y, inner, lit, dome):
    """Meadow: domed ground, big patches, clumps, fine speckle."""
    if inner < 0.04:
        return COAST
    value = lit * 0.8 + dome + 0.5 * patches(x, y, 1)
    if value > 0.62:
        color = GRASS_LIGHT
    elif value > 0.16:
        color = GRASS
    elif value > -0.34:
        color = GRASS_DARK
    else:
        color = GRASS_DEEP
    if patches(x * 1.9, y * 3.7, 7) > 0.82:  # small clumps of taller grass
        color = GRASS_DEEP if color is not GRASS_LIGHT else GRASS_DARK
    speck = rnd(x, y, 5)
    if speck > 0.955:
        color = GRASS_LIGHT if color in (GRASS, GRASS_DARK) else color
    elif speck < 0.05:
        color = GRASS_DARK if color in (GRASS, GRASS_LIGHT) else color
    return color


def sand_color(x, y, wet):
    if wet > 0.66:
        return SAND_WET
    speck = rnd(x, y, 6)
    if speck > 0.94:
        return SAND_WET if wet > 0.3 else SAND_LIGHT
    if speck < 0.035:
        return STONE  # a pebble in the sand
    return SAND if wet > 0.25 else SAND_LIGHT


def gravel_color(x, y, t):
    """Rocky shore: loose gravel, sand between the stones, pools, wet rock."""
    coarse = patches(x * 2.2, y * 4.4, 11)
    fine = patches(x * 5.3, y * 9.7, 19)
    if t > 0.84:  # washed by every wave
        return shade(STONE_DARK, 0.86) if fine < 0.2 else STONE_DARK
    if 0.45 < t < 0.82 and coarse > 0.55 and fine > 0.1:
        return SHALLOW if fine > 0.45 else SHALLOW_LIGHT  # tide pool
    if t < 0.2 and rnd(x, y, 12) > 0.86:
        return GRASS_DEEP  # moss where the grass gives up
    speck = rnd(x, y, 21)
    if speck > 0.9:
        return SAND_WET if t > 0.5 else SAND  # sand caught between the stones
    if fine > 0.55:
        return STONE_LIGHT
    if fine < -0.62 or speck < 0.06:
        return shade(STONE_DARK, 0.88)
    return STONE if coarse > -0.1 else STONE_DARK


def draw_island(px, island):
    reach = island.shallow * 1.8
    for y in range(HORIZON, H):
        for x in range(W):
            r, angle = island.polar(x, y)
            edge = island.radius(angle)
            side = island.side_height(angle)
            spit = island.sand_reach(x, y, angle)
            land_end = edge + max(side, spit)
            if r > land_end + reach:
                continue
            rocky, _ = island.coast(angle)
            beach = island.beach_width(x, y, angle)
            rock_band = (2.5 + 5.5 * rocky) if rocky > 0.25 else 0.0
            rock_band *= 1.0 + 0.45 * patches(x * 0.7, y * 1.4, 13)
            shore = edge - max(beach, rock_band)
            if r < shore:  # grass
                inner = (shore - r) / max(1.0, shore)
                lit = (-(x - island.cx) - (y - island.cy) * 2) / island.rx * 0.5
                dome = 0.5 * (1.0 - min(1.0, (r / edge) ** 2))
                color = grass_color(x, y, inner, lit, dome)
            elif rocky > 0.25 and r < edge + side * 0.9:  # rocky shore
                color = gravel_color(x, y, (r - shore) / max(1.0, edge + side * 0.9 - shore))
            elif r < edge:  # beach, wet towards the water
                color = sand_color(x, y, (r - (edge - beach)) / max(1.0, beach))
            elif r < edge + spit:  # sand bar reaching into the water
                color = SAND_WET if (r - edge) / max(1.0, spit) > 0.45 else SAND
            elif r < edge + side:  # the land has thickness at the front
                deep = (r - edge) / max(0.6, side)
                if deep < 0.42:
                    color = EARTH
                elif deep < 0.82:
                    color = EARTH_DARK
                else:
                    color = shade(EARTH_DARK, 0.78)
            elif r < land_end + (2.4 if rocky > 0.35 else 1.6):  # foam and spray
                color = FOAM if rnd(x, y, 9) > (0.45 if rocky > 0.35 else 0.22) else SHALLOW_LIGHT
            else:
                t = (r - land_end) / island.shallow
                if t < 0.45:
                    color = SHALLOW_LIGHT
                elif t <= 0.95:
                    color = SHALLOW
                else:  # fades into the open sea, no hard ring
                    color = lerp(SHALLOW, sea_color(x, y), min(1.0, (t - 0.95) / 0.75))
                if 0.0 < angle < 1.75 and 0.12 < t < 0.62:
                    color = shade(color, 0.88)  # the island shades the water
            px[x, y] = color


def draw_rock(px, x0, y0, w, h, seed, in_water=False):
    """A small boulder: light top left, dark bottom right, flat where it meets the ground."""
    for dy in range(-h, 2):
        for dx in range(-w, w + 1):
            nx = dx / w
            ny = dy / h
            if nx * nx + ny * ny > 1.0 + 0.12 * patches(dx * 3, dy * 3, seed):
                continue
            if dy > 0:
                continue
            if ny < -0.35 and nx < 0.15:
                color = STONE_LIGHT
            elif ny > 0.25 or nx > 0.45:
                color = STONE_DARK
            else:
                color = STONE
            px[x0 + dx, y0 + dy] = lerp(color, SHALLOW, 0.35) if in_water else color
    if not in_water:  # a short shadow on the ground
        for dx in range(0, w + 1):
            x = x0 + dx
            y = y0 + 1
            if 0 <= x < W and 0 <= y < H:
                px[x, y] = shade(px[x, y], 0.86)


def draw_details(px, island):
    """Rocks on the grass, pebbles and driftwood on the beach, rocks in the shallows."""
    rocks = []
    scale = island.rx / 92.0  # a longer coast carries more of everything

    def free(x, y, space):
        return all(
            abs(x - ox) > space or abs(y - oy) > space * 0.6 for ox, oy, _ in rocks
        )

    # boulders along the rim, most of them where the coast is rocky
    for k in range(round(900 * scale)):
        angle = rnd(k, 1) * 2 * math.pi
        rocky, _ = island.coast(angle)
        if rnd(k, 20) > 0.25 + 0.7 * rocky:
            continue
        edge = island.radius(angle)
        inward = 1.0 + rnd(k, 2) * (7.0 if rocky > 0.4 else 5.0)
        x = int(island.cx + math.cos(angle) * (edge - inward))
        y = int(island.cy + math.sin(angle) * (edge - inward) / 2)
        if not (0 <= x < W - 3 and HORIZON < y < H - 3):
            continue
        r, a = island.polar(x, y)
        band = max(island.beach_width(x, y, a), (2.5 + 5.5 * rocky) if rocky > 0.25 else 0.0)
        if r > island.radius(a) - band - 1:
            continue
        if not free(x, y, 7):
            continue
        w = 2 + int(rnd(k, 3) * (4 if rocky > 0.4 else 3))
        draw_rock(px, x, y, w, max(2, w - 1), k)
        rocks.append((x, y, w))
        if rnd(k, 4) > 0.5:  # a smaller one next to it
            sx, sy = x + w + 2, y + 1
            r2, a2 = island.polar(sx, sy)
            if r2 < island.radius(a2) - 3:
                draw_rock(px, sx, sy, 2, 2, k + 99)
                rocks.append((sx, sy, 2))
        if len(rocks) >= round(30 * scale):
            break

    # boulders in the rocky shore itself, some of them standing in the surf
    angle = 0.0
    while angle < 2 * math.pi:
        angle += 0.035
        rocky, _ = island.coast(angle)
        seed = int(angle * 400)
        if rocky < 0.3 or rnd(seed, 50) > 0.18 + 0.5 * rocky:
            continue
        edge = island.radius(angle)
        offset = (rnd(seed, 51) - 0.5) * 8.0
        x = int(island.cx + math.cos(angle) * (edge + offset))
        y = int(island.cy + math.sin(angle) * (edge + offset) / 2)
        if not (0 <= x < W - 3 and HORIZON < y < H - 3) or not free(x, y, 5):
            continue
        w = 2 + int(rnd(seed, 52) * 3)
        in_water = offset > 1.5
        draw_rock(px, x, y, w, max(2, w - 1), seed, in_water=in_water)
        if in_water:
            for dx in range(-w - 1, w + 2):
                sx = x + dx
                if 0 <= sx < W and rnd(sx, y, 53) > 0.45:
                    px[sx, y + 1] = FOAM
        rocks.append((x, y, w))

    # a couple of single boulders inland, so the middle is not empty
    for k in range(300):
        x = int(island.cx + (rnd(k, 40) - 0.5) * island.rx * 1.1)
        y = int(island.cy + (rnd(k, 41) - 0.5) * island.rx * 0.55)
        r, angle = island.polar(x, y)
        if r > island.radius(angle) - island.beach_width(x, y, angle) - 10:
            continue
        if not free(x, y, 20):
            continue
        w = 2 + int(rnd(k, 42) * 2)
        draw_rock(px, x, y, w, max(2, w - 1), k + 500)
        rocks.append((x, y, w))
        if sum(1 for entry in rocks if entry[2] <= 3) >= round(34 * scale):
            break

    # bare earth patches
    for k in range(300):
        x = int(island.cx + (rnd(k, 30) - 0.5) * island.rx * 1.5)
        y = int(island.cy + (rnd(k, 31) - 0.5) * island.rx * 0.8)
        r, angle = island.polar(x, y)
        if r > island.radius(angle) - island.beach_width(x, y, angle) - 8:
            continue
        if not free(x, y, 22):
            continue
        w = 4 + int(rnd(k, 32) * 4)
        for dy in range(-w // 2 - 1, w // 2 + 2):
            for dx in range(-w - 1, w + 2):
                nx, ny = dx / w, dy / max(1.0, w / 2)
                if nx * nx + ny * ny > 1.0 + 0.25 * patches(dx * 4, dy * 4, k):
                    continue
                sx, sy = x + dx, y + dy
                if not (0 <= sx < W and HORIZON < sy < H):
                    continue
                tone = rnd(sx, sy, 33)
                px[sx, sy] = STONE_DARK if tone > 0.93 else (EARTH if tone > 0.35 else EARTH_DARK)
        rocks.append((x, y, w))
        if sum(1 for entry in rocks if entry[2] >= 4) >= max(3, round(3 * scale)):
            break

    # rocks standing in the shallow water
    placed = 0
    for k in range(400):
        angle = rnd(k, 5) * 2 * math.pi
        if rnd(k, 25) > 0.2 + 0.8 * island.coast(angle)[0]:
            continue
        edge = island.radius(angle) + island.side_height(angle)
        dist = edge + island.shallow * (0.35 + rnd(k, 6) * 0.5)
        x = int(island.cx + math.cos(angle) * dist)
        y = int(island.cy + math.sin(angle) * dist / 2)
        if not (0 <= x < W - 4 and HORIZON < y < H - 4):
            continue
        if island.zone(x, y) != "shallow" or not free(x, y, 13):
            continue
        w = 2 + int(rnd(k, 7) * 2)
        draw_rock(px, x, y, w, max(2, w - 1), k + 7, in_water=True)
        for dx in range(-w - 1, w + 2):  # foam ring around it
            sx = x + dx
            if 0 <= sx < W and rnd(sx, y, 8) > 0.4:
                px[sx, y + 1] = FOAM
        rocks.append((x, y, w))
        placed += 1
        if placed >= round(9 * scale):
            break

    # driftwood and pebble groups on the sand
    for k in range(round(160 * scale)):
        angle = rnd(k, 9) * math.pi  # front half, where the beaches are
        edge = island.radius(angle)
        beach_here = island.beach * 1.6
        dist = edge - beach_here * (0.3 + rnd(k, 10) * 0.5)
        x = int(island.cx + math.cos(angle) * dist)
        y = int(island.cy + math.sin(angle) * dist / 2)
        if not (0 <= x < W - 5 and HORIZON < y < H - 3) or not free(x, y, 9):
            continue
        r, a = island.polar(x, y)
        if r > island.radius(a) or r < island.radius(a) - island.beach_width(x, y, a):
            continue
        if rnd(k, 11) > 0.55:  # driftwood
            length = 3 + int(rnd(k, 12) * 3)
            for i in range(length):
                if 0 <= x + i < W:
                    px[x + i, y] = DRIFTWOOD if i % 3 else shade(DRIFTWOOD, 0.8)
        else:  # a few pebbles
            for i in range(2 + int(rnd(k, 13) * 3)):
                sx = x + int(rnd(k, i, 14) * 5)
                sy = y + int(rnd(k, i, 15) * 3) - 1
                if 0 <= sx < W and 0 <= sy < H:
                    px[sx, sy] = STONE if rnd(k, i, 16) > 0.4 else STONE_DARK
        rocks.append((x, y, 3))
    return rocks


# ---------------------------------------------------------------------------
# Plants on the island
# ---------------------------------------------------------------------------


def grass_free(island, x, y, cells):
    for i in range(cells + 1):
        for j in range(cells + 1):
            sx, sy = x + (i - j) * 4, y - (i + j) * 2
            r, angle = island.polar(sx, sy)
            rocky, _ = island.coast(angle)
            band = max(
                island.beach_width(sx, sy, angle),
                (2.5 + 5.5 * rocky) * 1.45 if rocky > 0.25 else 0.0,
            )
            if r > island.radius(angle) - band - 3:
                return False
    return True


def place_plants(image, island, plant_dir, rocks=()):
    # Namen und Stufen des 10-Stufen-Satzes (island/pixel/plants.py). Die alte
    # Liste zeigte noch auf das 5-Stufen-Schema und lief seit dessen Ablösung in
    # einen KeyError. Gemischt werden ausgewachsene und halbhohe Pflanzen, damit
    # die Insel nicht wie eine Baumschule aussieht.
    wanted = [
        ("world_tree_10.png", 3), ("leafy_tree_10.png", 1), ("leafy_tree_08.png", 1),
        ("leafy_tree_06.png", 1), ("fir_tree_10.png", 1), ("fir_tree_07.png", 1),
        ("fruit_tree_10.png", 1), ("fruit_tree_07.png", 1), ("palm_tree_10.png", 1),
        ("palm_tree_07.png", 1), ("bush_10.png", 2), ("bush_07.png", 2), ("bush_03.png", 1),
        ("flower_bed_10.png", 3), ("grass_tufts_10.png", 1), ("grass_tufts_08.png", 1),
        ("grass_tufts_06.png", 1), ("leafy_tree_04.png", 1), ("fir_tree_03.png", 1),
        ("leafy_tree_02.png", 1),
    ]
    with open(os.path.join(plant_dir, "manifest.json")) as handle:
        manifest = {entry["file"]: entry for entry in json.load(handle)}

    copies = max(1, round((island.rx / 92.0) ** 2 * 0.8))
    wanted = wanted * copies
    span = int(island.rx / 4) + 6
    candidates = []
    for i in range(-span, span + 1):
        for j in range(-span, span + 1):
            candidates.append(
                (rnd(i, j, 21), round(island.cx + (i - j) * 4), round(island.cy - (i + j) * 2))
            )
    candidates.sort()

    placed = []
    for name, cells in wanted:
        for _, x, y in candidates:
            if not grass_free(island, x, y, cells):
                continue
            if any(abs(x - ox) < 14 + 4 * cells and abs(y - oy) < 9 + 2 * cells for ox, oy, _ in placed):
                continue
            if any(abs(x - rx) < 6 and abs(y - ry) < 4 for rx, ry, _ in rocks):
                continue
            placed.append((x, y, name))
            break

    placed.sort(key=lambda p: p[1])
    for x, y, name in placed:
        entry = manifest[name]
        sprite = Image.open(os.path.join(plant_dir, name)).convert("RGBA")
        layer = Image.new("RGBA", image.size, (0, 0, 0, 0))
        layer.paste(sprite, (x - entry["anchorPx"][0], y - entry["anchorPx"][1]))
        image.alpha_composite(layer)
    return len(placed)


def build(out_dir, stage=1, with_plants=True, seed=None, name=None):
    global ISLAND_FOR_WATER, W, H, HORIZON, SEA_SEED, SWELL_PHASE
    spec = STAGES[stage]
    SEA_SEED = 700 + stage * 13
    SWELL_PHASE = rnd(SEA_SEED, 99) * 6.283
    zoom = spec["d"]
    W = DEVICE_W // zoom
    H = round(DEVICE_H / zoom)
    HORIZON = round(H * 0.205)
    scale = spec["rx"] / 92.0
    island = Island(
        W / 2,
        round(H * 0.53),
        spec["rx"],
        BEACH_AT_92 * scale,
        SHALLOW_AT_92 * scale,
        spec["seed"] if seed is None else seed,
    )
    ISLAND_FOR_WATER = island
    label = name or f"home-{stage}"

    image = Image.new("RGBA", (W, H), (0, 0, 0, 255))
    px = image.load()
    draw_sky(px)
    draw_clouds(px)
    draw_sea(px)
    draw_island(px, island)
    rocks = draw_details(px, island)
    draw_waves(px, island)

    bg_dir = os.path.join(out_dir, "backgrounds")
    preview_dir = os.path.join(out_dir, "previews")
    os.makedirs(bg_dir, exist_ok=True)
    os.makedirs(preview_dir, exist_ok=True)
    image.save(os.path.join(bg_dir, f"{label}.png"))
    image.resize((W * zoom, H * zoom), Image.NEAREST).save(
        os.path.join(preview_dir, f"{label}@{zoom}x.png")
    )

    count = 0
    if with_plants:
        planted = image.copy()
        count = place_plants(planted, island, os.path.join(out_dir, "plants"), rocks)
        planted.resize((W * zoom, H * zoom), Image.NEAREST).save(
            os.path.join(preview_dir, f"{label}-plants@{zoom}x.png")
        )
    return len(rocks), count


def variant_sheet(out_dir, labels, scale=4, crop=(0, 150, W, 384)):
    """The island band of every variant side by side, for picking a coastline."""
    from PIL import ImageDraw, ImageFont

    tiles = []
    for label in labels:
        image = Image.open(os.path.join(out_dir, "backgrounds", f"{label}.png")).convert("RGBA")
        piece = image.crop(crop)
        tiles.append(piece.resize((piece.width * scale, piece.height * scale), Image.NEAREST))
    pad, caption = 16, 44
    columns = 2
    rows = (len(tiles) + columns - 1) // columns
    sheet = Image.new(
        "RGBA",
        (
            columns * tiles[0].width + pad * (columns + 1),
            rows * (tiles[0].height + caption) + pad * (rows + 1),
        ),
        (244, 241, 234, 255),
    )
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 30)
    except OSError:
        font = ImageFont.load_default()
    for index, (label, tile) in enumerate(zip(labels, tiles)):
        column, row = index % columns, index // columns
        x = pad + column * (tile.width + pad)
        y = pad + row * (tile.height + caption + pad)
        sheet.paste(tile, (x, y))
        draw.text((x + 4, y + tile.height + 8), label, fill=(40, 40, 40, 255), font=font)
    path = os.path.join(out_dir, "previews", "beach-variants.png")
    sheet.save(path)
    return path


def size_sheet(out_dir, stages, width=430):
    """Every island size next to each other, each at the same phone width."""
    from PIL import ImageDraw, ImageFont

    tiles, captions = [], []
    for stage in stages:
        zoom = STAGES[stage]["d"]
        path = os.path.join(out_dir, "previews", f"home-{stage}-plants@{zoom}x.png")
        image = Image.open(path).convert("RGBA")
        tiles.append(image.resize((width, round(image.height * width / image.width)), Image.BOX))
        metres = 2 * STAGES[stage]["rx"] / PX_PER_M
        captions.append(f"Stufe {stage} · {metres:.0f} m · Zoom D {zoom}")
    pad, caption = 16, 40
    sheet = Image.new(
        "RGBA",
        (len(tiles) * (width + pad) + pad, tiles[0].height + caption + pad * 2),
        (244, 241, 234, 255),
    )
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 24)
    except OSError:
        font = ImageFont.load_default()
    for index, (tile, text) in enumerate(zip(tiles, captions)):
        x = pad + index * (width + pad)
        sheet.paste(tile, (x, pad))
        draw.text((x, pad + tile.height + 8), text, fill=(40, 40, 40, 255), font=font)
    path = os.path.join(out_dir, "previews", "island-sizes.png")
    sheet.save(path)
    return path


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "out"
    args = sys.argv[2:]
    if "--sizes" in args:
        for stage in sorted(STAGES):
            rocks, plants = build(out, stage)
            metres = 2 * STAGES[stage]["rx"] / PX_PER_M
            print(
                f"stage {stage}: {metres:.1f} m across, canvas {W}x{H} at D {STAGES[stage]['d']}, "
                f"{rocks} details, {plants} plants"
            )
        print("sheet:", size_sheet(out, sorted(STAGES)))
        sys.exit(0)
    if "--variants" in args:
        names = []
        for index, seed in enumerate((11, 23, 37, 52)):
            name = f"variant-{chr(65 + index)}"
            rocks, plants = build(out, 1, True, seed, name)
            print(f"{name} (seed {seed}): {rocks} details, {plants} plants")
            names.append(name)
        print("sheet:", variant_sheet(out, names))
    else:
        for stage in [int(a) for a in args if a.isdigit()] or [1]:
            rocks, plants = build(out, stage)
            print(f"stage {stage}: {W}x{H} art px -> {W * 6}x{H * 6}, {rocks} details, {plants} plants")
