"""Stilkonstanten der Insel-Library. Quelle: island/ART_BIBLE.md.

Solange STYLE_VERSION mit "-draft" endet, dürfen Werte noch iteriert werden.
Nach der Abnahme der Master-Szene wird die Version auf "1.0" gesetzt; ab dann
gilt: Änderungen nur mit Versions-Bump und komplettem Neu-Rendern der Library.
"""

STYLE_VERSION = "0.1-draft"

# --- Kamera -----------------------------------------------------------------
PX_PER_M = 128                          # Renderpixel pro Blender-Meter (@2x)
CAMERA_ROTATION_DEG = (54.736, 0.0, 45.0)   # True Isometric
CAMERA_BACK_DIR = (1.0, -1.0, 1.0)      # Kamera steht in dieser Richtung vom Ziel
CAMERA_DISTANCE = 40.0
DEFAULT_ANCHOR_FRACTION = 0.25          # Bodenanker liegt 25 % über der Unterkante

# Rahmenklassen: (Breite m, Höhe m)
FRAMES = {
    "S": (2.0, 3.0),
    "M": (3.0, 4.0),
    "L": (4.0, 5.0),
}

# --- Licht ------------------------------------------------------------------
SUN_TRAVEL_DIR = (1.0, 1.0, -1.5)       # Richtung, in die das Licht läuft
SUN_STRENGTH = 2.6
SUN_COLOR = "#FFF6E8"
SUN_ANGLE_DEG = 4.0
WORLD_COLOR = "#DCE3EC"
WORLD_STRENGTH = 0.55

# --- Palette (sRGB-Hex, wird beim Materialaufbau nach Linear konvertiert) ----
PALETTE = {
    # Gelände, abgestimmt auf Konzepttafel A (island/concepts/island-directions-abcd.png)
    "grass": "#A3CF4F",
    "sand": "#EDD9A6",
    "earth": "#A56A3B",
    "cliff_light": "#D9A063",
    "cliff": "#BE7C43",
    "cliff_deep": "#8F5A2F",
    # Vegetation
    "canopy_a": "#4F9E4B",
    "canopy_b": "#7EC15A",
    "canopy_blossom": "#F1A8BC",
    "canopy_autumn": "#E39A4F",
    # Stein, Holz, Gebäude
    "stone": "#B9BCBD",
    "stone_dark": "#8C8F92",
    "wood": "#B9834F",
    "wood_dark": "#8A5B33",
    "wall_cream": "#F4E9D3",
    "wall_warm": "#EBD8B6",
    "roof_terracotta": "#D2694A",
    "roof_slate": "#5F739F",
    # Akzente
    "flower_yellow": "#F6CF4C",
    "flower_coral": "#E9605A",
    "detail_accent": "#415DCB",
    "water": "#6FB8D9",
    # UI-Hintergrund der App, nur für Vorschau-Backdrops
    "ui_bg": "#E0E5EC",
}

# --- Material ---------------------------------------------------------------
ROUGHNESS = 0.9
SPECULAR_IOR_LEVEL = 0.3
TOPLIGHT_MIX = 0.12                     # Oberseiten um 12 % Richtung Weiß

# --- Form -------------------------------------------------------------------
BEVEL_WIDTH = 0.04
BEVEL_SEGMENTS = 3
ISLAND_DEPTH = 1.4                      # Tiefe der Felsunterseite (Level 3)

# --- Render -----------------------------------------------------------------
RENDER_SAMPLES = 128
