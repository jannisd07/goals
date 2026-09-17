#!/usr/bin/env python3
"""
Turn the fixed water slots into the two files the app reads.

layout.py decides *where* every piece of water belongs, as an angle around the
island plus a band, so the same slot works at every island size. The app cannot
redo that maths — it has no island geometry — so this script resolves the slots
into plain pixel positions, once per island stage, and draws every sprite those
positions need.

Written:
  src/lib/islandSlots.ts                     positions per stage
  src/components/grow/waterPieceSprites.ts   the single pieces as pixel rows

A group grows by taking the first n places, so the order of the lists matters:
rocks run cluster by cluster, dolphins school by school.

Usage, from the repo root:
    python3 island/pixel/export_layout.py
"""

import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
import layout  # noqa: E402
import ocean  # noqa: E402
import water  # noqa: E402
import beach  # noqa: E402  registers the stone material used by the path slabs
from plants import Sprite  # noqa: E402

SHADOW_CHAR = "z"
SHADOW_RGBA = (0, 0, 0, 64)
ALPHABET = "".join(
    c for c in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    if c != SHADOW_CHAR
)

SLOTS_TS = os.path.join(ROOT, "src", "lib", "islandSlots.ts")
SPRITES_TS = os.path.join(ROOT, "src", "components", "grow", "waterPieceSprites.ts")
ZONES_TS = os.path.join(ROOT, "src", "lib", "islandZones.ts")
LAND_TS = os.path.join(ROOT, "src", "lib", "islandLand.ts")

# Which ground each kind of object stands on.
# `None` means the manifest itself says which ground each object stands on —
# the milestone landmarks are split between meadow and beach.
LAND_SETS = [
    ("plants", "grass"),
    ("buildings", "grass"),
    ("beach", "beach"),
    ("special", None),
]
# A block of n x n half-metre cells is 8 * n pixels wide on screen, so dividing
# the widest picture by eight reserves exactly as much ground as the object
# covers. Anything less and two houses overlap.
PX_PER_BLOCK = 8.0
# Stepping one cell towards the back moves the picture 4 px up at the same x, so
# the depth of a foot is measured in fours where its width is measured in eights.
PX_PER_CELL_DEPTH = 4.0


class SpriteBook:
    """Every piece drawn once, keyed by what it is; identical pieces share one entry."""

    def __init__(self):
        self.sprites = {}
        self.colors = {}

    def add(self, name, draw):
        if name in self.sprites:
            return name
        sprite = Sprite(1.0)
        sprite.ax, sprite.ay = 0, 0
        sprite.bx, sprite.by = 0.0, 0.0
        draw(sprite)
        image, anchor = sprite.image()
        rows = []
        for y in range(image.height):
            row = []
            for x in range(image.width):
                pixel = image.getpixel((x, y))
                if pixel[3] == 0:
                    row.append(".")
                elif pixel == SHADOW_RGBA:
                    row.append(SHADOW_CHAR)
                else:
                    hex_color = "#%02X%02X%02X" % pixel[:3]
                    if hex_color not in self.colors:
                        self.colors[hex_color] = ALPHABET[len(self.colors)]
                    row.append(self.colors[hex_color])
            rows.append("".join(row))
        self.sprites[name] = {
            "w": image.width,
            "h": image.height,
            # where the slot position sits inside the picture
            "ax": anchor[0],
            "ay": anchor[1],
            "rows": rows,
        }
        return name


def snap(value):
    """Whole artwork pixels, rounded half up — the rule Math.round uses in the app.

    Python's own round() rounds halves to the even number, so a place landing on
    exactly x.5 would end up one pixel away from where the app draws it.
    """
    return math.floor(value + 0.5)


def gull_name(slot):
    return f"gull_{int(slot['height'])}{'b' if slot['big'] else 's'}"


# Four slabs so a path does not look stamped, and one of them on every second
# cell: that leaves a hair of grass between the stones instead of a grey ribbon.
# Flat and wide, with the soft corners a laid stone plate has.
PATH_SLABS = (
    (3.6, 1.2, 0.0, 0.0),
    (3.3, 1.1, 0.3, 0.0),
    (3.5, 1.2, -0.2, 0.0),
    (3.1, 1.1, 0.1, 0.1),
)


def draw_path_sprites(book):
    """Flat stone slabs with softly rounded corners, one per cell of a path."""
    for index, (ru, rv, du, dv) in enumerate(PATH_SLABS):
        def draw(sprite, ru=ru, rv=rv, du=du, dv=dv):
            sprite.blob(du, dv, ru, rv, "rock", bias=0.45)
            sprite.outline()
        book.add(f"path_{index}", draw)
    return len(PATH_SLABS)


def draw_piece_sprites(slots, book):
    """Every picture the slots need, drawn once and shared by all stages."""
    mirror = bool(slots["dock"][0].get("mirror"))
    for level in range(1, 11):
        book.add(
            f"dock{'_m' if mirror else ''}_{level}",
            lambda sp, level=level: water.draw_dock(sp, level, mirror=mirror),
        )
        book.add(f"boat_{level}", lambda sp, level=level: water.draw_boat(sp, level))
    book.add("buoy", lambda sp: water.item_buoy(sp, 0, 0))
    book.add("dolphin", lambda sp: water.item_dolphin(sp, 0, 0))
    for index in range(len(slots["kayaks"])):
        book.add(f"kayak_{index}", lambda sp, index=index: water.item_kayak(sp, 0, 0, index))
    for size in sorted({m["size"] for c in slots["rockClusters"] for m in c["members"]}):
        book.add(f"rock_{size}", lambda sp, size=size: water.item_rock(sp, 0, 0, size))
    for slot in slots["gulls"]:
        book.add(
            gull_name(slot),
            lambda sp, slot=slot: water.item_gull(sp, 0, 0, slot["height"], slot["big"]),
        )


# Moves the fitter may make when a group does not fit where its slot says: a few
# degrees along the coast, a little further in or out. Sorted by how far they take
# a piece from its slot, so the answer is always the nearest one that works.
TURNS = (0, 4, -4, 8, -8, 13, -13, 19, -19, 26, -26, 34, -34, 45, -45, 58, -58, 72, -72)
PUSHES = (0.0, -0.3, 0.3, -0.7, 0.7, -1.2, 1.2, 1.8, -1.6, 2.6)
MOVES = sorted(
    ((turn, push) for turn in TURNS for push in PUSHES),
    key=lambda move: abs(move[0]) / 12 + abs(move[1]),
)
# A piece that stays inside this much of its slot is still standing where the
# slot table put it. Beyond it the piece has been found a different place, which
# is the sign that this island's water is full — see `limits` below.
NEAR_TURN, NEAR_PUSH = 26, 1.2


def group_box(book, members, x, y):
    """The rectangle a whole group covers, in artwork pixels."""
    lefts, tops, rights, bottoms = [], [], [], []
    for name, du, dv in members:
        sprite = book.sprites[name]
        lefts.append(x + du - sprite["ax"])
        tops.append(y + dv - sprite["ay"])
        rights.append(x + du - sprite["ax"] + sprite["w"])
        bottoms.append(y + dv - sprite["ay"] + sprite["h"])
    return min(lefts), min(tops), max(rights), max(bottoms)


# A piece that ends exactly on the last column reads as one that carries on off
# the screen, so the picture keeps a hair of water all the way round.
EDGE = 3


def slide_inside(entry, box):
    """The smallest shift that puts the box in the picture; None if it cannot fit."""
    left, top, right, bottom = box
    if right - left > entry["artW"] - 2 * EDGE or bottom - top > entry["artH"] - 2 * EDGE:
        return None
    return (
        max(0.0, EDGE - left) - max(0.0, right - (entry["artW"] - EDGE)),
        max(0.0, EDGE - top) - max(0.0, bottom - (entry["artH"] - EDGE)),
    )


def afloat(island, members, x, y, radius):
    """True while every piece of the group is still in open water."""
    for _, du, dv in members:
        distance, angle = island.polar(x + du, y + dv)
        if distance < island.radius(angle) + island.side_height(angle) + radius * 0.5:
            return False
    return True


# Room to breathe between two pieces, on top of what they cover themselves. The
# slot table was built with this gap on the largest island; the pieces keep their
# size on the small ones while the water around them shrinks, which is exactly
# why a small island holds fewer of them.
GAP = 5


def clear_of(placed, members, x, y, radius):
    """True while the group does not sit on top of something already placed.

    Distances are measured in the un-squashed circle, so a gap looks the same to
    the eye whether it runs along the coast or towards the viewer.
    """
    for other_x, other_y, other_radius in placed:
        for _, du, dv in members:
            if math.hypot(x + du - other_x, (y + dv - other_y) * 2) < radius + other_radius + GAP:
                return False
    return True


def find_place(book, island, entry, angle, band, members, radius, placed,
               anchored=False, floating=True):
    """Where this group goes in this picture.

    The slots are measured once, on the largest island, and every stage uses the
    same ones: an angle around the island and a distance in shares of the shallow
    ring. Island, shallows and canvas all scale together, so that travels well —
    but the sprites do not. A boat is the same thirty pixels wide on every stage,
    while the picture shrinks from 440 px to 165, of which the island itself takes
    138. On island 1 that leaves barely a dozen pixels of water to the left and to
    the right, and every piece that belongs on the flanks hangs over the edge.

    So a group is first slid back into the picture — as far as it takes, not by a
    fixed allowance. If that would beach it or bury it under another piece, it
    walks along the coast until it finds water with room, and only then gives up.
    Nothing may be drawn half outside the picture: the edge of the canvas is the
    edge of the world, and a boat cut in half by it is not a boat.

    The dock is the exception that may not move far: it stands on the shore, so it
    may change beach but may never be pushed off one.
    """
    for keep_clear in (True, False):
        for turn, push in MOVES:
            if anchored and push:
                continue
            x, y = layout.position(island, (angle + turn) % 360, band + push)
            shift = slide_inside(entry, group_box(book, members, x, y))
            if shift is None:
                continue
            if anchored and (shift[0] or shift[1]):
                continue
            x, y = x + shift[0], y + shift[1]
            if floating and not afloat(island, members, x, y, radius):
                continue
            if keep_clear and not clear_of(placed, members, x, y, radius):
                continue
            near = keep_clear and abs(turn) <= NEAR_TURN and abs(push) <= NEAR_PUSH
            return x, y, False, near
    # Nowhere at all: keep the slot and slide as far as the picture allows, so a
    # missing place costs a worse spot and never a missing object.
    x, y = layout.position(island, angle, band)
    shift = slide_inside(entry, group_box(book, members, x, y)) or (0.0, 0.0)
    return x + shift[0], y + shift[1], True, False


def stage_entry(stage, slots, book):
    island, width, height, zoom = layout.island_of(stage)
    entry = {"stage": stage, "artW": width, "artH": height, "zoom": zoom}
    clipped = []
    placed = []
    marks = {}

    def settle(group):
        """Sort a fleet best-place-first and say how many of them this water holds.

        Measured, not guessed: for every piece `place` notes whether it ended up
        in its own slot with room to breathe, or had to be found somewhere else
        entirely. The ones that kept their slot come first — a player who owns
        three buoys should get the three best places, not the first three — and
        their number is the limit. Always at least one: what you own has to be
        somewhere.
        """
        room = marks.get(group, [])
        order = sorted(range(len(entry[group])), key=lambda i: not room[i])
        entry[group] = [entry[group][i] for i in order]
        return max(1, sum(1 for near in room if near))

    def place(name, angle, band, members, radius, anchored=False, floating=True,
              avoid=True, run=None, group=None):
        """members: (sprite, du, dv); returns the fitted positions in artwork pixels.

        `run` is what the piece covers for the pieces placed after it. It defaults
        to the members themselves, which is right for anything roughly as wide as
        it is long — but a jetty is one picture sixty pixels long with its anchor
        at the landward end, and a single circle there would let a boat moor on
        top of the planks.
        """
        x, y, over, near = find_place(
            book, island, entry, angle, band, members, radius,
            placed if avoid else [], anchored=anchored, floating=floating,
        )
        if over:
            clipped.append(name)
        if group:
            marks.setdefault(group, []).extend([near] * len(members))
        if avoid:
            spread = run if run is not None else [(du, dv) for _, du, dv in members]
            placed.extend((x + du, y + dv, radius) for du, dv in spread)
        return [
            {"sprite": sprite, "x": snap(x + du), "y": snap(y + dv)}
            for sprite, du, dv in members
        ]

    # Placed in the order they matter, so the pieces that carry the picture get
    # the good water and the small ones fill in around them.
    dock_slot = slots["dock"][0]
    mirror = bool(dock_slot.get("mirror"))
    dock_name = f"dock{'_m' if mirror else ''}_10"
    step = -1 if mirror else 1
    dock = place(
        "dock", dock_slot["angle"], dock_slot["band"], [(dock_name, 0, 0)], 13,
        anchored=True, floating=False,
        run=[(step * d * 0.9, -d * 0.45) for d in (0, 16, 32, 48, 58)],
    )[0]
    entry["dock"] = {"x": dock["x"], "y": dock["y"], "mirror": mirror}

    entry["boats"] = []
    for index, slot in enumerate(slots["boats"]):
        # the flagship grows, so it has to fit at its largest
        name = f"boat_{10 if index == 0 else slot['level']}"
        spot = place(f"boat {index + 1}", slot["angle"], slot["band"], [(name, 0, 0)], 20,
                     group="boats")[0]
        entry["boats"].append({"x": spot["x"], "y": spot["y"], "hull": slot["level"]})

    entry["rocks"] = [
        piece
        for index, cluster in enumerate(slots["rockClusters"])
        for piece in place(
            f"rock cluster {index + 1}",
            cluster["angle"],
            cluster["band"],
            [(f"rock_{m['size']}", m["du"], m["dv"]) for m in cluster["members"]],
            8,
            group="rocks",
        )
    ]
    entry["dolphins"] = [
        piece
        for index, school in enumerate(slots["dolphinSchools"])
        for piece in place(
            f"dolphin school {index + 1}",
            school["angle"],
            school["band"],
            [("dolphin", m["du"], m["dv"]) for m in school["members"]],
            8,
            group="dolphins",
        )
    ]
    entry["kayaks"] = [
        place(f"kayak {i + 1}", slot["angle"], slot["band"], [(f"kayak_{i}", 0, 0)], 9,
              group="kayaks")[0]
        for i, slot in enumerate(slots["kayaks"])
    ]
    entry["buoys"] = [
        place(f"buoy {i + 1}", slot["angle"], slot["band"], [("buoy", 0, 0)], 5,
              group="buoys")[0]
        for i, slot in enumerate(slots["buoys"])
    ]
    # Gulls fly: they are allowed over the island and over everything else.
    entry["gulls"] = [
        place(
            f"gull {i + 1}", slot["angle"], slot["band"], [(gull_name(slot), 0, 0)], 4,
            floating=False, avoid=False,
        )[0]
        for i, slot in enumerate(slots["gulls"])
    ]
    # How much of each fleet this island's water actually holds. The boat is the
    # one you grow, so its slot is never taken away.
    entry["limits"] = {
        "boats": settle("boats"),
        "buoys": settle("buoys"),
        "kayaks": settle("kayaks"),
        "rocks": settle("rocks"),
        "dolphins": settle("dolphins"),
        "gulls": len(entry["gulls"]),
    }
    return entry, clipped


def zone_report(stage, entry):
    """Check what is actually drawn, not what the slot table wished for.

    The slots are angles measured on the largest island; on the small stages the
    fitter moves pieces to keep them in the picture, so checking the slot would
    check a place nothing is drawn at. Boats belong in water, the dock on the
    shore, gulls anywhere — they fly.
    """
    with open(os.path.join(HERE, "zones.json"), encoding="utf-8") as handle:
        data = json.load(handle)
    stage_zones = next(item for item in data["stages"] if item["stage"] == stage)
    i_min, j_min = stage_zones["bounds"]["iMin"], stage_zones["bounds"]["jMin"]
    cells = {
        (i_min + row_index, j_min + column): char
        for row_index, row in enumerate(stage_zones["rows"])
        for column, char in enumerate(row)
    }
    origin_x, origin_y = stage_zones["originPx"]["x"], stage_zones["originPx"]["y"]

    def zone_at(x, y):
        across = (x - origin_x) / 4      # i - j
        depth = (origin_y - 2 - y) / 2   # i + j
        return cells.get((round((depth + across) / 2), round((depth - across) / 2)), ".")

    problems = []
    checks = [("dock", [entry["dock"]], "GB")]
    checks += [(group, entry[group], "SD") for group in ("boats", "buoys", "kayaks", "rocks", "dolphins")]
    for name, pieces, allowed in checks:
        for index, piece in enumerate(pieces):
            zone = zone_at(piece["x"], piece["y"])
            # "." is the water outside the mapped ring: open sea, and fine for
            # anything that floats.
            if zone in allowed or (zone == "." and allowed == "SD"):
                continue
            problems.append(f"{name} {index + 1}: {zone} statt {allowed}")
    return problems


def preview(stage, entry, book):
    """Render exactly what the app will draw, from the exported numbers."""
    from PIL import Image

    scene = Image.open(
        os.path.join(HERE, "backgrounds", f"home-{stage}.png")
    ).convert("RGBA")
    # Exactly the fleet the app would draw on a fully grown island of this size,
    # so the preview is not a picture of a state the game cannot reach.
    limits = entry["limits"]
    pieces = [(entry["dock"]["x"], entry["dock"]["y"], f"dock{'_m' if entry['dock']['mirror'] else ''}_10")]
    pieces += [
        (b["x"], b["y"], f"boat_{10 if i == 0 else b['hull']}")
        for i, b in enumerate(entry["boats"][: limits["boats"]])
    ]
    for group in ("buoys", "kayaks", "rocks", "dolphins"):
        pieces += [(p["x"], p["y"], p["sprite"]) for p in entry[group][: limits[group]]]
    pieces.sort(key=lambda piece: piece[1])
    pieces += [(p["x"], p["y"], p["sprite"]) for p in entry["gulls"][: limits["gulls"]]]

    palette = {char: color for color, char in book.colors.items()}
    for x, y, name in pieces:
        sprite = book.sprites[name]
        layer = Image.new("RGBA", scene.size, (0, 0, 0, 0))
        for row_index, row in enumerate(sprite["rows"]):
            for column, char in enumerate(row):
                if char == ".":
                    continue
                color = (0, 0, 0, 64) if char == SHADOW_CHAR else (
                    *bytes.fromhex(palette[char][1:]), 255
                )
                px = round(x) - sprite["ax"] + column
                py = round(y) - sprite["ay"] + row_index
                if 0 <= px < scene.width and 0 <= py < scene.height:
                    layer.putpixel((px, py), color)
        scene = Image.alpha_composite(scene, layer)
    out = os.path.join(HERE, "previews", f"island-water-{stage}.png")
    zoom = entry["zoom"]
    scene.resize((scene.width * zoom, scene.height * zoom), Image.NEAREST).save(out)
    return out


def write_sprites(book):
    lines = [
        "/**",
        " * The single water pieces, generated by island/pixel/export_layout.py.",
        " * Do not edit by hand: the next run of the generator overwrites this file.",
        " *",
        " * One character per pixel, `.` is transparent and `z` the water shadow. The",
        " * island draws these as SVG paths, so they stay sharp at every island size.",
        " * `ax`/`ay` is the pixel the slot position sits on.",
        " */",
        "",
        "export const PIECE_COLORS: Record<string, string> = {",
    ]
    for hex_color, char in sorted(book.colors.items(), key=lambda item: item[1]):
        lines.append(f'  {char}: "{hex_color}",')
    lines += [
        "};",
        "",
        "/** Character drawn as the shadow on the water. */",
        'export const PIECE_SHADOW = "z";',
        "",
        "export interface PieceSpriteData {",
        "  w: number;",
        "  h: number;",
        "  ax: number;",
        "  ay: number;",
        "  rows: string[];",
        "}",
        "",
        "export const PIECE_SPRITES: Record<string, PieceSpriteData> = {",
    ]
    for name in sorted(book.sprites):
        sprite = book.sprites[name]
        lines.append(f"  {name}: {{")
        lines.append(f'    w: {sprite["w"]},')
        lines.append(f'    h: {sprite["h"]},')
        lines.append(f'    ax: {sprite["ax"]},')
        lines.append(f'    ay: {sprite["ay"]},')
        lines.append("    rows: [")
        for row in sprite["rows"]:
            lines.append(f'      "{row}",')
        lines.append("    ],")
        lines.append("  },")
    lines += ["};", ""]
    with open(SPRITES_TS, "w", encoding="utf-8") as handle:
        handle.write("\n".join(lines))
    return len(book.sprites)


def ts_list(items, keys):
    out = []
    for item in items:
        body = ", ".join(
            f'{key}: {json.dumps(item[key])}' for key in keys if key in item
        )
        out.append(f"    {{ {body} }},")
    return out


def write_slots(entries):
    lines = [
        "/**",
        " * Where every water object stands, per island stage.",
        " * Generated by island/pixel/export_layout.py — do not edit by hand.",
        " *",
        " * Coordinates are pixels of the stage artwork (`artW` x `artH`); the background",
        " * asset is that artwork scaled by `zoom`. A sprite is drawn so that its `ax`/`ay`",
        " * pixel lands on the position. Groups fill up in list order, so owning n pieces",
        " * means using the first n entries — rocks go cluster by cluster, dolphins school",
        " * by school. The places come from island/pixel/water/slots.json and are the same",
        " * for every player (island/SPRITES.md §9).",
        " */",
        "",
        "export interface WaterPiece {",
        "  /** Key in PIECE_SPRITES. */",
        "  sprite: string;",
        "  x: number;",
        "  y: number;",
        "}",
        "",
        "export interface BoatSlot {",
        "  x: number;",
        "  y: number;",
        "  /** Hull stage of this boat. The first boat is the flagship and uses the object's level. */",
        "  hull: number;",
        "}",
        "",
        "/**",
        " * How many pieces of each fleet this island's water holds. Measured by the",
        " * generator: it puts the slots down one by one and stops counting at the",
        " * first piece it could no longer place in its own slot with water around",
        " * it. A twelve-metre island has far less sea than a thirty-two-metre one,",
        " * and twenty-seven dolphins around it read as a traffic jam, not a school.",
        " * Nothing over the limit is lost — it comes out as the island grows.",
        " */",
        "export interface WaterLimits {",
        "  boats: number;",
        "  buoys: number;",
        "  kayaks: number;",
        "  rocks: number;",
        "  dolphins: number;",
        "  gulls: number;",
        "}",
        "",
        "export interface StageWaterSlots {",
        "  stage: number;",
        "  artW: number;",
        "  artH: number;",
        "  /** Device pixels per artwork pixel already baked into the background asset. */",
        "  zoom: number;",
        "  dock: { x: number; y: number; mirror: boolean };",
        "  boats: BoatSlot[];",
        "  buoys: WaterPiece[];",
        "  kayaks: WaterPiece[];",
        "  rocks: WaterPiece[];",
        "  dolphins: WaterPiece[];",
        "  gulls: WaterPiece[];",
        "  limits: WaterLimits;",
        "}",
        "",
        "export const ISLAND_WATER_SLOTS: readonly StageWaterSlots[] = [",
    ]
    for entry in entries:
        lines.append("  {")
        lines.append(f'    stage: {entry["stage"]},')
        lines.append(f'    artW: {entry["artW"]},')
        lines.append(f'    artH: {entry["artH"]},')
        lines.append(f'    zoom: {entry["zoom"]},')
        dock = entry["dock"]
        lines.append(
            f'    dock: {{ x: {dock["x"]}, y: {dock["y"]}, mirror: {"true" if dock["mirror"] else "false"} }},'
        )
        lines.append("    boats: [")
        lines += ts_list(entry["boats"], ("x", "y", "hull"))
        lines.append("    ],")
        for group in ("buoys", "kayaks", "rocks", "dolphins", "gulls"):
            lines.append(f"    {group}: [")
            lines += ts_list(entry[group], ("sprite", "x", "y"))
            lines.append("    ],")
        limits = entry["limits"]
        lines.append(
            "    limits: { "
            + ", ".join(
                f"{key}: {limits[key]}"
                for key in ("boats", "buoys", "kayaks", "rocks", "dolphins", "gulls")
            )
            + " },"
        )
        lines.append("  },")
    lines += ["];", ""]
    with open(SLOTS_TS, "w", encoding="utf-8") as handle:
        handle.write("\n".join(lines))


def write_zones():
    """The zone map the app places on, one line per row of half-metre cells."""
    with open(os.path.join(HERE, "zones.json"), encoding="utf-8") as handle:
        data = json.load(handle)
    lines = [
        "/**",
        " * Where something may stand, per island stage.",
        " * Generated by island/pixel/export_layout.py from island/pixel/zones.json —",
        " * do not edit by hand.",
        " *",
        " * One character per half-metre cell: G meadow, B beach, R rock, S shallow water,",
        " * D open sea, `.` outside the map. `rows[n]` is the line i = iMin + n, character",
        " * m in it is j = jMin + m. i runs to the upper right, j to the upper left, so a",
        " * larger i + j is further back — that is the drawing order.",
        " */",
        "",
        "export interface StageZones {",
        "  stage: number;",
        "  artW: number;",
        "  artH: number;",
        "  /** Device pixels per artwork pixel already baked into the background asset. */",
        "  zoom: number;",
        "  /** Artwork pixel of the island centre, where i and j are both zero. */",
        "  originX: number;",
        "  originY: number;",
        "  iMin: number;",
        "  jMin: number;",
        "  rows: string[];",
        "}",
        "",
        "export const ISLAND_ZONES: readonly StageZones[] = [",
    ]
    for entry in data["stages"]:
        lines.append("  {")
        lines.append(f'    stage: {entry["stage"]},')
        lines.append(f'    artW: {entry["artSize"]["w"]},')
        lines.append(f'    artH: {entry["artSize"]["h"]},')
        lines.append(f'    zoom: {entry["zoom"]},')
        lines.append(f'    originX: {entry["originPx"]["x"]},')
        lines.append(f'    originY: {entry["originPx"]["y"]},')
        lines.append(f'    iMin: {entry["bounds"]["iMin"]},')
        lines.append(f'    jMin: {entry["bounds"]["jMin"]},')
        lines.append("    rows: [")
        for row in entry["rows"]:
            lines.append(f'      "{row}",')
        lines.append("    ],")
        lines.append("  },")
    lines += [
        "];",
        "",
        "/** The zone of one cell, `.` when it is outside the map. */",
        "export function zoneAt(zones: StageZones, i: number, j: number): string {",
        "  const row = zones.rows[i - zones.iMin];",
        "  if (row === undefined) return \".\";",
        "  return row[j - zones.jMin] ?? \".\";",
        "}",
        "",
        "/** The artwork pixel in the middle of one cell. */",
        "export function cellCentre(zones: StageZones, i: number, j: number) {",
        "  return {",
        "    x: zones.originX + 4 * (i - j),",
        "    y: zones.originY - 2 * (i + j) - 2,",
        "  };",
        "}",
        "",
        "/**",
        " * Which cell an artwork pixel belongs to — the inverse of `cellCentre`, used",
        " * to turn a touch on the island into a place to stand. It lives next to its",
        " * forward direction so the two cannot drift apart.",
        " *",
        " * `cellCentre` returns the top corner of the cell's diamond; its middle is two",
        " * pixels lower. Inverting the middle is what a finger on the island means, and",
        " * it makes the round trip exact instead of relying on how .5 rounds.",
        " */",
        "export function cellAt(zones: StageZones, x: number, y: number) {",
        "  const across = (x - zones.originX) / 4;",
        "  const back = (zones.originY - y) / 2;",
        "  return {",
        "    i: Math.round((back + across) / 2),",
        "    j: Math.round((back - across) / 2),",
        "  };",
        "}",
        "",
    ]
    with open(ZONES_TS, "w", encoding="utf-8") as handle:
        handle.write("\n".join(lines))
    return sum(len(entry["rows"]) for entry in data["stages"])


def foot_size(path):
    """How an object touches the ground: (width, depth) in pixels.

    Not the whole picture — a tree crown is much wider than its trunk, a sun
    umbrella much wider than its stand. Taken are the opaque pixels of the
    bottom third, the same rule scene.py uses to check that a beach object
    stands entirely on sand (island/SPRITES.md §5c).

    Width and depth are kept apart because a foot is almost never square on
    screen: it is wide and shallow. One cell is 8 px wide and 4 px deep, so a
    single number would demand far more ground than the object really covers,
    and on a beach band that is barely two metres wide that is the difference
    between fitting and not.
    """
    from PIL import Image

    image = Image.open(path).convert("RGBA")
    alpha = image.split()[3].load()
    rows = {}
    for y in range(image.height):
        row = [x for x in range(image.width) if alpha[x, y] > 40]
        if row:
            rows[y] = row
    if not rows:
        return image.width, 1
    bottom = max(rows)
    cut = bottom - max(2, round(len(rows) * 0.3))
    used = [(x, y) for y, row in rows.items() if y >= cut for x in row]
    xs = [x for x, _ in used]
    ys = [y for _, y in used]
    return max(xs) - min(xs) + 1, max(ys) - min(ys) + 1


def land_objects():
    """Every object that stands on the island: its ground, its size, its anchors."""
    info = {}
    anchors = {}
    feet = {}
    for folder, zone in LAND_SETS:
        with open(os.path.join(HERE, folder, "manifest.json"), encoding="utf-8") as handle:
            manifest = json.load(handle)
        for entry in manifest:
            key, level = entry["key"], entry["level"]
            # Keyed by the file stem, not by key and level: that is the same
            # thing for every normal object, and it gives the flagpole's flag
            # variants (`flagpole_1_de`) their own anchor without inventing a
            # separate object for each flag.
            anchors[entry["file"][: -len(".png")]] = entry["anchorPx"]
            if entry.get("variant"):
                # A variant is the same object wearing something else. It must
                # not widen the block the object reserves on the island.
                continue
            previous = info.get(key, {})
            widest = max(previous.get("width", 0), entry["size"][0])
            foot_w, foot_d = foot_size(os.path.join(HERE, folder, entry["file"]))
            info[key] = {
                "zone": zone or entry.get("zone", "grass"),
                "width": widest,
                "footW": max(previous.get("footW", 0), foot_w),
                "footD": max(previous.get("footD", 0), foot_d),
            }
            feet[f"{key}_{level}"] = block(entry["size"][0], foot_w, foot_d)
    for key, entry in info.items():
        entry.update(block(entry["width"], entry["footW"], entry["footD"]))
    return info, anchors, feet


def block(width, foot_w, foot_d):
    """Spacing block and foot of one picture, in half-metre cells."""
    cells = max(1, min(10, round(width / PX_PER_BLOCK)))
    return {
        "cells": cells,
        # Never wider than the block it reserves, and never below one cell.
        "ground": max(1, min(cells, round(foot_w / PX_PER_BLOCK))),
        "depth": max(1, min(cells, round(foot_d / PX_PER_CELL_DEPTH))),
    }


def write_land(info, anchors, feet):
    lines = [
        "/**",
        " * The objects that stand on the island, generated by",
        " * island/pixel/export_layout.py — do not edit by hand.",
        " *",
        " * `cells` is the side of the square of half-metre cells an object keeps to",
        " * itself, measured from its widest picture — that is the spacing to other",
        " * objects. `ground` is the smaller square it actually stands on, measured from",
        " * the foot of the picture, and only that has to be the right kind of ground: a",
        " * crown may hang over the beach, the trunk may not stand in the sand, and a",
        " * beach object has to sit on the sand with its whole foot (island/SPRITES.md",
        " * §5c). That foot is not a square: `ground` is how many cells wide it is along",
        " * the shore, `depth` how many cells deep it reaches back — a hut is wide and",
        " * shallow, and asking for a square would demand ground it never covers.",
        " * `LAND_ANCHORS` says which pixel of a picture sits on the ground, keyed",
        " * `<object>_<level>` like the sprite files.",
        " */",
        "",
        "export interface LandFoot {",
        "  cells: number;",
        "  ground: number;",
        "  depth: number;",
        "}",
        "",
        "export interface LandObjectInfo extends LandFoot {",
        '  zone: "grass" | "beach";',
        "}",
        "",
        "export const LAND_OBJECTS: Record<string, LandObjectInfo> = {",
    ]
    for key in sorted(info):
        entry = info[key]
        lines.append(
            f'  {key}: {{ zone: "{entry["zone"]}", cells: {entry["cells"]}, '
            f'ground: {entry["ground"]}, depth: {entry["depth"]} }},'
        )
    lines += [
        "};",
        "",
        "/**",
        " * The same three numbers per picture, because a sapling covers far less ground",
        " * than the tree it becomes. Placement uses the level that stands there now; an",
        " * object that outgrows its spot is given a new one (`resolveSpots`). Using the",
        " * largest stage for every level would lock small islands out of their own",
        " * objects — on island 1 nothing would fit on the beach at all.",
        " */",
        "export const LAND_FOOT: Record<string, LandFoot> = {",
    ]
    for key in sorted(feet):
        entry = feet[key]
        lines.append(
            f'  {key}: {{ cells: {entry["cells"]}, ground: {entry["ground"]}, '
            f'depth: {entry["depth"]} }},'
        )
    lines += ["};", "", "export const LAND_ANCHORS: Record<string, [number, number]> = {"]
    for key in sorted(anchors):
        x, y = anchors[key]
        lines.append(f"  {key}: [{x}, {y}],")
    lines += ["};", ""]
    with open(LAND_TS, "w", encoding="utf-8") as handle:
        handle.write("\n".join(lines))
    return len(info), len(anchors)


def main():
    with open(os.path.join(HERE, "water", "slots.json"), encoding="utf-8") as handle:
        slots = json.load(handle)["slots"]

    book = SpriteBook()
    draw_path_sprites(book)
    draw_piece_sprites(slots, book)
    entries = []
    for stage in sorted(ocean.STAGES):
        entry, clipped = stage_entry(stage, slots, book)
        entries.append(entry)
        problems = zone_report(stage, entry)
        print(
            f"  Stufe {stage}: {entry['artW']}x{entry['artH']} px, Zoom {entry['zoom']}"
            f"{'  Zonen: ' + ', '.join(problems) if problems else ''}"
            f"{'  ragt über den Rand: ' + ', '.join(clipped) if clipped else ''}"
        )

    count = write_sprites(book)
    write_slots(entries)
    rows = write_zones()
    info, anchors, feet = land_objects()
    objects, anchor_count = write_land(info, anchors, feet)
    print(f"{ZONES_TS}: {rows} Zeilen Zonenkarte")
    print(f"{LAND_TS}: {objects} Landobjekte, {anchor_count} Anker")
    if "--preview" in sys.argv:
        for entry in entries:
            print("  Vorschau:", preview(entry["stage"], entry, book))
    first = entries[0]
    places = 1 + len(first["boats"]) + sum(
        len(first[group]) for group in ("buoys", "kayaks", "rocks", "dolphins", "gulls")
    )
    print(f"{SPRITES_TS}: {count} Teile, {len(book.colors)} Farben")
    print(f"{SLOTS_TS}: {len(entries)} Stufen mit je {places} Plätzen")


if __name__ == "__main__":
    main()
