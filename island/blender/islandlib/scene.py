"""Szene: Render-Engine, Welt, Sonne, Kamera, Shadow Catcher, Backdrop, Labels.
Alle Werte aus style.py. Kein Asset darf hiervon abweichen."""

import math

import bmesh
import bpy
from mathutils import Euler, Vector

from . import style as S
from .materials import enable_nodes, hex_to_linear, shadow_catcher_material


def reset_scene():
    """Headless: leere Datei laden."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    return bpy.context.scene


def clear_scene():
    """Live-Session: alles entfernen, ohne die Datei neu zu laden (Add-on bleibt)."""
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for coll in list(bpy.data.collections):
        bpy.data.collections.remove(coll)
    for blocks in (
        bpy.data.meshes, bpy.data.materials, bpy.data.lights, bpy.data.cameras,
        bpy.data.curves, bpy.data.node_groups, bpy.data.images,
    ):
        for block in list(blocks):
            if block.users == 0:
                blocks.remove(block)
    return bpy.context.scene


def collection(name):
    coll = bpy.data.collections.get(name)
    if coll is None:
        coll = bpy.data.collections.new(name)
    if coll.name not in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.link(coll)
    return coll


def setup_render(scene, samples=None):
    scene.render.engine = "CYCLES"
    device = "CPU"
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        prefs.compute_device_type = "METAL"
        prefs.refresh_devices()
        has_gpu = any(d.type == "METAL" for d in prefs.devices)
        for d in prefs.devices:
            d.use = (d.type == "METAL") if has_gpu else (d.type == "CPU")
        device = "GPU" if has_gpu else "CPU"
    except Exception as exc:
        print("[islandlib] GPU-Setup fehlgeschlagen, CPU:", exc)
    scene.cycles.device = device
    scene.cycles.samples = samples or S.RENDER_SAMPLES
    scene.cycles.use_denoising = True
    try:
        scene.cycles.denoiser = "OPENIMAGEDENOISE"
    except Exception:
        pass
    scene.render.film_transparent = True
    scene.render.use_persistent_data = True
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = 0.0
    scene.view_settings.gamma = 1.0
    img = scene.render.image_settings
    img.file_format = "PNG"
    img.color_mode = "RGBA"
    img.color_depth = "16"
    img.compression = 50
    scene.render.resolution_percentage = 100
    print(f"[islandlib] Cycles auf {device}, {scene.cycles.samples} Samples")
    return device


def setup_world(scene):
    world = bpy.data.worlds.new("IslandWorld")
    scene.world = world
    nt = enable_nodes(world)
    bg = nt.nodes.get("Background") if nt else None
    if bg is None:
        bg = nt.nodes.new("ShaderNodeBackground")
        out = nt.nodes.new("ShaderNodeOutputWorld")
        nt.links.new(bg.outputs["Background"], out.inputs["Surface"])
    bg.inputs["Color"].default_value = hex_to_linear(S.WORLD_COLOR)
    bg.inputs["Strength"].default_value = S.WORLD_STRENGTH
    return world


def add_sun(coll):
    ld = bpy.data.lights.new("IslandSun", "SUN")
    ld.energy = S.SUN_STRENGTH
    ld.angle = math.radians(S.SUN_ANGLE_DEG)
    ld.color = hex_to_linear(S.SUN_COLOR)[:3]
    sun = bpy.data.objects.new("IslandSun", ld)
    coll.objects.link(sun)
    travel = Vector(S.SUN_TRAVEL_DIR).normalized()
    sun.rotation_euler = travel.to_track_quat("-Z", "Y").to_euler()
    sun.location = (0.0, 0.0, 12.0)
    return sun


def add_camera(scene, coll):
    cd = bpy.data.cameras.new("IslandCam")
    cd.type = "ORTHO"
    cd.clip_start = 0.1
    cd.clip_end = 400.0
    cam = bpy.data.objects.new("IslandCam", cd)
    coll.objects.link(cam)
    scene.camera = cam
    return cam


def camera_rotation():
    return Euler(tuple(math.radians(a) for a in S.CAMERA_ROTATION_DEG), "XYZ")


def frame_camera(scene, cam, frame_w, frame_h, target=(0.0, 0.0, 0.0),
                 anchor_fraction=None, anchor_fraction_x=0.5, px_per_m=None):
    """Kamera so setzen, dass `target` bei (anchor_fraction_x von links,
    anchor_fraction von unten) im Rahmen liegt. Auflösung folgt aus px_per_m."""
    fy = S.DEFAULT_ANCHOR_FRACTION if anchor_fraction is None else anchor_fraction
    fx = anchor_fraction_x
    ppm = px_per_m or S.PX_PER_M
    scene.render.resolution_x = int(round(frame_w * ppm))
    scene.render.resolution_y = int(round(frame_h * ppm))
    if frame_w >= frame_h:
        cam.data.sensor_fit = "HORIZONTAL"
        cam.data.ortho_scale = frame_w
    else:
        cam.data.sensor_fit = "VERTICAL"
        cam.data.ortho_scale = frame_h
    rot = camera_rotation()
    cam.rotation_euler = rot
    m = rot.to_matrix()
    up = m @ Vector((0.0, 1.0, 0.0))
    right = m @ Vector((1.0, 0.0, 0.0))
    back = Vector(S.CAMERA_BACK_DIR).normalized()
    center = Vector(target) + up * ((0.5 - fy) * frame_h) + right * ((0.5 - fx) * frame_w)
    cam.location = center + back * S.CAMERA_DISTANCE
    bpy.context.view_layer.update()


def add_shadow_catcher(coll, size=40.0):
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=size)
    me = bpy.data.meshes.new("ShadowCatcher")
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new("ShadowCatcher", me)
    coll.objects.link(obj)
    obj.is_shadow_catcher = True
    me.materials.append(shadow_catcher_material())
    return obj


def _shadeless_material(name, color_hex):
    mat = bpy.data.materials.new(name)
    nt = enable_nodes(mat)
    for node in list(nt.nodes):
        nt.nodes.remove(node)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    mix = nt.nodes.new("ShaderNodeMixShader")
    lp = nt.nodes.new("ShaderNodeLightPath")
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = hex_to_linear(color_hex)
    em.inputs["Strength"].default_value = 1.0
    nt.links.new(lp.outputs["Is Camera Ray"], mix.inputs["Fac"])
    nt.links.new(tr.outputs["BSDF"], mix.inputs[1])
    nt.links.new(em.outputs["Emission"], mix.inputs[2])
    nt.links.new(mix.outputs["Shader"], out.inputs["Surface"])
    return mat


def add_backdrop(coll, color_hex=None, size=600.0, z=-10.0):
    """Nur für Vorschau-Sheets: Fläche in App-Hintergrundfarbe, wirkt nicht
    auf die Beleuchtung (nur Kamerastrahlen sehen sie)."""
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=size)
    me = bpy.data.meshes.new("Backdrop")
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new("Backdrop", me)
    coll.objects.link(obj)
    obj.location = (0.0, 0.0, z)
    me.materials.append(_shadeless_material("isl_backdrop", color_hex or S.PALETTE["ui_bg"]))
    try:
        obj.visible_shadow = False
        obj.visible_diffuse = False
        obj.visible_glossy = False
    except Exception:
        pass
    return obj


def add_label(coll, text, location, size=1.4, color_hex="#3B4351"):
    """Flaches Textobjekt, zur Kamera gedreht. Nur für Vorschau-Sheets."""
    cu = bpy.data.curves.new("lbl_" + text, "FONT")
    cu.body = text
    cu.size = size
    cu.align_x = "CENTER"
    obj = bpy.data.objects.new("Label_" + text, cu)
    coll.objects.link(obj)
    obj.location = location
    obj.rotation_euler = camera_rotation()
    cu.materials.append(_shadeless_material("isl_label_" + text, color_hex))
    try:
        obj.visible_shadow = False
    except Exception:
        pass
    return obj
