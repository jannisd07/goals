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
- Progression: **eine Belohnung pro Session, keine Punkte** (2026-09-10). Ihre
  Größe misst die Session an der üblichen Länge desselben Ziels; sie fügt ein
  neues Objekt hinzu oder lässt ein vorhandenes wachsen (`WACHSTUM.md` §14.3).
  Sonderobjekte gibt es nur über die Rewards-Roadmap.
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

### 2026-09-10, Claude-Code-Session (Session-Belohnung)

- **Was wächst:** Vor einer Fokus-Session wählt der Nutzer Pflanzen, Gebäude,
  Wasser oder Strand. Nach Auto Check-In fragt der Screen hinter der
  Notification danach und zeigt die Objekte in der Größe, die wirklich
  hinzukommt.
- **Sonderobjekte nur über die Rewards-Roadmap**, nie als Session-Belohnung.
  Die Idee „Sonder in etwa jeder fünften Session wählbar“ ist verworfen.
- **Neu hinzufügen oder wachsen lassen:** Die Belohnung fügt ein Objekt hinzu,
  das noch nicht auf der Insel steht, oder lässt ein vorhandenes wachsen. Die
  Größe der Session bestimmt, wie weit.
- **Keine Punkte:** Jede Session bringt genau eine Belohnung. Ihre Größe
  (5 Stufen) ist persönlich: 2 h nach üblich 1 h ist groß, 2 h nach üblich 3 h
  klein. Ohne Verlauf mittel.
- **Speicher** vorerst nur auf dem Gerät. **Look** des Fokus-Screens: Paper,
  Variante B.

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

> **Überholt (2026-09-10):** Kamera ist jetzt **Pixel-Iso 2:1** (ca. 26,6°), 1 m =
> 16 × 8 Art-Pixel, Kamera nur ganzzahlig vergrößert. Siehe `WACHSTUM.md` §15. Der
> ChatGPT-Prompt v2 unten ist damit veraltet (True Iso, gemalt).

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

> **Ersetzt (2026-09-10, Jannis):** Es gibt keine Ausbaupunkte mehr. Jede
> beendete Session ab 5 Minuten bringt genau eine Belohnung, deren Größe aus
> dem Vergleich mit der üblichen Session-Länge desselben Ziels kommt. Sie fügt
> ein Objekt neu hinzu oder lässt ein vorhandenes wachsen (`WACHSTUM.md` §14.3).
> §5.1 und §5.2 sind nur noch Historie.

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

> **Ersetzt durch `WACHSTUM.md` (2026-09-10):** 3 Inselstufen + Skalierung statt
> 16 Basisbilder, 0,5-m-Belegungsraster, Zonenmaske, Plausibilitätscheck. Der
> Text unten ist nur noch Historie.

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

> **Historisch — so gebaut ist es nicht.** Es gibt weder `island_items` noch die
> hier beschriebenen RPCs oder einen Punktestand; Punkte wurden am 2026-09-10
> ausdrücklich verworfen. Die Insel liegt bis auf Weiteres nur auf dem Gerät, in
> `src/store/islandSlice.ts` (`islandObjectsByUser`, `islandSpotsByUser`). Der
> Abschnitt bleibt als Vorlage stehen, falls die Insel später doch auf den Server
> zieht.

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

> **Ersetzt durch `WACHSTUM.md` §5 (2026-09-10):** 5–6 Hintergrundstufen mit
> geometrischer Zoomleiter, Heranzoomen des ferneren Bilds und Crossfade. Der
> Text unten ist nur noch Historie.

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

- **2026-09-10 (Claude Code): Leere flache Insel per Higgsfield, abgelehnt.**
  Auftrag: transparente Insel im festgelegten Iso-Winkel, Comic, minimalistisch,
  min. 1 Strand, komplett flach, nichts drauf, nur Gras mit fast keiner Textur;
  Home sollte das Meerbild ohne Insel plus diese Insel bekommen.
  - Higgsfield-Free-Plan (10 Credits): alle Modelle außer **Z Image** verlangen
    Basic („Requires basic plan or higher“), auch GPT Image 2.5 mit echtem
    `background: transparent`. Z Image kostet 0,25 Credits pro Bild, nimmt nur etwa
    ein bis zwei Jobs gleichzeitig an (sonst 429).
  - Z Image ignoriert „isometric“ bei flachem Vektorstil. Lösung ohne Credits:
    von oben generieren, weißen Hintergrund lokal ausschneiden, dann exakt
    projizieren (45° drehen, Höhe × sin 35,264° = 0,577). Für eine Insel ohne
    Höhe ist das mathematisch die echte Isometrie. Skript:
    Scratchpad `islands/iso.py` (Ausschnitt, Projektion, Vorschau auf `ocean-bg.png`).
  - 14 Bilder für 3,5 Credits, 6 Kandidaten auf dem Meer gezeigt.
  - **Jannis: „keine davon … viel zu simpel.“** Das minimalistische Briefing
    reicht also nicht; die Richtung für „mehr“ wird gerade geklärt.
  - Richtung danach (Jannis): **Mobile-Game-Comic** wie Boom Beach und Clash
    of Clans. Klare Konturen, 2–3 Grüntöne, Strand mit Wellenlinie und Schaum,
    trotzdem flach und leer. Weiter mit Z Image und den restlichen 6,5 Credits.
    Hintergrund jetzt Vollton-Magenta statt Weiß, damit weißer Schaum beim
    Ausschneiden erhalten bleibt (`islands/key.py`).
  - Game-Comic-Runde mit Z Image, 8 Bilder für 2 Credits, danach 4 Credits übrig:
    - Sobald „Boom Beach / Clash of Clans“ im Prompt steht, setzt Z Image Bäume,
      Büsche und Klippen dazu, auch mit ausdrücklichem „no trees“. „Bay“ wird
      zur inneren Lagune. „Top-down“ gilt nur ohne Game-Stichworte zuverlässig.
    - Positiv beschreiben hilft: „open empty lawn“ statt „no trees“. z24 wurde so
      erstmals leer, malte aber eine Wasserfläche und eine erhöhte Kante.
    - Magenta rendert Z Image als Rosa. Stabil ausschneiden geht über den Farbton:
      m = min(R−G, B−G), die Schwellen relativ zum Hintergrundwert
      (`islands/key.py`). Gemaltes Wasser zusätzlich über B − max(R,G) entfernen.
    - Uferlinie lokal aus der Alpha-Maske (`islands/shore.py`): Flachwasser-Schein,
      Schaumlinie und Comic-Kontur, damit sie immer zur Kontur passt.
    - Kandidaten: G z27, H z24fix, I z28 (kleine Grasbüschel), J z22 (reichster
      Look, aber Büsche und Klippe) als Referenz.
  - Jannis zu G/I/J: **„Keine, weiter generieren“**, ohne weitere Hinweise.
    Meine Deutung: A–F waren zu simpel, G und I haben realistisches Fell-Gras und
    eine dicke Kekskante. Nächster Versuch dazwischen: echte Cel-Shading-Optik
    (flache Farbe in 3 Grüntönen, Lichtflächen, kräftige Kontur), weiter flach, leer,
    mit Strand, von oben generiert und lokal projiziert. Dazu ein stärkerer lokaler
    Game-Look (`islands/shore2.py`): dicke Kontur, breite Schaumlinie,
    Flachwasser-Schein, Licht von oben links.
  - **Funktionierendes Rezept (z31, 2026-09-10):** Z Image, 1:1, Prompt:
    „Flat vector illustration of a small empty island shaped like an organic blob
    with gentle lobes, seen from a high isometric angle so the island looks wide
    and foreshortened, like an isometric map tile. Paper-thin, lying flat. The top
    is an open empty lawn in cel-shaded flat paint with three green tones: a darker
    green band along the edge, a mid green fill and a few soft light green
    highlight shapes, bold clean dark outline, no fine texture. A thin golden sand
    rim that widens into one broad flat sandy beach at the front. Clean cartoon
    game illustration, vibrant saturated colors, crisp shapes. The whole island
    fully visible and centered with a wide empty margin, on a flat solid magenta
    background, nothing else in the image."
    Ergebnis: nativ isometrisch, Cel-Shading mit Lichtflecken, kräftige Kontur,
    geschichteter Strand, leer. Pipeline: Farbton-Key gegen Magenta, Wasser raus,
    größte Fläche behalten, dann `shore2.py` (Kontur, Schaum, Flachwasser, Licht).
    Game-Namen im Prompt vermeiden, sonst kommen Bäume dazu.
  - Jannis zu K–N (Rezept z31): **„keine von denen hat 'n Strand. die ersten 2
    sind zu hoch. ich habe gesagt sie soll flach, mit min 1 strand, eher mehr,
    sein“.** Ein Strand heißt also: flache Sandfläche am Wasser, die sichtbar nach
    außen ausläuft. Keine Sandschicht als Seitenkante unter dem Gras. Die
    geschichtete Map-Tile-Optik wirkt zu hoch. Neue Richtung: von oben generieren
    (nur so garantiert flach), Game-Comic-Cel-Shading, mehrere große
    Sichelstrände, dann lokal projizieren und polieren (`islands/topdown.py`).
  - Runde „flache Inseln mit echten Stränden“ (von oben generiert, lokal
    projiziert): P z36, Q z37, R z38. Die Strände sind jetzt echte flache
    Sandflächen am Wasser. Jannis' Antwort: **„create die bilder einfach selber“**.
    Darauf per Code gezeichnet (`islands/draw_island.py`: organische Kurve, Strände
    als Sandausbuchtungen, Cel-Licht und -Schatten, Grasstriche, Nasssand-Streifen,
    Schaum, Flachwasser, exakte Projektion). Drei Varianten gerendert.
  - Credits am Ende: 0,5 von 10 übrig (38 Z-Image-Bilder).
  - **Neue Richtung (Jannis, 2026-09-10):** Die Inseln sollen **groß aussehen**, weil
    später viele Bäume und Gebäude darauf passen sollen. Jannis lässt 10 PNGs von
    ChatGPT erzeugen. Prompt:

    ```
    Create 10 separate images, one island per image, as transparent PNGs. Generate
    them one after another, each as its own image, not a grid or sprite sheet.

    Shared style for all 10 (keep it identical across the set):
    - Subject: one large, empty, flat island, as a game asset for an island-builder
      mobile game. The island must look BIG, like a wide open plateau that can
      later hold a whole village with many trees and buildings. Long coastlines,
      generous open grass areas, nothing small-scale on it.
    - Camera: true isometric view, rotated 45 degrees, camera about 35 degrees above
      the ground, orthographic with no perspective distortion. Same angle, same
      scale and same framing for every island.
    - Shape: natural organic outline with soft lobes and bays, never a circle,
      never a square.
    - Height: completely flat and low-lying at sea level. No cliffs, no hills, no
      raised edges, only a very thin shoreline edge.
    - Surface: one open empty meadow. Absolutely nothing on it: no trees, no bushes,
      no rocks, no buildings, no paths, no props, no people. Grass painted in 2 to 3
      flat cartoon green tones with very little texture, slightly lighter toward
      the top left.
    - Beaches: at least one, better two or three, wide flat golden sand beaches that
      run out into the water, with a thin white foam line along the shore and a
      narrow turquoise shallow-water rim right around the island.
    - Style: polished cartoon mobile game art with clean cel shading, crisp
      readable shapes, clean dark outlines and vibrant saturated colors. Soft light
      from the top left, no harsh black shadows.
    - Background: fully transparent. No ocean, no water beyond the thin shallow rim,
      no cast shadow on the background, no frame, no text, no watermark.
    - Composition: island centered, filling about 85 to 90 percent of the image
      width, fully visible with a small transparent margin. Landscape 1536x1024.

    The 10 islands (vary only the outline and the beaches):
    1. Broad kidney shape with one long beach along the entire front edge.
    2. Wide rounded island with three crescent beaches on different sides.
    3. Long oval with beaches at both ends.
    4. Heart-like shape with a wide beach in the front bay.
    5. Large banana shape with beaches on both tips and along the inner curve.
    6. Blob with one deep bay that holds a very wide beach.
    7. Three-lobed clover shape with a small beach between each lobe.
    8. Rounded, almost rectangular plateau with a big beach wrapping one corner.
    9. Irregular island with a long sandbar spit reaching out into the water.
    10. Wide teardrop shape with a sandy point and a second smaller beach on the
        opposite side.
    ```
  - Jannis: ChatGPT malte bei jeder Insel das Meer mit. Das Meer existiert aber
    schon als eigenes Bild. **Prompt v2 ohne jedes Wasser** (Schaumlinie und
    Flachwasser gestrichen, Insel ausdrücklich als Ausschnitt). Fallback, falls
    doch Wasser kommt: einfarbiger Magenta-Hintergrund, lokal ausschneiden mit
    `islands/key.py`.

- **2026-09-10 (Claude Code): Wachstumssystem spezifiziert → `island/WACHSTUM.md`.**
  Jannis' Regeln: 3 Inselstufen, danach Skalierung des größten Bilds; 5–6
  Hintergrundbilder, die mit wachsender Insel weiter weg wirken, mit Heranzoomen
  für weiche Übergänge; Kategorien Pflanzen, Strand, Wasser, Gebäude, Sonder;
  Mischung aus Größenstufen und Skalieren; Raster mit Footprints; 2.5D:
  Hintereinander erlaubt, Ineinander nicht; Zonen wie Strandobjekte nur auf
  Strand; der Plausibilitätscheck ist ein festes Gate. Umsetzung nach Recherche:
  Footprint und Sprite getrennt, 0,5-m-Unterzellen, Zonenmaske aus dem Inselbild,
  `validateLayout` als geteilte reine Funktion für App und Edge Function,
  Tiefensortierung nach Fußlinie mit topologischer Sortierung für große
  Footprints, Verdeckungscheck, Umzugs-Solver beim Wachstum.
  Gefunden: §3.1 hier widerspricht sich (+Y rechts oben vs. Tiefe x + y);
  verbindlich ist jetzt die Konvention in `WACHSTUM.md` §3.1.

- **2026-09-10 (Claude Code): Runde 2 → `WACHSTUM.md` §14.** Jannis: **Pixel-Stil
  statt detailliert.** Objekt-Katalog v1 gewählt (8 Pflanzen, 8 Strand, 7
  Wasser, 10 Gebäude, 6 Sonder, Flaschenpost). **Jedes Objekt einmal**, dann
  wahlweise wachsen lassen (Stufen, Größen, Vermehren: Häuser werden größer,
  Delfine mehr) oder Neues hinzufügen. **Rewards-Roadmap** nach Gesamtstunden
  (Fokus + Check-In): 10 Meilensteine aus den Sonderobjekten, in der App gebaut
  (Home-Pill + Screen). Offen: Pixel-Iso 2:1 statt True Iso; Skalierung vs.
  Pixel-Art.

- **2026-09-10 (Claude Code): Runde 3 → `WACHSTUM.md` §15.** Jannis: **Pixel-Iso 2:1**
  statt True Isometric; **ganzzahlige Schritte** statt stufenlosem Skalieren;
  **Maske pro Insel** (welche Zelle Strand, Meer, Gras ist). Umsetzung: 1 m =
  16 × 8 Art-Pixel, Kamera D = 6/4/3 für Stufe I/II/III, danach Insel × 2/3/4
  (jede Maskenzelle wird k × k) mit D = 2/1; Objekte bleiben in Pixelgröße;
  Zonenebene im Pixel-Editor als Quelle der Maske; KI-Bilder vorher per
  Pixel-Snap auf ein echtes Raster bringen. Offen: ChatGPT-Prompt v3
  (Pixel + 2:1), Pixel-Palette.

- **2026-09-10 (Claude Code): Session-Belohnung in der App, ohne Punkte.** Fokus
  (Kategorie vor dem Start) und Auto Check-In (Kategorie nach der Notification)
  bringen je eine Belohnung. Größe Tiny bis Huge aus dem Median der früheren
  Sessions desselben Ziels, daraus 1/1/2/3/4 Schritte. Der Reveal-Screen zeigt
  alle Objekte der Kategorie mit ihrem echten Ergebnis, dann „Add to island“
  bzw. „Grow on island“. Katalog v1 ohne Sonderobjekte in
  `src/lib/growRewards.ts`, Insel nur lokal pro Konto, Platzhalter-Zeichnungen
  bis zu den Pixel-Sprites. Details `WACHSTUM.md` §14.3, Abschnitt 5 hier als
  ersetzt markiert.
  - **ChatGPT-Prompt v3 (Pixel-Art + 2:1, 2026-09-10).** Ersetzt v2. Feste
    Pixelgröße 4 × 4 Bildpixel pro Kunstpixel, damit der Pixel-Snap sauber
    greift (`WACHSTUM.md` §15.4).

    ```
    Create 10 separate images, one island per image, as PNG pixel-art game assets with a fully transparent background. Generate them one after another, each as its own image, not a grid or sprite sheet.

    IMPORTANT: Draw ONLY the island itself. No water of any kind: no ocean, no sea, no shallow water, no waves, no foam, no reflections. The ocean is a separate layer in the game, so the island must be a clean cut-out. Everything outside the island is 100% transparent.

    Pixel-art rules (keep them identical for all 10):
    - True pixel art on a strict grid: every art pixel is an exact 4x4 block of image pixels, the same size everywhere in the image.
    - No anti-aliasing, no smoothing, no blur, no gradients, no soft shadows, no noise. Hard pixel edges only.
    - Limited palette of at most 16 flat colors per island, shared across the whole set.
    - Classic 2:1 isometric pixel-art projection (dimetric): diagonal edges step exactly 2 pixels across for every 1 pixel up.
    - Same angle, same pixel size and same framing for every island.

    The island:
    - One large, empty, flat island for an island-builder game. It must look BIG, with a wide open grass area where a whole village with many trees and buildings can be placed later. Long coastline, nothing small-scale on it.
    - Natural organic outline with soft lobes, never a circle, never a square.
    - Completely flat. No cliffs, no hills, no raised edges. At most a 1 to 2 pixel darker line along the outline.
    - Surface: one open empty meadow in 2 to 3 flat green tones with only a few scattered darker pixels as texture. Absolutely nothing on it: no trees, no bushes, no flowers, no rocks, no buildings, no paths, no props, no people.
    - Beaches: at least one, better two or three, wide flat sand areas in 2 flat sand tones along the outer edge that clearly stand out from the grass.
    - Light from the top left: grass and sand slightly lighter toward the top left, nothing else.
    - Island centered, filling about 85 percent of the image width, fully visible with a transparent margin. Image size 1536x1024.

    The 10 islands (vary only the outline and the beaches):
    1. Broad kidney shape with one long beach along the entire front edge.
    2. Wide rounded island with three crescent beaches on different sides.
    3. Long oval with beaches at both ends.
    4. Heart-like shape with a wide beach filling the front notch.
    5. Large banana shape with beaches on both tips and along the inner curve.
    6. Blob with one deep indentation that holds a very wide beach.
    7. Three-lobed clover shape with a small beach between each lobe.
    8. Rounded, almost rectangular island with a big beach wrapping one corner.
    9. Irregular island with a long sandbar spit reaching far out from the main shape.
    10. Wide teardrop shape with a sandy point and a second smaller beach on the opposite side.
    ```

    Folgeprompt für die drei Wachstumsstufen der Lieblingsinsel:

    ```
    Take island number X and create 3 growth stages of this same island as separate transparent PNGs, one per image. Keep exactly the same pixel-art rules: every art pixel is an exact 4x4 block, the same 16-color palette, 2:1 isometric, no water, nothing on the island, image size 1536x1024, island centered.
    - Stage 1: a smaller version, about 192 art pixels (768 image pixels) wide, with one beach.
    - Stage 2: a medium version, about 256 art pixels (1024 image pixels) wide, with two beaches.
    - Stage 3: the full island, about 320 art pixels (1280 image pixels) wide, with two or three beaches.
    Each larger stage keeps the character of the smaller one and extends its coastline outward.
    ```
- **2026-09-10 (Claude Code):** Pixel-Meer B1 von Jannis ist Home-Hintergrund
  (`assets/home/ocean-pixel-1.png`, ersetzt `island-bg.png`). B2–B6 folgen.
- **2026-09-10 (Claude Code):** Pixel-Meer B2 (mittlere Inselgröße) abgelegt in
  `assets/ocean/` (dazu das B1-Original), Versionen in `assets/ocean/README.md`.
  Kein Rebuild, noch nicht eingebunden.
- **2026-09-10 (Claude Code):** Weitestes Pixel-Meer (größte Insel) abgelegt als
  `assets/ocean/stage-3-farthest.png`. README listet jetzt drei Versionen. Kein
  Rebuild.
- **2026-09-10 (Claude Code):** Drei Pixel-Inseln (klein, mittel, groß) in
  `assets/island/stages/`, Meere B2/B3 als `assets/home/ocean-pixel-2/3.png`.
  Home zeigt die Insel auf dem Wasser (`src/lib/islandStages.ts`); Tippen
  schaltet als Vorschau durch die Stufen. Noch keine Wachstumslogik.
- **2026-09-10 (Claude Code):** Meer B1 (kleinste Insel) durch neue Version
  ersetzt (Horizont 13 %), die alte bleibt als `assets/ocean/stage-1-closest-v1.png`.
- **2026-09-10 (Claude Code):** Meer B1 erneut ersetzt (`07_53_34 PM`, Horizont 25 %),
  vorherige Version als `assets/ocean/stage-1-closest-v2.png` behalten.
- **2026-09-10 (Claude Code):** Home-Hintergrund = Meer mit eingemalter Insel
  (`assets/home/island-ocean-1.png`), separate Insel-Ebene und Stufen-Vorschau entfernt.
- **2026-09-10 (Claude Code):** Home-Hintergrund 10 pt höher, kleine Insel wieder als
  eigene Ebene darüber.
- **2026-09-10 (Claude Code):** Insel-Ebene passgenau über die gemalte Insel im
  Home-Hintergrund gelegt (vorher doppelt sichtbar).
- **2026-09-10 (Claude Code):** Home-Hintergrund = Meer mit Flachwasser ohne gemalte
  Insel (`assets/home/shallows-ocean-1.png`), kleine Insel mittig darauf.

- **2026-09-10 (Claude Code): Pixel-Sprites der Pflanzen, erster Entwurf.** 24 Bilder
  plus 2 Gras-Varianten, gezeichnet von `island/pixel/plants.py` (16 px pro Meter,
  Licht oben links, 1-px-Kontur in Materialfarbe, 12 Farben, Schatten 25 %).
  Regeln, Palette und jede Stufe in `island/SPRITES.md`, Vorschauen in
  `island/pixel/previews/`. Formel in `WACHSTUM.md` §15.1 auf `· 4` / `· 2`
  korrigiert. Wartet auf Jannis' Abnahme.
- **2026-09-10 (Claude Code):** Stufe 1 (kleine Insel auf Flachwasser-Hintergrund) von Jannis
  abgenommen, Endwerte in `WACHSTUM.md` §15.8. Als Nächstes Stufe 2 (§15.9).
- **2026-09-11 (Claude Code):** Stufe 2 (mittlere Insel, weiter herausgezoomtes Flachwasser)
  als erster Versuch auf Home; Stufen jetzt in `src/lib/homeIslandStages.ts`.

- **2026-09-14 (Claude Code): Meereshintergrund selbst gezeichnet, Entwurf.** `island/pixel/ocean.py` malt Himmel, Meer, Insel, Strand, Flachwasser und Schaum
  als Pixelbild: 220 × 478 Kunstpixel = 1320 × 2868 auf dem Handy, Horizont bei 20 %
  und Insel bei 53 % wie in §15.8 abgenommen. **Zweiter Versuch nach Jannis'
  Rückmeldung** („Wellen, helles Meer und die Übergänge sehen scheiße aus, Insel und
  helles Wasser sind okay"): Himmel und Meer sind jetzt ein weicher Verlauf ohne
  Farbbänder und ohne Dither-Kanten, der blasse Streifen unter dem Horizont ist weg,
  Wellen stehen in lockeren Gruppen mit angehobener Mitte, dunklem Wellental und
  kleiner Schaumkrone (in der Ferne glattes Wasser), Wolken sind Haufenwolken mit
  flacher Unterkante in drei Tönen. Insel, Strand, Schaum und das ruhige helle Wasser
  blieben unverändert. Vorschauen mit und ohne Pflanzen in
  `island/pixel/previews/home-1*@6x.png`. Damit liegen Meer, Insel und Objekte zum
  ersten Mal auf demselben Pixelraster. **Dritter Durchgang** nach „die Insel ist mir
  zu langweilig, sieht aus wie ein flaches Ding": gewölbte Wiese mit großen Flecken,
  Grasbüscheln und Sprenkeln, sichtbare Landkante an der Vorderseite, Steine auf der
  Wiese, nackte Erdflecken, Kiesel und Treibholz am Strand, Felsen im Flachwasser mit
  Schaumring. **Vierter Durchgang** (Jannis: „Textur perfekt, Steine bitte an den Rand,
  auch Steinküsten, Strandgröße variieren"): Die Küste bekommt pro Abschnitt einen
  Charakter — felsige Strecken mit Felsband statt Sand, wilderem Schaum und Felsen in
  der Brandung, dazwischen Sandstrände von breiter Bucht bis fast nichts. Findlinge
  liegen jetzt am Inselrand (mehr davon an den Felsküsten), nur einzelne im Inneren;
  Pflanzen halten Abstand zum Felsband. **Fünfter Durchgang** (Jannis: „Steinstrand
  sieht nicht gut aus, mehr Textur, mehr Varianz in der Strandbreite"): Aus dem glatten
  Felsband wurde Geröll — grobe und feine Steinlagen, Sand zwischen den Steinen,
  Gezeitentümpel, nasser dunkler Stein an der Wasserlinie, Moos oben, dazu einzelne
  Felsbrocken im Geröll und in der Brandung. Die Strandbreite kommt aus einer eigenen
  Kurve und reicht jetzt von breiter Bucht (rund 25 px) bis zu einem Saum von unter
  1 px. Noch nicht in der App, wartet auf Abnahme.

- **2026-09-14 (Claude Code): Pixel-Insel ist der Home-Hintergrund, Pflanzen in der App.**
  Jannis: „jetzt find ichs geil, bau das so als Hintergrund ein" plus Pflanzen im
  Deep-Work-Setup. `assets/home/pixel-island-1.png` (Ausgabe von `ocean.py`, ×6 mit
  Nearest Neighbor) ersetzt Stufe 1 in `src/lib/homeIslandStages.ts` — ohne eigene
  Insel-Ebene und ohne Zoom, weil Himmel, Meer und Insel ein Bild sind. Die Pflanzen
  liegen als Pixelzeilen in `src/components/grow/plantSprites.ts` (erzeugt von
  `island/pixel/export_sprites.py`) und werden als SVG-Rechtecke gezeichnet, damit sie
  in jeder Größe scharf bleiben; ein hochskaliertes PNG würde iOS weichzeichnen.
  Offen: Stufe 2 und 3 im selben Stil, Objekte auf der Insel platzieren, Sprites für
  Strand, Wasser und Gebäude.

- **2026-09-14 (Claude Code): Lagunen-Palette und freier Himmel oben links.** Jannis:
  ästhetischer statt realistischer, passend zum Grün. Das Meer läuft jetzt von Türkis
  am Horizont (#3FBED6) zu tiefem Blau vorne (#12568C), rundum die Insel leuchtet das
  Wasser zusätzlich türkis auf (Radius 2,7 Inselradien). Himmel heller und kühler
  (#2C7FE3 → #BDEDF5), Sand wärmer, Steine kühlgrau, damit sie zum Wasser gehören.
  Wolken stehen nur noch rechts und knapp über dem Horizont: Die obere linke Ecke
  bleibt frei für Begrüßung, Datum und Streak-Pille. `assets/home/pixel-island-1.png`
  neu erzeugt.

- **2026-09-14 (Claude Code): Küste folgt der Inselform, Variante B gewählt.** Der
  Strand entsteht jetzt aus der Krümmung der Küstenlinie: Buchten (nach innen gebogen)
  sammeln Sand und werden breit, Landzungen (nach außen gebogen) bleiben Geröll. Die
  Krümmung wird über ein Stück Küste gemittelt, damit der Strand ein Band an der Küste
  bleibt und kein Keil ins Land wird (Breite ca. 2–13 px); in der größten Bucht läuft
  eine Sandbank ins Wasser. Jannis hat aus vier Varianten **B** gewählt (zwei getrennte
  Strände, sonst Fels). Die Form steckt in `seed` in `STAGES` von `ocean.py` und gilt
  für alle drei Inselstufen, damit die Insel beim Wachsen ihren Charakter behält.
  `assets/home/pixel-island-1.png` neu erzeugt; Vergleichsbilder in
  `island/pixel/previews/beach-variants*.png`, die vier Inseln in `island/pixel/variants/`.

- **2026-09-14 (Claude Code): Fünf Inselgrößen, je mit eigenem Meer.** Eine Insel, die
  wächst: gleiche Küstenform (Variante B, `seed` 23) in fünf Größen, das bisherige Bild
  ist Stufe 2. Pro Stufe wird ein eigenes Meer gerendert und die Kamera tritt zurück,
  damit die Insel immer aufs Wasser passt und die Objekte ihre Pixelgröße behalten.

  | Stufe | Insel | Kamera D | Leinwand (Kunstpixel) | Land gesamt | davon Wiese |
  |---:|---|---:|---|---:|---:|
  | 1 | 12,2 m | 8 | 165 × 359 | ~118 m² | 96 m² |
  | 2 | 16,3 m | 6 | 220 × 478 | ~210 m² | 177 m² |
  | 3 | 19,5 m | 5 | 264 × 574 | ~303 m² | 258 m² |
  | 4 | 24,4 m | 4 | 330 × 717 | ~472 m² | 410 m² |
  | 5 | 32,5 m | 3 | 440 × 956 | ~840 m² | 739 m² |

  **Korrektur (2026-09-14):** Die Meterangaben standen hier zuerst um den Faktor √2
  zu klein. Ein Meter entlang einer Bodenachse sind 8 px nach rechts und 4 px nach
  unten, im ungestauchten Kreis also √128 = 11,31 px — nicht 16 px. Die 16 px aus
  `SPRITES.md` sind die Breite der Rautendiagonale. Flächen oben sind aus den
  fertigen Bildern gemessen (1 m² Boden = 64 Kunstpixel).

  **Die Insel füllt auf jeder Stufe denselben Anteil der Bildschirmbreite** (2 · rx · D
  = 1104 von 1320 Gerätepixeln, rund 84 %). Gewachsen wird also über die Kamera: Je
  weiter sie zurücktritt, desto kleiner die Objekte und desto mehr Platz hat die Insel.

  **Kapazität nachgerechnet, nicht geschätzt:** `island/pixel/capacity.py` liest das
  fertige Bild, stuft jede 0,5-m-Unterzelle nach Farbe als Wiese, Strand oder Fels ein
  und platziert dann den ganzen Katalog mit echten Footprints (Gebäude mit einer Zelle
  Abstand ringsum). Bedarf: 126 m² Grundfläche auf der Wiese, 17,8 m² am Strand; mit
  Abständen belegt die Platzierung 253 m². Ergebnis:

  | Stufe | platziert | fehlt |
  |---:|---|---|
  | 1 | 47/84 | halbe Katalog |
  | 2 | 62/84 | u. a. Weltenbaum, Blumenbeete, Palmen |
  | 3 | 82/84 | Strandbar, Hängematte (Strand zu schmal) |
  | 4 | 83/84 | Strandbar |
  | 5 | **84/84** | nichts, danach noch 510 m² Wiese frei |

  Getestet mit Jannis' Wunschmengen: alle zehn Gebäude einmal in Endgröße, sechs
  Laubbäume, acht Büsche, fünf Tannen, fünf Palmen, vier Obstbäume, drei Blumenbeete,
  zwölf Grasbüschel, ein Weltenbaum, dazu Roadmap- und Strandobjekte.
  Jede Stufe bekommt ein **eigenes Meer**: Wellen, Dünung und Wolken werden mit einem
  eigenen Startwert gewürfelt (`SEA_SEED`), sodass sich keine zwei Hintergründe
  gleichen.
  Wasserobjekte liegen ohnehin im Meer. Strand und Flachwasser wachsen proportional
  mit, damit die Küste ihre Proportionen behält.
  Bilder: `assets/home/pixel-island-1…5.png`, Vorschauen `island/pixel/previews/`
  (`island-sizes.png` zeigt alle fünf nebeneinander). `src/lib/homeIslandStages.ts`
  listet jetzt die fünf Pixelstufen; die älteren KI-Meere und die Inselsprites aus
  `assets/island/stages/` sind damit nicht mehr eingebunden. Home steht auf Stufe 2.
  **Wolken liegen jetzt als Bank knapp über dem Horizont:** Auf dem Handy ist der
  Himmel fast vollständig von Statusleiste, Begrüßung, den drei runden Buttons,
  Datum und Streak-Pille belegt; nur der Streifen direkt über der Wasserlinie rechts
  der Pille bleibt frei.

- **2026-09-14 (Claude Code): Zonenkarte `island/pixel/zones.json`.** Für alle fünf
  Inselbilder steht jetzt fest, welche halbe-Meter-Zelle Wiese, Strand, Fels,
  Flachwasser oder offenes Meer ist — die Maske aus `WACHSTUM.md` §15.3, nur direkt
  aus den fertigen Bildern gelesen. `zones.py` zählt die 16 Pixel jeder Zellraute und
  nimmt die Mehrheit, prüft das Ergebnis gegen die Geometrie (98–99 % Übereinstimmung)
  und schreibt Zellzahlen, Flächen und Prüfergebnisse mit in die Datei. Format und
  Platzierungsregeln stehen in `island/SPRITES.md` §7. `capacity.py` liest jetzt nur
  noch diese Karte und platziert damit den Katalog: Stufe 5 nimmt 84 von 84 Objekten
  auf. Damit ist die Grundlage für die spätere Objektplatzierung fertig.

- **2026-09-14 (Claude Code): Wasserobjekte mit 8–12 Wachstumsstufen.** 69 Sprites in
  `island/pixel/water/`, gezeichnet von `water.py` (gleiche Engine wie die Pflanzen,
  Schaumring statt Bodenschatten). Boot 10 Stufen vom Ruderboot zur Yacht, Steg 10 (ab
  Stufe 6 mit T-Kopf), Bojen 10, Kajaks 8, Felsen 9, Delfine 10, Möwen 12 — Gruppen
  liegen komplett in einem Bild pro Stufe. `GROW_OBJECTS.water` in `growRewards.ts`
  hat die neuen Maxima, `GrowObjectArt` zeichnet Pflanzen und Wasser aus zwei
  getrennten Sprite-Sätzen (eigene Paletten, damit sich die Buchstaben nicht beißen).
  Details in `SPRITES.md` §8. Hinweis: Die Pflanzen wurden parallel von der anderen
  Session auf je 10 Stufen erweitert; `plantSprites.ts` ist daraus neu erzeugt, die
  Maxima der Pflanzen in `growRewards.ts` stehen aber noch auf den alten Werten.

- **2026-09-14 (Claude Code): Feste Plätze für die Wasserobjekte.** Bojen, Felsen,
  Möwen, Kajaks und Delfine sitzen nicht mehr als Klumpen beieinander: Jedes Stück hat
  einen festen Platz rund um die Insel, gleich für alle Nutzer, gespeichert in
  `island/pixel/water/slots.json`. Ein Platz ist ein **Winkel plus Band** (0 = Wasser-
  linie, 1 = äußerer Rand des Flachwassers), kein Pixel — dadurch bleiben die Plätze
  beim Inselwachstum an derselben Stelle der Küste. Die Winkel folgen der Küste:
  Felsen an den Geröllabschnitten, Kajaks an den Stränden, Steg an einer Sandküste mit
  offenem Wasser davor, Boot daneben, Delfine im offenen Meer, Möwen in der Luft.
  `layout.py` erzeugt die Datei, prüft jeden Platz gegen die Zonenkarte und rendert
  das Beispiel `previews/water-layout-5.png`. Details in `SPRITES.md` §9.
- **2026-09-14, Nachschärfung (Jannis):** Boote sind eine **Flotte bis fünf** (auch
  hinter der Insel, jedes mit eigener Größe), Felsen liegen in **höchstens drei
  Gruppen zu je drei**, Delfine in **höchstens drei Schulen**, die 3 → 5 → 7 → 9
  wachsen, bevor die nächste beginnt. Alles ist weiter gestreut statt als Ring um die
  Insel: Die Bänder wechseln pro Platz und werden nach Richtung begrenzt, weil das
  Bild seitlich kurz nach dem Flachwasser endet. Der Steg steht jetzt am breitesten
  passenden Strand und lässt sich spiegeln, wenn er nach links laufen soll.
  **Offen:** Welche Wachstumsstufe wie viele Delfine bzw. Felsen bedeutet — die
  Gruppenbilder für Reveal und Timer zeigen bisher ein Stück pro Stufe.
- **2026-09-14, zweite Nachschärfung (Jannis):** Der Steg stand schräg zur Küste; er
  wird jetzt nur noch in den zwei Fenstern gesucht, in die sein Sprite laufen kann
  (315° und gespiegelt 225°, je ±12°). Die Delfinschulen lagen alle vorn — jetzt eine
  vorn und zwei hinter der Insel. Boote liegen weiter draußen (Band 2,6 bis 6,5), und
  zwei der zwölf Möwen fliegen über der Insel selbst. Dafür reicht die Zonenkarte
  jetzt bis zum Achtfachen der Flachwasserbreite ins offene Meer (vorher 4,5), sonst
  lägen die weit draußen liegenden Boote außerhalb der Karte.
- **2026-09-14, dritte Nachschärfung (Jannis):** Manche Stücke überlappten, und die
  Delfine klebten am Boot. `layout.py` hat jetzt einen Abstandsdurchgang: jedes Stück
  ist ein Kreis (Boot 20 px, Kajak 9, Felsen/Delfin 8, Boje 5, Steg vier Kreise), zu
  nah gesetzte Stücke wandern erst weiter raus oder rein, dann ein paar Grad die
  Küste entlang. Boote und Delfinschulen halten zusätzlich 30 px Abstand. Der Steg
  bleibt fest. Im Beispiel mussten drei Stücke ausweichen.
- **2026-09-14, in die App eingebaut (Jannis: „bau das in die Applogik ein"):** Die
  Wasserobjekte stehen jetzt wirklich auf der Home-Insel. `export_layout.py` löst die
  Plätze für alle fünf Inselgrößen in Pixel auf und zeichnet die 44 Einzelteile;
  `islandScene.ts` entscheidet, welche Stücke stehen, `IslandWaterLayer.tsx` zeichnet
  sie als SVG-Pfade über den Hintergrund. Die Inselgröße kommt nicht mehr aus einer
  Konstante, sondern aus allem, was auf der Insel steht (0/25/70/145/240 Stufen).
  Auf Jannis' Ansage „dann sinds halt mehr als 10 Stufen" hat das Boot jetzt 14 Stufen
  (ab 11 kommt je ein Boot der Flotte dazu) und die Delfine 12 (Schulen zu 3, 5, 7, 9,
  bis zu drei Schulen, am Ende 27 Tiere). Alle Pflanzen stehen auf 10 Stufen, so viele
  Bilder hat ihre Art. Geprüft: Typecheck, 210 Domain-Zusicherungen, ein Pixel-für-
  Pixel-Vergleich der App-Pfade mit der Python-Vorschau (0 Abweichungen, dabei einen
  Rundungsfehler gefunden) und zwei Screenshots aus dem Simulator.
  **Offen:** Pflanzen, Gebäude und Strandobjekte haben noch keine festen Plätze an
  Land — sie wachsen in der Logik, stehen aber noch nicht auf der Insel.
- **2026-09-15, Live Activity im Papier-Look, mit Wachstum und Check-In (Jannis):**
  Das Widget stand noch auf dem alten Blau `#6B87F5` auf Fast-Schwarz. Jetzt warmes
  Papier `#F5F5F2` mit Inselgrün — auf dem meist dunklen Sperrbildschirm liest sich
  die Karte dadurch als *diese* App und nicht als weiterer Systembanner. Neu in der
  Nutzlast: `growName`/`growDetail`/`growCategory` (eine Zeile „Tanne · wächst" mit
  passendem Symbol; die genaue Größe bräuchte den Verlauf vom Server und ist es auf
  dem Sperrbildschirm nicht wert) und `kind`, das zwischen Fokus-Session und Auto
  Check-In unterscheidet. Ein Check-In zeigt nur die hochzählende Zeit und keine
  Knöpfe — ein Besuch hat nichts zu pausieren, er endet beim Gehen. **Grenze von
  iOS:** Eine Live Activity darf nur im Vordergrund gestartet werden, ein
  Geofence-Eintritt passiert im Hintergrund — der Banner erscheint deshalb, sobald
  die App das nächste Mal offen ist. Manuelle Check-Ins starten ihn sofort.
  **Nicht gebaut:** Native Builds sind hier blockiert (iOS-26.5-Plattform fehlt),
  geprüft sind nur Syntax (`swiftc -parse`), Typen und dass alle drei Ebenen —
  Widget, Expo-Modul, TypeScript — dieselbe Nutzlast beschreiben.
- **2026-09-15, die Insel gehört dem Account (Jannis: „bitte auf den Account
  speichern, nicht auf Handy"):** Neue Tabelle `public.island_state` — eine Zeile pro
  Spieler mit `objects`, `spots` und `applied_sessions`, RLS auf den eigenen Account,
  Migration `20260915120000_island_state.sql` (auf `uxpburqocxlcivcdtotb` angewendet).
  Die Insel wird als Ganzes gelesen und geschrieben, weil sie sich etwa einmal pro
  Session ändert und die Verschmelzung zweier Geräte so an einer Stelle liegt.
  `islandMerge.ts` ist diese Verschmelzung: **eine Insel schrumpft nie**, also gewinnt
  je Objekt die höhere Stufe und die Vereinigung der eingelösten Sessions — das
  Ergebnis ist unabhängig von der Reihenfolge und zweimal verschmelzen ändert nichts.
  Nur der Platz ist eine echte Wahl, dort gewinnt das jüngere `updatedAt`.
  `useIslandSync.ts` hängt am App-Start; **es wird nie gesendet, bevor die Insel des
  Accounts gelesen wurde** — eine frische Installation würde sonst alles überschreiben.
  Nachgewiesen: Insel angelegt → auf dem Server; Gerät geleert wie nach einer
  Neuinstallation → Insel kam vollständig zurück.
- **2026-09-15, die Meilenstein-Landmarken (Jannis: „generiere sie und mache das System
  um sie zu setzen"):** `island/pixel/special.py` zeichnet sechs Landmarken in zehn
  Bildern — Fahnenmast, Truhe, Brunnen, Uhrturm, Leuchtturm, Monument, vier davon mit
  einer zweiten Stufe. Gold gibt es nur hier und fast nur auf der zweiten Stufe, die
  Silhouetten sind bewusst unverwechselbar. `src/lib/milestones.ts` ist die Logik und
  macht die Zustellung bauartbedingt verlässlich: **ein Meilenstein ist kein Ereignis,
  sondern eine Tatsache über die Gesamtstunden** — es gibt nichts zu verpassen, die
  Insel wird nur mit den Stunden abgeglichen. `useMilestoneDelivery.ts` platziert, was
  fehlt, schickt eine Benachrichtigung und meldet den Moment an; `MilestoneMoment.tsx`
  gibt ihm den ganzen Bildschirm. Wichtig: Der Abgleich wartet auf die Server-Insel
  (`islandSyncedFor`), sonst würde ein neues Handy feiern, was es längst besitzt.
  **Dabei gefunden und behoben:** Der Leuchtturm stand auf `beach` und brauchte 5×5
  Zellen Sand — auf einer vollen Insel fand er nie einen Platz und wäre bei 100 Stunden
  stumm ausgefallen. Er steht jetzt auf der Wiese; ein Test sichert, dass alle sechs
  Landmarken auf einer fertigen Insel einen Platz finden.
- **2026-09-15, jede Session hinterlässt verlässlich ein Objekt (Jannis: „EGAL was der
  user macht"):** Die Belohnung ist mit dem Ende der Session verdient; der Reveal-Screen
  entscheidet nur noch, *was* daraus wird, und ist kein Tor mehr. Neu `src/lib/growDelivery.ts`:
  Eine Belohnung, die länger als 24 h wartet — oder die hinter mehr als drei neueren
  liegt — platziert die App selbst, zuerst mit dem Objekt aus dem Timer-Ring, dann mit
  der Kategorie der Session, dann in einer anderen Kategorie. Nur wenn die ganze Insel
  keinen Platz hat, wartet sie weiter, statt weggeworfen zu werden. Weitere Löcher
  geschlossen: der Reveal schreibt die Belohnung beim Öffnen selbst fest (falls das
  Schreiben nach der Session scheiterte), abgebrochene und veraltete Sessions behalten
  ihre Belohnung (`rememberSessionReward`), „Insel zu klein" wirft nichts mehr weg,
  mehrere Belohnungen laufen direkt hintereinander statt einer pro Home-Besuch, und
  `addPendingGrow` setzt die Wartezeit nicht mehr zurück. Sichtbar wird das auf Home
  über `RewardWaitingPill`: „Eine Belohnung wartet" beziehungsweise „… ist gewachsen,
  während du weg warst". Nachgewiesen im Simulator: 30 h alte Belohnung, App gestartet,
  ohne eine einzige Berührung stand die Tanne auf der Insel.
- **2026-09-14, Landobjekte stehen auf der Insel (Jannis: „ein System, was das gerade
  wachsende Objekt leicht random, aber da wo am meisten Platz ist, platziert"):**
  `src/lib/islandPlacement.ts` sucht den Platz. Jedes Objekt belegt ein Quadrat aus
  Halbmeterzellen in der Breite seines größten Bildes; zwei Abstandskarten trennen
  „passt es hier" (nächstes Objekt) von „ist hier viel Platz" (auch falscher
  Untergrund zählt), und gezogen wird gewichtet mit der dritten Potenz der offenen
  Fläche. Der Zufall hängt am Account. Der Platz wird beim Hinzufügen vergeben und
  in `islandSpotsByUser` festgehalten; nur ein Strandobjekt zieht um, wenn die Insel
  gewachsen ist und der Strand unter ihm weggewandert ist. Voll gewordene Inseln
  lockern stufenweise (erst Abstandsring, dann kleinerer Block), statt ein Objekt
  wegzulassen. Neu: `islandZones.ts` (Zonenkarte in der App), `islandLand.ts`
  (Untergrund, Blockgröße, Ankerpunkte), `IslandObjectsLayer.tsx` zeichnet jetzt
  Land und Wasser zusammen. Geprüft mit 217 Domain-Zusicherungen (nichts steht auf
  dem falschen Grund, nichts überlappt, gleicher Account = gleiche Insel, Bestehendes
  zieht nicht um), fünf Vorschaubildern aus der App-Logik und einem Screenshot.
- **2026-09-14, Limit pro Kategorie und Inselgröße (Jannis: „weil nicht ALLE
  Strandobjekte auf die kleinste Insel passen"):** `ISLAND_CATEGORY_LIMITS` in
  `islandScene.ts`. Insel 1 trägt 4 Pflanzen, 3 Gebäude, 5 Strandobjekte; Insel 2
  6/6/5; Insel 3 8/9/8; ab Insel 4 alles. Wasser hat kein Limit, seine Plätze sind
  fest. Die Zahlen sind gemessen, nicht geschätzt: `preview_islands.py limits` stellt
  die größten Objekte einer Kategorie mit vollem Block und Abstandsring auf, in acht
  gemischten Reihenfolgen — so wie ein Spieler sammelt, nicht in der günstigen
  „große zuerst"-Ordnung. Ist eine Kategorie voll, kann die Session nur noch wachsen
  lassen, was schon dasteht; neue Objekte zeigen „Island too small" und sind nicht
  wählbar. Die Vorschauen bauen ihre Inseln jetzt wie ein Spieler, Belohnung für
  Belohnung, und können damit keinen Zustand mehr zeigen, den die App nie erreicht.
