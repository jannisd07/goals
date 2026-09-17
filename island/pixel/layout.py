#!/usr/bin/env python3
"""
Fixed places for the water objects, and an example island that uses them.

Buoys, rocks, gulls, kayaks and dolphins are not one clump any more: every piece
of a group has its own slot around the island, and the slots are the same for
every player. A slot is stored as an angle around the island plus how far out it
sits, measured in shares of the shallow ring — not as a pixel position. That way
the same slot still works when the island grows to the next stage.

Where a slot may sit follows the coast: rocks belong to the rocky stretches,
kayaks to the beaches, the dock to a beach with open water in front of it, the
boat next to the dock, dolphins to the open sea, gulls to the air.

Usage, from the repo root:
    python3 island/pixel/layout.py            # writes the slots and the example
Writes island/pixel/water/slots.json and island/pixel/previews/water-layout-5.png.
"""

import json
import math
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import ocean  # noqa: E402
import water  # noqa: E402
from plants import Sprite  # noqa: E402

EXAMPLE_STAGE = 5

# The dock starts on the shore, not in the water: a slightly negative band puts
# its landward end on the sand so the planks meet the beach instead of floating.
DOCK_BAND = -0.35


def canvas_of(stage):
    """The island and the picture it is drawn in, without touching any global."""
    spec = ocean.STAGES[stage]
    zoom = spec["d"]
    width = ocean.DEVICE_W // zoom
    height = round(ocean.DEVICE_H / zoom)
    island = ocean.Island(
        width / 2,
        round(height * 0.53),
        spec["rx"],
        ocean.BEACH_AT_92 * spec["rx"] / 92.0,
        ocean.SHALLOW_AT_92 * spec["rx"] / 92.0,
        spec["seed"],
    )
    return island, width, height, zoom


def island_of(stage):
    island, width, height, zoom = canvas_of(stage)
    ocean.ISLAND_FOR_WATER = island
    return island, width, height, zoom


def sprite_box(draw):
    """(anchor x, anchor y, width, height) of a piece, in artwork pixels."""
    sprite = Sprite(1.0)
    sprite.ax, sprite.ay = 0, 0
    sprite.bx, sprite.by = 0.0, 0.0
    draw(sprite)
    image, anchor = sprite.image()
    return anchor[0], anchor[1], image.width, image.height


def fits_canvas(box, x, y, width, height):
    """True when a picture drawn at (x, y) stays inside the canvas."""
    ax, ay, w, h = box
    return 1 <= x - ax and x - ax + w <= width - 1 and 1 <= y - ay and y - ay + h <= height - 1


def spread(values, count):
    """Pick `count` values spread evenly over a sorted list."""
    if not values:
        return []
    step = len(values) / count
    return [values[min(len(values) - 1, int(k * step + step / 2))] for k in range(count)]


def coast_angles(island, rocky_min=None, rocky_max=None, step=2):
    """Angles in degrees whose coast is rocky (or sandy) enough."""
    found = []
    for degrees in range(0, 360, step):
        rocky, width = island.coast(math.radians(degrees))
        if rocky_min is not None and rocky < rocky_min:
            continue
        if rocky_max is not None and rocky > rocky_max:
            continue
        found.append(degrees)
    return found


def max_band(island, degrees, width, height, margin=14):
    """How far out a slot may sit in this direction before it leaves the picture."""
    angle = math.radians(degrees)
    base = island.radius(angle) + island.side_height(angle)
    limits = []
    if abs(math.cos(angle)) > 1e-3:
        limits.append((width / 2 - margin) / abs(math.cos(angle)))
    if abs(math.sin(angle)) > 1e-3:
        horizon = round(height * 0.205)
        room = min(island.cy - horizon, height - island.cy) - margin
        limits.append(2 * room / abs(math.sin(angle)))
    limit = min(limits) if limits else base + island.shallow * 6
    return max(0.3, (limit - base) / island.shallow)


def beach_width_at(island, degrees):
    """How wide the sand is at this angle, in shares of the base beach width."""
    return island.coast(math.radians(degrees))[1]


def build_slots(island, width, height):
    """The slot table. Angles come from the coast, so they suit the island's shape.

    Bands are capped per direction: to the left and right the picture ends quickly,
    towards the front and the back there is much more water. Because island, canvas
    and shallows all scale together, a band that fits on one stage fits on all.
    """

    def fit(angle, band, reserve=0.0):
        return round(min(band, max(0.3, max_band(island, angle, width, height) - reserve)), 2)

    def clear_of_land(angle, band, members, reserve=0.0):
        """Push a group outwards until none of its members sits on the island."""
        ceiling = max(0.3, max_band(island, angle, width, height) - reserve)
        while band < ceiling:
            cx, cy = position(island, angle, band)
            on_land = False
            for member in members:
                distance, member_angle = island.polar(cx + member['du'], cy + member['dv'])
                land_end = island.radius(member_angle) + island.side_height(member_angle)
                if distance < land_end + island.shallow * 0.35:
                    on_land = True
                    break
            if not on_land:
                break
            band += 0.15
        return round(min(band, ceiling), 2)

    rocky = coast_angles(island, rocky_min=0.45)
    sandy = coast_angles(island, rocky_max=0.12)

    # The dock runs away from the shore towards the upper right, so it needs a coast
    # facing that way (around 315°). Mirrored, it runs to the upper left (225°).
    def dock_choice():
        """The sprite runs up-right, mirrored up-left. Only those two directions
        look right, so the slot has to sit on a coast facing that way; within that
        window the widest, least rocky stretch wins.

        It also has to fit on the *smallest* island, and that is the harder test.
        Every stage uses this one slot, but a jetty is the same 58 px long in all
        of them while the picture shrinks from 440 px wide to 165 — of which the
        island itself takes 138. Out on the flanks there is barely a dozen pixels
        of water, so a jetty reaching sideways runs straight off the edge; only
        the coast nearer the back of the island has the length for it. The dock
        keeps one place for all five stages on purpose: it is the first landmark
        a player unlocks, and a jetty that walks around the coast every time the
        island grows reads as a different jetty.
        """
        small, small_w, small_h, _ = canvas_of(min(ocean.STAGES))
        best = None
        for mirror, target in ((False, 315), (True, 225)):
            box = sprite_box(lambda sp, mirror=mirror: water.draw_dock(sp, 10, mirror=mirror))
            for offset in range(-44, 45, 2):
                angle = (target + offset) % 360
                x, y = position(small, angle, DOCK_BAND)
                if not fits_canvas(box, x, y, small_w, small_h):
                    continue
                rocky, width = island.coast(math.radians(angle))
                score = width - 1.5 * rocky - abs(offset) / 80
                if best is None or score > best[0]:
                    best = (score, angle, mirror)
        return (best[1], best[2]) if best else (225.0, True)

    dock_angle, dock_mirror = dock_choice()

    # Up to five boats, the flagship at the dock, the rest spread around — also behind
    # the island. Each boat also has its own size, so the fleet does not look cloned.
    boat_angles = [(dock_angle + (18 if not dock_mirror else -18)) % 360, 84, 152, 248, 296]
    boats = [
        {"angle": angle, "band": fit(angle, band, 0.8), "level": level}
        for angle, band, level in zip(boat_angles, (1.1, 5.5, 2.6, 4.0, 6.5), (10, 4, 7, 2, 5))
    ]

    # Rocks come in at most three groups of three, on the rocky stretches.
    cluster_angles = spread(rocky, 3)
    rock_offsets = [(0, 0, 2), (6, 2, 0), (-5, 3, 1)]
    rock_members = [{"du": du, "dv": dv, "size": size} for du, dv, size in rock_offsets]
    rock_clusters = [
        {
            "angle": angle,
            "band": clear_of_land(angle, fit(angle, 0.5 + 0.35 * index, 0.9), rock_members),
            "members": rock_members,
        }
        for index, angle in enumerate(cluster_angles)
    ]

    # Dolphins swim in schools: a school fills up to nine, then the next one starts.
    school_formation = [
        (0, 0), (-9, -4), (9, 3), (-16, 4), (16, -3),
        (-6, 8), (7, 9), (-21, -2), (22, 6),
    ]
    school_members = [{"du": du, "dv": dv} for du, dv in school_formation]
    dolphin_schools = [
        {
            "angle": angle,
            "band": clear_of_land(angle, fit(angle, band, 1.1), school_members, 1.1),
            "members": school_members,
        }
        # one school in front, two in the water behind the island — to the sides
        # the canvas ends right after the shallows, so no school goes there
        for angle, band in ((88, 4.6), (248, 3.4), (296, 5.8))
    ]

    slots = {
        "dock": [{"angle": dock_angle, "band": DOCK_BAND, "mirror": dock_mirror}],
        "boats": boats,
        "buoys": [
            {"angle": angle, "band": fit(angle, band, 0.3)}
            for angle, band in zip(
                spread(list(range(4, 360, 6)), 10),
                (1.0, 2.4, 1.5, 3.2, 1.2, 2.8, 1.8, 3.6, 1.3, 2.1),
            )
        ],
        "kayaks": [
            {"angle": angle, "band": fit(angle, 0.45 + 0.35 * (index % 3), 0.3)}
            for index, angle in enumerate(spread(sandy, 8))
        ],
        "rockClusters": rock_clusters,
        "dolphinSchools": dolphin_schools,
        "gulls": [
            {
                "angle": angle,
                "band": fit(angle, 0.5 + 1.6 * (index % 4), 0.2),
                "height": 16 + (index % 5) * 7,
                "big": index % 3 == 0,
            }
            for index, angle in enumerate(spread(list(range(0, 360, 5)), 10))
        ]
        # two of them circle over the island itself: a negative band is inland
        + [
            {"angle": 205, "band": -3.0, "height": 34, "big": True},
            {"angle": 35, "band": -5.5, "height": 26, "big": False},
        ],
    }
    return slots


PIECE_RADIUS = {"dock": 13, "boats": 20, "rockClusters": 8, "dolphinSchools": 8, "kayaks": 9, "buoys": 5}
# Dolphins next to a boat looked odd, so schools keep well away from the fleet.
EXTRA_GAP = {frozenset(("boats", "dolphinSchools")): 30}
DEFAULT_GAP = 5


def piece_points(island, kind, slot):
    """The circles a piece covers, in screen pixels: (x, y, radius)."""
    x, y = position(island, slot["angle"], slot["band"])
    radius = PIECE_RADIUS[kind]
    if kind == "dock":
        step = -1 if slot.get("mirror") else 1
        return [(x + step * d * 0.9, y - d * 0.45, radius) for d in (0, 20, 40, 58)]
    if kind in ("rockClusters", "dolphinSchools"):
        return [(x + m["du"], y + m["dv"], radius) for m in slot["members"]]
    return [(x, y, radius)]


CANDIDATE_MOVES = sorted(
    (
        (turn, push)
        for turn in (0, 5, -5, 10, -10, 16, -16, 24, -24, 34, -34, 45, -45)
        for push in (0, 0.2, -0.2, 0.4, -0.4, 0.7, -0.7, 1.1, -1.1, 1.6, 2.2, 3.0)
    ),
    key=lambda move: abs(move[0]) / 12 + abs(move[1]),
)


def resolve_overlaps(island, width, height, slots):
    """Nudge every piece outwards or sideways until nothing overlaps.

    The dock keeps its place, the rest may move: first a little further out, then a
    few degrees along the coast. Distances are measured in the un-squashed circle,
    so the clearances look right in the 2:1 view.
    """
    order = ["dock", "boats", "rockClusters", "dolphinSchools", "kayaks", "buoys"]
    placed = []
    moved = 0

    def free(kind, points):
        for other_kind, other_points in placed:
            gap = EXTRA_GAP.get(frozenset((kind, other_kind)), DEFAULT_GAP)
            for x1, y1, r1 in points:
                for x2, y2, r2 in other_points:
                    if math.hypot(x1 - x2, (y1 - y2) * 2) < r1 + r2 + gap:
                        return False
        for x, y, radius in points:  # and keep clear of the island itself
            distance, angle = island.polar(x, y)
            land_end = island.radius(angle) + island.side_height(angle)
            if distance < land_end + radius * 0.7:
                return False
        return True

    for kind in order:
        reserve = 1.0 if kind in ("boats", "dolphinSchools") else 0.3
        for slot in slots[kind]:
            points = piece_points(island, kind, slot)
            if kind == "dock" or free(kind, points):
                placed.append((kind, points))
                continue
            start_angle, start_band = slot["angle"], slot["band"]
            for turn, push in CANDIDATE_MOVES:
                angle = (start_angle + turn) % 360
                ceiling = max(0.4, max_band(island, angle, width, height) - reserve)
                slot["angle"] = angle
                slot["band"] = round(min(ceiling, max(0.4, start_band + push)), 2)
                points = piece_points(island, kind, slot)
                if free(kind, points):
                    moved += 1
                    break
            else:  # nothing free: keep the wish position rather than inventing one
                slot["angle"], slot["band"] = start_angle, start_band
                points = piece_points(island, kind, slot)
            placed.append((kind, points))
    return moved


def position(island, angle_degrees, band):
    """Screen position of a slot: angle around the island, band in shares of the shallows."""
    angle = math.radians(angle_degrees)
    radius = island.radius(angle) + island.side_height(angle) + island.shallow * band
    x = island.cx + math.cos(angle) * radius
    y = island.cy + math.sin(angle) * radius / 2
    return x, y


def piece_sprite(x, y, draw):
    """A sprite whose anchor sits at (x, y) on the water."""
    sprite = Sprite(1.0)
    sprite.ax, sprite.ay = round(x), round(y)
    sprite.bx, sprite.by = float(sprite.ax), float(sprite.ay)
    draw(sprite)
    return sprite


def example_pieces(island, slots, counts=None):
    """Every object at its slot: (sort key, image, position)."""
    counts = counts or {}
    pieces = []

    def add(x, y, draw, in_air=False):
        sprite = piece_sprite(x, y, draw)
        image, anchor = sprite.image()
        pieces.append((10 ** 6 if in_air else y, image, (round(x) - anchor[0], round(y) - anchor[1])))

    for slot in slots["dock"]:
        x, y = position(island, slot["angle"], slot["band"])
        add(x, y, lambda sp, slot=slot: water.draw_dock(sp, 10, mirror=slot.get("mirror", False)))
    for slot in slots["boats"][: counts.get("boats", len(slots["boats"]))]:
        x, y = position(island, slot["angle"], slot["band"])
        add(x, y, lambda sp, slot=slot: water.draw_boat(sp, slot["level"]))
    for index, slot in enumerate(slots["buoys"][: counts.get("buoys", len(slots["buoys"]))]):
        x, y = position(island, slot["angle"], slot["band"])
        add(x, y, lambda sp: water.item_buoy(sp, 0, 0))
    for index, slot in enumerate(slots["kayaks"][: counts.get("kayaks", len(slots["kayaks"]))]):
        x, y = position(island, slot["angle"], slot["band"])
        add(x, y, lambda sp, index=index: water.item_kayak(sp, 0, 0, index))
    for cluster in slots["rockClusters"][: counts.get("rockClusters", len(slots["rockClusters"]))]:
        cx, cy = position(island, cluster["angle"], cluster["band"])
        for member in cluster["members"]:
            add(
                cx + member["du"],
                cy + member["dv"],
                lambda sp, member=member: water.item_rock(sp, 0, 0, member["size"]),
            )
    for school in slots["dolphinSchools"][: counts.get("dolphinSchools", len(slots["dolphinSchools"]))]:
        cx, cy = position(island, school["angle"], school["band"])
        for member in school["members"]:
            add(cx + member["du"], cy + member["dv"], lambda sp: water.item_dolphin(sp, 0, 0))
    for slot in slots["gulls"][: counts.get("gulls", len(slots["gulls"]))]:
        x, y = position(island, slot["angle"], slot["band"])
        add(x, y, lambda sp, slot=slot: water.item_gull(sp, 0, 0, slot["height"], slot["big"]), True)
    return pieces


def draw_example(stage, slots):
    """Stage background plus every water object at its slot, back to front."""
    island, width, height, zoom = island_of(stage)
    scene = Image.open(os.path.join(HERE, "backgrounds", f"home-{stage}.png")).convert("RGBA")
    for _, image, spot in sorted(example_pieces(island, slots), key=lambda piece: piece[0]):
        layer = Image.new("RGBA", scene.size, (0, 0, 0, 0))
        layer.paste(image, spot)
        scene = Image.alpha_composite(scene, layer)
    out = os.path.join(HERE, "previews", f"water-layout-{stage}.png")
    scene.resize((width * zoom, height * zoom), Image.NEAREST).save(out)
    return out


def verify(stage, slots):
    """Every slot must land in the zone it is meant for."""
    with open(os.path.join(HERE, "zones.json"), encoding="utf-8") as handle:
        data = json.load(handle)
    entry = next(item for item in data["stages"] if item["stage"] == stage)
    i_min, j_min = entry["bounds"]["iMin"], entry["bounds"]["jMin"]
    cells = {}
    for row_index, row in enumerate(entry["rows"]):
        for column, char in enumerate(row):
            cells[(i_min + row_index, j_min + column)] = char

    island, *_ = island_of(stage)
    origin_x, origin_y = entry["originPx"]["x"], entry["originPx"]["y"]

    def zone_at(x, y):
        across = (x - origin_x) / 4      # i - j
        depth = (origin_y - 2 - y) / 2   # i + j
        return cells.get((round((depth + across) / 2), round((depth - across) / 2)), ".")

    problems = []

    def check(name, x, y, allowed):
        zone = zone_at(x, y)
        if zone not in allowed:
            problems.append(f"{name}: {zone} statt {allowed}")

    for index, slot in enumerate(slots["dock"]):
        x, y = position(island, slot["angle"], slot["band"])
        check(f"dock #{index + 1}", x, y, "GB")
    for index, slot in enumerate(slots["boats"]):
        x, y = position(island, slot["angle"], slot["band"])
        check(f"boat #{index + 1}", x, y, "SD")
    for index, slot in enumerate(slots["buoys"]):
        x, y = position(island, slot["angle"], slot["band"])
        check(f"buoy #{index + 1}", x, y, "SD")
    for index, slot in enumerate(slots["kayaks"]):
        x, y = position(island, slot["angle"], slot["band"])
        check(f"kayak #{index + 1}", x, y, "SD")
    for index, cluster in enumerate(slots["rockClusters"]):
        cx, cy = position(island, cluster["angle"], cluster["band"])
        for member_index, member in enumerate(cluster["members"]):
            check(f"rock {index + 1}.{member_index + 1}", cx + member["du"], cy + member["dv"], "SD")
    for index, school in enumerate(slots["dolphinSchools"]):
        cx, cy = position(island, school["angle"], school["band"])
        for member_index, member in enumerate(school["members"]):
            check(
                f"dolphin {index + 1}.{member_index + 1}",
                cx + member["du"],
                cy + member["dv"],
                "SD.",  # the open sea beyond the map is fine for a school
            )
    return problems


def main():
    island, width, height, _ = island_of(EXAMPLE_STAGE)
    slots = build_slots(island, width, height)
    moved = resolve_overlaps(island, width, height, slots)
    out = {
        "version": 1,
        "generated": "2026-09-14",
        "generator": "island/pixel/layout.py",
        "about": (
            "Fixed places for the water objects, the same for every player. A slot is an "
            "angle around the island plus a band: 0 is the water line, 1 the outer edge of "
            "the shallow ring, above 2 open sea. Because the slots are angles, they keep "
            "working when the island grows."
        ),
        "howToUse": (
            "position = island.radius(angle) + island.sideHeight(angle) + shallowWidth * band; "
            "x = centreX + cos(angle) * position, y = centreY + sin(angle) * position / 2. "
            "Owning n pieces of a group means using the first n slots."
        ),
        "slots": slots,
    }
    path = os.path.join(HERE, "water", "slots.json")
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(out, handle, indent=2, ensure_ascii=False)
        handle.write("\n")
    print(f"{path} written, {moved} Stücke zur Seite geschoben")
    for key, entries in slots.items():
        print(f"  {key:<9} {len(entries):2d} Plätze  Winkel {[s['angle'] for s in entries]}")

    problems = verify(EXAMPLE_STAGE, slots)
    if problems:
        print("  PROBLEME:")
        for line in problems:
            print("   ", line)
    else:
        print("  alle Plätze liegen in ihrer Zone")
    print("Beispiel:", draw_example(EXAMPLE_STAGE, slots))


if __name__ == "__main__":
    main()
