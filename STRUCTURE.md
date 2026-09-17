# STRUCTURE.md — Projektstruktur „Goals"

> Zweck: Schnell finden, wo was liegt. Bei „ändere alle Popups" o.ä. hier nachschlagen.
> Bei strukturellen Änderungen (neue Screens/Komponenten) diese Datei mit aktualisieren.

## Root

| Pfad | Zweck |
|---|---|
| `App.tsx` | App-Einstieg: Fonts, QueryClient, Navigation, Auth-Bootstrap, Notification-Routing, Vordergrund-Refresh |
| `index.ts` | Expo-Registrierung |
| `app.json` | Expo-Konfiguration (Name, Bundle-ID, Permissions, Plugins) |
| `eas.json` | EAS-Build-Profile |
| `CLAUDE.md` | Verbindliche Design- und Arbeitsregeln (Neumorphismus-Spec) |
| `AGENTS.md` | Kopie der Projektregeln für andere Agents |
| `NEUMORPHISM.md` | Kurzzusammenfassung des finalen Systems; `CLAUDE.md` bleibt vollständig maßgeblich |
| `STRUCTURE.md` | Diese Datei |
| `PROGRESS.md` | Feature-Status & Entscheidungen — immer aktuell halten |
| `Information/` | Historische Prompts/Beschreibungen (nicht mehr maßgeblich) |
| `ios/` | Natives iOS-Projekt (aus `npx expo prebuild`) |
| `assets/` | Icons, Splash, `sounds/` (CC0-Fokus-Musik) und `home/island-ocean-1.png` als verbindlicher Home-Hintergrund; `island/` enthält 4 alte Platzhalter-PNGs und wird Zielordner der gerenderten Insel-WebPs |
| `plugins/withGoalsNativeConfig.js` | Expo-Config-Plugin: native App-IDs/URL-Schemes/Permissions bereinigen |
| `supabase/` | Schema, Migrationen, Edge Functions |
| `supabase/functions/_shared/coachPatterns.ts` | Deterministische Musteranalyse ohne KI für Coach-Nudges und Stats-Insight: Wochenziel, übliche Zeit, beste Zeit, Pause, Rhythmus, Trend |
| `supabase/functions/_shared/coachWriter.ts` | Groq formuliert nur stabile Muster und wird gegen deren Zahlen geprüft; sonst feste Texte |
| `supabase/functions/coach-nudges/` | Edge Function: Muster → Notification-Auswahl → Text-Cache → höchstens 1 Modell-Call/Tag |
| `island/` | Insel-Progression (Grove v2): `ISLAND.md` (alles: Entscheidungen, Design, System, Pipeline, Log), `mockups/` (SVG-Comic-Mockups), `blender/islandlib/` (Python-Pipeline), `concepts/`, `references/` (CC0-Vorlagen) |

## src/theme

| Datei | Zweck |
|---|---|
| `neumorphism.ts` | **Single Source of Truth** für Farben/Radien/Schatten (`NEU`, `NEU_FONTS`) |

## src/components — wiederverwendbare UI

| Datei | Zweck |
|---|---|
| `NeumorphicSurface.tsx` | Basis-Karte (duale Schatten, Clipping) |
| `ProgressBar.tsx` | Flache Progress-Bar (Accent-Fill, Track `NEU.track`) |
| `RatingSheet.tsx` | **Popup** nach Session-Ende: „Wie war die Session?" (Rating fließt in KI-Insights, wird nie angezeigt) |
| `DisplayNameSheet.tsx` | **Popup** aus Settings → Account: Anzeigenamen ändern (1–80 Zeichen, speichert über `useAuth().updateDisplayName`) |
| `GoalStartSheet.tsx` | **Popup** beim Start eines Goals: Fokus-Länge, Stil und was wächst (Pflanzen, Gebäude, Wasser, Strand); Check-In starten oder beenden |
| `grow/GrowObjectArt.tsx` | Zeichnet ein Insel-Objekt als Pixel-Sprite — alle vier Kategorien; die flachen Formen sind nur noch Rückfall |
| `grow/plantSprites.ts` | Pixelzeilen der 80 Pflanzenbilder (8 Arten × 10 Stufen), erzeugt von `island/pixel/export_sprites.py` — nicht von Hand ändern |
| `hooks/useFocusLiveActivity.ios.ts` | Treibt die Live Activity: laufende Session **und** offener Auto Check-In, plus was gerade wächst |
| `grow/MilestoneMoment.tsx` | Der Bildschirm, wenn eine Landmarke ankommt: Stunden, Objekt, Beschreibung |
| `grow/specialSprites.ts` | Die zehn Landmarken-Bilder, erzeugt von `island/pixel/special.py` |
| `grow/RewardWaitingPill.tsx` | Zeile auf Home: wie viele Belohnungen warten, oder was die App selbst platziert hat |
| `grow/GrowingObject.tsx` | Das Objekt im Fokus-Ring: wächst mit der Zeit, springt sichtbar eine Stufe hoch, ruht bei Pause und Pause |
| `grow/waterPieceSprites.ts` | Die einzelnen Wasserteile (Boot, Steg, Boje, Kajak, Fels, Delfin, Möwe) für die Insel selbst |
| `island/IslandObjectsLayer.tsx` | Zeichnet alles Gewachsene über den Home-Hintergrund: Wasser an festen Plätzen, Land an seinem gefundenen |
| `island/islandSprites.ts` | Eine Suche über alle vier Sprite-Dateien, samt Palette und Ankerpixel |
| `PendingRatingSheet.tsx` | Globale Rating-Destination für manuell beendete Sessions und Check-In-Notifications |
| `CategoryCards.tsx` | „Wofür ist es"-Kategorie-Grid + `ValueStepper` (Onboarding + beide Setup-Screens) |
| `TabIcons.tsx` | Alle SVG-Icons (24×24 ViewBox), inkl. `FriendsIcon`. Neue Icons hier ergänzen, keine Emojis |

### src/components/ui — Primitives (bevorzugt verwenden!)

| Datei | Zweck |
|---|---|
| `PrimaryButton.tsx` | Standard-CTA: solid Accent, Radius 12, kein Schatten |
| `TextAction.tsx` | Textbutton (Accent-Label, transparent) |
| `MinimalTextInput.tsx` | Verbindliches Texteingabefeld für die ganze App: flach, keine Schatten, 1pt neutral / 2pt Accent bei Focus |
| `PopupCard.tsx` | Modal-Panel (max. 420pt, Radius 20) — Basis für **alle Popups** |

### Alle Popups/Modals im Projekt

- `RatingSheet.tsx` (Session-Bewertung)
- `GoalStartSheet.tsx` (Start eines Goals, inkl. Auswahl, was wächst)
- `ui/PopupCard.tsx` (generische Basis)
- System-Alerts (`Alert.alert`) verstreut in Screens — bei Redesign prüfen

## src/screens

| Datei | Route | Zweck |
|---|---|---|
| `HomeScreen.tsx` | Hauptscreen | Insel im Hintergrund, Zeitbudget, beide Ziele, Permission-Warnung, wartende Belohnungen, Friends/Stats/Settings |
| `AnalyticsScreen.tsx` | Root Stack | Stats-Übersicht; nur über Home-Stats-Button, mit eigener Back-Aktion |
| `AnalyticsWeekScreen.tsx` | Stack | Wochendetail der Stats |
| `AuthScreen.tsx` | Stack (unauth) | Login/Signup; flache Minimal-Inputs, zwei runde Apple-/Google-Buttons; Back führt ins Onboarding |
| `PasswordResetScreen.tsx` | Recovery-Gate | Neues Passwort nach `com.goals.app://reset-password` setzen |
| `OnboardingScreen.tsx` | Stack (unauth/first) | 8-Seiten-Tour in zwei klaren Feature-Kapiteln; Auto Check-In wird direkt per Karte/Pin eingerichtet, Permissions schließt den Flow ohne Extra-Slide ab |
| `PermissionGateScreen.tsx` | Gate | Permissions nachfordern bei Rückkehrern |
| `SettingsScreen.tsx` | Stack | Goals bearbeiten, Focus-Prefs, Friends, Budget, Notifications, Permissions, Konto |
| `SetupStudyingScreen.tsx` | Stack | Deep-Work-Goal einrichten (Kategorie-Cards + Wochenstunden) |
| `SetupGeofenceScreen.tsx` | Stack | Auto-Check-In: Ortssuche (Nominatim), Kategorie-Cards, Radius, Wochenziel |
| `FriendsScreen.tsx` | Stack | Eigener Code, Freund hinzufügen, Wochenfortschritt der Freunde |
| `FocusSessionScreen.tsx` | Stack (fullscreen) | Laufende Session im Paper-Look: Intervall + Flowtime, Ring mit wachsendem Objekt, Pause, +5min, Musik; Ende ab 5 min öffnet `GrowReveal` |
| `GrowRevealScreen.tsx` | Stack (Fade) | Session-Belohnung: Größe, Kategorie (nach Auto Check-In), Objekt neu hinzufügen oder wachsen lassen |
Entfernt: `CreateGoalScreen.tsx`, `SessionLengthPicker.tsx`, `GardenOrb.tsx`,
`PlantRenderer.tsx`, `SkiaIslandDemoScreen.tsx`, `GlassCard.tsx` und
`NoiseTexture.tsx`. Es gibt keine tote Skia-/Glassmorphism-Route mehr.

## src/navigation

| Datei | Zweck |
|---|---|
| `RootNavigator.tsx` | Auth-Gate → Onboarding-Gate → PermissionGate → Stack |
| `MainTabs.tsx` | Routencontainer, rendert nur Home; **keine sichtbare Bottom-Navigation** |
| `types.ts` | `RootStackParamList`, `MainTabParamList` |

## src/store — Zustand (persistiert via AsyncStorage)

| Datei | Zweck |
|---|---|
| `index.ts` | Store-Zusammenbau + Persist-Konfig (Key: `goals-app-state-v3`, Version 1) |
| `configSlice.ts` | Auth-/Recovery-Status, UserConfig, Permission-Warnungen, Notification-Prefs, Pending-Onboarding |
| `goalsSlice.ts` | Goals + Wochenfortschritt |
| `sessionSlice.ts` | Aktive Session, Pomodoro-State, Ambient-Sound-Prefs |
| `walletSlice.ts` | Zeitbudget (Fixzeiten → verfügbare Stunden) |
| `islandSlice.ts` | Insel pro Konto, nur auf dem Gerät: Stufe pro Objekt, bereits angewendete Sessions, zuletzt gewählte Kategorie |

## src/hooks

| Datei | Zweck |
|---|---|
| `useAuth.ts` | Einziger globaler Supabase-Auth-Bootstrap, Profile (insert/update, nie upsert: Spalten-Grants), Login/Signup/OAuth-Aktionen, Sign-out/Delete-Cleanup |
| `useGoals.ts` | Goals laden/mutieren (React Query) |
| `useSessions.ts` | Sessions, Wochenfortschritt, Monatsdaten; loggt Start-Koordinaten und steuert den manuellen Auto-Check-In-Fallback |
| `useInsights.ts` | JWT-geschützter Stats-Insight pro gewähltem Goal (sendet Geräte-Zeitzone), 10-min-Client-Cache, lokaler Fehler-Fallback |
| `useCoachNudges.ts` | Holt Coach-Nudges (1× pro Tag und bei neuem Wochenfortschritt) und plant die lokalen Notifications |
| `usePomodoro.ts` | Wall-clock-Timer: Start-Deduplizierung, Intervall/Flowtime, Pause, Hintergrund-/Restart-Reconciliation |
| `useGrowHistory.ts` | Längen der früheren Sessions eines Goals (ab 5 min, neueste 50) für die Belohnungsgröße |
| `useAmbientSound.ts` | Fokus-Musik-Player (expo-audio, Loop, Hintergrund) |
| `useFriends.ts` | Friend-Code (generieren/teilen), Freund hinzufügen/entfernen, Wochenübersicht |
| `useStreak.ts` | Streak berechnen + Erinnerungs-Notification synchronisieren |
| `useStudySpotSync.ts` | Fokus-Orte clustern → Study-Spot-Geofence registrieren |
| `usePageRefreshAnimation.ts` | Fade-Animation bei Tab-Fokus |
| `useRefreshPermissionWarnings.ts` | Permission-Status prüfen → Warnungen setzen |

## src/lib

| Datei | Zweck |
|---|---|
| `supabase.ts` | Supabase-Client |
| `pomodoro.ts` | Session-Längen-/Pausen-Berechnung (Intervall adaptiv + Flowtime) |
| `streaks.ts` | Streak-Berechnung aus Sessions |
| `insights.ts` | Lokale Insight-Heuristik (nur Sessions ab 5 min) als Offline-/Serverfehler-Fallback |
| `coachSchedule.ts` | Reine Planung der Coach-Notifications: Gewohnheiten wöchentlich, alles andere einmalig mit Sperrfrist |
| `coachNudges.ts` | Coach-Notifications über expo-notifications planen und löschen |
| `serverInsights.ts` | Validierung und Zeitlabel für Antworten der `analyze-sessions`-Function |
| `notifications.ts` | Streak-, Wochen-, Study-Spot- und Timer-Phasen-Notifications + Account-Cleanup |
| `studySpots.ts` | Fokus-Ort-Clustering + Persistenz für den Study-Spot-Geofence |
| `geofenceSessions.ts` | Reine, getestete Dauerentscheidung: kurzer Visit, gültige Session oder >18h-Orphan |
| `onboarding.ts` | Onboarding-Abschluss idempotent in Supabase schreiben (users-Zeile nur prüfen, Focus Goal + optionales Auto-Check-In Goal schreiben) |
| `onboardingPlan.ts` | Reine, getestete Reconciliation-Planung für vorhandene/fehlende/duplizierte Onboarding-Goals |
| `focusStyle.ts` | Serialisierte Server-Persistenz für schnelle Focus-Style-Wechsel |
| `placeSearch.ts` | Gemeinsame Ortssuche, Kontinent-Priorisierung und Geofence-Radiusoptionen für Onboarding und Setup |
| `time.ts` | Datum/Zeit-Formatierung, Wochenstart (Montag), Geräte-Zeitzone |
| `haptics.ts` | Haptik-Wrapper |
| `growRewards.ts` | Reine, getestete Belohnungslogik: Kategorien, Katalog v1, Größe aus dem Verlauf, neu hinzufügen oder wachsen |
| `islandMerge.ts` | Verschmilzt zwei Kopien einer Insel: höhere Stufe gewinnt, Insel schrumpft nie |
| `islandSync.ts` | Liest und schreibt die Insel in `public.island_state` |
| `milestones.ts` | Welche Landmarken die Gesamtstunden verdient haben und was der Insel noch fehlt |
| `growDelivery.ts` | Sorgt dafür, dass jede Session ein Objekt hinterlässt: wann die App selbst platziert und was |
| `pendingGrows.ts` | Verdiente, aber noch nicht platzierte Belohnungen; serialisierte Änderungen, überlebt App-Neustart und Hintergrund-Task |
| `islandScene.ts` | Reine Logik der Insel: Inselgröße aus den gesammelten Stufen, welche Teile wo stehen |
| `islandPlacement.ts` | Sucht den Platz für ein neues Landobjekt: viel Platz bevorzugt, leicht zufällig, pro Account fest |
| `islandZones.ts` | Zonenkarte je Inselgröße (Wiese, Strand, Fels, Wasser), erzeugt von `island/pixel/export_layout.py` |
| `islandLand.ts` | Untergrund, Platzbedarf und Ankerpunkte der Landobjekte, ebenfalls erzeugt |
| `islandSlots.ts` | Die festen Plätze im Wasser je Inselgröße, erzeugt von `island/pixel/export_layout.py` — nicht von Hand ändern |
| `pendingGrows.ts` | Noch nicht platzierte Belohnungen in AsyncStorage (auch aus dem Geofence-Task), beim Abmelden gelöscht |

## src/services

| Datei | Zweck |
|---|---|
| `geofencing.ts` | Background-Geofencing-Task (expo-location + task-manager), Auto-Check-In-Sessions; legt die Belohnung ab und schickt die Grow-Notification |

## src/types

| Datei | Zweck |
|---|---|
| `index.ts` | Alle Domain-Typen (Goal, Session, PomodoroState, …) + Konstanten |

## supabase

| Pfad | Zweck |
|---|---|
| `schema.sql` | Kanonisches Fresh-Project-App-Schema: 4 nutzerbezogene Tabellen, Constraints, RLS und abgesicherte Friend-RPCs |
| `island_state` | Eine Zeile pro Spieler: die ganze Insel als JSON, damit sie am Account hängt und nicht am Gerät |
| `migrations/` | Inkrementelle SQL-Migrationen einschließlich privatem Place-Search-/Insight-Betrieb und `manual_checkin`; alle neun Migrationen sind remote angewendet |
| `functions/delete-account/` | Deployte Edge Function: JWT-validierte Hard-Delete des eigenen Kontos |
| `functions/analyze-sessions/` | Deployte Edge Function: JWT-validierter Stats-Insight pro Goal aus der Coach-Engine, immer frisch berechnet (kein Cache, kein Refresh-Limit mehr) |
| `functions/place-search/` | Deployte JWT-geschützte Ortssuche mit gemeinsamem Cache, Nutzerquote und globaler Upstream-Queue |
