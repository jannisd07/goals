#!/usr/bin/env python3
"""
Does the whole catalogue fit on an island stage?

Reads the zone map written by island/pixel/zones.py and places the objects of
catalogue v1 greedily with their real footprints (buildings keep a one-cell
clearance ring). This is also the test of the zone map itself: if the map were
wrong — sand in the water, grass on the rocks, cells in the wrong place — the
placement here would fail.

1 sub-cell = 0.5 x 0.5 m = 0.25 m².

Usage, from the repo root:
    python3 island/pixel/capacity.py [stage ...]
"""

import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import ocean  # noqa: E402

ZONE_NAMES = {"G": "grass", "B": "beach", "R": "rock", "S": "shallow", "D": "deep"}

# name, footprint (sub-cells), count, zone, clearance ring
CATALOG = [
    # buildings, each once at its biggest size
    ("Wohnhaus", (8, 8), 1, "grass", 1),
    ("Trainingsplatz", (6, 8), 1, "grass", 1),
    ("Café", (6, 6), 1, "grass", 1),
    ("Bibliothek", (6, 6), 1, "grass", 1),
    ("Sternwarte", (6, 6), 1, "grass", 1),
    ("Gewächshaus", (6, 4), 1, "grass", 1),
    ("Windmühle", (4, 4), 1, "grass", 1),
    ("Werkstatt", (4, 4), 1, "grass", 1),
    ("Yoga-Pavillon", (4, 4), 1, "grass", 1),
    ("Bootshaus", (4, 4), 1, "grass", 1),
    # roadmap objects
    ("Brunnen", (4, 4), 1, "grass", 0),
    ("Uhrturm", (4, 4), 1, "grass", 0),
    ("Monument", (4, 4), 1, "grass", 0),
    ("Leuchtturm", (4, 4), 1, "grass", 0),
    ("Fahnenmast", (2, 2), 1, "grass", 0),
    ("Schatzkiste", (2, 2), 1, "beach", 0),
    # plants, counts from Jannis
    ("Weltenbaum", (4, 4), 1, "grass", 1),
    ("Blumenbeet", (4, 4), 3, "grass", 0),
    ("Busch", (2, 2), 8, "grass", 0),
    ("Laubbaum", (1, 1), 6, "grass", 1),
    ("Tanne", (1, 1), 5, "grass", 1),
    ("Palme", (1, 1), 5, "grass", 1),
    ("Obstbaum", (1, 1), 4, "grass", 1),
    ("Grasbüschel", (1, 1), 12, "grass", 0),
    # beach objects
    ("Strandbar", (4, 4), 1, "beach", 0),
    ("Beachvolleyball", (2, 6), 1, "beach", 0),
    ("Hängematte", (2, 4), 1, "beach", 0),
    ("Sandburg", (2, 2), 1, "beach", 0),
    ("Lagerfeuer", (2, 2), 1, "beach", 0),
    ("Liegestuhl", (2, 1), 4, "beach", 0),
    ("Surfbrett", (1, 1), 5, "beach", 0),
    ("Muscheln", (1, 1), 10, "beach", 0),
]


def load_zones(stage):
    """The sub-cell map of one stage, straight from zones.json."""
    with open(os.path.join(HERE, "zones.json"), encoding="utf-8") as handle:
        data = json.load(handle)
    entry = next(item for item in data["stages"] if item["stage"] == stage)
    cells = {}
    i_min, j_min = entry["bounds"]["iMin"], entry["bounds"]["jMin"]
    for row_index, row in enumerate(entry["rows"]):
        for column, char in enumerate(row):
            if char == ".":
                continue
            cells[(i_min + row_index, j_min + column)] = ZONE_NAMES[char]
    return cells, entry


def place(cells):
    """Greedy placement from the middle outwards; returns what did not fit."""
    used = set()
    order = sorted(cells, key=lambda cell: (abs(cell[0] + cell[1]), abs(cell[0] - cell[1])))
    missing = []
    placed = []
    for name, (w, h), count, zone, clearance in CATALOG:
        for index in range(count):
            spot = None
            for (i, j) in order:
                ok = True
                for di in range(-clearance, w + clearance):
                    for dj in range(-clearance, h + clearance):
                        cell = (i + di, j + dj)
                        if cell in used:
                            ok = False
                            break
                        needed = 0 <= di < w and 0 <= dj < h
                        if needed and cells.get(cell) != zone:
                            ok = False
                            break
                    if not ok:
                        break
                if ok:
                    spot = (i, j)
                    break
            if spot is None:
                missing.append(f"{name} #{index + 1}")
                continue
            i, j = spot
            for di in range(-clearance, w + clearance):
                for dj in range(-clearance, h + clearance):
                    used.add((i + di, j + dj))
            placed.append((name, spot, (w, h)))
    return placed, missing, used


def report(stage):
    cells, entry = load_zones(stage)
    areas = entry["areaM2"]
    grass_cells = sum(1 for zone in cells.values() if zone == "grass")
    beach_cells = sum(1 for zone in cells.values() if zone == "beach")
    needed = sum(w * h * n for _, (w, h), n, zone, _ in CATALOG if zone == "grass") * 0.25
    needed_beach = sum(w * h * n for _, (w, h), n, zone, _ in CATALOG if zone == "beach") * 0.25
    placed, missing, used = place(cells)
    total = sum(count for _, _, count, _, _ in CATALOG)
    print(f"--- Stufe {stage}: Insel {entry['island']['widthMetres']} m, Kamera D {entry['zoom']}")
    print(f"    Wiese  {areas['grass']:6.1f} m² ({grass_cells} Unterzellen)")
    print(f"    Strand {areas['beach']:6.1f} m² ({beach_cells} Unterzellen)")
    print(f"    Fels   {areas['rock']:6.1f} m²    Flachwasser {areas['shallow']:6.1f} m²")
    print(f"    Bedarf Wiese {needed:.1f} m², Strand {needed_beach:.1f} m² (nur Grundflächen)")
    print(f"    platziert {len(placed)}/{total} Objekte, belegt {len(used) * 0.25:.1f} m² inkl. Abstand")
    if missing:
        print(f"    PASST NICHT: {', '.join(missing)}")
    else:
        free = grass_cells - sum(1 for cell in used if cells.get(cell) == "grass")
        print(f"    alles drauf, danach noch {free * 0.25:.1f} m² Wiese frei")
    return not missing


if __name__ == "__main__":
    stages = [int(a) for a in sys.argv[1:] if a.isdigit()] or [5]
    for stage in stages:
        report(stage)
