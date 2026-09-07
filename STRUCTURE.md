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
| `assets/` | Icons, Splash und `sounds/` (CC0-Fokus-Musik); `island/` enthält 4 alte Platzhalter-PNGs und wird Zielordner der gerenderten Insel-WebPs |
| `plugins/withGoalsNativeConfig.js` | Expo-Config-Plugin: native App-IDs/URL-Schemes/Permissions bereinigen |
| `supabase/` | Schema, Migrationen, Edge Functions |
| `supabase/functions/_shared/coachPatterns.ts` | Deterministische Langzeit-Musteranalyse (ohne KI) |
| `supabase/functions/_shared/coachWriter.ts` | Groq-Aufruf, formuliert Nudges; fällt auf feste Texte zurück |
| `supabase/functions/coach-nudges/` | Edge Function: Muster → Cache → höchstens 1 Modell-Call/Tag |
| `island/` | Insel-Progression (Grove v2): `ISLAND.md` (alles: Entscheidungen, Design, System, Pipeline, Log), `mockups/` (SVG-Comic-Mockups), `blender/islandlib/` (Python-Pipeline), `concepts/`, `references/` (CC0-Vorlagen) |

## src/theme

| Datei | Zweck |
|---|---|
| `neumorphism.ts` | **Single Source of Truth** für Farben/Radien/Schatten (`NEU`, `NEU_FONTS`) |

## src/components — wiederverwendbare UI

| Datei | Zweck |
|---|---|
| `NeumorphicSurface.tsx` | Basis-Karte (duale Schatten, Clipping); `NeumorphicInsetOverlay` ist nur für ausdrücklich erlaubte mechanische Vertiefungen reserviert |
| `AtmosphericBackground.tsx` | Einfarbige `NEU.bg`-Fläche (Name historisch) |
| `BalanceCard.tsx` | Große Statuskarte auf der Homepage (Wochenbudget) |
| `GoalCard.tsx` | Kompakte Goal-Karte mit Progress + Start-Pill (Homepage) |
| `GardenPreview.tsx` | Grove-Vorschau, terminale Karte der Homepage (20pt oben / 31pt unten) |
| `ProgressBar.tsx` | Flache Progress-Bar (Accent-Fill, Track `NEU.track`) |
| `RatingSheet.tsx` | **Popup** nach Session-Ende: „Wie war die Session?" (Rating fließt in KI-Insights, wird nie angezeigt) |
| `PendingRatingSheet.tsx` | Globale Rating-Destination für manuell beendete Sessions und Check-In-Notifications |
| `FocusSetupSheet.tsx` | **Popup** vor Deep-Work-Start (Long-Press auf Start-Pill): Modus Intervall/Flowtime, Presets, Slider, Pausenvorschau |
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

- `FocusSetupSheet.tsx` (Deep-Work-Start, via Long-Press)
- `RatingSheet.tsx` (Session-Bewertung)
- `ui/PopupCard.tsx` (generische Basis)
- System-Alerts (`Alert.alert`) verstreut in Screens — bei Redesign prüfen

## src/screens

| Datei | Route | Zweck |
|---|---|---|
| `HomeScreen.tsx` | Tab „Home" | Referenzdesign: Zeitbudget, beide Ziele, Permission-Warnung, Grove-Vorschau, Friends/Stats/Settings |
| `GardenScreen.tsx` | Tab „Grove" | Interaktive, deterministische 3D-Session-Konstellation mit Pan/Rotation/Tooltip |
| `AnalyticsScreen.tsx` | Root Stack | Stats-Übersicht; nur über Home-Stats-Button, mit eigener Back-Aktion |
| `AnalyticsWeekScreen.tsx` | Stack | Wochendetail der Stats |
| `AuthScreen.tsx` | Stack (unauth) | Login/Signup; flache Minimal-Inputs, zwei runde Apple-/Google-Buttons; Back führt ins Onboarding |
| `PasswordResetScreen.tsx` | Recovery-Gate | Neues Passwort nach `com.goals.app://reset-password` setzen |
| `OnboardingScreen.tsx` | Stack (unauth/first) | 7-Seiten-Tour in zwei klaren Feature-Kapiteln; Auto Check-In wird direkt per Karte/Pin eingerichtet, Permissions schließt den Flow ohne Extra-Slide ab |
| `PermissionGateScreen.tsx` | Gate | Permissions nachfordern bei Rückkehrern |
| `SettingsScreen.tsx` | Stack | Goals bearbeiten, Focus-Prefs, Friends, Budget, Notifications, Permissions, Konto |
| `SetupStudyingScreen.tsx` | Stack | Deep-Work-Goal einrichten (Kategorie-Cards + Wochenstunden) |
| `SetupGeofenceScreen.tsx` | Stack | Auto-Check-In: Ortssuche (Nominatim), Kategorie-Cards, Radius, Wochenziel |
| `FriendsScreen.tsx` | Stack | Eigener Code, Freund hinzufügen, Wochenfortschritt der Freunde |
| `FocusSessionScreen.tsx` | Stack (fullscreen) | Laufende Session: Intervall + Flowtime, neumorphischer Timer-Dial, Pause, +5min, Musik |
Entfernt: `CreateGoalScreen.tsx`, `SessionLengthPicker.tsx`, `GardenOrb.tsx`,
`PlantRenderer.tsx`, `SkiaIslandDemoScreen.tsx`, `GlassCard.tsx` und
`NoiseTexture.tsx`. Es gibt keine tote Skia-/Glassmorphism-Route mehr.

## src/navigation

| Datei | Zweck |
|---|---|
| `RootNavigator.tsx` | Auth-Gate → Onboarding-Gate → PermissionGate → Stack |
| `MainTabs.tsx` | Unsichtbarer Home-/Grove-Routencontainer; **keine sichtbare Bottom-Navigation** |
| `types.ts` | `RootStackParamList`, `MainTabParamList` |

## src/store — Zustand (persistiert via AsyncStorage)

| Datei | Zweck |
|---|---|
| `index.ts` | Store-Zusammenbau + Persist-Konfig (Key: `goals-app-state-v3`, Version 1) |
| `configSlice.ts` | Auth-/Recovery-Status, UserConfig, Permission-Warnungen, Notification-Prefs, Pending-Onboarding |
| `goalsSlice.ts` | Goals + Wochenfortschritt |
| `sessionSlice.ts` | Aktive Session, Pomodoro-State, Ambient-Sound-Prefs |
| `walletSlice.ts` | Zeitbudget (Fixzeiten → verfügbare Stunden) |

## src/hooks

| Datei | Zweck |
|---|---|
| `useAuth.ts` | Einziger globaler Supabase-Auth-Bootstrap, Profile, Login/Signup/OAuth-Aktionen, Sign-out/Delete-Cleanup |
| `useGoals.ts` | Goals laden/mutieren (React Query) |
| `useSessions.ts` | Sessions, Wochenfortschritt, Monatsdaten; loggt Start-Koordinaten und steuert den manuellen Auto-Check-In-Fallback |
| `useInsights.ts` | JWT-geschützte Stats-Insights mit 24h React-Query-Cache, Server-Refresh und lokalem Fehler-Fallback |
| `usePomodoro.ts` | Wall-clock-Timer: Start-Deduplizierung, Intervall/Flowtime, Pause, Hintergrund-/Restart-Reconciliation |
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
| `insights.ts` | Lokale deterministische Insight-Heuristik als Offline-/Serverfehler-Fallback |
| `serverInsights.ts` | Validierung und Zeitlabel für Antworten der `analyze-sessions`-Function |
| `notifications.ts` | Streak-, Wochen-, Study-Spot- und Timer-Phasen-Notifications + Account-Cleanup |
| `studySpots.ts` | Fokus-Ort-Clustering + Persistenz für den Study-Spot-Geofence |
| `geofenceSessions.ts` | Reine, getestete Dauerentscheidung: kurzer Visit, gültige Session oder >18h-Orphan |
| `onboarding.ts` | Onboarding-Abschluss idempotent in Supabase schreiben (users + Focus Goal + optionales Auto-Check-In Goal) |
| `onboardingPlan.ts` | Reine, getestete Reconciliation-Planung für vorhandene/fehlende/duplizierte Onboarding-Goals |
| `focusStyle.ts` | Serialisierte Server-Persistenz für schnelle Focus-Style-Wechsel |
| `placeSearch.ts` | Gemeinsame Ortssuche, Kontinent-Priorisierung und Geofence-Radiusoptionen für Onboarding und Setup |
| `time.ts` | Datum/Zeit-Formatierung |
| `haptics.ts` | Haptik-Wrapper |
| `constellation.ts` | Deterministisches 3D-Sternbild-Layout und Projektion für den aktiven Grove |

## src/services

| Datei | Zweck |
|---|---|
| `geofencing.ts` | Background-Geofencing-Task (expo-location + task-manager), Auto-Check-In-Sessions |

## src/types

| Datei | Zweck |
|---|---|
| `index.ts` | Alle Domain-Typen (Goal, Session, PomodoroState, …) + Konstanten |

## supabase

| Pfad | Zweck |
|---|---|
| `schema.sql` | Kanonisches Fresh-Project-App-Schema: 4 nutzerbezogene Tabellen, Constraints, RLS und abgesicherte Friend-RPCs |
| `migrations/` | Inkrementelle SQL-Migrationen einschließlich privatem Place-Search-/Insight-Betrieb und `manual_checkin`; alle sieben Migrationen sind remote angewendet |
| `functions/delete-account/` | Deployte Edge Function: JWT-validierte Hard-Delete des eigenen Kontos |
| `functions/analyze-sessions/` | Deployte Edge Function v7: JWT-validierte Session-Analyse, privater 24h-Cache und drei manuelle Refreshes pro UTC-Tag |
| `functions/place-search/` | Deployte JWT-geschützte Ortssuche mit gemeinsamem Cache, Nutzerquote und globaler Upstream-Queue |
