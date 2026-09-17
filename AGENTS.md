# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

Expo React Native goal-tracking app with focus sessions, geofencing, and a garden gamification system. Uses Supabase for auth and data, Zustand for local state, and TanStack React Query for server state.

## Commands

- `npx expo start` — start dev server
- `npx expo run:ios` — run on iOS simulator
- `npx expo run:android` — run on Android emulator
- `npx expo start --web` — run web version
- `npx eas build --profile development` — create dev build
- `npx eas build --profile preview` — create preview build
- `npm run typecheck` — strict TypeScript compile check
- `npm run test:domain` — deterministic domain smoke suite
- `npm run check` — typecheck + domain suite + Expo Doctor

No separate linter is configured.

## Architecture

### Tech Stack
- **React Native 0.83 + Expo 55** with TypeScript (strict mode)
- **React Native StyleSheet/inline styles** with canonical semantic tokens
- **Zustand 5** for local/persisted state (AsyncStorage, key: `"goals-app-state-v3"`)
- **TanStack React Query** for Supabase data fetching
- **Supabase** for auth (email/password) and PostgreSQL with RLS
- **React Navigation** (native stack; Home is the single main screen)
- **Reanimated 4** for animations
- **expo-location + expo-task-manager** for background geofencing

### Path Alias
`@/*` maps to `src/*` (configured in tsconfig.json)

### State Management
Zustand store in `src/store/index.ts` combines 4 slices:
- **configSlice** — auth state, user config, permission warnings, onboarding status
- **goalsSlice** — goal CRUD, weekly progress
- **sessionSlice** — active focus session, pomodoro state, ambient sound prefs
- **walletSlice** — time budget (fixed commitments → disposable hours)

### Data Flow
- **Auth**: one global `useAuthBootstrap` → Supabase Auth → Zustand config slice
- **Goals**: `useGoals` hook → Supabase query → React Query cache → Zustand goals slice sync
- **Sessions**: focus timer or geofencing background task → Supabase sessions
  table → local notifications and query invalidation
- **Mutations** use React Query with automatic query invalidation on success

### Navigation
- `RootNavigator`: Auth guard → Onboarding guard → MainTabs (+ modal stack screens)
- `MainTabs`: Routencontainer, rendert nur Home; es gibt keine sichtbare Bottom-Bar
- Analytics wird ausschließlich über den Stats-Button auf Home geöffnet und besitzt Back

### Database
Schema in `supabase/schema.sql`. Four tables: `users`, `goals`, `sessions`,
`friend_links`. All have RLS; session policies also verify goal ownership.

### Supabase Edge Functions
- `supabase/functions/delete-account/` — JWT-validated own-account hard delete
- `supabase/functions/analyze-sessions/` — JWT-validated personal insights

### Key Types
All in `src/types/index.ts`. Two goal types: `"physical"` (geofenced) and `"focus"` (manual pomodoro). Sessions have triggers: `"geofence"` or `"manual_pomodoro"`.

## Styling Conventions

The complete final visual specification is in `CLAUDE.md`. Canonical runtime
tokens live in `src/theme/neumorphism.ts`; do not duplicate colors in screens.
Use `NeumorphicSurface` for cards, `MinimalTextInput` for all text fields,
`PrimaryButton` for ordinary filled actions, `TextAction` for text actions and
`FlatToggle` for switches. Never use `NeumorphicSurface` as an interactive
control body.

## Environment Variables

Required in `.env` (see `.env.example`):
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

# Verbindliche Design-Regeln

`CLAUDE.md`, Abschnitt **VERBINDLICHES DESIGN-SYSTEM**, ist die einzige
vollständige und aktuelle Designspezifikation. Frühere Glassmorphism-/Liquid-
Glass-Experimente sind verworfen.

Kurzfassung:

- monochromer heller Neumorphismus, Seite `#E0E5EC`, Karten `#E9EDF2`;
- ein barrierearmer Indigo-Akzent `#415DCB`;
- Karten mit konsistentem 20pt-Radius und dualem Top-Left-/Bottom-Right-Schatten;
- ausnahmslos alle Buttons, Header-Tools, Toggles, Segmente, Stepper, Slider,
  Auswahlkarten und Pills flach, ohne neumorphische Schatten oder Insets;
- alle Texteingaben minimalistisch und ohne Schatten;
- keine sichtbare Bottom-Bar, keine Emojis, Blobs, Fotos, Glass- oder Blur-Flächen;
- Pomodoro als neumorphischer Außen-Dial mit Inset-Well und flachem Progressring.

# Kommunikationsstil

Während laufender Arbeit (Builds, Installationen, Tests, lange Befehle) immer kurz
sagen, was gerade passiert und wie lange es dauert — z.B. "Starte jetzt den
Simulator, dauert ca. 2 Minuten." Kein Drumherumreden, keine unnötigen Erklärungen.
Am Ende nur eine kurze Zusammenfassung: was wurde gemacht, was ist als nächstes
wichtig. Zeiten/Dauer immer mit angeben, wenn ein Schritt länger als ein paar
Sekunden dauert.

# Lokaler Modell-Server — Betriebsanweisung

Diese Datei gilt für jedes App-Projekt in diesem Setup. Sie beschreibt einen lokalen
LLM-Server, der als Zuarbeiter zur Verfügung steht, und legt fest, wann du ihn
benutzt und wann nicht.

---

## 0. Tool-Status — getestet am 2026-07-27, alle 11 Tools

| Tool | Status | Befund |
|---|---|---|
| `ornith_ask` | ✅ funktioniert | Zuverlässig, schnelle korrekte Antworten |
| `ornith_health` | ✅ funktioniert | Guter erster Diagnose-Schritt bei Problemen |
| `ornith_task` | ⚠️ funktioniert, aber Compile-Check ist Fake außerhalb Dart | Zweimal an TS-Dateien getestet. Kleine additive Funktion: korrekt. Größerer Umbau (GlassCard → BlurView): fehlerhaft — entfernte einen noch gebrauchten Import (`ViewStyle`), meldete trotzdem `"status": "ok"` und `"Kompiliert"`. `tsc --noEmit` warf sofort `TS2304`. Das interne Gate ist `dart analyze` — für TS ein reines No-op, das JEDEN Fehler durchwinkt |
| `ornith_diff_review` | ⚠️ funktioniert, aber genauso blind für TS-Fehler | Gleicher Test: mit dem kaputten `ViewStyle`-Import im Diff trotzdem `"verdict": "ok", "issues": []`. Auch dieses Gate hängt an Dart-Tooling und prüft in TS/JS-Projekten keine echte Kompilierbarkeit |
| `ornith_translate` | ✅ funktioniert | Format-neutral (ARB = JSON), auch außerhalb Flutter nutzbar für simple key-value-JSON-Übersetzungen |
| `ornith_survey` | ❌ reproduzierbar leer | Zweimal getestet (kleine wie größere Datei) — immer `{"result":""}`. Nicht verlassen, bis behoben |
| `ast_definition` | ❌ kaputt | `ast-grep` fehlt auf dem Server-Host |
| `ast_callers` | ❌ kaputt | `ast-grep` fehlt auf dem Server-Host |
| `ast_find` | ❌ kaputt | `ast-grep` fehlt auf dem Server-Host |
| `grep_find` | ❌ kaputt | `rg` (ripgrep) fehlt auf dem Server-Host |
| `ornith_gen_tests` | ❌ nicht nutzbar hier | Hardcoded auf Flutter — sucht `pubspec.yaml`, bricht in JS/TS-Projekten sauber mit "nichts geschrieben" ab |

**Fazit:** Nur 5 von 11 Tools liefern zuverlässige Ergebnisse in diesem Projekt, und
selbst davon haben 2 einen kritischen blinden Fleck. Die drei AST-Tools + `grep_find`
sind ausschließlich durch fehlende Binaries (`ast-grep`, `rg`) auf dem Docker-Host
blockiert — vermutlich mit `apt-get install ripgrep` + `ast-grep` Binary-Install im
Container behebbar. `ornith_survey`, das laut Abschnitt 3 der wichtigste Anwendungsfall
sein soll, ist aktuell unbrauchbar. Bis das behoben ist: **nicht auf `ornith_survey`
verlassen**, stattdessen direkt lesen oder `ornith_ask` mit gezielter Frage nutzen.
`ornith_gen_tests` und `ornith_translate` sind auf Flutter zugeschnitten (ARB,
pubspec.yaml) — in diesem Projekt ist nur `ornith_translate` bedingt nutzbar (reines
JSON), `ornith_gen_tests` nicht.

**Kritisch — in diesem Projekt (kein Dart/Flutter) sind `ornith_task`'s "Kompiliert"-Meldung
und `ornith_diff_review`'s "verdict: ok" NICHT vertrauenswürdig.** Beide Gates hängen an
`dart analyze` und laufen in TS/JS-Projekten leer durch — verifiziert durch einen
reproduzierten Bug (fehlender `ViewStyle`-Import), den beide Tools als "ok" durchgewinkt
haben, während `npx tsc --noEmit` ihn sofort fand. Nach jedem `ornith_task` in diesem
Repo zwingend `npx tsc --noEmit -p .` laufen lassen — Regel 5 (Reparaturschleifen bleiben
lokal) gilt hier nicht, weil das lokale Gate den Fehler gar nicht sieht.

---

## 1. Was verfügbar ist

**Ornith 1.0 9B** (Q4_K_M, MIT-Lizenz), llama.cpp-Server auf `http://192.168.178.35:8081`
Hardware: RTX 2060 6GB, Ryzen 5 5600X, 16GB DDR4 · Ubuntu 24.04 · Docker-Container `ornith`

| Eigenschaft | Wert |
|---|---|
| Generierung | 47 tok/s, Streuung ±0,1 über 10 Läufe |
| Prefill (großer Kontext) | ~1.100 tok/s — 6.000 Token in ca. 6 Sekunden |
| Kontextfenster | **12.288 Token** — harte Grenze |
| Parallele Anfragen | 4 gleichzeitig = 1,8× Durchsatz. Darüber nichts mehr |
| Kosten | 0 € pro Token. Nur Strom, ~14 W im Leerlauf |

MCP-Werkzeuge (laufen auf dem Mac, rufen den Server über LAN):
`ornith_task`, `ornith_survey`, `ornith_ask`

---

## 2. Wie gut das Modell wirklich ist — gemessen, nicht geschätzt

**Stark:**

- **Strukturierte Ausgabe: 10/10.** JSON-Schema-Anfragen kommen zuverlässig valide zurück. Zusätzlich per GBNF-Grammatik erzwungen — syntaktisch ungültige Ausgabe ist unmöglich.
- **Kontextverständnis: 3/3.** Findet in einem 6.000-Token-Kontext Nachbarschaftsbeziehungen, zählt Klassen korrekt, liest Feldnamen aus der Mitte.
- **Dart/Flutter-Grundlagen:** korrekt und idiomatisch. Dart ist deutlich besser abgedeckt als Swift.
- **Stabil:** kein Throttling, keine Streuung, keine Ausfälle über längere Läufe.

**Schwach — und zwar auf eine gefährliche Art:**

Bei einer größeren Aufgabe (Flutter-Screen mit Drawer, Formular, Validierung, SnackBar)
lieferte es 241 Zeilen, erfüllte 9 von 10 Anforderungen — und enthielt trotzdem:

- einen **Compile-Fehler** (`GlobalKey<Form>` statt `GlobalKey<FormState>`)
- einen **Laufzeitfehler** (`Scaffold.of(context)` im eigenen Scaffold-Build)
- einen **schweren UX-Bug** (Validierung löschte bei Fehler die Nutzereingaben)
- **toten Code** (Form-Key angelegt, aber `validate()` nie aufgerufen)

Rund 8% der Zeilen waren falsch. **Muster: Die Bausteine stimmen, die Verdrahtung nicht.**
Struktur sieht professionell aus, es scheitert an den Nahtstellen.

**Die wichtigste Eigenschaft:** Es meldet Erfolg bei kaputtem Code. Es sagt nicht "ich bin
unsicher". Behandle jede Ausgabe als Entwurf eines schnellen, aber unaufmerksamen Praktikanten.

**Bekannte Fallstricke:**

- Es ist ein **Reasoning-Modell** mit separatem `reasoning_content`. Bei zu knappem
  `max_tokens` kommt eine **leere Antwort** statt eines Fehlers.
- Zählaufgaben und Ordinalfragen ("die letzten drei X") sind unzuverlässig.
- Veralteter Stil möglich (z. B. `primarySwatch` statt `ColorScheme.fromSeed`).

---

## 3. Wofür du es benutzt — verbindliche Regeln

### IMMER delegieren

**A. Kontext-Aufbereitung vor eigener Arbeit** *(der wichtigste Fall)*

Bevor du selbst mehrere Dateien liest, ruf `ornith_survey`. Du bekommst Befund,
2–3 Optionen mit Risikoeinschätzung und eine Empfehlung — etwa 150 Token statt
5.000–20.000 für die Rohdateien. **Du entscheidest, Ornith liefert die Grundlage.**

Nicht: Datei lesen, dann denken.
Sondern: `ornith_survey` → Optionen prüfen → entscheiden → gezielt handeln.

**B. Codebase-Fragen**

"Wo wird der Login-State gehalten?", "Welche Views nutzen dieses ViewModel?",
"Was passiert bei fehlgeschlagenem Request?" — immer `ornith_survey` oder `ornith_ask`.
Nie selbst durch Dateien suchen. Hier ist das Modell nachweislich zuverlässig.

**C. Lokalisierung**

Strings in weitere Sprachen übersetzen, ARB-Dateien befüllen, Konsistenz prüfen.
Reine Fleißarbeit im Volumen. Immer lokal, im Batch, nie selbst.

**D. Tests im Volumen erzeugen**

Für jede Funktion Testfälle generieren lassen, dann **ausführen und nur die
behalten, die durchlaufen**. Der Testlauf filtert, nicht das Modell. Große Mengen,
niedrige Anforderungen an Einzelqualität — idealer Fall.

**E. AI-Features prototypen**

Wenn das Projekt ein Feature braucht, das ein Sprachmodell aufruft: erst gegen
`192.168.178.35:8081` bauen. Keine API-Kosten pro Nutzer beim Experimentieren.
Erst wenn das Feature steht, entscheiden, ob Produktion lokal oder Cloud läuft.

### NUR mit Gate delegieren

`ornith_task` für **eine Datei, ein präzise beschriebener Schritt**. Das Werkzeug
prüft automatisch mit `dart analyze`, bessert bis zu 3× selbst nach und setzt die
Datei bei endgültigem Fehlschlag zurück.

Formuliere die Aufgabe so eng, dass es nichts zu interpretieren gibt:

- Gut: *"Ergänze in `_emailValidator` eine Prüfung auf leeren String, gib 'Pflichtfeld' zurück"*
- Schlecht: *"Verbessere die Formularvalidierung"*

**Ein `status: ok` bedeutet nur: es kompiliert.** Es bedeutet nicht, dass die Aufgabe
erfüllt wurde. Lies immer das `summary`-Feld und prüf, ob es zur Anweisung passt.

### NIEMALS delegieren

- Architektur- und Designentscheidungen
- Änderungen über mehrere Dateien hinweg
- Alles Sicherheitsrelevante — Auth, Keys, Berechtigungen, Zahlungen
- State-Management-Umbauten
- Refactorings ohne Testabdeckung
- Alles, wo ein Fehler schwer rückgängig zu machen ist
- Beurteilung deiner eigenen Arbeit — ein 9B kann das nicht

---

## 4. Kontext und Tokens sparen

**Regel 1 — Ornith liest, du entscheidest.**
Jede Datei, die du selbst öffnest und die Ornith hätte zusammenfassen können, ist
verschwendetes Budget. Der Unterschied ist Faktor 30 bis 100.

**Regel 2 — Entscheidungen weiterreichen, keine Daten.**
Fordere von `ornith_survey` immer Optionen mit Risiko und Empfehlung an, nie
Rohinhalte. Ein strukturiertes Kontextobjekt hat 150–500 Token, die Datei 5.000+.

**Regel 3 — Ergebnisse verdichten, nicht durchreichen.**
Nach einem `ornith_task` nie den erzeugten Code in deinen Kontext holen. Das
`summary` reicht. Willst du prüfen, lies gezielt die geänderten Zeilen.

**Regel 4 — Kontexte klein halten.**
12K ist die Obergrenze des Servers. Eine Aufgabe, die mehr braucht, ist zu groß
geschnitten — teile sie.

**Regel 5 — Reparaturschleifen bleiben lokal.**
Compilerfehler gehen zurück an Ornith, nicht an dich. Erst nach drei Fehlversuchen
übernimmst du — dann ist das Problem konzeptionell, nicht syntaktisch.

**Regel 6 — bis zu 4 Aufgaben parallel.**
Mehrere unabhängige `ornith_*`-Aufrufe gleichzeitig bringen 1,8× Durchsatz.
Ab 5 verhungern sie sich gegenseitig.

---

## 5. Standardablauf

```
Nutzer beschreibt einen Wunsch
   ↓
ornith_survey  → Befund, Optionen, Empfehlung        (~150 Token)
   ↓
DU entscheidest, welche Option                        (deine Kernaufgabe)
   ↓
klein genug + eine Datei?
   ├─ ja   → ornith_task, danach summary prüfen
   └─ nein → selbst umsetzen, oder in Einzelschritte zerlegen
   ↓
dart analyze / flutter test
   ↓
Ergebnis knapp berichten, nicht den Code wiederholen
```

---

## 6. Wenn der Server nicht erreichbar ist

Nicht raten, nicht schweigend selbst weitermachen — sag es kurz an und arbeite
normal weiter. Der Server ist eine Optimierung, keine Voraussetzung.

Diagnose auf dem Server: `sudo docker ps --filter name=ornith`,
Neustart: `sudo docker restart ornith`
