"""Rahmen berechnen, Sichtbarkeit steuern, rendern, Ankerpixel bestimmen."""

import time

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

from . import style as S
from .scene import camera_rotation


def screen_axes():
    m = camera_rotation().to_matrix()
    return m @ Vector((1.0, 0.0, 0.0)), m @ Vector((0.0, 1.0, 0.0))


def fit_frame(points, margin=0.5):
    """Kleinster Rahmen (Breite, Höhe in m), der alle Punkte enthält, plus die
    Position des Weltursprungs im Rahmen (Anteil von links, Anteil von unten)."""
    right, up = screen_axes()
    rs = [Vector(p).dot(right) for p in points]
    us = [Vector(p).dot(up) for p in points]
    min_r, max_r = min(rs) - margin, max(rs) + margin
    min_u, max_u = min(us) - margin, max(us) + margin
    w, h = max_r - min_r, max_u - min_u
    return w, h, (0.0 - min_r) / w, (0.0 - min_u) / h


def island_points(cells, depth, location=(0.0, 0.0, 0.0)):
    pts = []
    for x, y in cells:
        for dx in (-0.65, 0.65):
            for dy in (-0.65, 0.65):
                for z in (0.0, -depth):
                    pts.append((x + dx + location[0], y + dy + location[1], z + location[2]))
    return pts


KEEP_TYPES = {"LIGHT", "CAMERA", "EMPTY"}


def set_render_visibility(visible):
    """Nur die genannten Meshes rendern. Lichter, Kamera und Empties bleiben
    immer sichtbar, sonst fehlt die Sonne im Bild."""
    names = {o.name for o in visible}
    for o in bpy.data.objects:
        if o.type in KEEP_TYPES:
            o.hide_render = False
        else:
            o.hide_render = o.name not in names


def anchor_px(scene, cam, point=(0.0, 0.0, 0.0)):
    co = world_to_camera_view(scene, cam, Vector(point))
    return {
        "x": round(co.x * scene.render.resolution_x, 1),
        "y": round((1.0 - co.y) * scene.render.resolution_y, 1),
    }


def render_png(scene, path):
    scene.render.filepath = path
    t = time.time()
    bpy.ops.render.render(write_still=True)
    dt = time.time() - t
    print(f"[islandlib] gerendert {path} ({scene.render.resolution_x}x{scene.render.resolution_y}) in {dt:.1f}s")
    return dt
