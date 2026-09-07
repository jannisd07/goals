# Wird per live.py im laufenden Blender ausgeführt: baut Insel A in die offene Szene.
import sys, importlib
sys.path.insert(0, "/Users/jannisdietrich/Apps/goals/island/blender")
import bpy
import islandlib
for m in ("style", "materials", "geo", "scene", "builders", "export"):
    importlib.reload(importlib.import_module("islandlib." + m))
from islandlib import scene as SC, builders as B, export as X
scene = SC.clear_scene()
SC.setup_render(scene, 64)
SC.setup_world(scene)
rig = SC.collection("Rig"); land = SC.collection("Islands")
SC.add_sun(rig); cam = SC.add_camera(scene, rig)
spec = B.SHAPES["A"]; cells = B.island_mask("A", seed=1)
obj = B.build_island(land, cells, name="Island_A", depth=spec["depth"])
w, h, fx, fy = X.fit_frame(X.island_points(cells, spec["depth"]), margin=0.6)
SC.frame_camera(scene, cam, w, h, anchor_fraction=fy, anchor_fraction_x=fx)
for window in bpy.context.window_manager.windows:
    for area in window.screen.areas:
        if area.type == "VIEW_3D":
            space = area.spaces.active
            space.shading.type = "MATERIAL"
            if space.region_3d.view_perspective != "CAMERA":
                for region in area.regions:
                    if region.type == "WINDOW":
                        with bpy.context.temp_override(window=window, area=area, region=region):
                            bpy.ops.view3d.view_camera()
print("Insel A live:", len(cells), "Zellen,", scene.render.resolution_x, "x", scene.render.resolution_y)
