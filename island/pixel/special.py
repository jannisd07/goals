#!/usr/bin/env python3
"""
The milestone objects: what long hours of focus leave on the island.

These are not session rewards. They arrive at 5, 10, 25, 50, 100, 200, 300, 500,
750 and 1000 lifetime hours (`src/lib/rewards.ts`), so each one has to feel like
an occasion — six landmarks, four of which grow a second time much later.

Same engine, palette and projection as the buildings (buildings.py supplies the
drawing helpers): 16 art px per metre on the ground, 10 px per metre of height,
light from the top left, one-pixel outline, flat tones.

Two things make them read as landmarks rather than another hut:
- each silhouette is unmistakable at thumbnail size — a thin pole, a low chest,
  a wide round basin, a square clock face, a tapered striped tower, a sharp
  obelisk;
- gold only ever appears here, and only at the second tier.

Usage, from the repo root:
    python3 island/pixel/special.py island/pixel
Writes island/pixel/special/*.png and manifest.json. Spec: island/SPRITES.md.
"""

import json
import math
import os
import sys

HERE_DIR = os.path.dirname(os.path.abspath(__file__))

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from plants import COLORS, MATERIALS, OUTLINE_PRIORITY, Sprite, opaque_colors  # noqa: E402
import buildings as B  # noqa: E402
import flags as FLAGS_MODULE  # noqa: E402

# Flag colours as flat materials: every level the same, because shading a 16 px
# flag turns two neighbouring reds into mud. The outline entry is unused — the
# cloth gets the sprite's own outline pass.
for _char, _hex in FLAGS_MODULE.PALETTE.items():
    _name = f"flag_{_char}"
    COLORS[_name] = _hex
    COLORS[f"{_name}_o"] = _hex
    MATERIALS[_name] = [f"{_name}_o", _name, _name, _name, _name]
    OUTLINE_PRIORITY[_name] = 3

COLORS.update({
    "water_outline": "#2B6478", "water_dark": "#3E93AE", "water_mid": "#63BBD4", "water_light": "#B8ECF7",
    "gold_outline": "#7A5A12", "gold_dark": "#C9962A", "gold_mid": "#F0C246", "gold_light": "#FFE79B",
    "flag_outline": "#7A2A22", "flag_dark": "#B33A2E", "flag_mid": "#D9503C", "flag_light": "#F0806A",
})
MATERIALS.update({
    "water": ["water_outline", "water_dark", "water_dark", "water_mid", "water_light"],
    "brass": ["gold_outline", "gold_dark", "gold_dark", "gold_mid", "gold_light"],
    "flag": ["flag_outline", "flag_dark", "flag_dark", "flag_mid", "flag_light"],
})
OUTLINE_PRIORITY.update({"water": 2, "brass": 5, "flag": 5})

at, shift, centred = B.at, B.shift, B.centred
box, cylinder, ring, post = B.box, B.cylinder, B.ring, B.post
ground_plate, plinth, steps = B.ground_plate, B.plinth, B.steps
hip_roof, canvas = B.hip_roof, B.canvas


def disc(sp, o, w, d, height, mat, level, base=0.0):
    """A flat round surface — the water in a basin, the light of a beacon."""
    cu, cv = canvas(sp, *shift(at(w / 2, d / 2, base + height), *o))
    # a w x d diamond is (w + d) * 8 px wide, so its radius is half of that
    r = (w + d) * B.PX_PER_M_X * 0.5
    for y in range(math.floor(cv - r / 2) - 1, math.ceil(cv + r / 2) + 1):
        for x in range(math.floor(cu - r) - 1, math.ceil(cu + r) + 1):
            dx = (x + 0.5 - cu) / r
            dy = (y + 0.5 - cv) / (r * 0.5)
            if dx * dx + dy * dy <= 1.0:
                # the lit side is one step brighter, but 4 is as bright as it gets
                sp.put(x, y, mat, min(4, level + 1) if dx + dy < -0.4 else level)


def jet(sp, o, w, d, base_h, height, spread):
    """Water rising and falling back — a few pixels, read as movement."""
    cu, cv = canvas(sp, *shift(at(w / 2, d / 2, base_h), *o))
    for step in range(int(height * B.PX_PER_M_H)):
        sp.put(math.floor(cu), math.floor(cv - step), "water", 3 if step % 3 else 4)
    top = cv - height * B.PX_PER_M_H
    for side in (-1, 1):
        for step in range(int(spread * B.PX_PER_M_X)):
            t = step / max(1, spread * B.PX_PER_M_X)
            sp.put(
                math.floor(cu + side * step),
                math.floor(top + t * t * height * B.PX_PER_M_H * 0.9),
                "water",
                4 if step < 2 else 3,
            )


def pole(sp, o, a, b, height, mat="dark"):
    post(sp, shift(at(a, b, 0), *o), 0.12, 0.12, height, mat)


def pennant(sp, o, a, b, top_h, length, drop, mat="flag"):
    """A banner hanging off a pole, drawn as a flag that catches the wind."""
    cu, cv = canvas(sp, *shift(at(a, b, top_h), *o))
    for column in range(int(length * B.PX_PER_M_X)):
        t = column / max(1, length * B.PX_PER_M_X)
        wave = math.sin(t * 3.1) * 1.6
        height_px = int(drop * B.PX_PER_M_H * (1.0 - 0.35 * t))
        for row in range(height_px):
            sp.put(
                math.floor(cu + 1 + column),
                math.floor(cv + row + wave),
                mat,
                4 if row < height_px * 0.35 else (3 if column % 5 else 2),
            )


# ---------------------------------------------------------------------------
# The six landmarks
# ---------------------------------------------------------------------------


def banner(sp, o, a, b, top_h, rows):
    """A real flag on the pole: one pixel per pixel of `flags.py`, with the wave.

    The wave is the only shading. It shifts whole columns, so a stripe stays a
    stripe — a per-pixel highlight would blur exactly the edges that make a flag
    readable at this size.
    """
    cu, cv = canvas(sp, *shift(at(a, b, top_h), *o))
    for column in range(FLAGS_MODULE.W):
        wave = math.sin(column / FLAGS_MODULE.W * 3.1) * 1.4
        for row in range(FLAGS_MODULE.H):
            char = rows[row][column]
            sp.put(
                math.floor(cu + 1 + column),
                math.floor(cv + row + wave),
                f"flag_{char}",
                3,
            )


def flagpole(sp, o, w, d, h, tier, flag=None):
    """First milestone, 5 hours: a flag, and the island is claimed.

    `flag` is a code from `flags.py`; without one the pole flies the plain
    pennant it has always flown.
    """
    ground_plate(sp, centred(o, w, d, w * 0.9, d * 0.9), w * 0.9, d * 0.9, "stone", 3, h=0.14)
    plinth(sp, centred(o, w, d, w * 0.55, d * 0.55), w * 0.55, d * 0.55, "stone", h=0.26)
    pole(sp, o, w / 2 - 0.06, d / 2 - 0.06, h)
    rows = FLAGS_MODULE.flag_rows(flag) if flag else None
    if rows:
        banner(sp, o, w / 2 - 0.06, d / 2 - 0.06, h - 0.15, rows)
    else:
        pennant(sp, o, w / 2 - 0.06, d / 2 - 0.06, h - 0.15, 0.85, 0.5)
    # a knob on top, so the pole ends somewhere instead of stopping
    box(sp, shift(at(w / 2 - 0.1, d / 2 - 0.1, h), *o), 0.2, 0.2, 0.16, "brass", levels=(4, 3, 2))


def treasure_chest(sp, o, w, d, h, tier):
    """Washed up on the beach. At 750 hours it has turned to gold."""
    body = "brass" if tier >= 2 else "wood"
    # The bands stay dark even on the golden chest — without them the whole
    # thing melts into one gold blob and stops reading as a chest.
    band = "dark"
    lid_h = h * 0.42
    box(sp, o, w, d, h - lid_h, body, levels=(4, 3, 1))
    # the lid stands open, leaning back
    lid_o = shift(o, 0, -int(B.PX_PER_M_Y * 0.18))
    box(sp, shift(at(0, 0, h - lid_h), *lid_o), w, d * 0.92, lid_h, body, levels=(4, 3, 2))
    for frac in (0.22, 0.78):  # iron bands across the chest
        box(sp, shift(at(w * frac - 0.05, -0.02, 0), *o), 0.1, d + 0.04, h - lid_h, band, levels=(3, 2, 1))
    box(sp, shift(at(w * 0.42, -0.04, (h - lid_h) * 0.45), *o), 0.16, 0.12, 0.2, band, levels=(4, 3, 2))
    # what is inside is the point: gold, and a glow over the opening
    for index in range(7 if tier >= 2 else 4):
        u = w * (0.18 + 0.11 * index)
        v = d * (0.3 + 0.16 * (index % 3))
        box(sp, shift(at(u, v, h - lid_h - 0.06), *o), 0.12, 0.1, 0.08, "brass", levels=(4, 4, 3))
    if tier >= 2:
        for index in range(4):  # coins spilling out onto the sand
            box(sp, shift(at(-0.18 - index * 0.12, d * 0.2 + index * 0.1, 0), *o), 0.12, 0.1, 0.04, "brass", levels=(4, 3, 2))


def fountain(sp, o, w, d, h, tier):
    """Quiet water in the middle of the village; at 200 hours a grand one."""
    basin_h = h * (0.3 if tier >= 2 else 0.42)
    ground_plate(sp, centred(o, w, d, w * 1.12, d * 1.12), w * 1.12, d * 1.12, "stone", 3, h=0.1)
    cylinder(sp, o, w, d, basin_h, "stone", base=0.08)
    ring(sp, o, w, d, basin_h, "stone", 4, base=0.08)
    inner = centred(o, w, d, w * 0.78, d * 0.78)
    disc(sp, inner, w * 0.78, d * 0.78, 0.0, "water", 3, base=basin_h - 0.04)
    if tier >= 2:
        # a second, smaller basin lifted on a column
        # tall enough that the upper bowl is clearly above the water, not in it
        column_h = h * 0.55
        col_o = centred(o, w, d, w * 0.26, d * 0.26)
        cylinder(sp, col_o, w * 0.22, d * 0.22, column_h, "stone", base=basin_h)
        upper = centred(o, w, d, w * 0.6, d * 0.6)
        cylinder(sp, upper, w * 0.6, d * 0.6, h * 0.12, "stone", base=basin_h + column_h)
        ring(sp, upper, w * 0.6, d * 0.6, h * 0.12, "brass", 4, base=basin_h + column_h)
        # the water has its own centred origin, and stays inside the stone rim —
        # passing a narrower width with the bowl's origin pushed it off centre
        water_o = centred(o, w, d, w * 0.4, d * 0.4)
        disc(sp, water_o, w * 0.4, d * 0.4, 0.0, "water", 3, base=basin_h + column_h + h * 0.1)
        jet(sp, o, w, d, basin_h + column_h + h * 0.12, h * 0.26, w * 0.22)
        # water falling from the upper basin into the lower one
        for side in (-1, 1):
            cu, cv = canvas(sp, *shift(at(w / 2 + side * w * 0.26, d / 2, basin_h + column_h), *o))
            for step in range(int(column_h * B.PX_PER_M_H)):
                sp.put(math.floor(cu), math.floor(cv + step), "water", 3)
    else:
        column_h = h * 0.26
        col_o = centred(o, w, d, w * 0.2, d * 0.2)
        cylinder(sp, col_o, w * 0.2, d * 0.2, column_h, "stone", base=basin_h)
        jet(sp, o, w, d, basin_h + column_h, h * 0.3, w * 0.22)


def clock_tower(sp, o, w, d, h, tier):
    """Time well spent, on display. At 300 hours it gets its bell."""
    shaft_h = h * (0.66 if tier >= 2 else 0.74)
    ground_plate(sp, centred(o, w, d, w * 1.2, d * 1.2), w * 1.2, d * 1.2, "stone", 3, h=0.12)
    box(sp, o, w, d, shaft_h, "stone", levels=(4, 3, 1), base=0.1)
    for frac in (0.3, 0.6):  # courses, so the shaft is not one flat wall
        ring(sp, o, w, d, shaft_h * frac, "stone", 2, base=0.1)
    # the clock face is the whole point: as large as the tower allows
    face_h = shaft_h * 0.72
    cu, cv = canvas(sp, *shift(at(w * 0.5, -0.02, face_h), *o))
    r = w * B.PX_PER_M_X * 0.42
    for y in range(math.floor(cv - r) - 1, math.ceil(cv + r) + 1):
        for x in range(math.floor(cu - r) - 1, math.ceil(cu + r) + 1):
            dx, dy = (x + 0.5 - cu) / r, (y + 0.5 - cv) / r
            distance = dx * dx + dy * dy
            if distance > 1.0:
                continue
            sp.put(x, y, "brass" if distance > 0.72 else "wall", 4 if distance > 0.72 else 4)
    for hand, length, thickness in ((-0.55, 0.62, 1), (0.25, 0.42, 1)):
        for step in range(int(r * length)):
            sp.put(
                math.floor(cu + math.sin(hand * 3.1) * step),
                math.floor(cv - math.cos(hand * 3.1) * step),
                "dark",
                2,
            )
        del thickness
    if tier >= 2:
        # open belfry with a golden bell, then the roof
        belfry_h = h * 0.26
        bel_o = centred(o, w, d, w * 0.86, d * 0.86)
        for corner in ((0.0, 0.0), (w * 0.86 - 0.16, 0.0), (0.0, d * 0.86 - 0.16), (w * 0.86 - 0.16, d * 0.86 - 0.16)):
            post(sp, shift(at(corner[0], corner[1], 0), *bel_o), 0.16, 0.16, belfry_h, "stone")
        hip_roof(sp, o, w, d, shaft_h + belfry_h, h - shaft_h - belfry_h, "roof")
        cu, cv = canvas(sp, *shift(at(w * 0.43, d * 0.43, shaft_h + belfry_h * 0.52), *bel_o))
        bell_r = w * B.PX_PER_M_X * 0.34
        for y in range(math.floor(cv - bell_r), math.ceil(cv + bell_r * 0.3)):
            for x in range(math.floor(cu - bell_r), math.ceil(cu + bell_r)):
                dx = (x + 0.5 - cu) / bell_r
                dy = (y + 0.5 - cv) / bell_r
                if dy > 0.3 or dx * dx + dy * dy > 1.0:
                    continue
                sp.put(x, y, "brass", 4 if dx < -0.3 else (3 if dx < 0.4 else 2))
    else:
        hip_roof(sp, o, w, d, shaft_h, h - shaft_h, "roof")


def lighthouse(sp, o, w, d, h, tier):
    """One hundred hours on the coast. At five hundred it is lit."""
    tower_h = h * 0.76
    ground_plate(sp, centred(o, w, d, w * 1.3, d * 1.3), w * 1.3, d * 1.3, "stone", 3, h=0.12)
    # tapered: three stacked cylinders, each a little narrower
    for index, (frac_w, frac_h) in enumerate(((1.0, 0.0), (0.84, 0.36), (0.7, 0.68))):
        part_o = centred(o, w, d, w * frac_w, d * frac_w)
        cylinder(sp, part_o, w * frac_w, d * frac_w, tower_h * 0.36, "stone", base=0.1 + tower_h * frac_h)
        del index
    for band, base in ((0.14, 0.14), (0.14, 0.48)):  # the red bands that say lighthouse
        band_o = centred(o, w, d, w * (1.0 - base * 0.45), d * (1.0 - base * 0.45))
        cylinder(sp, band_o, w * (1.0 - base * 0.45), d * (1.0 - base * 0.45), tower_h * band, "roof", base=0.1 + tower_h * base)
    # gallery, lantern room, roof
    gal_o = centred(o, w, d, w * 0.9, d * 0.9)
    cylinder(sp, gal_o, w * 0.9, d * 0.9, 0.08, "stone", base=tower_h)
    ring(sp, gal_o, w * 0.9, d * 0.9, 0.08, "dark", 3, base=tower_h)
    lamp_o = centred(o, w, d, w * 0.58, d * 0.58)
    cylinder(sp, lamp_o, w * 0.58, d * 0.58, h * 0.16, "glass", base=tower_h + 0.08)
    if tier >= 2:
        disc(sp, lamp_o, w * 0.58, d * 0.58, 0.0, "brass", 4, base=tower_h + 0.08 + h * 0.08)
        # the beam: a wedge of light out to sea, only at the second tier
        cu, cv = canvas(sp, *shift(at(w * 0.29, d * 0.29, tower_h + h * 0.16), *lamp_o))
        for step in range(int(w * B.PX_PER_M_X * 1.5)):
            spread = 1 + step // 5
            for offset in range(-spread, spread + 1):
                sp.put(math.floor(cu + 3 + step), math.floor(cv + offset - step * 0.18), "brass", 4)
    hip_roof(sp, lamp_o, w * 0.58, d * 0.58, tower_h + 0.08 + h * 0.16, h * 0.08, "roof", overhang=0.3)


def monument(sp, o, w, d, h, tier):
    """One thousand hours. Nothing on the island stands taller.

    Drawn as a real obelisk: two square plinths, a long even taper, and a
    pyramid cap. The taper is the whole silhouette, so it is narrow from the
    start — a wide one reads as a rock.
    """
    base_h = h * 0.1
    lower = centred(o, w, d, w * 0.66, d * 0.66)
    box(sp, lower, w * 0.66, d * 0.66, base_h, "stone", levels=(4, 3, 1))
    upper = centred(o, w, d, w * 0.46, d * 0.46)
    box(sp, shift(at(0, 0, base_h), *upper), w * 0.46, d * 0.46, base_h * 0.7, "stone", levels=(4, 3, 2))

    shaft_bottom = base_h * 1.7
    shaft_h = (h - shaft_bottom) * 0.86
    slices = 18
    for index in range(slices):
        t = index / slices
        width = w * (0.26 - 0.13 * t)
        part = centred(o, w, d, width, width)
        box(sp, shift(at(0, 0, shaft_bottom + shaft_h * t), *part), width, width,
            shaft_h / slices + 0.03, "stone", levels=(4, 3, 1))

    # the cap tapers to a point, in gold — the one landmark that earns it
    cap_h = h - shaft_bottom - shaft_h
    for index in range(6):
        t = index / 6
        width = w * 0.13 * (1.0 - t)
        part = centred(o, w, d, width, width)
        box(sp, shift(at(0, 0, shaft_bottom + shaft_h + cap_h * t), *part), width, width,
            cap_h / 6 + 0.02, "brass", levels=(4, 3, 2))

    # a plaque on the lower plinth, because a monument names what it is for
    box(sp, shift(at(w * 0.2, -0.03, base_h * 0.35), *lower), w * 0.26, 0.05, base_h * 0.4,
        "brass", levels=(4, 3, 2))


# key, label, builder, footprint (w, d) in metres, height, tiers, zone
SPEC = [
    ("flagpole", "Flagpole", flagpole, (0.8, 0.8), 2.6, 1, "grass"),
    ("treasure_chest", "Treasure chest", treasure_chest, (1.0, 0.8), 0.7, 2, "beach"),
    ("fountain", "Fountain", fountain, (2.0, 2.0), 1.4, 2, "grass"),
    ("clock_tower", "Clock tower", clock_tower, (1.6, 1.6), 3.2, 2, "grass"),
    # On grass, not sand: at its full size it needs five by five cells, and the
    # beach is a thin ring that a finished island has already filled. A
    # lighthouse belongs on the headland anyway.
    ("lighthouse", "Lighthouse", lighthouse, (1.6, 1.6), 3.6, 2, "grass"),
    ("monument", "Monument", monument, (1.6, 1.6), 3.0, 1, "grass"),
]

# The second tier is the same landmark, grown: a little wider and clearly taller.
TIER_2_SCALE = {"w": 1.18, "h": 1.24}


def render(builder, w, d, h, tier, **extra):
    sp = Sprite(1.0)
    sp.set_footprint(max(1, round(w)), max(1, round(d)))
    builder(sp, B.origin_for(w, d), w, d, h, tier, **extra)
    sp.outline()
    sp.ground_shadow(0.0, max(w, d) * 5.2)
    return sp


def build(out_dir):
    target = os.path.join(out_dir, "special")
    os.makedirs(target, exist_ok=True)
    for name in os.listdir(target):
        if name.endswith(".png"):
            os.remove(os.path.join(target, name))

    manifest = []
    for key, label, builder, (w, d), h, tiers, zone in SPEC:
        for tier in range(1, tiers + 1):
            scale = TIER_2_SCALE if tier >= 2 else {"w": 1.0, "h": 1.0}
            sprite = render(builder, w * scale["w"], d * scale["w"], h * scale["h"], tier)
            img, anchor = sprite.image()
            name = f"{key}_{tier}.png"
            img.save(os.path.join(target, name))
            manifest.append({
                "key": key, "label": label, "level": tier, "stages": tiers, "file": name,
                "size": [img.width, img.height], "anchorPx": list(anchor),
                "footprint": [max(1, round(w * scale["w"])), max(1, round(d * scale["w"]))],
                "heightM": round(h * scale["h"], 2), "zone": zone,
                "maxCount": 1, "layer": "object", "colors": len(opaque_colors(img)),
            })
            # One more picture of the flagpole per flag. Same object, same place,
            # same footprint — only the cloth differs, so they are variants of
            # `flagpole_1` rather than objects of their own.
            if key == "flagpole":
                for code in FLAGS_MODULE.FLAGS:
                    variant = render(builder, w * scale["w"], d * scale["w"],
                                     h * scale["h"], tier, flag=code)
                    vimg, vanchor = variant.image()
                    vname = f"{key}_{tier}_{code}.png"
                    vimg.save(os.path.join(target, vname))
                    manifest.append({
                        "key": key, "label": FLAGS_MODULE.FLAGS[code][0], "level": tier,
                        "stages": tiers, "file": vname, "variant": code,
                        "size": [vimg.width, vimg.height], "anchorPx": list(vanchor),
                        "footprint": [max(1, round(w * scale["w"])), max(1, round(d * scale["w"]))],
                        "heightM": round(h * scale["h"], 2), "zone": zone,
                        "maxCount": 1, "layer": "object", "colors": len(opaque_colors(vimg)),
                    })
    with open(os.path.join(target, "manifest.json"), "w") as handle:
        json.dump(manifest, handle, indent=2)
    FLAGS_MODULE.write_list(
        os.path.join(os.path.dirname(os.path.dirname(HERE_DIR)), "src", "lib", "islandFlags.ts")
    )
    return manifest


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "island/pixel"
    result = build(out)
    print(f"{len(result)} Bilder")
    for entry in result:
        print(f'  {entry["file"]:<22} {entry["size"][0]:>3} x {entry["size"][1]:<3} px, {entry["colors"]} Farben, {entry["zone"]}')
