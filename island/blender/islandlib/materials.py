"""Palette → Blender-Materialien. Ein Rezept für alles (Principled BSDF, matt),
plus der globale TopLight-Trick als Node-Group."""

import bpy

from . import style as S

_cache = {}


def hex_to_linear(hex_str, alpha=1.0):
    """sRGB-Hex → lineares RGBA, wie Blender es für Base Color erwartet."""
    h = hex_str.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4))

    def lin(c):
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    return (lin(r), lin(g), lin(b), alpha)


def sock(node, identifier, outputs=False):
    """Socket per Identifier finden (Mix-Node hat mehrere gleichnamige)."""
    coll = node.outputs if outputs else node.inputs
    for s in coll:
        if s.identifier == identifier:
            return s
    return coll[identifier]


def enable_nodes(datablock):
    try:
        if hasattr(datablock, "use_nodes") and not datablock.use_nodes:
            datablock.use_nodes = True
    except Exception:
        pass
    return datablock.node_tree


def toplight_group():
    ng = bpy.data.node_groups.get("IslandTopLight")
    if ng is not None:
        return ng
    ng = bpy.data.node_groups.new("IslandTopLight", "ShaderNodeTree")
    ng.interface.new_socket(name="Color", in_out="INPUT", socket_type="NodeSocketColor")
    ng.interface.new_socket(name="Color", in_out="OUTPUT", socket_type="NodeSocketColor")
    n, l = ng.nodes, ng.links
    gin = n.new("NodeGroupInput")
    gout = n.new("NodeGroupOutput")
    geo = n.new("ShaderNodeNewGeometry")
    dot = n.new("ShaderNodeVectorMath")
    dot.operation = "DOT_PRODUCT"
    dot.inputs[1].default_value = (0.0, 0.0, 1.0)
    mx = n.new("ShaderNodeMath")
    mx.operation = "MAXIMUM"
    mx.inputs[1].default_value = 0.0
    pw = n.new("ShaderNodeMath")
    pw.operation = "POWER"
    pw.inputs[1].default_value = 2.0
    mul = n.new("ShaderNodeMath")
    mul.operation = "MULTIPLY"
    mul.inputs[1].default_value = S.TOPLIGHT_MIX
    mix = n.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.blend_type = "MIX"
    sock(mix, "B_Color").default_value = (1.0, 1.0, 1.0, 1.0)
    l.new(geo.outputs["Normal"], dot.inputs[0])
    l.new(dot.outputs["Value"], mx.inputs[0])
    l.new(mx.outputs["Value"], pw.inputs[0])
    l.new(pw.outputs["Value"], mul.inputs[0])
    l.new(mul.outputs["Value"], sock(mix, "Factor_Float"))
    l.new(gin.outputs[0], sock(mix, "A_Color"))
    l.new(sock(mix, "Result_Color", outputs=True), gout.inputs[0])
    return ng


def _principled(name):
    mat = bpy.data.materials.new(name)
    nt = enable_nodes(mat)
    bsdf = nt.nodes.get("Principled BSDF")
    out = nt.nodes.get("Material Output")
    if bsdf is None:
        bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    if out is None:
        out = nt.nodes.new("ShaderNodeOutputMaterial")
    if not out.inputs["Surface"].is_linked:
        nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    bsdf.inputs["Roughness"].default_value = S.ROUGHNESS
    bsdf.inputs["Metallic"].default_value = 0.0
    for key in ("Specular IOR Level", "Specular"):
        if key in bsdf.inputs:
            bsdf.inputs[key].default_value = S.SPECULAR_IOR_LEVEL
            break
    return mat, nt, bsdf


def _attach_color(nt, bsdf, color, toplight):
    if toplight:
        try:
            grp = nt.nodes.new("ShaderNodeGroup")
            grp.node_tree = toplight_group()
            grp.inputs[0].default_value = color
            nt.links.new(grp.outputs[0], bsdf.inputs["Base Color"])
            return
        except Exception as exc:  # pragma: no cover - Fallback für API-Abweichungen
            print("[islandlib] TopLight nicht verfügbar, flache Farbe:", exc)
    bsdf.inputs["Base Color"].default_value = color


def get_material(token, toplight=True):
    key = (token, toplight)
    cached = _cache.get(key)
    if cached is not None:
        try:
            if cached.name in bpy.data.materials:
                return cached
        except ReferenceError:
            pass
    name = "isl_" + token + ("" if toplight else "_flat")
    mat, nt, bsdf = _principled(name)
    color = hex_to_linear(S.PALETTE[token])
    _attach_color(nt, bsdf, color, toplight)
    mat.diffuse_color = color
    _cache[key] = mat
    return mat


def island_bands(depth, strata=False):
    """Farbbänder von oben nach unten als (z_unten, z_oben, Token)."""
    bands = [
        (-0.045, 0.0, "grass"),
        (-0.17, -0.045, "sand"),
        (-0.24, -0.17, "earth"),
    ]
    if strata:
        z, i, band_h = -0.24, 0, 0.16
        while z > -depth + 1e-6:
            tok = ("cliff_light", "cliff", "cliff_deep")[i % 3]
            bands.append((max(z - band_h, -depth), z, tok))
            z -= band_h
            i += 1
    else:
        rest = depth - 0.24
        bands.append((-0.24 - 0.35 * rest, -0.24, "cliff_light"))
        bands.append((-0.24 - 0.70 * rest, -0.24 - 0.35 * rest, "cliff"))
        bands.append((-depth, -0.24 - 0.70 * rest, "cliff_deep"))
    return bands


def island_base_material(name, depth, strata=False):
    """Farbbänder nach Objekt-Z mit harten Kanten (Sandrand, Erdband, Fels)."""
    mat, nt, bsdf = _principled("isl_base_" + name)
    n, l = nt.nodes, nt.links
    tex = n.new("ShaderNodeTexCoord")
    sep = n.new("ShaderNodeSeparateXYZ")
    mr = n.new("ShaderNodeMapRange")
    mr.inputs["From Min"].default_value = -depth
    mr.inputs["From Max"].default_value = 0.0
    ramp = n.new("ShaderNodeValToRGB")
    ramp.color_ramp.interpolation = "LINEAR"
    eps = 0.004
    stops = []
    for zb, zt, tok in island_bands(depth, strata):
        tb = max(0.0, (zb + depth) / depth)
        tt = min(1.0, (zt + depth) / depth)
        stops.append((min(tb + eps, 1.0), tok))
        stops.append((tt, tok))
    stops.sort(key=lambda s: s[0])
    els = ramp.color_ramp.elements
    els[0].position = stops[0][0]
    els[0].color = hex_to_linear(S.PALETTE[stops[0][1]])
    els[1].position = stops[-1][0]
    els[1].color = hex_to_linear(S.PALETTE[stops[-1][1]])
    for pos, tok in stops[1:-1]:
        e = els.new(pos)
        e.color = hex_to_linear(S.PALETTE[tok])
    l.new(tex.outputs["Object"], sep.inputs["Vector"])
    l.new(sep.outputs["Z"], mr.inputs["Value"])
    l.new(mr.outputs["Result"], ramp.inputs["Fac"])
    try:
        grp = n.new("ShaderNodeGroup")
        grp.node_tree = toplight_group()
        l.new(ramp.outputs["Color"], grp.inputs[0])
        l.new(grp.outputs[0], bsdf.inputs["Base Color"])
    except Exception as exc:
        print("[islandlib] TopLight (Insel) nicht verfügbar:", exc)
        l.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    mat.diffuse_color = hex_to_linear(S.PALETTE["grass"])
    return mat


def shadow_catcher_material():
    mat, nt, bsdf = _principled("isl_shadow_catcher")
    bsdf.inputs["Base Color"].default_value = (1.0, 1.0, 1.0, 1.0)
    return mat
