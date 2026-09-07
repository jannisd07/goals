#!/usr/bin/env python3
"""Comic-Insel-Mockups als SVG (ohne Blender).

Sechs **Zeichenstile** derselben Grundidee: flache Insel im Meer mit echten
Sandstränden (1, 2 oder 3). Ausgabe: island/mockups/style_1..6.svg + sheet.svg
Reine Standardbibliothek, Rasterung per `qlmanage -t`.
"""
import math
import os
import random

OUT = os.path.dirname(os.path.abspath(__file__))
W, H = 1000, 1000
CX, CY = 500, 470
S = 44.0                       # px pro Zelle
COS30, SIN30 = math.cos(math.radians(30)), math.sin(math.radians(30))
TAU = 2 * math.pi


def proj(x, y, z=0.0):
    return CX + (x - y) * COS30 * S, CY + (x + y) * SIN30 * S - z * S


def unproj(sx, sy):
    u = (sx - CX) / (COS30 * S)
    v = (sy - CY) / (SIN30 * S)
    return (u + v) / 2.0, (v - u) / 2.0


def fmt(pts):
    return "M " + " L ".join(f"{x:.1f} {y:.1f}" for x, y in pts) + " Z"


def angdiff(a, b):
    return (a - b + math.pi) % TAU - math.pi


def mix(c1, c2, t):
    a = tuple(int(c1[i:i + 2], 16) for i in (1, 3, 5))
    b = tuple(int(c2[i:i + 2], 16) for i in (1, 3, 5))
    return "#" + "".join(f"{round(a[i] + (b[i] - a[i]) * t):02X}" for i in range(3))


# --------------------------------------------------------------------------
# Stile
# --------------------------------------------------------------------------
# grass/grass_dk/grass_lt, sand, sand_dk, edge (Erdkante), edge_dk,
# sea, sea_lt (Untiefe), foam, line (Outline)

STYLES = [
    dict(
        n=1, name="Soft Gradient", note="weiche Verläufe, keine Outline",
        beaches=1, wall=0.40, seed=11, aspect=1.22, angle=0.5, harm=0.16, lobe=0.30,
        sand_w=0.07, bwide=0.62, bdeep=1.7,
        pal=dict(grass="#A6D155", grass_dk="#88BC45", grass_lt="#C6E479",
                 sand="#F2DFB0", sand_dk="#DCC38C", edge="#C89055", edge_dk="#9A6A3B",
                 sea="#8FC2E0", sea_lt="#C3E7F0", foam="#FFFFFF"),
        gradients=True, outline=None, detail="both", waves="line", tuft=30, dots=0,
    ),
    dict(
        n=2, name="Clean Outline", note="klare Kontur, Zeichentrick",
        beaches=2, wall=0.34, seed=23, aspect=1.06, angle=0.2, harm=0.09, lobe=0.42,
        sand_w=0.06, bwide=0.52, bdeep=1.5,
        pal=dict(grass="#9ACF4E", grass_dk="#7CB93F", grass_lt="#BFE072",
                 sand="#F4E2B4", sand_dk="#E0C88F", edge="#CE9256", edge_dk="#A06C3C",
                 sea="#87BEDF", sea_lt="#BFE4F2", foam="#FFFFFF"),
        gradients=False, outline=("#6B5334", 3.0), detail="tufts", waves="line",
        tuft=26, dots=0,
    ),
    dict(
        n=3, name="Low Poly", note="facettierte Küste, reine Flächen",
        beaches=3, wall=0.34, seed=37, aspect=1.30, angle=0.35, harm=0.20, lobe=0.14,
        sand_w=0.05, bwide=0.44, bdeep=1.35, facets=30,
        pal=dict(grass="#96C951", grass_dk="#7FB544", grass_lt="#B4DA6C",
                 sand="#F0DDAC", sand_dk="#DCC48D", edge="#C99257", edge_dk="#A5713F",
                 sea="#8CC3E2", sea_lt="#C8E9F2", foam="#EAF7FB"),
        gradients=False, outline=None, detail="facet", waves="blob", tuft=0, dots=0,
    ),
    dict(
        n=4, name="Painterly", note="viele Grüntöne, unruhige Flächen",
        beaches=1, wall=0.42, seed=41, aspect=1.15, angle=0.6, harm=0.23, lobe=0.22,
        sand_w=0.08, bwide=0.70, bdeep=2.0,
        pal=dict(grass="#9CCB56", grass_dk="#71A63E", grass_lt="#CBE785",
                 sand="#EFDCAB", sand_dk="#D3B983", edge="#C08A52", edge_dk="#8F6337",
                 sea="#87BDD9", sea_lt="#BDE2EE", foam="#FFFFFF"),
        gradients=True, outline=None, detail="painterly", waves="line", tuft=44, dots=26,
    ),
    dict(
        n=5, name="Chunky Toy", note="kräftig, dicke Sandkante",
        beaches=2, wall=0.46, seed=53, aspect=1.10, angle=0.15, harm=0.10, lobe=0.52,
        bwide=0.55, bdeep=1.4,
        pal=dict(grass="#8FCB3F", grass_dk="#6EB130", grass_lt="#B6E063",
                 sand="#F7E2A6", sand_dk="#E3C87F", edge="#D89A54", edge_dk="#AE7238",
                 sea="#79BADF", sea_lt="#B6E2F2", foam="#FFFFFF"),
        gradients=False, outline=("#7A5A30", 2.2), detail="both", waves="fat",
        tuft=22, dots=14, sand_w=0.30,
    ),
    dict(
        n=6, name="Airy Pastel", note="hell, entsättigt, ruhig",
        beaches=3, wall=0.28, seed=67, aspect=1.26, angle=0.45, harm=0.17, lobe=0.20,
        sand_w=0.05, bwide=0.40, bdeep=1.25,
        pal=dict(grass="#B4D97A", grass_dk="#9BC65F", grass_lt="#D2E9A2",
                 sand="#F6E9CB", sand_dk="#E4D3AC", edge="#D9AE7E", edge_dk="#B58B5E",
                 sea="#A8D3E8", sea_lt="#D7EFF6", foam="#FFFFFF"),
        gradients=True, outline=None, detail="tufts", waves="thin", tuft=34, dots=18,
    ),
]


# --------------------------------------------------------------------------
class Island:
    """Flache Insel: Grasplateau, umlaufender Sandsaum, an 1–3 Stellen ein
    breiter Strand, der die Kante auf null zieht und ins flache Wasser läuft."""

    def __init__(self, style):
        self.st = style
        self.pal = style["pal"]
        self.R = 4.5
        self.aspect = style["aspect"]
        self.angle = style["angle"]
        self.wall = style["wall"]
        self.sand_w = style.get("sand_w", 0.06)
        rnd = random.Random(style["seed"])
        self.rnd = rnd
        self.harm = [(k, rnd.uniform(0.4, 1.0) * style["harm"], rnd.uniform(0, TAU))
                     for k in (2, 3, 4, 5)]
        self.M = max(8, round(TAU * self.R / 1.3))
        self.psi = rnd.uniform(0, TAU)
        self.lobe = style["lobe"]
        # Strände: gleichmäßig verteilt, leicht versetzt, vordere Seite bevorzugt
        n = style["beaches"]
        base = [-0.5, -0.5 + TAU / 3 * 1.0, -0.5 + TAU / 3 * 2.0][:n] if n > 1 else [-0.45]
        if n == 2:
            base = [-0.55, 2.35]
        if n == 3:
            base = [-0.6, 1.55, 3.55]
        bw, bd = style.get("bwide", 0.55), style.get("bdeep", 1.6)
        self.beaches = [(t + rnd.uniform(-0.10, 0.10), bw * rnd.uniform(0.88, 1.12),
                         bd * rnd.uniform(0.85, 1.15)) for t in base]

    # --- Geometrie ---------------------------------------------------------
    def radius(self, th):
        r = self.R * (1 + sum(a * math.sin(k * th + ph) for k, a, ph in self.harm))
        r += self.lobe * abs(math.cos(self.M * th / 2 + self.psi)) ** 0.55
        return max(1.0, r)

    def beach_f(self, th):
        """0 = keine Strandnähe, 1 = Strandmitte."""
        f = 0.0
        for t0, wdt, _d in self.beaches:
            f = max(f, math.exp(-(angdiff(th, t0) / wdt) ** 2))
        return f

    def wall_at(self, th):
        return self.wall * (1.0 - 0.92 * self.beach_f(th))

    def sand_inset(self, th):
        """Wie weit der Sand vom Rand nach innen reicht."""
        ins = self.sand_w
        for t0, wdt, dep in self.beaches:
            ins += dep * math.exp(-(angdiff(th, t0) / wdt) ** 2)
        return ins

    def pt(self, th, scale=1.0, dr=0.0, z=None):
        r = self.radius(th) * scale + dr
        px, py = r * math.cos(th) * self.aspect, r * math.sin(th)
        c, s = math.cos(self.angle), math.sin(self.angle)
        gx, gy = px * c - py * s, px * s + py * c
        zz = -self.wall_at(th) if z is None else z
        return proj(gx, gy, zz)

    def ring(self, n=560, scale=1.0, dr=0.0, z=0.0, follow=False):
        n = self.st.get("facets", n) if n >= 300 else n
        out = []
        for i in range(n):
            th = TAU * i / n
            out.append(self.pt(th, scale, dr, -self.wall_at(th) * z if follow else z))
        return out

    def grass_ring(self, n=560):
        n = self.st.get("facets", n)
        return [self.pt(TAU * i / n, dr=-self.sand_inset(TAU * i / n), z=0.0)
                for i in range(n)]

    def ground(self, th, scale=1.0, dr=0.0):
        r = self.radius(th) * scale + dr
        px, py = r * math.cos(th) * self.aspect, r * math.sin(th)
        c, s = math.cos(self.angle), math.sin(self.angle)
        return px * c - py * s, px * s + py * c

    def inside(self, x, y, margin=0.0):
        c, s = math.cos(-self.angle), math.sin(-self.angle)
        px, py = x * c - y * s, x * s + y * c
        px /= self.aspect
        return math.hypot(px, py) < self.radius(math.atan2(py, px)) - margin

    def inside_grass(self, x, y, margin=0.0):
        c, s = math.cos(-self.angle), math.sin(-self.angle)
        px, py = x * c - y * s, x * s + y * c
        px /= self.aspect
        th = math.atan2(py, px)
        return math.hypot(px, py) < self.radius(th) - self.sand_inset(th) - margin

    # --- Zeichnen ----------------------------------------------------------
    def defs(self):
        p, k = self.pal, self.st["n"]
        d = [f'<linearGradient id="sea{k}" x1="0" y1="0" x2="0.3" y2="1">'
             f'<stop offset="0" stop-color="{mix(p["sea"], "#FFFFFF", 0.18)}"/>'
             f'<stop offset="1" stop-color="{mix(p["sea"], "#000000", 0.06)}"/></linearGradient>']
        if self.st["gradients"]:
            d.append(f'<radialGradient id="grass{k}" cx="0.38" cy="0.3" r="0.8">'
                     f'<stop offset="0" stop-color="{p["grass_lt"]}"/>'
                     f'<stop offset="0.62" stop-color="{p["grass"]}"/>'
                     f'<stop offset="1" stop-color="{p["grass_dk"]}"/></radialGradient>')
            d.append(f'<linearGradient id="sand{k}" x1="0.15" y1="0" x2="0.85" y2="1">'
                     f'<stop offset="0" stop-color="{mix(p["sand"], "#FFFFFF", 0.25)}"/>'
                     f'<stop offset="1" stop-color="{p["sand_dk"]}"/></linearGradient>')
            d.append(f'<linearGradient id="edge{k}" gradientUnits="userSpaceOnUse" '
                     f'x1="{CX - 240}" y1="0" x2="{CX + 240}" y2="0">'
                     f'<stop offset="0" stop-color="{mix(p["edge"], "#FFFFFF", 0.2)}"/>'
                     f'<stop offset="1" stop-color="{p["edge_dk"]}"/></linearGradient>')
        d.append(f'<filter id="b8_{k}"><feGaussianBlur stdDeviation="8"/></filter>')
        d.append(f'<filter id="b18_{k}"><feGaussianBlur stdDeviation="18"/></filter>')
        d.append(f'<clipPath id="land{k}"><path d="{fmt(self.ring(z=0.0))}"/></clipPath>')
        d.append(f'<clipPath id="gr{k}"><path d="{fmt(self.grass_ring())}"/></clipPath>')
        return "\n".join(d)

    def fill(self, which):
        k, p = self.st["n"], self.pal
        if self.st["gradients"]:
            return f"url(#{which}{k})"
        return {"grass": p["grass"], "sand": p["sand"], "edge": p["edge"]}[which]

    def wave(self, x, y, rnd):
        p = self.pal
        kind = self.st["waves"]
        w = rnd.choice((22, 28, 34))
        if kind == "blob":
            return (f'<ellipse cx="{x:.0f}" cy="{y:.0f}" rx="{w*0.55:.0f}" ry="{w*0.16:.0f}" '
                    f'fill="{p["foam"]}" fill-opacity="0.5"/>')
        if kind == "fat":
            return (f'<path d="M {x:.0f} {y:.0f} q {w/4:.0f} -6 {w/2:.0f} 0 t {w/2:.0f} 0" '
                    f'fill="none" stroke="{p["foam"]}" stroke-opacity="0.85" '
                    f'stroke-width="4" stroke-linecap="round"/>')
        if kind == "thin":
            return (f'<path d="M {x:.0f} {y:.0f} q {w/4:.0f} -4 {w/2:.0f} 0 t {w/2:.0f} 0" '
                    f'fill="none" stroke="{p["foam"]}" stroke-opacity="0.6" '
                    f'stroke-width="1.6" stroke-linecap="round"/>')
        return (f'<path d="M {x:.0f} {y:.0f} q {w/4:.0f} -5 {w/2:.0f} 0 t {w/2:.0f} 0" '
                f'fill="none" stroke="{p["foam"]}" stroke-opacity="0.75" '
                f'stroke-width="2.4" stroke-linecap="round"/>')

    def sample(self, rnd, margin, grass=True):
        for _ in range(160):
            gx, gy = rnd.uniform(-7.5, 7.5), rnd.uniform(-7.5, 7.5)
            ok = self.inside_grass(gx, gy, margin) if grass else self.inside(gx, gy, margin)
            if ok:
                return gx, gy
        return None

    def svg(self, standalone=True):
        st, p, k = self.st, self.pal, self.st["n"]
        rnd = random.Random(st["seed"] + 7)
        out = []
        if standalone:
            out.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" '
                       f'viewBox="0 0 {W} {H}">')
        out.append("<defs>" + self.defs() + "</defs>")

        # --- Meer ---
        out.append(f'<rect width="{W}" height="{H}" fill="url(#sea{k})"/>')
        # Untiefen, an Stränden weiter hinaus
        nsh = self.st.get("facets", 400)
        shallow = [self.pt(TAU * i / nsh, dr=1.5 + 1.9 * self.beach_f(TAU * i / 400), z=0.0)
                   for i in range(nsh)]
        shallow2 = [self.pt(TAU * i / nsh, dr=0.6 + 1.0 * self.beach_f(TAU * i / nsh), z=0.0)
                    for i in range(nsh)]
        out.append(f'<path d="{fmt(shallow)}" fill="{p["sea_lt"]}" fill-opacity="0.55" '
                   f'filter="url(#b18_{k})"/>')
        out.append(f'<path d="{fmt(shallow2)}" fill="{p["sea_lt"]}" fill-opacity="0.75" '
                   f'filter="url(#b8_{k})"/>')
        # Wellen
        for _ in range(30):
            for _try in range(40):
                x, y = rnd.uniform(30, W - 40), rnd.uniform(30, H - 30)
                gx, gy = unproj(x, y)
                if not self.inside(gx, gy, -3.2):
                    out.append(self.wave(x, y, rnd))
                    break
        # Schatten der Insel
        out.append(f'<g transform="translate(16,14)"><path d="{fmt(self.ring(z=0.0))}" '
                   f'fill="#2F6E96" fill-opacity="0.28" filter="url(#b8_{k})"/></g>')

        # --- flache Kante: gestapelte Kopien, Höhe folgt wall_at (0 am Strand) ---
        n = max(6, int(self.wall * S / 1.6))
        for i in range(n, -1, -1):
            t = i / n
            ring = self.ring(n=360, follow=True, z=t)
            if st["gradients"]:
                fill = self.fill("edge")
            else:
                fill = p["edge"] if t < 0.55 else p["edge_dk"]
            if i >= n - 2:
                fill = mix(p["edge_dk"], "#4E7C8C", 0.35)      # nasse Basis
            out.append(f'<path d="{fmt(ring)}" fill="{fill}"/>')
        if st["outline"]:
            col, wd = st["outline"]
            out.append(f'<path d="{fmt(self.ring(n=360, follow=True, z=1.0))}" fill="none" '
                       f'stroke="{col}" stroke-width="{wd}" stroke-linejoin="round"/>')

        # Schaumlinie an der Wasserkante
        out.append(f'<path d="{fmt(self.ring(n=400, follow=True, z=1.0))}" fill="none" '
                   f'stroke="{p["foam"]}" stroke-opacity="0.9" stroke-width="3"/>')
        out.append(f'<path d="{fmt(self.ring(n=400, dr=0.22, follow=True, z=1.0))}" fill="none" '
                   f'stroke="{p["foam"]}" stroke-opacity="0.5" stroke-width="1.8" '
                   f'stroke-dasharray="14 12"/>')

        # --- Sandbank: an den Stränden läuft der Sand ins flache Wasser ---
        nb_ = self.st.get("facets", 400)
        bank = [self.pt(TAU * i / nb_, dr=0.62 * self.beach_f(TAU * i / nb_) ** 1.6, z=0.0)
                for i in range(nb_)]
        out.append(f'<path d="{fmt(bank)}" fill="{p["sand"]}" fill-opacity="0.55"/>')
        out.append(f'<path d="{fmt(bank)}" fill="none" stroke="{p["foam"]}" '
                   f'stroke-opacity="0.7" stroke-width="2.2"/>')
        # --- Oberseite: Sandfläche, darin Gras ---
        out.append(f'<path d="{fmt(self.ring(z=0.0))}" fill="{self.fill("sand")}"/>')
        # feuchter Sandstreifen an den Stränden
        nw_ = self.st.get("facets", 400)
        wet = [self.pt(TAU * i / nw_, dr=-0.12 - 0.30 * self.beach_f(TAU * i / nw_), z=0.0)
               for i in range(nw_)]
        out.append(f'<g clip-path="url(#land{k})"><path d="{fmt(self.ring(z=0.0))}" '
                   f'fill="none" stroke="{p["sand_dk"]}" stroke-opacity="0.55" '
                   f'stroke-width="10"/>')
        out.append(f'<path d="{fmt(wet)}" fill="none" stroke="{p["sand_dk"]}" '
                   f'stroke-opacity="0.35" stroke-width="3"/></g>')
        out.append(f'<path d="{fmt(self.grass_ring())}" fill="{self.fill("grass")}"/>')

        # --- Details auf dem Gras ---
        out.append(f'<g clip-path="url(#gr{k})">')
        det = st["detail"]
        if det == "facet":
            for _ in range(16):
                s_ = self.sample(rnd, 0.6)
                if not s_:
                    continue
                cxp, cyp = proj(*s_)
                m = rnd.randint(3, 5)
                r0 = rnd.uniform(22, 52)
                ph0 = rnd.uniform(0, TAU)
                poly = [(cxp + r0 * rnd.uniform(0.7, 1.25) * math.cos(ph0 + TAU * j / m),
                         cyp + r0 * 0.5 * rnd.uniform(0.7, 1.25) * math.sin(ph0 + TAU * j / m))
                        for j in range(m)]
                col = p["grass_dk"] if rnd.random() < 0.55 else p["grass_lt"]
                out.append(f'<path d="{fmt(poly)}" fill="{col}" fill-opacity="0.5"/>')
        if det in ("blobs", "both", "painterly"):
            cnt = 20 if det == "painterly" else 12
            for _ in range(cnt):
                s_ = self.sample(rnd, 0.5)
                if not s_:
                    continue
                x, y = proj(*s_)
                rx = rnd.uniform(18, 40)
                col = p["grass_dk"] if rnd.random() < 0.6 else p["grass_lt"]
                op = 0.55 if det != "painterly" else 0.45
                out.append(f'<ellipse cx="{x:.0f}" cy="{y:.0f}" rx="{rx:.0f}" '
                           f'ry="{rx*0.5:.0f}" fill="{col}" fill-opacity="{op}"/>')
        if det == "painterly":
            for _ in range(22):
                s_ = self.sample(rnd, 0.4)
                if not s_:
                    continue
                x, y = proj(*s_)
                rx = rnd.uniform(26, 60)
                out.append(f'<ellipse cx="{x:.0f}" cy="{y:.0f}" rx="{rx:.0f}" '
                           f'ry="{rx*0.42:.0f}" fill="{mix(p["grass"], p["grass_dk"], rnd.random())}" '
                           f'fill-opacity="0.4" filter="url(#b8_{k})"/>')
        for _ in range(st["tuft"]):
            s_ = self.sample(rnd, 0.35)
            if not s_:
                continue
            x, y = proj(*s_)
            sc = rnd.uniform(0.8, 1.3)
            out.append(f'<path d="M {x-4*sc:.1f} {y+3:.1f} l {1.6*sc:.1f} {-5*sc:.1f} '
                       f'M {x:.1f} {y+3:.1f} l 0 {-6.5*sc:.1f} '
                       f'M {x+4*sc:.1f} {y+3:.1f} l {-1.6*sc:.1f} {-5*sc:.1f}" '
                       f'stroke="{p["grass_dk"]}" stroke-width="{1.6*sc:.1f}" '
                       f'stroke-linecap="round" fill="none"/>')
        for _ in range(st["dots"]):
            s_ = self.sample(rnd, 0.5)
            if not s_:
                continue
            x, y = proj(*s_)
            col = rnd.choice(("#F6CF4C", "#E9605A", "#FFFFFF"))
            out.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{rnd.uniform(2.2,3.4):.1f}" '
                       f'fill="{col}" fill-opacity="0.9"/>')
        out.append("</g>")

        # Graskante
        if st["outline"]:
            col, wd = st["outline"]
            out.append(f'<path d="{fmt(self.grass_ring())}" fill="none" stroke="{col}" '
                       f'stroke-width="{wd*0.8:.1f}" stroke-linejoin="round"/>')
        else:
            out.append(f'<path d="{fmt(self.grass_ring())}" fill="none" '
                       f'stroke="{p["grass_dk"]}" stroke-opacity="0.5" stroke-width="1.6"/>')

        # Kiesel und Felsbrocken auf dem Sand
        for _ in range(9):
            th = rnd.uniform(0, TAU)
            g = self.ground(th, dr=-self.sand_inset(th) * rnd.uniform(0.25, 0.75))
            x, y = proj(*g)
            r = rnd.uniform(3.5, 7)
            out.append(f'<ellipse cx="{x:.0f}" cy="{y:.0f}" rx="{r:.1f}" ry="{r*0.6:.1f}" '
                       f'fill="#BDBAB2" stroke="#8B877E" stroke-width="1.1"/>')
        for _ in range(4):
            th = rnd.uniform(-1.6, 1.0)
            x, y = self.pt(th, dr=0.5, z=0.0)
            r = rnd.uniform(8, 13)
            out.append(f'<ellipse cx="{x:.0f}" cy="{y-2:.0f}" rx="{r:.0f}" ry="{r*0.6:.0f}" '
                       f'fill="#ACA396" stroke="#726858" stroke-width="1.5"/>')

        if standalone:
            out.append(self.caption(0, 0))
            out.append("</svg>")
        return "\n".join(out)

    def caption(self, tx, ty):
        st = self.st
        beach = {1: "1 Strand", 2: "2 Strände", 3: "3 Strände"}[st["beaches"]]
        f = "Avenir Next, Helvetica Neue, Arial"
        return (f'<text x="{tx+34}" y="{ty+62}" font-family="{f}" font-size="34" '
                f'font-weight="700" fill="#2F3A46">{st["n"]} · {st["name"]}</text>'
                f'<text x="{tx+34}" y="{ty+94}" font-family="{f}" font-size="20" '
                f'font-weight="500" fill="#33404C" fill-opacity="0.85">'
                f'{st["note"]} · {beach}</text>')


def main():
    islands = [Island(st) for st in STYLES]
    for isl in islands:
        with open(os.path.join(OUT, f"style_{isl.st['n']}.svg"), "w") as fh:
            fh.write(isl.svg())
    cols, tile = 3, W
    rows = (len(islands) + cols - 1) // cols
    sw = cols * tile
    sh = sw                                   # quadratisch, sonst croppt qlmanage
    oy = (sh - rows * tile) // 2
    sheet = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{sw}" height="{sh}" '
             f'viewBox="0 0 {sw} {sh}">',
             f'<rect width="{sw}" height="{sh}" fill="#DCE7EE"/>']
    for i, isl in enumerate(islands):
        tx, ty = (i % cols) * tile, oy + (i // cols) * tile
        sheet.append(f'<g transform="translate({tx},{ty})">' + isl.svg(standalone=False) + "</g>")
        sheet.append(isl.caption(tx, ty))
    sheet.append("</svg>")
    with open(os.path.join(OUT, "sheet.svg"), "w") as fh:
        fh.write("\n".join(sheet))
    print("svg ok:", len(islands), "Stile")


if __name__ == "__main__":
    main()
