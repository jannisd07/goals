"""bmesh-Helfer: Grundkörper hinzufügen und Objekte mit Bevel/Subsurf anlegen.
Alle Formen entstehen aus Code, nichts wird von Hand modelliert."""

import math

import bmesh
import bpy
from mathutils import Vector

from . import style as S


def add_box(bm, size, center):
    r = bmesh.ops.create_cube(bm, size=1.0)
    verts = r["verts"]
    bmesh.ops.scale(bm, vec=Vector(size), verts=verts)
    bmesh.ops.translate(bm, vec=Vector(center), verts=verts)
    return verts


def add_sphere(bm, radius, center, scale=(1.0, 1.0, 1.0), segments=20, rings=12):
    r = bmesh.ops.create_uvsphere(bm, u_segments=segments, v_segments=rings, radius=radius)
    verts = r["verts"]
    bmesh.ops.scale(bm, vec=Vector(scale), verts=verts)
    bmesh.ops.translate(bm, vec=Vector(center), verts=verts)
    return verts


def add_icosphere(bm, radius, center, subdivisions=1):
    r = bmesh.ops.create_icosphere(bm, subdivisions=subdivisions, radius=radius)
    verts = r["verts"]
    bmesh.ops.translate(bm, vec=Vector(center), verts=verts)
    return verts


def add_cone(bm, r_bottom, r_top, height, center_bottom, segments=16):
    r = bmesh.ops.create_cone(
        bm, cap_ends=True, cap_tris=False, segments=segments,
        radius1=r_bottom, radius2=r_top, depth=height,
    )
    verts = r["verts"]
    bmesh.ops.translate(bm, vec=Vector(center_bottom) + Vector((0.0, 0.0, height / 2.0)), verts=verts)
    return verts


def add_prism(bm, width, depth, height, center_bottom):
    """Satteldach: Dreiecksquerschnitt entlang X extrudiert, First entlang X."""
    hw, hd = width / 2.0, depth / 2.0
    cx, cy, cz = center_bottom
    co = [
        (-hw, -hd, 0.0), (hw, -hd, 0.0), (hw, hd, 0.0), (-hw, hd, 0.0),
        (-hw, 0.0, height), (hw, 0.0, height),
    ]
    vs = [bm.verts.new((x + cx, y + cy, z + cz)) for x, y, z in co]
    for f in [(0, 1, 2, 3), (0, 1, 5, 4), (2, 3, 4, 5), (0, 4, 3), (1, 2, 5)]:
        bm.faces.new([vs[i] for i in f])
    return vs


def make_object(name, bm, material, coll, smooth=True, bevel=None, subsurf=0):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    coll.objects.link(obj)
    if material is not None:
        me.materials.append(material)
    if smooth:
        try:
            me.shade_smooth()
        except Exception:
            for p in me.polygons:
                p.use_smooth = True
    if bevel:
        m = obj.modifiers.new("Bevel", "BEVEL")
        m.width = bevel
        m.segments = S.BEVEL_SEGMENTS
        m.limit_method = "ANGLE"
        m.angle_limit = math.radians(35.0)
        try:
            m.harden_normals = True
        except Exception:
            pass
    if subsurf:
        m = obj.modifiers.new("Subd", "SUBSURF")
        m.levels = subsurf
        m.render_levels = subsurf
    return obj


def make_root(name, coll, objects):
    """Leeres Elternobjekt, damit ein Prop als Ganzes verschoben werden kann."""
    root = bpy.data.objects.new(name + "_root", None)
    coll.objects.link(root)
    for o in objects:
        o.parent = root
    return root
