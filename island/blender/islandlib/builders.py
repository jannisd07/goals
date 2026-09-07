"""Generatoren: natürliche Inselmasken und Insel-Geometrie. Props folgen in
props.py. Alles deterministisch über Seeds."""

import math
import random

import bmesh

from . import style as S
from .geo import add_box, add_cone, make_object
from .materials import island_base_material

N4 = ((1, 0), (-1, 0), (0, 1), (0, -1))


# --- Inselmasken -------------------------------------------------------------

def _blob(cx, cy, radius, seed, aspect=1.0, angle=0.0, amp=0.18):
    """Weich verformter Kreis: Radius schwankt mit 2–5 Harmonischen → Buchten
    und Vorsprünge. Liefert eine Funktion inside(x, y)."""
    rnd = random.Random(seed)
    harmonics = [
        (k, rnd.uniform(0.35, 1.0) * amp, rnd.uniform(0.0, 2.0 * math.pi))
        for k in (2, 3, 4, 5)
    ]
    c, s = math.cos(angle), math.sin(angle)

    def inside(x, y):
        dx, dy = x - cx, y - cy
        rx = (dx * c + dy * s) / aspect
        ry = -dx * s + dy * c
        d = math.hypot(rx, ry)
        th = math.atan2(ry, rx)
        r = radius * (1.0 + sum(a * math.sin(k * th + ph) for k, a, ph in harmonics))
        return d <= r

    return inside


# Vier Inselideen ohne Bebauung. parts: ((cx, cy, R), blob-Parameter, hinzufügen?)
SHAPES = {
    "A": dict(
        label="Lobed", title="Lappige Insel, viel Baufläche",
        parts=[((0.0, 0.0, 3.2), dict(aspect=1.2, angle=0.5, amp=0.20), True)],
        depth=1.0, strata=False,
    ),
    "B": dict(
        label="Plateau", title="Hohes Plateau mit Felsschichten",
        parts=[((0.0, 0.0, 3.3), dict(aspect=1.05, angle=0.2, amp=0.09), True)],
        depth=1.7, strata=True,
    ),
    "C": dict(
        label="Twin", title="Zwei Landteile mit schmaler Landbrücke",
        parts=[
            ((-1.7, -1.3, 2.4), dict(aspect=1.1, angle=0.3, amp=0.16), True),
            ((2.0, 1.6, 2.2), dict(aspect=1.0, angle=-0.4, amp=0.16), True),
            ((0.15, 0.15, 1.15), dict(amp=0.10), True),
        ],
        depth=1.0, strata=False,
    ),
    "D": dict(
        label="Bay", title="Große Bucht auf einer Seite",
        parts=[
            ((0.0, 0.0, 3.7), dict(aspect=1.15, angle=0.1, amp=0.12), True),
            ((1.8, -1.9, 2.0), dict(amp=0.15), False),
        ],
        depth=1.0, strata=False,
    ),
}


def _clean(cells):
    """Spitzen entfernen, Löcher füllen, größte zusammenhängende Fläche behalten."""
    cells = set(cells)
    changed = True
    while changed:
        changed = False
        for c in list(cells):
            if sum((c[0] + dx, c[1] + dy) in cells for dx, dy in N4) < 2:
                cells.discard(c)
                changed = True
        candidates = set()
        for c in cells:
            for dx, dy in N4:
                n = (c[0] + dx, c[1] + dy)
                if n not in cells:
                    candidates.add(n)
        for n in candidates:
            if sum((n[0] + dx, n[1] + dy) in cells for dx, dy in N4) == 4:
                cells.add(n)
                changed = True
    comps, seen = [], set()
    for start in cells:
        if start in seen:
            continue
        comp, stack = set(), [start]
        while stack:
            p = stack.pop()
            if p in comp or p not in cells:
                continue
            comp.add(p)
            stack.extend((p[0] + dx, p[1] + dy) for dx, dy in N4)
        seen |= comp
        comps.append(comp)
    return max(comps, key=len) if comps else set()


def island_mask(shape_key, seed=1, size=18):
    spec = SHAPES[shape_key]
    fns = [
        (_blob(cx, cy, r, seed + i * 13, **kw), add)
        for i, ((cx, cy, r), kw, add) in enumerate(spec["parts"])
    ]
    half = size // 2
    cells = set()
    for x in range(-half, half + 1):
        for y in range(-half, half + 1):
            inside = False
            for fn, add in fns:
                if fn(x, y):
                    inside = add
            if inside:
                cells.add((x, y))
    return _clean(cells)


def mask_from_count(count, seed=1):
    """Wachstum in der App: Insel mit ungefähr `count` Zellen, gleiche Form-
    familie wie A. Größere Masken enthalten die kleineren (gleicher Seed)."""
    lo, hi = 0.8, 12.0
    best = None
    for _ in range(24):
        radius = (lo + hi) / 2.0
        fn = _blob(0.0, 0.0, radius, seed, aspect=1.2, angle=0.5, amp=0.20)
        cells = _clean({(x, y) for x in range(-16, 17) for y in range(-16, 17) if fn(x, y)})
        best = cells
        if len(cells) < count:
            lo = radius
        else:
            hi = radius
    return best


# --- Insel-Geometrie ---------------------------------------------------------

def build_island(coll, cells, name="Island", depth=0.7, strata=False, seed=1):
    """Zellmaske → Blöcke → Voxel-Remesh → Glättung. Plateau-Oberseite liegt
    auf z = 0, alles andere darunter. Farbbänder kommen aus dem Material."""
    cells = list(cells)
    cellset = set(cells)

    def nb(c):
        return sum((c[0] + dx, c[1] + dy) in cellset for dx, dy in N4)

    rnd = random.Random(seed)
    bm = bmesh.new()

    def puck(radius, z_top, z_bottom, c, jitter=0.0):
        r = radius + rnd.uniform(-jitter, jitter)
        add_cone(bm, r, r, z_top - z_bottom, (c[0], c[1], z_bottom), segments=20)

    for c in cells:
        puck(0.74, 0.0, -0.30, c, jitter=0.03)     # Grasplateau (runde Zellkörper → lappige Küste)
        puck(0.92, -0.06, -0.34, c, jitter=0.02)   # Sandrand, 0.18 m breit
        puck(0.86, -0.05, -0.62 * depth, c)        # Felskante, nahezu senkrecht
    # Unterseite: viele feine Stufen, die das Remesh zu einer weichen Wölbung verschmilzt
    steps = 6
    for i in range(steps):
        t0, t1 = i / steps, (i + 1) / steps
        radius = 0.84 - 0.62 * t1
        min_nb = 2 if t1 < 0.5 else (3 if t1 < 0.85 else 4)
        z_top = -(0.55 + 0.45 * t0) * depth
        z_bottom = -(0.55 + 0.45 * t1) * depth - 0.03
        for c in cells:
            if nb(c) < min_nb:
                continue
            puck(radius, z_top, z_bottom, c, jitter=0.03)
    mat = island_base_material(name, depth, strata)
    obj = make_object(name, bm, mat, coll, smooth=True)
    m = obj.modifiers.new("Remesh", "REMESH")
    m.mode = "VOXEL"
    m.voxel_size = 0.06
    m.use_smooth_shade = True
    m2 = obj.modifiers.new("Smooth", "SMOOTH")
    m2.factor = 0.5
    m2.iterations = 6
    obj["island_cells"] = len(cells)
    obj["island_depth"] = depth
    return obj
