#!/usr/bin/env python3
"""
Write the zone map of every island stage to island/pixel/zones.json.

The app needs to know where an object may stand. This reads the finished
background of each stage and decides, for every half-metre sub-cell, whether it
is grass, beach, rock, shallow water or open sea — by counting the colours of
the 16 pixels that make up the cell's diamond and taking the majority.

Two sources are compared so mistakes cannot slip through quietly:
1. the colours in the picture (what the player sees), and
2. the geometry the picture was drawn from (ocean.py's island functions).
Their agreement, plus a few sanity checks, is written into the file.

Usage, from the repo root:
    python3 island/pixel/zones.py
"""

import json
import math
import os
import sys
from collections import Counter, deque

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import ocean  # noqa: E402

OUT_PATH = os.path.join(HERE, "zones.json")
GENERATED = "2026-09-14"

GRASS_COLORS = {ocean.GRASS, ocean.GRASS_LIGHT, ocean.GRASS_DARK, ocean.GRASS_DEEP, ocean.COAST}
SAND_COLORS = {ocean.SAND, ocean.SAND_LIGHT, ocean.SAND_WET}
STONE_COLORS = {ocean.STONE, ocean.STONE_LIGHT, ocean.STONE_DARK, ocean.DRIFTWOOD}
EARTH_COLORS = {ocean.EARTH, ocean.EARTH_DARK}
SHALLOW_COLORS = {ocean.SHALLOW, ocean.SHALLOW_LIGHT, ocean.FOAM, ocean.FOAM_WHITE}

LEGEND = {
    "G": "grass: plants, buildings, everything that stands on land",
    "B": "beach: sand, for the beach objects",
    "R": "rock: gravel coast, boulder or the earth edge of the island — blocked",
    "S": "shallow: the bright water ring, for boats, buoys, kayaks, water rocks",
    "D": "deep: open sea next to the island, for dolphins and big boats",
    ".": "outside the map, do not place anything",
}


def pixel_kind(color):
    if color in GRASS_COLORS:
        return "grass"
    if color in SAND_COLORS:
        return "beach"
    if color in STONE_COLORS:
        return "rock"
    if color in EARTH_COLORS:
        return "earth"
    if color in SHALLOW_COLORS:
        return "shallow"
    return "water"


def cell_pixels(image, centre_x, centre_y):
    """The 16 pixels of one sub-cell diamond (8 x 4)."""
    kinds = Counter()
    for dy in range(-2, 3):
        for dx in range(-4, 5):
            if abs(dx) / 4.0 + abs(dy) / 2.0 > 1.0:
                continue
            x = centre_x + dx
            y = centre_y + dy
            if 0 <= x < image.width and 0 <= y < image.height:
                kinds[pixel_kind(image.getpixel((x, y)))] += 1
    return kinds


def classify_cell(kinds, inside_land):
    """Majority of the cell decides. Bare earth counts as ground inside the island."""
    if not kinds:
        return "."
    land = kinds["grass"] + kinds["beach"] + kinds["rock"] + kinds["earth"]
    water = kinds["shallow"] + kinds["water"]
    if land >= water:
        if kinds["rock"] >= 0.4 * land:
            return "R"
        if kinds["earth"] >= 0.4 * land:
            return "G" if inside_land else "R"
        if kinds["beach"] > kinds["grass"]:
            return "B"
        if kinds["grass"] > 0:
            return "G"
        return "R"
    if kinds["shallow"] >= 0.3 * water:
        return "S"
    return "D"


def build_stage(stage):
    spec = ocean.STAGES[stage]
    zoom = spec["d"]
    width = ocean.DEVICE_W // zoom
    height = round(ocean.DEVICE_H / zoom)
    origin_x, origin_y = width / 2, round(height * 0.53)
    image = Image.open(os.path.join(HERE, "backgrounds", f"home-{stage}.png")).convert("RGB")
    island = ocean.Island(
        origin_x, origin_y, spec["rx"], ocean.BEACH_AT_92 * spec["rx"] / 92.0,
        ocean.SHALLOW_AT_92 * spec["rx"] / 92.0, spec["seed"],
    )

    reach = int(spec["rx"] / 4) + 26  # far enough for the shallows and the open water
    cells = {}
    geometry_land = {}
    for i in range(-reach, reach + 1):
        for j in range(-reach, reach + 1):
            centre_x = round(origin_x + 4 * (i - j))
            centre_y = round(origin_y - 2 * (i + j)) - 2
            if not (0 <= centre_x < image.width and 0 <= centre_y < image.height):
                continue
            distance, angle = island.polar(centre_x, centre_y)
            land_end = island.radius(angle) + max(
                island.side_height(angle), island.sand_reach(centre_x, centre_y, angle)
            )
            inside_land = distance < land_end
            zone = classify_cell(cell_pixels(image, centre_x, centre_y), inside_land)
            # only keep water close enough to matter for placement
            if zone in ("S", "D") and distance > land_end + island.shallow * 8.0:
                continue
            if zone == ".":
                continue
            cells[(i, j)] = zone
            geometry_land[(i, j)] = inside_land

    i_values = [i for i, _ in cells]
    j_values = [j for _, j in cells]
    i_min, i_max = min(i_values), max(i_values)
    j_min, j_max = min(j_values), max(j_values)
    rows = [
        "".join(cells.get((i, j), ".") for j in range(j_min, j_max + 1))
        for i in range(i_min, i_max + 1)
    ]

    counts = Counter(cells.values())
    checks = run_checks(cells, geometry_land, island, spec)
    return {
        "stage": stage,
        "background": f"assets/home/pixel-island-{stage}.png",
        "artwork": f"island/pixel/backgrounds/home-{stage}.png",
        "artSize": {"w": width, "h": height},
        "zoom": zoom,
        "originPx": {"x": origin_x, "y": origin_y},
        "island": {
            "radiusPx": spec["rx"],
            "widthMetres": round(2 * spec["rx"] / ocean.PX_PER_M, 2),
            "seed": spec["seed"],
        },
        "bounds": {"iMin": i_min, "iMax": i_max, "jMin": j_min, "jMax": j_max},
        "counts": {key: counts.get(key, 0) for key in "GBRSD"},
        "areaM2": {
            "grass": round(counts.get("G", 0) * 0.25, 1),
            "beach": round(counts.get("B", 0) * 0.25, 1),
            "rock": round(counts.get("R", 0) * 0.25, 1),
            "shallow": round(counts.get("S", 0) * 0.25, 1),
        },
        "checks": checks,
        "rows": rows,
    }


def run_checks(cells, geometry_land, island, spec):
    """Everything that must hold; a false here means the map is unusable."""
    land_zones = {"G", "B", "R"}
    agree = sum(
        1 for cell, zone in cells.items() if (zone in land_zones) == geometry_land[cell]
    )
    # grass should be one connected meadow, not scattered islands
    grass = {cell for cell, zone in cells.items() if zone == "G"}
    biggest, stray = 0, 0
    seen = set()
    for start in grass:
        if start in seen:
            continue
        queue, size = deque([start]), 0
        seen.add(start)
        while queue:
            i, j = queue.popleft()
            size += 1
            for neighbour in ((i + 1, j), (i - 1, j), (i, j + 1), (i, j - 1)):
                if neighbour in grass and neighbour not in seen:
                    seen.add(neighbour)
                    queue.append(neighbour)
        biggest = max(biggest, size)
        if size < 4:
            stray += size
    # every stretch of sand must reach the water somewhere; a wide beach may be
    # several cells deep, so it is the patch that has to touch water, not the cell
    beach = {cell for cell, zone in cells.items() if zone == "B"}
    landlocked_beach = 0
    seen_beach = set()
    coast_cells = 0
    for start in beach:
        if start in seen_beach:
            continue
        queue, patch = deque([start]), []
        seen_beach.add(start)
        while queue:
            i, j = queue.popleft()
            patch.append((i, j))
            for neighbour in ((i + 1, j), (i - 1, j), (i, j + 1), (i, j - 1)):
                if neighbour in beach and neighbour not in seen_beach:
                    seen_beach.add(neighbour)
                    queue.append(neighbour)
        touches = any(
            cells.get((i + di, j + dj)) in ("S", "D")
            for i, j in patch
            for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1))
        )
        if not touches:
            landlocked_beach += len(patch)
    for (i, j), zone in cells.items():
        if zone in ("G", "B") and any(
            cells.get((i + di, j + dj)) in ("S", "D")
            for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1))
        ):
            coast_cells += 1
    # no land may sit far outside the island outline
    outside = 0
    for (i, j), zone in cells.items():
        if zone not in land_zones:
            continue
        if not geometry_land[(i, j)]:
            distance, angle = island.polar(
                island.cx + 4 * (i - j), island.cy - 2 * (i + j) - 2
            )
            if distance > island.radius(angle) * 1.1:
                outside += 1
    return {
        "cells": len(cells),
        "geometryAgreement": round(agree / max(1, len(cells)), 4),
        "grassCells": len(grass),
        "largestGrassPatch": biggest,
        "strayGrassCells": stray,
        "landlockedBeachCells": landlocked_beach,
        "coastCells": coast_cells,
        "landCellsOutsideOutline": outside,
    }


def main():
    stages = [build_stage(stage) for stage in sorted(ocean.STAGES)]
    data = {
        "version": 1,
        "generated": GENERATED,
        "generator": "island/pixel/zones.py",
        "about": (
            "Zone map of the island backgrounds. One character per half-metre sub-cell, "
            "read from the finished picture by colour majority and cross-checked against "
            "the geometry it was drawn from."
        ),
        "legend": LEGEND,
        "grid": {
            "cellMetres": 0.5,
            "cellAreaM2": 0.25,
            "cellDiamondPx": {"w": 8, "h": 4},
            "artPixelsPerMetreDiagonal": 16,
            "artPixelsPerMetreAxis": round(ocean.PX_PER_M, 3),
            "cellCentrePx": "x = originPx.x + 4 * (i - j), y = originPx.y - 2 * (i + j) - 2",
            "rows": (
                "rows[n] is the line i = bounds.iMin + n; character m in it is "
                "j = bounds.jMin + m"
            ),
            "axes": "i runs to the upper right, j to the upper left, both in 0.5 m steps",
            "depthSort": "draw order for objects: larger (i + j) is in front",
            "coastRule": (
                "a land cell (G or B) with an S or D neighbour is coast — needed for "
                "boathouse, lighthouse and dock"
            ),
            "strayGrass": (
                "patches of fewer than four G cells are single blades between rocks; "
                "skip them when placing"
            ),
        },
        "stages": stages,
    }
    with open(OUT_PATH, "w", encoding="utf-8") as handle:
        json.dump(data, handle, indent=2, ensure_ascii=False)
        handle.write("\n")

    print(f"{OUT_PATH} written")
    for entry in stages:
        checks = entry["checks"]
        print(
            f"  Stufe {entry['stage']}: {checks['cells']:5d} Zellen  "
            f"G {entry['counts']['G']:4d}  B {entry['counts']['B']:3d}  R {entry['counts']['R']:3d}  "
            f"S {entry['counts']['S']:4d}  D {entry['counts']['D']:4d}  "
            f"Geometrie {checks['geometryAgreement'] * 100:.1f} %  "
            f"Streugras {checks['strayGrassCells']}  "
            f"Strand ohne Wasseranschluss {checks['landlockedBeachCells']}  "
            f"Küstenzellen {checks['coastCells']}  "
            f"Land außerhalb {checks['landCellsOutsideOutline']}"
        )


if __name__ == "__main__":
    main()
