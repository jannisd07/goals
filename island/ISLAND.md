# ISLAND.md — Die Insel: Design, System, Pipeline, Entscheidungen, Log

> **Das ist die eine Datei für alles rund um die Insel.** Jede Entscheidung,
> jede Änderung am Stil, jeder Pipeline-Schritt wird hier ergänzt. Ältere
> Einzeldokumente (ART_BIBLE, PROGRESSION, SETUP) sind hier aufgegangen.
> Stand: **2026-09-07, 13:10**. Änderungen unten im Changelog (Abschnitt 14).

---

## 0. Kurzfassung

- Das Sternen-Grove der App wird durch eine **wachsende, individuelle Insel**
  ersetzt. UI-Label ist bereits „Island".
- Look: **Comic-Insel im Meer**, schräge Vogelperspektive (echte Isometrie),
  lappige natürliche Küste, dünner Sandrand, warme geschichtete Klippe.
  Referenz: `concepts/island-directions-abcd.png`, Richtung **A** gewählt.
- Assets werden in **Blender** erzeugt und als transparente Sprites
  vorgerendert; die App setzt daraus jede Insel zusammen. Kein Echtzeit-3D.
- Progression: **1 Ausbaupunkt pro Fokusminute**, freie Wahl nach der Session,
  Insel wächst mit Anzahl und Grundfläche der Objekte, Streaks schalten
  Besonderes frei.
- Aktueller Schritt: Insel-Look per Mockups festlegen (`mockups/`), danach
  Master-Szene mit Baum, Busch, Haus, Stein, Blume in Blender.

---

## 1. Entscheidungslog

Alle Entscheidungen von Jannis, chronologisch. Codex und Claude Code arbeiten am
selben Repo; Entscheidungen aus beiden Chats gelten.

### 2026-09-07 vormittags, Codex-Chat

- **Stil:** cozy, comic-artig, hochwertig, „Blick von oben seitlich" (Vogel-
  perspektive von der Seite). Kamerawinkel 45° um die Insel, ca. 35,3° über dem
  Boden = echte Isometrie. **„Kamerawinkel perfekt."**
- **„Grove" heißt jetzt Insel.** In der englischen UI: „Island".
- **Art Bible v0.1 von Codex** akzeptiert („alles passt"): orthografisch,
  klare Grundkörper mit abgerundeten Kanten und kontrollierter Asymmetrie,
  matte Materialien, große weiche Hauptlichtquelle links oben, kurze weiche
  Schatten, wenige große Details, keine schwarzen Umrisse, transparente
  Renders. Größenlogik: 1 Zelle = 1 Blender-Einheit; Bäume 1 Zelle, kleine
  Häuser 2×2, besondere Gebäude 3×3; ausgewachsener Baum ≈ kleines Haus.
- **Master-Szene:** ca. 6×6 Zellen, Insel + Baum + Busch + Haus + Stein + Blume.
  Drei Prüfungen vor dem Einfrieren: (1) Gesamtszene überzeugt bei ~360 px
  Breite, (2) einzeln exportierte Objekte ergeben wieder dieselbe Szene,
  (3) zwei aneinanderliegende Landstücke zeigen keine Nähte.
- **Progression:** Nutzer wählt nach der Session selbst (Pflanze, Gebäude,
  Deko, Ansparen). **Die Insel wächst mit der Anzahl der Sachen darauf.**
  Insel **nicht rund, nicht viereckig, natürliche Form.**
- **Ausbaueinheit = 1 Fokusminute.** Pausen zählen nicht. Kostenidee:
  10–20 min Blumen/kleine Deko, 25–50 min Busch/Setzling/Wachstum,
  60–120 min größeres Objekt/Bauabschnitt, mehrere Stunden Haus/Gebäude.
  Nach der Session höchstens drei passende Möglichkeiten plus Ansparen; wer
  nichts wählt, lässt ein vorher gewähltes Projekt automatisch voranbringen.
- **Gesamtfokuszeit schaltet Phasen frei** (0–2 h Startinsel, 2–10 h Garten
  und Hütte, 10–30 h Siedlung, 30–80 h Dorf mit Gemeinschaftsgebäuden,
  ab 80 h Stadt mit Vierteln). Die Insel füllt sich nicht automatisch.
- **Streaks** belohnen mit besonderen Varianten (3 Tage Blumen, 7 Tage
  Baumvariante, später Gewächshaus oder Baustil). Verdientes bleibt.
- **Werkzeuge:** Jannis will maximale Designqualität; Skepsis gegenüber blind
  erzeugten Python-Skripten. Entscheidung: Blender mit MCP-Anbindung für
  interaktive Gestaltung plus gespeicherte Skripte für identische Serien-
  Exporte. Figma nur für Auswahlmenüs/App-Einbettung.
- **Vorlagen (CC0):** KayKit Forest Nature (fehlt noch), KayKit Medieval
  Hexagon, Kenney Fantasy Town, Quaternius Simple Nature. Favorit KayKit;
  mittelalterliche Details reduzieren, Hexagon-Bodenplatten nicht übernehmen.
- **Inselform A** aus der Konzepttafel gewählt: flache grüne Insel, natürliche
  Buchten, schmaler Sandrand, viel Baufläche. D als spätere Ausbaustufe mit
  Bucht denkbar.
- Codex hat `insel-vorlagen.zip`, `MCP_CONNECT.md`, `concepts/`,
  `references/` angelegt und Grove→„Insel" in drei UI-Dateien geändert.

### 2026-09-07 mittags, Claude-Code-Session

- Blender 5.2.1 LTS installiert, MCP-Add-on läuft (Port 9876), Blender als
  MCP-Server in Claude Code registriert.
- Pipeline `blender/islandlib/` gebaut, vier Inselformen headless gerendert,
  Insel A live in Blender aufgebaut. **Jannis: „Inseln sehen SCHLECHT aus.
  Detaillierter, nicht nur mit Kreisen, mit Meer, wie ein richtiger Comic."**
  Und: **erst Mockups ohne Blender.**
- Codex' deutsches „Insel" in der englischen UI wurde zu „Island" korrigiert
  (Typecheck grün). Falls Jannis das deutsche Wort will: rückgängig machen.
- Diese Datei ersetzt die drei Einzeldokumente.
- Jannis (13:00): **mehr Stilvarianz**, und **keine hohen Küsten** — flache Insel
  mit **1, 2 oder 3 Sandstränden**. Mockups zeigen jetzt sechs Zeichenstile
  statt vier Formen.

---

## 2. Visueller Stil

**Comic-Insel im Meer.** Wie ein hochwertiges Mobile Game: klare, leicht
überzeichnete Formen, satte aber nicht grelle Farben, weiche Schatten, wenige
große Details, keine schwarzen Umrisse, keine Texturen im Sinne von Fotos.

Merkmale, an denen jedes Asset erkennbar sein muss:

1. **Rundung statt Facette.** Sichtbare Bevels, Kugelwolken als Kronen,
   abgerundete Dächer. Steine dürfen als einziges Element facettiert sein.
2. **Toy-Proportionen.** Gebäude relativ zu Bäumen klein, Dächer groß, Stämme
   dick, Türen und Fenster größer als real.
3. **Flache Materialfarbe, Tiefe durch Licht.** Oben hell, links mittel,
   rechts im kühlen Fülllicht.
4. **Weiche, kühle Schatten**, halbtransparent, nie schwarz, kurz gehalten,
   damit sie nicht über Nachbarzellen fallen.
5. **Ruhe.** Maximal drei Sekundärdetails pro Objekt. Silhouette bei 40 pt
   Höhe lesbar.

Die **Insel selbst** (Referenz Konzept A und `mockups/`): Grasplateau mit
leichtem Farbverlauf und Flecken, lappige Küste aus rundlichen Vorsprüngen und
Buchten, schmaler heller Sandrand, darunter eine warm-orangene Klippe mit
1–3 Schichtlinien und feinen Rissen, nasse dunkle Basis, weiße Schaumlinie,
helle Untiefen im Meer, Schatten der Insel im Wasser, vereinzelte Wellenmarken.

### Stilvarianten zur Auswahl (`mockups/style_1..6`)

| # | Stil | Merkmal | Strände |
|---:|---|---|---:|
| 1 | Soft Gradient | weiche Verläufe, keine Outline | 1 |
| 2 | Clean Outline | klare dunkle Kontur, Zeichentrick | 2 |
| 3 | Low Poly | facettierte Küste, reine Flächen | 3 |
| 4 | Painterly | viele Grüntöne, unruhige Flächen | 1 |
| 5 | Chunky Toy | kräftig, dicke Sandkante, Outline | 2 |
| 6 | Airy Pastel | hell, entsättigt, ruhig | 3 |

Noch offen: welcher Stil gewinnt. Die Strandanzahl ist unabhängig vom Stil und
wird später aus der Inselgröße abgeleitet.

Referenzen: Tiny Glade (Formen, Dächer), Townscaper (Ruhe, Wasserkante),
Alba (Vegetation), Monument Valley (Kamera), Islanders (Insel als Bühne).

Verworfen: facettiertes Low-Poly (wirkt 2015), Voxel (zu kindisch),
handgemalt 2D (nicht per Skript konsistent), reine Kreis-Zellkörper ohne
Details (erster Blender-Versuch, „sieht schlecht aus").

---

## 3. Art Bible (Werte, nach Abnahme eingefroren)

### 3.1 Kamera und Maßstab

| Parameter | Wert |
|---|---:|
| Projektion | Orthographisch |
| Winkel | True Isometric: Rotation X 54.736°, Y 0°, Z 45° |
| Kameraposition | Richtung (+X, −Y, +Z) vom Ziel |
| Bildschirm | +X = rechts unten, +Y = rechts oben; Tiefe für Sortierung = x + y |
| Zelle | 1 m = 1 Zelle; Raute √2 m breit, 0.8165 m hoch (1 : 0.577) |
| Pixel | `PX_PER_M = 128` beim Rendern (@2x), 64 pt pro Meter bei Zoom 1.0 |

Rahmenklassen (Bodenanker bei 25 % von unten, Ankerpixel steht im Manifest):
S 2×3 m (256×384 px), M 3×4 m, L 4×5 m, XL dynamisch für Inselbasen.

### 3.2 Palette (sRGB, in `blender/islandlib/style.py`)

| Token | Hex | Verwendung |
|---|---|---|
| `grass` | `#A3CF4F` | Inseloberfläche |
| `sand` | `#EDD9A6` | Sandrand, Wege, Strand |
| `earth` | `#A56A3B` | Erdband |
| `cliff_light` / `cliff` / `cliff_deep` | `#D9A063` / `#BE7C43` / `#8F5A2F` | Klippe oben / Mitte / Basis |
| `canopy_a` / `canopy_b` | `#4F9E4B` / `#7EC15A` | Kronen, Büsche |
| `canopy_blossom` / `canopy_autumn` | `#F1A8BC` / `#E39A4F` | Streak-Varianten |
| `stone` / `stone_dark` | `#B9BCBD` / `#8C8F92` | Steine, Fenster, Schornstein |
| `wood` / `wood_dark` | `#B9834F` / `#8A5B33` | Stämme, Zäune, Balken |
| `wall_cream` / `wall_warm` | `#F4E9D3` / `#EBD8B6` | Hauswände |
| `roof_terracotta` / `roof_slate` | `#D2694A` / `#5F739F` | Dächer |
| `flower_yellow` / `flower_coral` | `#F6CF4C` / `#E9605A` | Blumen |
| `detail_accent` | `#415DCB` | Nur winzige Details (Türen, Fahnen) |
| `water` / `sea_light` | `#7FB4D6` / `#B9E3EE` | Meer und Untiefen (Mockups) |
| `ui_bg` | `#E0E5EC` | App-Hintergrund, nur für Vorschau |

Regeln: max. 24 Grundfarben, neue Farbe nur als benanntes Token, kein reines
Weiß/Schwarz auf Materialien, `#415DCB` nie als Fläche.

### 3.3 Material, Licht, Render (Blender)

- Principled BSDF, Roughness 0.9, Specular 0.3, keine Texturen. TopLight-Trick:
  Oberseiten um 12 % zu Weiß gemischt.
- Sonne aus oben links (Lichtrichtung (1, 1, −1.5)), Stärke 2.6, Farbe
  `#FFF6E8`, Winkel 4°. Welt `#DCE3EC` bei 0.55. Ergebnis: Oberseiten erreichen
  ~100 % ihrer Palettenfarbe (gemessen).
- Cycles auf Metal, 128 Samples, OpenImageDenoise, Film transparent, View
  Transform **Standard** (Palette bleibt 1:1), PNG 16 bit → WebP.
- Schatten per Shadow Catcher in jedes Sprite gebacken.
- Sichtbarkeitsumschaltung darf nie Lichter/Kamera ausblenden (Bug vom
  2026-09-07, behoben).

### 3.4 Formen und Proportionen (Meter)

| Objekt | Footprint | Höhe |
|---|---|---:|
| Gras / Blume | 1×1 | 0.15–0.35 |
| Stein klein / groß | 1×1 | 0.25 / 0.6 |
| Busch s1–s3 | 1×1 | 0.45 / 0.65 / 0.75 |
| Baum s1–s5 | 1×1 | 0.35 / 1.0 / 1.8 / 2.4 / 3.0 |
| Haus s1–s6 | 1×1 | 0.15 / 1.0 / 1.2 / 1.4 / 1.5 / 1.7 |
| Haus s7–s10 | 2×2 | 2.4 / 2.7 / 3.0 / 3.4 |
| Windmühle / Leuchtturm / Kapelle / Markt | 2×2 / 1×1 / 2×2 / 1×2 | 3.5 / 4.0 / 3.0 / 1.6 |
| Brunnen / Laterne / Bank, Zaun, Wegweiser | 1×1 | 1.1 / 1.2 / 0.5–1.0 |

Bevel 0.03–0.05 m, Insel-Kante 0.08 m, Toy-Maßstab (Tür 0.45 m hoch).

### 3.5 Insel-Basis

**Flach, keine Klippe** (Entscheidung 2026-09-07): Grasplateau (z = 0) → schmaler
Sandsaum (ca. 6 cm) → niedrige Erdkante von nur 0.28–0.50 m → Wasserlinie.
An **1 bis 3 Stellen** ein echter **Strand**: dort zieht sich das Gras 1.2–2.0 m
zurück, die Kante läuft auf null aus und der Sand setzt sich als flache Sandbank
ins Wasser fort. Davor helleres Flachwasser und eine Schaumlinie.
Kontur aus der Zellmaske: weich verformter Umriss mit Harmonischen plus
Lappen-Bumps, Voxel-Remesh + Glättung in Blender. Meer als eigene Ebene
(siehe 9).

### 3.6 Verboten

Andere Kamera/Licht/Palette pro Asset, Fototexturen, Outlines, schwarze
Schatten, Emojis, Text, Gesichter, perspektivische Kamera, Kreis-/Quadrat-/
Hexagon-Inseln, Assets die nicht aus einem Skript reproduzierbar sind.

---

## 4. Asset-Struktur

Namensschema: `{category}_{variant:02}[_s{stage}][.{biome}].webp`, z. B.
`tree_01_s3.webp`, `house_02_s7.webp`, `path_straight.webp`,
`island_base_l04.webp`.

| Kategorie | Präfix | Footprint | Stufen | Varianten v1 |
|---|---|---|---|---|
| Grasbüschel | `grass` | 1×1 | 1 | 3 |
| Blume | `flower` | 1×1 | 2 | 4 |
| Stein | `rock` | 1×1 | 1 | 4 |
| Busch | `bush` | 1×1 | 3 | 3 |
| Baum | `tree` | 1×1 | 5 | 3 + Blüte + Herbst |
| Weg | `path` | 1×1 | 1 | gerade, Ecke, T, Ende |
| Deko klein | `deco` | 1×1 | 1 | Zaun, Bank, Wegweiser, Fass |
| Deko besonders | `special` | 1×1 | 1 | Brunnen, Laterne, Statue |
| Haus | `house` | 1×1 bis s6, 2×2 ab s7 | 10 | 3 |
| Civic | `civic` | bis 2×3 | 1 | Windmühle, Leuchtturm, Kapelle, Markt |
| Inselbasis | `island_base` | Raster | 16 Stufen | 1 Formfamilie (A) |
| Annex | `annex` | eigenes Raster | 1 | Leuchtturm-Fels, Winter-Islet |

Manifest `manifest/island_manifest.json` (generiert, nie von Hand): Datei,
Rahmen, Breite/Höhe, Ankerpixel, Footprint, Kategorie, Stufe, Kosten,
Freischaltung, `style_version`.

### Wachstumsstufen

Blume 2 (Knospe → Blüte), Busch 3 (klein → voll → blühend), Baum 5
(Sprössling → jung → Baum → groß → Grand Tree), Haus 10 (Fundament → kleine
Hütte → Hütte → kleines Haus → Haus mit Details → größeres Haus → zweistöckig
2×2 → Wohnhaus → hochwertig → Endstufe mit Turm). Der Sprung s6→s7 braucht drei
freie Nachbarzellen, sonst wird ein anderes Upgrade angeboten.

---

## 5. Progression

### 5.1 Fokusminuten → Ausbaupunkte

1 Punkt pro fokussierter Minute, Pausen zählen nicht, unter 5 Minuten nichts.

| Objekt | Punkte | Objekt | Punkte |
|---|---:|---|---:|
| Grasbüschel, Blume | 10 | Wegstück | 10 |
| Stein klein / groß | 15 / 40 | Kleine Deko | 15 |
| Busch / Setzling | 25 | Baumstufe +1 | 20 |
| Haus-Fundament | 60 | Hausstufe +1 | 60 |
| Besondere Deko | 90 | Civic-Gebäude | 240 |

### 5.2 Wahl nach der Session

Nach dem Rating-Sheet: „Your island grew" mit höchstens **drei bezahlbaren
Optionen** plus „Save for …". Optionen deterministisch aus Session-ID,
Guthaben und Inselzustand; mindestens eine Option ist ein Upgrade, sobald ein
Objekt existiert. Schließen verliert nichts. Auto-Modus baut das gemerkte
Projekt weiter.

### 5.3 Platzierung

Nutzer wählt **was**, nie **wo** (v1). Heuristik mit Session-Seed: Häuser innen
und nahe Wegen, Bäume/Steine am Rand, Blumen in Lücken, Wege verbinden Häuser
mit der Mitte, Civic auf die freie Zelle mit den meisten Nachbarn.

### 5.4 Gesamtfokuszeit → Freischaltungen

| Gesamt-Fokus | Freigeschaltet |
|---:|---|
| 0–2 h | Gras, Blumen, Steine, Büsche, Setzlinge |
| ab 2 h | Hütten (Haus bis s3), Wege, kleine Deko |
| ab 10 h | Häuser bis s6, große Steine |
| ab 30 h | Häuser bis s10, Gemeinschaftsgebäude |
| ab 80 h | Civic-Gebäude, Viertel-Deko |

### 5.5 Streaks → Unlocks (bleiben nach Riss erhalten, Basis `longest`)

3 Tage Blütenbaum · 7 Tage Brunnen, Laterne · 14 Tage Windmühle · 21 Tage
Herbstpalette · 30 Tage Leuchtturm + Annex „Lighthouse Rock" · 60 Tage
Winter-Annex · 100 Tage Monument. Kein Punkte-Multiplikator.

---

## 6. Inselwachstum

Landbedarf pro Objekt: Blume/Busch/Baum 1, Haus 1×1 = 3, Haus 2×2 = 6,
Civic 8. `Zellen_soll = 9 + Σ Landbedarf · 1.3`, immer mindestens 25 % frei.
Die Basis springt auf die kleinste Stufe, deren Zellenzahl das Soll erreicht;
neues Land erscheint mit 800 ms Animation, Objekte bleiben stehen, weil jede
Stufe die vorherige enthält.

**Feste natürliche Formfamilie statt Kacheln.** Iso-Kacheln mit Kantenstücken
wurden verworfen (Nähte, Rautenkontur, Dutzende Küstenvarianten). Stattdessen:
16 Basis-Bilder von 9 bis ca. 120 Zellen aus der Formfamilie A
(`builders.mask_from_count`), alle Nutzer teilen die Landform, Individualität
kommt aus den Objekten. Raster 18×18, Ursprung Mitte. Bildschirmposition:
`sx = (x + y) · 45.25 pt`, `sy = (x − y) · 26.1 pt` bei Zoom 1.0.

---

## 7. Datenmodell und Server

Neue Tabelle `island_items`: `id`, `user_id`, `asset_key`, `stage`, `biome`,
`cell_x`, `cell_y`, `island` (`main` | `annex_*`), `source_session_id`,
Zeitstempel. Unique auf `(user_id, island, cell_x, cell_y)`. Punktestand wird
aus Sessions minus Käufen berechnet (Käufe tragen `cost`).

Bestehende Spalten: `sessions.garden_rendered` = Belohnung eingelöst,
`sessions.growth_stage` = gutgeschriebene Punkte. RPCs (`authenticated`,
SECURITY DEFINER): `claim_island_reward(session_id, action, asset_key,
target_item_id)` prüft Besitz, Session beendet, Guthaben, Freischaltung, Zelle;
`backfill_island(user_id)` spielt alte Sessions im Auto-Modus ab. Logik in
`src/lib/island/`, gespiegelt in SQL, Domain-Tests in `npm run test:domain`.

---

## 8. App-Rendering

Ein `View` pro Insel, absolut positionierte `expo-image`-Views (WebP), Sortierung
nach `x + y`. Grove-Screen: volle Insel, Zoom 0.35–1.6, Pan, Tap zeigt Objekt
und Session. Home-Vorschau 280×116 pt: feste Skalierung. Neues Objekt 400 ms
Scale/Opacity, Level-Up 800 ms Crossfade, Reduced Motion sofort. Bundle ca.
10–12 MB. Fallback bei Ruckeln: statische Insel per `react-native-view-shot`
einfrieren.

---

## 9. Meer und Hintergrund

Die Mockups zeigen die Insel **im Meer**: Meer-Verlauf, helle Untiefen um die
Basis, Schatten der Insel im Wasser, Schaumlinie, Wellenmarken. In der App wird
das Meer als eigene Ebene unter der Insel-Sprite gezeichnet (Wasserfläche im
Well der Karte, Untiefen-Halo und Schatten als Sprites mit Alpha, Wellenmarken
als kleine wiederholte Sprites). Die Inselbasis selbst bleibt ein transparentes
Sprite, damit Wasser und Insel unabhängig animiert werden können.

---

## 10. Pipeline und Werkzeuge

| Weg | Wofür | Status |
|---|---|---|
| Mockups `mockups/make_mockups.py` (SVG, kein Blender) | Look festlegen, schnelle Iteration | aktiv |
| Headless `Blender --background --python …` | Serien-Renders, Manifest | läuft |
| Live `python3 blender/live.py exec <datei.py>` | Code im offenen Blender, Viewport-Screenshot | läuft, braucht „MCP for Blender" → „Start MCP Server" (Port 9876) |
| MCP-Tools in Claude Code | wie Live, als Tools | registriert (`claude mcp add --scope user blender -- uvx blender-mcp`), ab nächster Session |

Vor jeder Blender-Sitzung: Blender öffnen, `N`, Tab „MCP for Blender", „Start
MCP Server". Ohne Server nur Headless.

Ordner:

```text
island/
  ISLAND.md                 diese Datei
  MCP_CONNECT.md            Codex-Anleitung fürs Add-on (historisch)
  concepts/                 Konzepttafel A–D, SELECTED_DIRECTION.md
  references/               CC0-Vorlagen: Kenney, KayKit Hexagon, Quaternius
  insel-vorlagen.zip        dieselben Vorlagen gebündelt (Codex)
  mockups/                  make_mockups.py, island_A–D.svg/.png, sheet
  blender/
    islandlib/              style, materials, scene, geo, builders, export
    build_islands.py        vier Inselformen headless
    live.py, live_island_a.py   Live-Draht zum offenen Blender
    out/                    Renders und .blend (gitignored)
assets/island/              finale WebPs (später)
```

Warum vorgerendert statt Echtzeit-3D: Expo-3D ist mit RN 0.83 fragil, Cycles
sieht besser aus, Bilder kosten keinen Akku, Konsistenz ist trivial. Echtzeit
erst bei freiem Drehen, Tag/Nacht oder laufenden Figuren; die Blender-Modelle
bleiben die Quelle (glTF-Export möglich).

---

## 11. Vorlagen (CC0)

| Paket | Inhalt | Status |
|---|---|---|
| KayKit Forest Nature | Bäume, Büsche, Gras, Steine | fehlt noch (itch.io lieferte keine Datei) |
| KayKit Medieval Hexagon | Häuser, Markt, Windmühle, Brunnen | in `references/` |
| Kenney Fantasy Town | 160 Stadt-Dateien | in `references/` |
| Quaternius Simple Nature | 13 Blender-Modelle | in `references/` |

Plan: erst eigene Geometrie in der Master-Szene, dann Vergleich mit KayKit;
mittelalterliche Details reduzieren, Farben und Proportionen anpassen.

---

## 12. Offene Entscheidungen

Standardannahme in Klammern, ohne Rückmeldung wird so gebaut.

1. Inselform final: A (ja), B/C/D als spätere Annex- oder Ausbau-Formen.
2. Meer in der App immer sichtbar oder nur im Grove-Screen? (immer, auch in der
   Home-Vorschau, gedämpft.)
3. Objekte später verschieben? (nein in v1.)
4. Auto-Check-In-Sessions zählen wie Fokus-Sessions? (ja.)
5. „Island" oder deutsch „Insel" in der englischen UI? (Island.)
6. PX_PER_M 128 oder 160? (128, Entscheidung nach der Master-Szene.)

---

## 13. Nächste Schritte

1. Mockups A–D abnehmen, Look der Insel einfrieren.
2. Blender-Insel an die Mockups angleichen (Lappen, Schichten, Sand, Basis).
3. Master-Szene: Baum, Busch, Haus, Stein, Blume auf Insel A; Nahtprobe.
4. Abnahme → `STYLE_VERSION = "1.0"`.
5. Library rendern, Manifest, `island_items` + RPCs, App-Rendering, Backfill.

---

## 14. Changelog

- **2026-09-07 11:40–12:05 (Codex):** Stil, Kamera, Progression, Vorlagen,
  Konzepttafel, Richtung A, Grove→Insel.
- **2026-09-07 12:10–12:35 (Claude Code):** Pipeline `islandlib`, vier
  Inselformen headless, Sonnen-Bug behoben, Insel A live in Blender, MCP
  registriert, UI „Island".
- **2026-09-07 12:40 (Claude Code):** Jannis: Blender-Inseln zu schlecht, erst
  Comic-Mockups mit Meer ohne Blender. SVG-Mockup-Generator `mockups/`
  gebaut, Sheet A–D. Diese Datei angelegt, Einzeldokumente aufgelöst.
- **2026-09-07 13:10 (Claude Code):** Jannis will mehr Stilvarianz und flache
  Küsten mit 1–3 Sandstränden. Mockup-Generator umgebaut: sechs Zeichenstile,
  Kantenhöhe 0.28–0.50 m, Strände als echte Buchten mit Sandbank im Wasser,
  Formvarianz pro Stil. Ausgabe `mockups/style_1..6` + quadratisches Sheet
  (nicht-quadratische Sheets werden von `qlmanage` beschnitten).
