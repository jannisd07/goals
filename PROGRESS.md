# PROGRESS.md — verbindlicher Feature- und Release-Status „Goals"

> Stand: 2026-07-30, nach vollständigem Code-, Navigations-, Design-, Daten-,
> Berechtigungs- und Release-Audit.
>
> Legende: ✅ implementiert und lokal geprüft · 🟡 implementiert, externer
> Produktionsschritt offen · ⏸ bewusst nicht Teil dieses Releases.

## 0. Aktueller Gesamtstand

Die im aktuellen Produktumfang vorgesehenen App-Flows sind implementiert:
Onboarding, E-Mail-/Google-/Apple-Auth, Passwort-Recovery, Home, Wochenbudget,
Focus Timer, Auto Check-In, Settings, Stats, Friends, Notifications, Ratings und
Grove. Tote Bottom-Bar-, Analytics-, Glassmorphism- und Skia-Routen wurden
entfernt. Der App-Code kompiliert, bundelt und baut nativ für den iOS-Simulator.

Noch **nicht** App-Store-fertig sind ausschließlich externe Konfigurations- und
Infrastrukturpunkte:

- 🟡 Apple Sign-In akzeptiert jetzt sowohl die Services-ID
  `com.dominik.vibetimeauth` als auch die native Bundle-ID `com.vibetime.app`;
  die vorherige `Unacceptable audience`-Ablehnung ist damit serverseitig
  behoben. Der echte Provider-Login bleibt auf einem Release-Gerät zu prüfen.
- 🟡 Supabase Confirm Email ist aktiv und die App blockiert unbestätigte
  E-Mail-Sessions. Für echte Zustellung an beliebige Nutzer muss noch ein
  eigener SMTP-Provider bzw. Send-Email-Hook konfiguriert werden; Supabases
  eingeschränkter Standardversand ist keine Produktionszustellung.
- 🟡 Supabase Auths Leaked-Password-Protection ist auf dem aktuellen Tarif
  nicht verfügbar: Der dokumentierte Management-API-Schreibversuch wird mit
  HTTP 402 abgelehnt. Die serverseitige Mindestlänge wurde passend zur App von
  6 auf 8 Zeichen erhöht.
- ✅ Der produktionsfähige Place-Search-Proxy ist remote aktiv:
  JWT-geschützte Edge Function, gemeinsamer Cache, atomisches Nutzerlimit und
  cross-instance Nominatim-Queue. Migration `place_search_proxy` wurde atomar
  angewendet, Function `place-search` ist aktiv und Preview-/Production-Builds
  setzen `EXPO_PUBLIC_PLACE_SEARCH_ENDPOINT=supabase`.
- 🟡 Reale End-to-End-Tests von OAuth, Always-Location, Background-Geofence und
  Account-Deletion brauchen echte Provider-Konfiguration bzw. ein physisches
  Gerät/Testkonto.

## 1. Rebranding und native App-Konfiguration — ✅

- App-Name, Slug, Store-Key, Background-Task-Namen und User-Agent heißen `Goals`.
- iOS-Bundle-ID: `com.vibetime.app` (bestehender App-Store-Eintrag, früher
  „Max – Habit Tracker“); Android-ID und URL-Scheme bleiben `com.goals.app`;
  Development-Client-Scheme zusätzlich
  `exp+goals`.
- Light-Only, Portrait, Splash und Icons sind auf das aktuelle Design abgestimmt.
- Native Permission-Texte beschreiben Location transparent.
- Background Modes enthalten nur `location` und `audio`; keine Mikrofon-
  Berechtigung oder Background Recording.
- Android-Berechtigungen werden einmalig durch die zuständigen Expo-Module
  eingebracht; eine zuvor redundante manuelle Doppelliste wurde entfernt.
- `plugins/withGoalsNativeConfig.js` hält die generierte Native-Konfiguration
  reproduzierbar.

## 2. Verbindliches Designsystem — ✅

- `src/theme/neumorphism.ts` ist Single Source of Truth:
  Seite `#E0E5EC`, leicht hellere Karten `#E9EDF2`, barrierearmer Accent
  `#415DCB`.
- Karten besitzen konsistente 20pt-Radien und duale Schatten mit Lichtquelle
  oben links. Grove hat nur unten den an die iPhone-Kontur angepassten 31pt-
  Abschluss und einen bewusst schwächeren unteren Schatten.
- Alle Buttons, Header-Tools, Toggles, Segmente, Stepper, Slider, Rating-Kreise,
  Auswahlkarten und Pills sind flach und ohne neumorphische Schatten oder
  Inset-Effekte. Start/Resume und aktive Auswahlzustände nutzen den violetten
  Solid-Akzent; sekundäre Aktionen sind Outline oder reiner Text.
- Headeraktionen Friends/Stats/Settings sind flache violette Kreise mit weißen
  Icons. `FlatToggle` ist der einzige Toggle.
- Alle Progress-Bars nutzen genau einen flachen Accent-Fill, nie einen Verlauf.
- Alle Eingabefelder verwenden `MinimalTextInput`: flach, neutraler 1pt-Rand,
  2pt-Accent bei Fokus/Fehler, keine Inset-/Drop-Shadows.
- Outfit 500/600/700, lesbare Textfarben und mindestens 44pt Touchflächen.
- Onboarding-Fortschritt, deaktivierte Stepper, Analytics-Heatmap,
  Grove-Konstellation und Rating-Dialog besitzen eindeutige VoiceOver-Semantik.
- Keine Emojis, bunten Hintergrund-Blobs, Glassmorphism-Flächen oder sichtbare
  Bottom-Navigation.
- Vollständige reproduzierbare Regeln: `CLAUDE.md`.

## 3. Navigation — ✅

- `RootNavigator`: Recovery → Loading/Auth → Onboarding → Permission Gate →
  Main Stack.
- `MainTabs` ist nur ein unsichtbarer Home-/Grove-Routencontainer; es gibt keine
  Bottom-Bar.
- Stats öffnet ausschließlich über den Home-Header und hat eine eigene Back-
  Aktion; Week Drill-down kehrt ebenfalls korrekt zurück.
- Friends/Settings/Goal-Setup sind Root-Stack-Seiten mit Back/Close.
- Grove öffnet über „Your Grove → View" und kehrt mit Back nach Home zurück.
- FocusSession verwendet eine stabile Route-ID; Doppel-Taps erzeugen weder zwei
  Screens noch zwei Datenbank-Sessions.
- Auth-Back funktioniert auch dann, wenn Auth die initiale Route nach einem
  abgeschlossenen Pre-Auth-Onboarding ist.

## 4. Onboarding — ✅

Acht Seiten, in Welcome und zwei klar getrennte Feature-Kapitel gegliedert:

1. ruhige Welcome-Seite mit Focus-Modi, optionalem Auto Check-In, Grove/Stats
   und verständlichem Privacy-Hinweis,
2. kurz eingeblendete/ausgeblendete Kapitelanimation
   **Feature 1 · Focus Timer**, danach derselbe Timer-Showcase,
3. „How do you work best?" — Intervals oder Flowtime,
4. Focus-Kategorie und Wochenstunden; die Wochenstunden werden mit einem
   horizontalen, einrastenden Zahlenrad mit räumlicher Drehung gewählt, nicht
   mit einem Standardslider,
5. dieselbe Kapitelanimation für **Feature 2 · Auto Check-In**,
6. Ort direkt auf der Karte pinnen/verschieben, aktuellen Standort verwenden
   oder explizit suchen und Treffer pinnen; der gewählte Radius 15/30/70 m wird
   als echte Kreisfläche auf der Karte gezeigt,
7. optionale Check-In-Kategorie und Wochenbesuche,
8. klar feature-bezogene Location-/Notification-Permissions und Abschluss.

Footer-Regel: reine Textaktionen, höchstens eine links und eine rechts, gleiche
Höhe, Abstand zur Bildschirmkante. Auto Check-In ist vollständig überspringbar;
Skip entfernt Ort und Check-In-Ziel, ohne ein Physical Goal anzulegen.

UX-/Motion-Audit am 2026-07-29:

- Der bisher rein punktbasierte Fortschritt ist jetzt eine zusammenhängende
  Fortschrittsleiste mit lesbarem Abschnittsnamen und `x of 8`; dadurch ist die
  Trennung zwischen Welcome, Focus Timer, Auto Check-In und Abschluss jederzeit
  sichtbar.
- Beide Feature-Kapitel verwenden exakt dieselbe Reveal-Sequenz, verschwinden
  nach 1,2 Sekunden und können jederzeit per Tap sofort geöffnet werden. Reduce
  Motion verkürzt den Wechsel auf 250 ms.
- Der horizontale Pager blendet Seiten dezent ein/aus und verschiebt sie nur
  18pt. Auf Karte und Zahlenrad ist Pager-Swipe deaktiviert, damit horizontale
  Eingaben nicht versehentlich die Seite wechseln.
- Timer-Ring und Standort-Puls laufen nicht mehr endlos: Der Ring füllt sich
  einmal, der Puls läuft zweimal. Beide besitzen einen statischen
  Reduce-Motion-Zustand.
- Alle Seiten sind auf kleinen Displays vertikal scrollbar, berücksichtigen die
  iOS-Tastatur und behalten den Footer in der Safe Area.
- VoiceOver kündigt Abschnitt und Schritt an; Überschriften und
  Timerstil-Auswahlen haben vollständigere Semantik.
- Welcome nennt nun die erwartete Dauer und weist sichtbar darauf hin, dass alle
  Entscheidungen später geändert werden können. Kein bestehender Inhalt und
  keine Setup-Funktion wurde entfernt.

Pre-Auth-Daten werden als `pendingOnboarding` persistiert und nach Signup
idempotent geschrieben. Bestehende aktive Ziele werden erkannt, sodass ein
wiederholter Abschluss keine Duplikate erzeugt. Vorhandene Teil-Setups werden
auf die aktuelle Auswahl aktualisiert; ältere Duplikate bzw. ein explizit
übersprungenes Auto Check-In werden deaktiviert, ohne Sessions zu löschen.
Netzwerkfehler führen in einen Retry-Zustand statt in einen falschen Abschluss.

## 5. Auth, Recovery und Kontolebenszyklus — ✅/🟡

- E-Mail-Signup/-Signin mit Feldvalidierung, verständlichen Fehlern und
  E-Mail-Bestätigungshinweis.
- Google und Apple als zwei getrennte, runde Brandbuttons mit korrekt großen,
  zentrierten Logos.
- Apple verwendet Nonce-Verifikation und speichert den nur beim ersten nativen
  Login gelieferten Namen best effort in Auth-Metadaten und Profil. Google
  verarbeitet Hash-/Query-Callbacks, Providerfehler und optionalen PKCE-Code.
- Ein einziger globaler Supabase-Auth-Listener; kein Listener pro Screen.
- Token-Refreshes sind mit `processLock` serialisiert und folgen dem nativen
  Foreground-/Background-Lifecycle.
- App-Start lädt zuerst das Profil und zeigt erst danach den authentifizierten
  Zustand. Token-Refresh verursacht keinen Fullscreen-Flash.
- Profil-/Netzwerkfehler zeigen „Account unavailable" + Retry statt Nutzer
  fälschlich auszuloggen oder Onboarding erneut zu starten.
- Benutzerwechsel und Sign-out löschen nutzerspezifischen Query-/Zustand,
  Geofences, lokale Notifications, Study-Spot-Daten und offene lokale Sessions.
- Passwort-Reset über `com.goals.app://reset-password` tauscht Code/Tokens sicher
  in eine Session und zeigt einen eigenen minimalen Reset-Screen.
- E-Mail-Signup verwendet `com.goals.app://auth-confirmed`; der Deep Link
  tauscht PKCE-Code oder Tokens aus und bestätigt den Account. Passwortnutzer
  ohne `email_confirmed_at` werden weder beim Bootstrap noch beim Sign-in als
  authentifiziert übernommen. Der Auth-Screen bietet einen echten
  „Resend confirmation email"-Pfad.
- Account-Deletion ruft eine JWT-validierte Edge Function auf; diese hard-deletet
  ausschließlich `auth.uid()` und verlässt sich nie auf eine Client-User-ID.

Externe Konfiguration:

- ✅ Supabase Site URL und Redirect Allow List enthalten
  `com.goals.app://auth-confirmed`, `com.goals.app://google-auth` und
  `com.goals.app://reset-password`.
- ✅ Supabase Apple Audience enthält Services-ID
  `com.dominik.vibetimeauth` und native Bundle-ID `com.vibetime.app`.
- 🟡 Eigenen SMTP-Provider bzw. Send-Email-Hook mit verifizierter Absenderdomain
  konfigurieren; ohne diesen externen Dienst kann die App keine verlässlichen
  Produktions-E-Mails zustellen.

## 6. Home und Wochenbudget — ✅

- Reale Store-/Supabase-Daten; keine TEMP-/Mock-Goals.
- Header: Name, Datum, Streak und Friends/Stats/Settings.
- Balance = 168 Wochenstunden minus Sleep, Work und Overhead minus alle
  abgeschlossenen Sessionzeiten; offene Fokuszeit wird live weitergezählt.
- Focus- und Auto-Check-In-Karte zeigen das jeweils passende Stunden-/Besuchs-
  Ziel und dieselbe Accent-Progress-Bar.
- Fokusziele besitzen im Edit-Screen ein eigenständiges minimalistisches
  Namensfeld; Kategorie und Kartenname überschreiben einander nicht mehr.
  Bestehende Goals werden mit einem Update-Payload ohne die absichtlich
  unveränderbare `user_id` gespeichert. Derselbe Berechtigungsfehler ist auch
  für bestehende Auto-Check-In-Goals behoben.
- Laufende Fokuszeit bewegt die Focus-Zielkarte live, zählt die Session aber erst
  nach Ende als abgeschlossen.
- Load-/Error-/Retry-Zustände verhindern falsche „keine Ziele"-Ansichten bei
  Netzwerkproblemen.
- Fehlende Ziele werden mit klarer Setup-Aktion gezeigt.
- Permission-Warnung führt direkt in die Systemeinstellungen.
- Grove-Vorschau füllt den verbleibenden Raum ohne Bottom-Bar und besitzt die
  gewünschte iPhone-konforme Unterkante.

## 7. Focus Timer — ✅

### Start und Persistenz

- One-Tap Start nutzt die letzte Sessionlänge.
- Die sichtbare flache Textaktion „Adjust" sowie weiterhin Long-Press öffnen das
  FocusSetupSheet mit Modus, 15/25/45/60-Presets, zugänglichem Slider und
  Pausenvorschau. Start bleibt eine klar abgesetzte Solid-Accent-Pill.
- Schnelle Focus-Style-Wechsel werden serialisiert gespeichert, sodass ein
  langsamer älterer Request nie die letzte Auswahl überschreibt.
- Ein modulweiter Pending-Guard verhindert parallele Session-Inserts.
- Die aktive Session inklusive `focused_seconds` und
  `last_tick_at_ms` wird in AsyncStorage persistiert.
- Ein über „Resume" geöffneter Focus-Screen markiert die vorhandene Session
  sofort als bereits gestartet. Wenn „End Session" den Store während der
  nativen Back-Transition leert, darf der Auto-Start-Effect niemals noch einmal
  auslösen. Nach bestätigtem Ende zeigt Home wieder `Adjust` + `Start` statt
  fälschlich `Resume`.

### Zeitlogik

- Reine Funktion `advancePomodoro` rechnet über echte Wall-Clock-Sekunden.
- Foreground-Ticks, Background-Rückkehr und Prozess-Restart verwenden dieselbe
  Logik und können mehrere Focus-/Break-Grenzen korrekt überschreiten.
- Intervall: Countdown, adaptive kurze Pause, lange Pause nach vier Blöcken,
  `+5 min`, Pause/Resume und Skip.
- Flowtime: Focus zählt offen hoch und besitzt bewusst keinen separaten
  Pause-/Resume-Zustand. Jede Unterbrechung ist ein Break mit offener
  Recovery-Stoppuhr; sie endet ausschließlich durch „Resume Focus". Eine fertige
  Flowtime wird über „End Session" beendet.
- Flowtime wird als genau eine zusammenhängende Session modelliert: Nach einer
  Recovery läuft die sichtbare gesamte Fokuszeit weiter. Es gibt keine
  „Stretches completed"-Zählung und Recovery-Schritte erhöhen keine Zyklen.
- Flowtime besitzt jetzt ein optionales, während der Session drehbares Fokusziel:
  Der flache Ring reagiert in 5-Minuten-Schritten, verfälscht nie die gemessene Zeit
  und löst weiterhin keine automatische Pause aus.
- Nur Fokusphasen erhöhen Zeitbudget/Sessiondauer; Pausen zählen nicht.
- Stop schreibt Dauer, Zyklen, Growth Stage und Sound serverseitig. Bei
  Netzwerkfehler bleibt die Session erhalten und kann erneut beendet werden.
- Beim Sign-out wird eine offene manuelle Session vorher reconciled und beendet
  oder bei 0 Sekunden gelöscht.

### UI, Audio und Accessibility

- Intervals und Flowtime sind nun in allen entscheidenden Einstiegen eindeutig
  getrennt: Die gemeinsame flache Auswahl nennt zusätzlich immer das
  Zeitverhalten „Countdown" bzw. „Count up". Settings zeigt bei Flowtime keine
  irrelevante feste Break-Länge und keinen erklärenden Ziel-Hilfstext mehr.
- Der laufende Timer benennt oberhalb des Dials explizit
  `INTERVALS · COUNTDOWN`, `FLOWTIME · COUNT UP` oder
  `RECOVERY · COUNTDOWN` und erklärt das jeweilige Endverhalten. Im Flowtime-
  Modus ist Pause die einzige gefüllte Primäraktion; Break ist eine flache
  Outline-Sekundäraktion. Home zeigt bereits vor One-Tap-Start „Intervals" oder
  „Flowtime" statt des mehrdeutigen Labels „Focus".
- Der Focus-Dial ist auf die ruhige flache Variante zurückgesetzt: 260pt,
  ein einzelner 6pt-Track und ein einzelner 6pt-Akzentfortschritt.
- Rail-, Pipe-, Innen-, Außen- und Glow-Schatten sowie SVG-Filter und die
  zwischenzeitlich getestete Skia-Komponente wurden vollständig entfernt.
- Der Flowtime-Ring ist per relativer Kreisbewegung und VoiceOver
  Increment/Decrement verstellbar. Beim Ansetzen springt der Wert nicht mehr
  sofort zur absoluten Touchposition; Bewegungen über die 12-Uhr-Naht werden
  normalisiert. Timer-Mitte und Intervallmodus bleiben geschützt.
- Pause/Resume ist eine große flache Accent-Pill mit echtem Pause-/Play-Icon,
  sichtbarem Text und eindeutigem VoiceOver-Label. Der pausierte Zustand steht
  zusätzlich im Status und der Countdown bleibt nachweislich stehen.
- Break/Skip/+5 min und End Session haben klare 44pt Ziele. End Session verlangt
  eine Bestätigung und nennt vorher die gespeicherte Fokusdauer.
- Fünf echte CC0-Tracks aus Open Lofi; Loop und Background Playback via
  `expo-audio`, ohne Mikrofonberechtigung. Musik bleibt opt-in; „Off" ist ein
  sichtbarer, vollständig funktionaler Zustand.
- Lautstärkeregler verwendet die reale Layoutbreite, reagiert auf Tippen/Ziehen
  und unterstützt VoiceOver Increment/Decrement.
- Beim Backgrounding wird genau eine passende Focus-/Break-Endnotification
  geplant; im Foreground/bei Stop wird sie entfernt. Paused/Flowtime-Focus plant
  keine falsche Grenze.
- Ein gestarteter manueller Timer erzeugt auf unterstützten iPhones eine echte
  ActivityKit Live Activity für Sperrbildschirm und Dynamic Island. Compact,
  minimal, expanded und Lock-Screen-Banner unterscheiden verständlich
  `FLOWTIME`/`INTERVALS` sowie `FOCUS MODE`, `RECOVERY MODE` und `BREAK MODE`;
  Zielname, laufende oder pausierte Zeit und Status bleiben ohne sekündliche
  JavaScript-Updates lesbar.
- Die erweiterte Dynamic Island und der Sperrbildschirm spiegeln die Modi
  eindeutig: Intervals bietet `Pause`/`Resume` plus `Break`/`Focus`; Flowtime
  zeigt ausschließlich `Take Break` beziehungsweise `Resume Focus` und niemals
  einen Pause-Button. Ein manuell aus einem Intervall gestarteter Break bewahrt
  die bereits gearbeitete Intervallzeit und kehrt danach in denselben Block
  zurück; Flowtime-Recovery bleibt wie im Hauptscreen offen. Doppelte Live
  Activities werden bereinigt und beim Sessionende sofort geschlossen.

## 8. Ratings — ✅

- Nach manuellem Stop oder Tap auf eine Check-In-Endnotification erscheint
  derselbe globale Rating-Sheet.
- 1–5, optionale kurze Notiz, Skip und Retry bei Lade-/Speicherfehlern.
- Rating/Notiz werden gespeichert, aber nicht als soziales Leistungsmerkmal
  angezeigt; sie dienen nur persönlichen Insights/Grove-Tooltip.

## 9. Auto Check-In — ✅/🟡

- Ein Physical Goal mit Kategorie, Wochenbesuchen, Radius und konkretem Ort.
- Ortssuche ist nur auf explizite Nutzeraktion aktiv und lokal begrenzt gecacht.
  Auf iOS nutzt sie einen eigenen Expo-Nativbaustein mit Apples `MKLocalSearch`,
  echter Geräteposition als Suchregion und POI-/Adresssuche. Dadurch werden auch
  Geschäfts- und Ortsnamen gefunden, die Nominatim häufig nicht kennt.
- Die erste Suche ist hart auf das Land des realen Gerätestandorts begrenzt:
  Koordinaten und Land stammen bei erteilter Foreground-Permission aus Standort
  plus Reverse-Geocoding; die Geräte-Region ist der robuste Fallback. Ergebnisse
  aus anderen Ländern werden clientseitig entfernt, sodass kein russischer oder
  sonstiger ausländischer Treffer in die lokale Liste fällt.
- Es gibt keinen stillen globalen Fallback und keine automatische Auswahl des
  ersten Treffers. Leere lokale Ergebnisse bieten ausdrücklich „Search
  Worldwide"; erst der Tap auf einen konkreten Treffer setzt den Pin.
- Setup und Onboarding zeigen den gewählten Detection Radius als farbige,
  maßstabsgetreue Kreisfläche direkt auf der Karte.
- iOS/Android Background-Geofence registriert Enter und Exit.
- Enter erzeugt eine offene Supabase-Session; Exit unter 10 Minuten löscht sie,
  längere Besuche werden abgeschlossen und optional gemeldet.
- Home liest den offenen Physical-Sessionstatus direkt aus Supabase. Ein
  laufender automatischer Besuch kann dort sofort über `End session` beendet
  und bewertet werden. Falls Background-Erkennung nicht greift, startet
  `Start manually` denselben sicheren Check-In-Flow mit dem eigenen Trigger
  `manual_checkin`; der nächste Geofence-Enter erzeugt dabei kein Duplikat.
- Doppelte Events werden debounced. Ein >18h verwaister Visit wird beim nächsten
  Enter, Exit und auch beim Logout-Cleanup verworfen statt als mehrtägige
  Session gespeichert. Verspätete Events für deaktivierte Goals werden ignoriert.
- Sign-out sperrt neue Geofence-Verarbeitung sofort, stoppt die Registrierung
  und leert bereits zugestellte Event-Operationen, bevor persistierte Visits
  geschlossen werden. Ein Enter-Race kann dadurch keine Session mehr in das
  nächste Konto tragen.
- Sign-out schließt/löscht lokale offene Visits bestmöglich und entfernt alle
  Account-Geofences.
- Permission-Prompts erscheinen nur nach einer expliziten Onboarding-/Gate-
  Nutzeraktion, nie überraschend beim App-Start.
- Ein nach dem Onboarding neu angelegtes Physical Goal löst die Permission-
  Prüfung erneut aus, sodass fehlendes „Always"/Background-Location nicht
  unbemerkt bleibt.
- Rückkehr aus iOS Settings aktualisiert den Gate-/Settings-Status automatisch.

✅ Der produktive Pfad ist lokal und remote aktiv:
`supabase/functions/place-search` authentifiziert jeden Aufruf über das
Supabase-JWT, speichert nur einen SHA-256-Query-Key statt der Klartextsuche,
cacht bereinigte Antworten sieben Tage, begrenzt pro Nutzer auf 40 Requests pro
Minute und serialisiert Cache-Misses projektweit mit mindestens 1,1 Sekunden
Nominatim-Abstand. Der Client sendet sein JWT ausschließlich an die aus
`EXPO_PUBLIC_SUPABASE_URL` abgeleitete, exakt geprüfte eigene Function-Origin.
Preview und Production aktivieren den Proxy über
`EXPO_PUBLIC_PLACE_SEARCH_ENDPOINT=supabase`; lokale Entwicklungsbuilds behalten
den funktionierenden, gedrosselten Direktfallback.

## 10. Study-Spot-Suggestions — ✅

- Manuelle Sessions speichern bestmöglich eine letzte bekannte Startposition,
  ohne Permission-Prompt und ohne Startblockade.
- Drei abgeschlossene Sessions im 150-m-Cluster innerhalb 60 Tagen ergeben einen
  stillen Study Spot; Orte nahe einem Auto-Check-In werden ausgeschlossen.
- Ankunft kann alle drei Stunden eine ruhige Nudge senden, wenn „Smart
  Suggestions" aktiv und Notification-Permission vorhanden ist.
- Der Cooldown wird nur gesetzt, wenn eine Notification wirklich zugestellt
  werden konnte.

## 11. Stats und Insights — ✅

- Zugriff nur über Home-Stats-Button; kein Analytics-Tab.
- Header, Ladezustand und Inhalt besitzen durchgehend denselben Seitenhintergrund.
  Der Header ist Teil desselben ScrollViews und scrollt mit der gesamten Seite
  nach oben; es gibt keine sticky Top-Bar und keine Schattenkante.
- Monatsnavigation nie in die Zukunft.
- Zielsegment, KPI-Karten, Montag–Sonntag-Kalender-Heatmap, persönlicher
  Server-Insight und Wochenliste mit Drill-down.
- Physical Goals rechnen Besuche, Focus Goals Dauer; Monats-KPIs filtern auf den
  Monat, Wochenziele besitzen vollständige Montag–Sonntag-Grenzen und behandeln
  aktuelle Wochen nicht als verfrüht „missed".
- Zeitzonen-/DST-sichere lokale Kalendergrenzen.
- Loading/Error/Retry statt stiller Nullwerte.
- Die JWT-geschützte `analyze-sessions`-Function ist als primäre Quelle
  angebunden. Sie nutzt einen privaten 24-Stunden-Servercache, erzeugt erst ab
  fünf bewerteten Sessions persönliche Muster und begrenzt manuelle Refreshes
  atomisch auf drei pro UTC-Tag. Bei Offline-/Serverfehlern bleibt die
  deterministische lokale Heuristik sichtbar.

## 12. Streaks und Notifications — ✅

- Streak = aufeinanderfolgende lokale Kalendertage mit mindestens einer
  abgeschlossenen Session; 90-Tage-Abfrage.
- Abendnudge nur bei echtem Risiko und aktivem Toggle.
- Optionaler Sunday-Weekly-Summary öffnet Stats.
- Check-In-Start/-Ende, Rating, Study Spot und Focus-Phasen besitzen getrennte
  Payloads/Ziele.
- Alle Schedules respektieren Permission und Preferences; Sign-out entfernt
  geplante und bereits zugestellte accountbezogene Notifications.
- Settings enthält „Send Test Notification": bei erteilter Berechtigung wird
  unmittelbar eine lokale Testnotification geplant; bei verweigerter
  Berechtigung führt die Aktion gezielt in die iOS-Einstellungen.
- Entzogene Permissions löschen weiterhin alte Schedules; spätere Freigabe
  synchronisiert Weekly Summary erneut und Scheduling-Fehler bleiben best effort
  statt als unbehandelte Promise-Rejection zu enden.
- App-Foreground invalidiert Sessions, Fortschritt, Streak, Grove, Study Spot und
  Freunde, damit Background-Geofence-Writes sofort sichtbar werden.

## 13. Friends — ✅

- Eigener zufälliger Code aus einem verwechslungsarmen Alphabet, Share-Sheet,
  Code-Eingabe, Liste, Retry und Entfernen.
- Sichtbar sind ausschließlich Display Name, Focus-Stunden/-Ziel und
  Visits/-Ziel der ausgewählten Woche—keine Roh-Sessions, Orte, Ratings oder
  Notizen.
- Bidirektionales Add/Remove liegt in `SECURITY DEFINER`-RPCs; PUBLIC Execute ist
  entzogen, nur `authenticated` darf aufrufen.
- Wochen-RPC akzeptiert höchstens ein 8-Tage-Fenster.
- DB-Constraints sichern Friend-Code-Format und eine aktive Goal-Instanz pro Typ.

Die RPC-/RLS-/Constraint-Regeln sind Bestandteil der bereits remote angewendeten
Migration `production_backend`.

## 14. Grove — ✅

- Kein altes Orb-/Plant-/Skia-Experiment mehr.
- Bis zu 250 abgeschlossene Sessions werden deterministisch zu 3D-Sternen;
  Dauer beeinflusst Größe/Zentrumsnähe, Ziele bilden MST-Cluster.
- Auto-Rotation pausiert bei Pan und setzt später fort.
- Tap zeigt Dauer, Datum und optionales Rating.
- Loading, Empty, Error/Retry und Back sind vorhanden; Timer/RAF werden beim
  Unmount bereinigt.

## 15. Settings — ✅

- Ziele öffnen die passenden Edit-Screens.
- Beide Goal-Editoren lösen das aktive Goal erneut serverseitig auf, blockieren
  parallele Submits und aktualisieren Store sowie React-Query-Cache gemeinsam.
- Focus Style wird serverseitig gespeichert und bei Fehler zurückgerollt.
- Sessionlänge, nur im Intervallmodus sichtbare Breakbasis, Musik und
  Notification-Prefs sind bewusst gerätelokal persistiert.
- „My Budget" ist vollständig aus Settings entfernt; Schlaf-, Arbeits- und
  Overhead-Stepper konkurrieren dort nicht mehr mit den beiden Kernfeatures.
- Flowtime zeigt weder eine irrelevante Basis-Pausenlänge noch den früheren
  „This target only …"-Hilfstext.
- Permission-Status aktualisiert sich nach Rückkehr aus Settings.
- Sign-out und permanente Account-Deletion haben Bestätigung, Fehlerzustände und
  Background-Cleanup.

## 16. Datenbank und Security — ✅

Kanonischer Fresh-State: die geordnete Kette unter `supabase/migrations/`;
`supabase/schema.sql` bleibt eine lesbare Baseline-Referenz.

- `users`, `goals`, `sessions`, `friend_links`, Foreign Keys und Indizes.
- Supabase E-Mail-Auth ist aktiv; für jedes `auth.users`-Konto wird atomar ein
  privates Profil erzeugt. Bestehende Profile wurden ohne E-Mail-Duplikation
  backgefüllt und normalisiert.
- Fokusdauer, Pausenlänge, Standardmusik, Lautstärke und
  Notification-Präferenzen werden kontobezogen und geräteübergreifend gespeichert.
- RLS auf allen Tabellen.
- `anon` besitzt keinerlei Tabellenzugriff; `authenticated` erhält nur die von
  der App benötigten Tabellen- und Spaltenrechte.
- Session-Insert/Update darf nur auf ein eigenes Goal des passenden Typs zeigen;
  ein Composite Foreign Key erzwingt dieselbe Eigentümerschaft auch außerhalb RLS.
- Gültige Profile, Commitments, Präferenzen, Goals, Locations, Sessions,
  Koordinaten, Dauern, Ratings, Musikwerte und Friend-Codes werden per Constraint
  erzwungen.
- Höchstens ein aktives Goal pro Nutzer und Typ.
- Die zugehörige Bestandsmigration deaktiviert vor dem Unique-Index ältere
  aktive Duplikate, ohne Goals oder referenzierende Sessions zu löschen.
- Öffentliche Friend-RPCs sind `SECURITY INVOKER`, nicht anonym ausführbar und
  delegieren ausschließlich an privilegierte Implementierungen im nicht
  exponierten `private`-Schema. Wochenabfragen sind auf die aktuelle Woche begrenzt.
- `analyze-sessions` und `delete-account` leiten die User-ID ausschließlich aus
  dem validierten JWT ab.
- Die neue Place-Search-Migration aktiviert RLS auf allen drei operativen
  Tabellen, entzieht `anon`/`authenticated` sämtliche Tabellen- und
  RPC-Rechte und erlaubt Cache-/Quota-/Queue-Zugriff nur der serverseitigen
  `service_role`. Nutzerquoten und globale Upstream-Slots werden atomisch in
  kurzen PostgreSQL-Transaktionen reserviert.

Remote:

- ✅ Produktionsmigrationen `production_backend` und
  `composite_session_owner_index` sind im Projekt `uxpburqocxlcivcdtotb`
  angewendet.
- ✅ Edge Functions `analyze-sessions` (v4) und `delete-account` (v2) sind aktiv
  und verlangen ein gültiges JWT; anonyme Testaufrufe liefern HTTP 401.
- ✅ Migration `place_search_proxy` ist remote angewendet. Alle drei operativen
  Tabellen haben RLS; `anon` und `authenticated` besitzen keine Tabellenrechte,
  `service_role` besitzt nur die benötigten Rechte. Edge Function
  `place-search` v1 ist aktiv, verlangt ein JWT und liefert ohne Authorization
  nachweislich HTTP 401.
- ✅ Migrationen `insight_cache` und `manual_checkin` sind remote angewendet.
  Insight-Cache und Refresh-Zähler sind für `anon`/`authenticated` vollständig
  gesperrt. `analyze-sessions` v7 ist aktiv und JWT-geschützt; der
  Session-Constraint akzeptiert exakt `geofence`, `manual_checkin` und
  `manual_pomodoro`.
- ✅ Auth-/Profilanzahl stimmt überein; Profile laden nach App-Neustart und
  Cross-Device-Präferenzen wurden über Simulator → DB → Wiederherstellung geprüft.
- ✅ Security Advisor: keine anonym exponierten Tabellen oder öffentlichen
  `SECURITY DEFINER`-RPCs mehr. Verbleibend ist nur die tarifbedingt nicht
  verfügbare Leaked-Password-Protection sowie erwartete Hinweise zur
  absichtlichen Data-API-Sichtbarkeit für authentifizierte, per RLS isolierte
  Tabellen.

## 17. QA-Status

Bereits erfolgreich:

- ✅ `npx tsc --noEmit -p .`
- ✅ `npx expo-doctor`: 19/19
- ✅ cachefreier iOS- und Android-JS-Export
- ✅ nativer iPhone-Simulator-Build nach den finalen Fixes: 0 Fehler
  (nur bekannte Warnungen aus Expo-/React-Native-Abhängigkeiten)
- ✅ Neuer lokale Expo-Nativbaustein `ExpoPlaceSearch` via CocoaPods
  autoverlinkt und mit Xcode 27 einschließlich `MKLocalSearch` kompiliert.
- ✅ Aktueller vollständiger Check am 2026-07-30:
  TypeScript fehlerfrei, 74 Domain-Assertions grün und Expo Doctor 19/19.
- ✅ Cachefreie produktionsnahe iOS- und Android-Hermes-Exporte mit
  `EXPO_PUBLIC_PLACE_SEARCH_ENDPOINT=supabase`; Bundle, Assets und der
  Supabase-Place-Search-Pfad sind nachweislich enthalten.
- ✅ `expo-widgets`-Extension mit App Group
  `group.com.vibetime.app`, `NSSupportsLiveActivities` und interaktiven
  ActivityKit-Intents reproduzierbar per Expo Prebuild erzeugt; CocoaPods,
  cachefreier iOS-Metro-Export und vollständiger Xcode-27-Simulator-Build
  einschließlich Embedded-Extension-Validierung erfolgreich.
- ✅ Dev-Client-Manifest/Bundle im Expo-Offline-Modus
- ✅ Vollständiger visueller iPhone-17-Pro-Klicktest am 2026-07-28:
  alle damaligen sieben Onboarding-Seiten einschließlich beider Kapitelanimationen,
  direktem Karten-Pin und Skip-Pfaden; Sign-up, Sign-in und leere
  Feldvalidierung; Home, Settings (oben/unten), Stats mit Back-Navigation,
  Grove mit Back/Drag und Focus Timer mit Pause/Resume.
- ✅ Zusätzlicher Kernfeature-Regressionslauf am 2026-07-28 mit frisch nativ
  gebautem Dev Client: Auto-Check-In-Ortssuche gegen simulierten Standort Berlin
  liefert ausschließlich deutsche Treffer, zeigt bei leerem lokalen Resultat
  nur den expliziten Worldwide-Fallback und setzt erst nach Ergebnis-Tap einen
  Pin; Focus Timer durchlief Start, laufenden Countdown, Pause mit stabilem
  Zeitstand, Resume, `+5 min`, End-Bestätigung und Rating-Skip. „Music Off" war
  vor und während des gesamten Tests ausgewählt; es wurde kein Audio abgespielt.
- ✅ Der frisch installierte iOS-Dev-Client führt
  `goals-geofence-task` tatsächlich als registrierten
  `EXGeofencingTaskConsumer`; dies wurde read-only in der Simulator-
  Taskregistrierung geprüft, ohne einen künstlichen Check-In zu erzeugen.
- ✅ 18 Beleg-Screenshots unter
  `/Users/jannisdietrich/Downloads/goals-visual-audit-2026-07-28`.
- ✅ 74 deterministische Domain-Smoke-Assertions für Pomodoro, Streak,
  Study Spot, Constellation, Wochenbudget, Onboarding-Reconciliation und
  Geofence-Dauergrenzen sowie Place-Search-Provider-, Request-, Cache-Key- und
  Upstream-Response-Validierung und Server-Insight-Parsing
- ℹ️ Der Focus-Dial wurde danach auf Nutzerwunsch wieder auf 260pt mit flachem
  6pt-Track und flachem 6pt-Akzentfortschritt zurückgesetzt. Für diesen visuellen
  Rollback wurde auf Nutzerwunsch kein neuer Simulator-Test ausgeführt.
- ✅ `git diff --check`

Im finalen Simulatorlauf gefundene und danach erneut visuell geprüfte Fehler:

- ✅ Resume-Endlosschleife beseitigt: Eine über Home fortgesetzte Session wurde
  beim Beenden zuvor während des Screen-Unmounts sofort neu angelegt. Der
  Initial-Guard berücksichtigt nun vorhandene Sessions; der reale Ablauf
  `Resume → End Session → Bestätigung → Rating Skip → Home` endet sichtbar mit
  `Adjust` und `Start`.
- ✅ Gleichzeitige Startversuche für zwei verschiedene Goals teilen nicht mehr
  blind dasselbe Erfolgs-Promise. Der zweite Aufruf meldet nur dann Erfolg, wenn
  die tatsächlich aktive Session zu seinem Goal gehört.
- ✅ Sessionlängen- und Lautstärke-Slider verwenden stabile absolute
  Trackkoordinaten statt kindabhängigem `locationX`; Track-Taps, Endpunkte und
  Screenreader-Schritte springen nicht mehr. Thumb und persistierte Lautstärke
  bleiben an beiden Grenzen im gültigen Bereich.
- ✅ `PopupCard` ist eine vollständig flache Kartenfläche ohne neumorphischen
  Außen-, Drop- oder Glow-Schatten; Focus-Setup und Rating verwenden dieselbe
  zentrale Popup-Regel.
- ✅ Friends und Settings besitzen keine separate feste Top-Bar mehr. Titel,
  Close-Aktion und Karten liegen im selben Scroll-Inhalt auf einer durchgehenden
  Hintergrundfläche; zwischen Header und erstem Kartenblock existiert keine
  horizontale Viewport-Naht mehr.
- ✅ Der helle obere Schatten der jeweils ersten Karte ist dort deaktiviert;
  dadurch bleibt auch optisch keine horizontale Lichtkante als vermeintliche
  Top-Bar zurück.
- ✅ Grove-Endlosschleife beseitigt: Während des Query-Ladens wird eine stabile
  leere Session-Liste verwendet; Layout-State wird nur bei echten
  Koordinatenänderungen aktualisiert. Grove lädt wieder Konstellation und
  Drag-Geste statt „Maximum update depth exceeded".
- ✅ Focus-Timer-Soundauswahl passt vollständig in die iPhone-Breite; „Lo-fi"
  wird nicht mehr auf „L" abgeschnitten, alle sechs Optionen bleiben mindestens
  44pt groß.
- ✅ Onboarding-Fortschritt meldet für VoiceOver korrekt Abschnitt und Schritt
  1–8; der Abschluss ist exakt Schritt 8 von 8 und überschreitet 100 % nicht.

Testgrenzen:

- ✅ Direkte Geräteinstallation des aktuellen Live-Activity-Stands am 2026-07-29
  erfolgreich: Nach Anmeldung des berechtigten Team-Accounts und Aktivierung von
  `group.com.vibetime.app` für `Goals` und `ExpoWidgetsTarget` wurden neue
  Development-Profile erzeugt. Release `Goals 1.0.0 (36)` wurde vollständig
  nativ mit Xcode 27 beta 4 gebaut, tief signaturgeprüft und per USB auf
  `Jannis’s iPhone` installiert. Haupt-App und eingebettete
  `com.vibetime.app.ExpoWidgetsTarget` tragen beide Build 36 und dieselbe App
  Group; beide Prozesse liefen acht Sekunden nach dem Kaltstart weiter. Kein
  TestFlight-Upload war für diese Geräteprüfung erforderlich.
- ✅ Dynamic-Island-Tapziel am 2026-07-29 in Build 37 repariert:
  `expo-widgets@55.0.20` speicherte die Live-Activity-URL als `String`, las sie
  in der Extension aber fälschlich als `Data`; dadurch blieb `widgetURL` leer.
  Der korrigierte String-Zugriff ist reproduzierbar über `patch-package`
  hinterlegt. `com.goals.app://focus?goalId=…` wird zusätzlich am App-Root
  verarbeitet und öffnet den passenden laufenden Focus-Screen. Haupt-App und
  Extension wurden beide als `1.0.0 (37)` signiert, per USB installiert und
  blieben nach Kaltstart sowie einem echten `openURL`-Test aktiv. Die visuelle
  Darstellung und der Tap direkt auf der Dynamic Island bleiben ein manueller
  Gerätecheck, weil sie ohne Bedienung der iPhone-Oberfläche nicht vollständig
  automatisiert werden können.
- ✅ Die anschließenden echten USB-Systemlogs haben die verbleibende Ursache
  eindeutig bewiesen: ActivityKit erzeugte die Live Activity korrekt, aber
  `ExpoWidgetsTarget` wurde beim Rendern wiederholt mit
  `jetsam / per-process-limit` beendet; `chronod` meldete danach einen
  fehlgeschlagenen Reload und ActivityKit entfernte die Activity sofort. Es
  handelte sich damit weder um eine Live-Activities-Berechtigung noch um eine
  fehlerhafte Activity-Anforderung, sondern um den Speicherverbrauch des
  JavaScript-basierten Expo-Widget-Renderers.
- ✅ Build 38 ersetzt den Live-Activity-Renderer deshalb vollständig durch eine
  native `ActivityConfiguration` aus ActivityKit, WidgetKit und SwiftUI. Start,
  Update, Wiederaufnahme nach Prozessstart und Ende laufen über das lokale
  Expo-Nativmodul `ExpoFocusLiveActivity`; die Dynamic Island und das
  Sperrbildschirm-Banner besitzen native URL-Tapziele für Öffnen,
  Pause/Resume und Focus/Break. Der Config-Plugin kopiert die SwiftUI-Quelle
  reproduzierbar und entfernt React Native, ExpoWidgets und JavaScriptCore aus
  dem Extension-Pod-Target.
- ✅ Build 38 wurde vollständig als signierter Release-Gerätebuild erstellt und
  tief signaturgeprüft. Haupt-App und Extension tragen Build 38. Die fertige
  Extension ist nur 524 KB groß und ihr Binär-Dependency-Check enthält
  ausschließlich ActivityKit, SwiftUI, WidgetKit und Apple-Systembibliotheken;
  der speicherintensive Renderer ist nachweislich nicht mehr enthalten.
- ✅ Build 38 wurde anschließend per USB auf `Jannis’s iPhone` installiert und
  mit einem neuen gefilterten Systemlog geprüft. WidgetKit archivierte
  Lock-Screen-, Compact-, Minimal- und Expanded-Inhalte vollständig; nach dem
  Backgrounding blieb die Live Activity registriert und die Extension wechselte
  regulär von `running-active` zu `running-suspended`. Für
  `ExpoWidgetsTarget` gab es weder `jetsam`, `per-process-limit`, Crash,
  Reload-Fehler noch eine ActivityKit-Verwerfung.
- ✅ Build 39 wurde als signierter Release-Gerätebuild erstellt und per USB auf
  `Jannis’s iPhone` installiert. Flowtime besitzt darin weder im Hauptscreen
  noch auf Sperrbildschirm/Dynamic Island einen Pause-Button: `Take Break`
  wechselt in die offene Recovery, `Resume Focus` zurück in die Fokusmessung
  und `End Session` beendet die gesamte Flowtime. Intervals behält sein
  separates Pause/Resume-Verhalten.
- ✅ Build 40 wurde signiert und per USB installiert. Die erweiterte Dynamic
  Island verwendet eine größere, klarere monospaced Zeitanzeige, entfernt die
  redundante `RUNNING`-Zeile und reserviert für `FLOWTIME` ausreichend Breite;
  auch die kompakte Moduszeile skaliert nun ohne Abschneiden.
- ✅ Build 41 wurde signiert und per USB installiert. In der erweiterten
  Dynamic Island heißt der Modus platzsparend `FLOW`; Modus und Zeitanzeige
  wurden gemeinsam um 5 pt nach unten gesetzt, damit Text und Timer nicht an
  der oberen Island-Kontur anschneiden. Die abschließende Sichtprüfung dieser
  Feinjustierung bleibt beim Nutzer.
- ✅ Die Island-URL-Aktionen wurden ohne UI-Automation über exakt denselben
  `com.goals.app://focus?action=toggle-pause`-Pfad als Pause und anschließend
  Resume ausgelöst. Beide Kaltstarts waren erfolgreich, Haupt-App und native
  Extension liefen danach weiter. Ein physischer Tap auf der Island bleibt
  naturgemäß ein manueller Sicht-/Touchtest am Gerät; der dahinterliegende
  Link-, App- und Zustandswechselpfad ist technisch verifiziert.
- Der TestFlight-Build `1.0.0 (1)` zeigte auf dem echten iPhone beim Start nur
  kurz den Launchscreen und beendete sich anschließend. Die forensische Prüfung
  der exakt hochgeladenen IPA ergab zwei konkrete Release-Probleme:
  Das bisherige App-Icon war selbst ein blaues, Expo-ähnliches A-/Chevron-Symbol,
  und das zugrunde liegende Archiv war weiterhin mit Xcode 27 beta 3
  (`27A5218g`) kompiliert worden. Der spätere Export mit beta 4 hatte zwar die
  IPA-Metadaten aktualisiert, aber den nativen Programmcode nicht neu gebaut.
- Diese Startstrecke ist für Build `1.0.0 (2)` vollständig neu erzeugt:
  eigenständiges Goals-Icon (Indigo-Kreis mit weißem Haken), explizite
  Produktions-Splash-Konfiguration, `developmentClient=false`,
  Store-/Release-Konfiguration, keine Bonjour-/Local-Network-Development-Keys
  und ausschließlich das produktive URL-Scheme `com.goals.app`. Fehlende oder
  ungültige Supabase-Buildwerte können die native Modulevaluation nicht mehr
  beenden; stattdessen rendert die App einen Recovery-Zustand. Zusätzlich fängt
  eine Root Error Boundary unerwartete React-Renderfehler ab, und Splash-Hide-
  Fehler können den Start nicht mehr blockieren.
- Der Nutzer hat am 2026-07-29 bestätigt, dass auch TestFlight-Build
  `1.0.0 (2)` auf seinem iPhone 15 Pro (A17 Pro, iOS 27.0) direkt nach dem
  korrekten Goals-Launchscreen beendet wird. Das physische Gerät ist in
  `devicectl` weiterhin `unavailable`; deshalb konnte der zugehörige native
  `.ips`-Crashlog nicht lokal abgerufen und die genaue Absturzsignatur noch
  nicht bewiesen werden. Apple empfiehlt für verteilte Builds ausdrücklich
  den TestFlight-/Crashes-Organizer-Report oder den direkt vom Gerät
  übertragenen Diagnosebericht. Bis einer dieser Berichte vorliegt, sind
  Aussagen über Hermes/PAC, TurboModules oder DYLD nur Hypothesen.
- Für Build `1.0.0 (3)` wurden zwei weitere reale Upgrade-Risiken der
  wiederverwendeten Vorgänger-App-ID `com.vibetime.app` isoliert:
  Zustand und Supabase-Session verwenden nun Goals-spezifische, versionierte
  AsyncStorage-Namensräume (`goals-app-state-v3` und
  `goals-auth-session-v1`). Damit kann kein inkompatibler Zustand der früheren
  Max-/VibeTime-Installation mehr während des Starts hydriert werden. Der
  Zustandsspeicher besitzt zusätzlich eine explizite Persistenzversion.
- Build 3 verwendet weiterhin den von Expo SDK 55 unterstützten Hermes-Standard.
  Ein Wechsel auf JSC wurde bewusst nicht erzwungen: Die installierte
  SDK-55-Konfigurationsschema-Prüfung verwirft `jsEngine`, React Native 0.83
  liefert JSC nicht mehr selbst mit, und ein nicht unterstützter Engine-Umbau
  ohne Crashsignatur würde ein zusätzliches Release-Risiko schaffen.
- Das EAS-Produktionsprofil ist nun deterministisch auf Release/Store,
  Buildnummer 3 und Expos offizielles SDK-55-Image
  `macos-sequoia-15.6-xcode-26.2` festgelegt. Das vermeidet die bisherige lokale
  Abweichung durch Xcode 27 beta 4; Expo dokumentiert für SDK 55 Xcode 26.2 als
  unterstützte Version. Ein Cloud-Build kann sofort nach `eas login` gestartet
  werden.
- Build 3 wurde cachefrei als Produktions-JS-Bundle exportiert, vollständig
  neu vorgebaut und als echter Release auf dem iPhone-17-Pro-Simulator dreimal
  kalt gestartet. Alle Prozesse liefen nach vier Sekunden weiter; es gab keine
  nativen Fehler/Faults. `npm run check` ist grün (TypeScript, 62
  Domain-Assertions, Expo Doctor 19/19). Das neue Gerätearchiv und die
  App-Store-IPA wurden vollständig neu erzeugt. Die IPA ist 27,8 MB groß,
  `arm64`, Build 3, Bundle-ID `com.vibetime.app`, enthält Hermes-Bytecode und
  die Produktionskonfiguration, ist mit Apple Distribution für
  `CTBGYBDPP4` signiert und besteht
  `codesign --verify --deep --strict`. SHA-256:
  `76ac13a776072e80f54c9f5bc6e579e440011f3397212173b074b457c168d634`.
- Der korrekte App-Store-Connect-Login für das bestehende Team ist
  `sleathbots@gmail.com`. Mit diesem Konto hat Apple die fertige Build-3-IPA
  zunächst ohne Fehler validiert und anschließend am 2026-07-29 vollständig
  angenommen. Uploadstatus `UPLOAD SUCCEEDED`, Delivery UUID
  `e01f1635-79a8-470f-8a6a-522313e06cb5`; 27.790.125 Bytes wurden fehlerfrei
  übertragen. Apple verarbeitet den Build anschließend asynchron für
  TestFlight.
- Das inzwischen per USB verfügbare echte Gerät
  `Jannis’s iPhone` (iPhone 15 Pro, iOS 27.0 beta) hat die zuvor fehlende
  native Crashsignatur geliefert. Build 3 wurde unmittelbar beim Start durch
  `SIGTRAP` beendet, weil `RCTSwiftUIContainerView` gleichzeitig im
  vorgebauten `React.framework` und im App-Binary implementiert war. Der
  Config-Plugin setzt deshalb dauerhaft
  `ios.buildReactNativeFromSource=true`. Ein vollständig sauberer Prebuild
  entfernt `React.framework`; im fertigen App-Bundle liegt nur noch
  `hermesvm.framework`.
- Nach Entfernung des doppelten Frameworks wurde in Build 4 ein zweiter,
  unabhängiger Startfehler sichtbar:
  `___UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption_block_invoke`.
  Apps, die mit dem aktuellen iOS-27-SDK gebaut werden, müssen den
  `UIScene`-Lebenszyklus verwenden. `withGoalsNativeConfig` erzeugt nun
  reproduzierbar `UIApplicationSceneManifest`, einen `SceneDelegate`, ein an
  die aktive `UIWindowScene` gebundenes Fenster sowie die Weiterleitung der
  Expo-Lifecycle-, URL- und Universal-Link-Ereignisse. Die Änderung liegt im
  Config-Plugin und bleibt damit auch nach `expo prebuild --clean` erhalten.
- Build 5 wurde anschließend direkt auf `Jannis’s iPhone` installiert. Ein
  Start mit angeschlossener Konsole blieb länger als 30 Sekunden aktiv und
  erreichte die Auswertung des eingebetteten JavaScript-Bundles. Zwei weitere
  vollständige Kaltstarts blieben jeweils nach 15 Sekunden aktiv. Der zuvor
  reproduzierbare native Sofortabsturz ist damit auf dem betroffenen echten
  Gerät behoben.
- App Store Connect enthielt inzwischen bereits Build 35. Deshalb wurde die
  unveränderte, auf dem Gerät geprüfte Release-Konfiguration mit
  `CFBundleVersion=36` neu archiviert. Das Archiv enthält das
  `UIApplicationSceneManifest`, kein `React.framework` und nur
  `hermesvm.framework`. Apples Vorabvalidierung endete ohne Fehler. Build
  `1.0.0 (36)` wurde am 2026-07-29 vollständig zu App Store Connect
  übertragen: `UPLOAD SUCCEEDED`, Delivery UUID
  `d098edb7-2534-4932-b3d2-8bd6d5eb00ed`, 30.505.432 Bytes. Die
  TestFlight-Verarbeitung erfolgt anschließend asynchron bei Apple.
- `npx expo prebuild --clean --platform ios` wurde mit der finalen
  Produktionskonfiguration ausgeführt. `npm run check` ist danach vollständig
  grün (TypeScript, 62 Domain-Assertions, Expo Doctor 19/19).
- Der daraus erzeugte echte `Release`-Simulator-Build enthält ein eingebettetes
  Hermes-Bytecode-Bundle und wurde dreimal vollständig beendet und frisch
  gestartet. Alle drei Prozesse liefen nach acht Sekunden weiterhin; der
  abschließende Headless-Screenshot zeigt unmittelbar das Goals-Onboarding,
  nicht Expo Go, Dev Launcher, Splash-Hänger oder Error Boundary.
- Das Gerätearchiv für Build `1.0.0 (2)` wurde anschließend ebenfalls vollständig
  neu mit Xcode 27 beta 4 (`27A5228h`) kompiliert. Die exportierte 27-MB-IPA ist
  `arm64`, enthält das Hermes-Bundle und die Produktions-Supabase-Konfiguration,
  ist mit `Apple Distribution` für Team `CTBGYBDPP4` signiert und besitzt
  `aps-environment=production`, `beta-reports-active=true` sowie
  `get-task-allow=false`. `codesign --verify --deep --strict` ist erfolgreich.
- Der zunächst externe Uploadblocker für Build 2 ist behoben: Nach der erneuten
  Xcode-Anmeldung eines berechtigten Accounts erkennt Apples Uploaddienst Team
  `CTBGYBDPP4` wieder. Xcode hat die bereits verifizierte IPA am 2026-07-29
  vollständig zu App Store Connect übertragen. Apple bestätigt Status
  `PROCESSING`, Build-Upload-/Delivery-UUID
  `337660fb-79ac-496c-8707-1cc48629c216`; 27.789.611 Bytes wurden fehlerfrei
  übertragen. Die Warnungen über fehlende dSYMs betreffen ausschließlich die
  vorgebauten Frameworks `React`, `ReactNativeDependencies` und `hermesvm` und
  haben die Annahme des Builds nicht verhindert.
- Der lokale Release-Archive-Lauf für die bestätigte Vorgänger-App ist am
  2026-07-28 vollständig erfolgreich: Xcode archiviert `Goals` 1.0.0 (1) mit
  Bundle-ID `com.vibetime.app` für Team `CTBGYBDPP4`. Das automatisch erzeugte
  Development-Profil und das Archiv sind gültig; der frühere Bundle-ID- und
  Provisioning-Blocker ist damit beseitigt. Sowohl der zunächst anschließende
  `xcodebuild -exportArchive`-Upload als auch „Distribute App“ im Xcode
  Organizer erkennen das richtige App-Store-Produkt, werden aber vor
  Distribution-Signing/Upload von Apples AppsService mit
  `401 NOT_AUTHORIZED` abgewiesen („Authentication credentials are missing or
  invalid“). Ab- und erneutes Anmelden von `Dominik K`
  (`d.klossika@icloud.com`) in Xcode 27 beta 3 ändert den Fehler nicht; auch der
  separate Organizer-Pfad „TestFlight Internal Only“ endet identisch. In App
  Store Connect ist Dominik nachweislich **Account Holder + Admin** mit Zugriff
  auf **All Apps**, und der richtige Datensatz `Goals, Habit tracker` zeigt
  `com.vibetime.app`. Rolle, App-Zugriff und Bundle-ID sind daher nicht die
  Ursache. Das Distributionslog zeigt stattdessen, dass Xcode für den
  Upload-Schritt den App-Store-Connect-Account als `(null)` auflöst und dadurch
  einen ungültigen Bearer-Token an Apples AppsService sendet. Der ebenfalls
  berechtigte Admin-Account `jannis@excellent-data.de` wurde danach erfolgreich
  als zweiter Xcode-Account hinzugefügt und sieht sowohl das Team `Dominik
  Klossika` als auch ein Personal Team. Selbst nach vollständigem Xcode-Neustart
  scheitern CLI und Organizer weiterhin am identischen `401`; Xcodes lokaler
  Apple-ID-Uploaddienst ist damit als Blocker isoliert. Der nächste unabhängige
  Weg ist Apples offiziell unterstützte Authentifizierung mit einem expliziten
  App-Store-Connect-API-Key über `xcodebuild`/Transporter. Die Integrationsseite
  ist für den angemeldeten Admin jedoch leer und leitet zurück zu „Apps“:
  Der Account Holder hat den von Apple vorgeschriebenen Team-API-Zugang noch
  nicht beantragt/freigeschaltet. Ein API-Key kann deshalb noch nicht erzeugt
  werden. Der lokale Export mit Ziel `export` funktioniert unabhängig davon.
  Ein erster `altool`-Versuch mit App-spezifischem Passwort authentifiziert
  erfolgreich, wird aber mit Apple-Fehler `90534` abgelehnt, weil das Archiv
  noch mit der inzwischen nicht mehr unterstützten Xcode 27 beta 3 gebaut war.
  Danach wurde die offizielle Xcode 27 beta 4 (Build `27A5228h`) installiert
  und das bestehende beta-3-Archiv erneut exportiert. Die daraus exportierte
  27-MB-IPA ist korrekt mit `Apple Distribution: Dominik Klossika
  (CTBGYBDPP4)` signiert; Bundle-ID `com.vibetime.app`, Version `1.0.0`, Build
  `1`, `DTXcodeBuild=27A5228h` und `DTSDKBuild=24A5390e` wurden direkt aus der
  IPA geprüft. Die spätere Archivprüfung zeigt jedoch, dass dies nur ein
  Re-Export und keine erneute native Kompilierung war. Der anschließende
  `altool`-Upload ist am 2026-07-29 ohne Fehler abgeschlossen. Apple Delivery UUID:
  `0f7af54d-390e-4a9c-8a94-e01e88107f5c`. App Store Connect verarbeitet den
  Build nach dem Upload asynchron; die Sichtprüfung in TestFlight steht noch
  aus, weil der Mac währenddessen gesperrt wurde.
- Das von Apple vorgeschaltete „Compliance Screening“ wurde vom Accountinhaber
  abgeschlossen. Ein unmittelbar danach wiederholtes Release-Archive wird von
  Xcode weiterhin ausschließlich wegen der nicht verfügbaren Bundle-ID
  `com.goals.app` sowie der daraus fehlenden Push-/Apple-Sign-In-Provisionierung
  abgelehnt. Die Portal-Prüfung zeigt, dass der in `eas.json` hinterlegte
  App-Store-Connect-Datensatz `6761142813` zu **„Max – Habit Tracker“** mit
  Bundle-ID `com.vibetime.app` gehört. Der Nutzer hat bestätigt, dass Max der
  frühere Name derselben App ist. Das iOS-Projekt verwendet deshalb nun die
  bestehende App-Store-Identität `com.vibetime.app`; Android-Package und
  URL-Scheme bleiben davon unabhängig `com.goals.app`.
- Ohne reale Provider-/Device-Konfiguration können OAuth, Remote Password-Mail,
  echte Background-Geofence-Bewegung bei gesperrtem iPhone und
  Delete-Account-E2E nicht vollständig simuliert werden. Ortssuche,
  Always-Location-Status und die foregroundseitige Goal-/Timer-UX wurden dagegen
  mit dem vorhandenen Testkonto im Simulator geprüft.
- Die direkte Ortssuche ist lokal funktional geprüft. Der produktionsfähige
  Proxy ist remote aktiv: Migration, JWT-geschützte Edge Function und
  Preview-/Production-Build-Aktivierung sind verifiziert.
- Xcode 27 akzeptiert Pod-Targets unter iOS 15 nicht mehr. Der Podfile-
  Post-Install-Schritt hebt deshalb alle älteren Dependency-Targets
  reproduzierbar auf iOS 15.1; `pod install` erzeugt 252 passende Targets und
  die vorherigen RNCAsyncStorage-/RNSVG-Deployment-Fehler sind im zweiten
  Archive-Lauf verschwunden.
- Ein zusätzlicher Build mit vollständig isoliertem, leerem DerivedData wurde
  zuvor durch ein volles Startvolume beendet (`No space left on device`).
  Am 2026-07-30 wurden ausschließlich reproduzierbare Goals-Buildartefakte
  entfernt: `ios/build/device38`, `ios/build/device39` und die beiden
  Goals-DerivedData-Verzeichnisse. Dadurch stehen wieder rund 10 GB frei;
  Quellcode, Archive und Nutzerdaten wurden nicht gelöscht.
- `npm audit --omit=dev` meldet 26 transitive Findings (8 moderate, 18 high,
  0 critical). `npm audit fix --force` würde inkompatible Expo-/React-Native-
  Hauptversionen einsetzen und wird nicht blind ausgeführt.

## 18. Bewusst später — ⏸

- **Home-Screen-Widgets:** Die App Group und `expo-widgets`-Extension sind jetzt
  für die Focus Live Activity vorhanden; eigenständige Home-Screen-Widgets
  bleiben bewusst später.
- **App Blocking:** FamilyControls/ManagedSettings/DeviceActivity benötigt
  Apples Distribution-Entitlement und ist ausdrücklich aus diesem Release
  ausgeklammert.

## 19. Nutzeraktionen vor Release

- [ ] Bei Upgrade auf Supabase Pro „Leaked password protection“ aktivieren;
  der aktuelle Tarif lehnt die Einstellung mit HTTP 402 ab. Die
  Mindestpasswortlänge ist bereits serverseitig auf 8 gesetzt.
- [x] Supabase Site URL und Redirects für E-Mail-Bestätigung, Google und
  Password Recovery konfigurieren.
- [x] Supabase Apple Client-ID-Liste um die native Audience
  `com.vibetime.app` ergänzen; Services-ID `com.dominik.vibetimeauth` bleibt
  parallel erhalten.
- [ ] Apple Sign-In nach der Audience-Korrektur auf echtem Release-Gerät testen.
- [ ] Eigenen SMTP-Provider oder Supabase Send Email Hook mit verifizierter
  Absenderdomain konfigurieren. Erst dann erreichen Signup-, Resend- und
  Recovery-Mails beliebige Produktionsnutzer zuverlässig.
- [x] Mit `d.klossika@icloud.com` das von Apple vorgeschaltete
  „Compliance Screening“ vollständig und wahrheitsgemäß abschließen
  (Ausweis, Geburtsort/-land, Firmenstatus).
- [x] In Apple Developer/App Store Connect prüfen, ob `com.goals.app` und
  App-ID `6761142813` wirklich Team `CTBGYBDPP4` gehören: nein; die App-ID
  gehört zu „Max – Habit Tracker“/`com.vibetime.app`, und `com.goals.app` ist
  für dieses Team nicht verfügbar.
- [x] Bestehenden App-Store-Eintrag als beabsichtigte Vorgänger-App bestätigt:
  Goals verwendet iOS-seitig `com.vibetime.app` und App-ID `6761142813`.
  Android-Package und URL-Scheme bleiben unabhängig davon `com.goals.app`.
- [x] Release-Archiv für `com.vibetime.app` lokal erfolgreich erzeugen und im
  Organizer dem richtigen Vorgängerprodukt zuordnen.
- [x] `d.klossika@icloud.com` in Xcode → Settings → Apple Accounts vollständig
  ab- und erneut anmelden und beide Organizer-Uploadmethoden wiederholen; der
  Xcode-27-Bearer-Token bleibt dennoch ungültig (`401`, Account im
  Distributionslog `(null)`).
- [x] `jannis@excellent-data.de` als zweiten, bereits für alle Apps berechtigten
  Admin-Account in Xcode anmelden, Xcode vollständig neu starten und CLI sowie
  Organizer erneut testen; Xcodes lokaler Uploaddienst bleibt bei
  `401 NOT_AUTHORIZED`.
- [ ] Optionaler Automatisierungspfad: Account Holder beantragt unter Users and
  Access → Integrations den App-Store-Connect-API-Zugang; Apple prüft diesen
  Antrag separat. Erst danach kann ein minimal berechtigter Team-Key erzeugt
  werden. Für den aktuellen TestFlight-Upload ist dieser Pfad nicht mehr
  erforderlich.
- [x] App-Store-signierte IPA lokal exportieren und Signatur, Bundle-ID sowie
  Buildnummer prüfen.
- [x] App-spezifisches Passwort für
  `jannis@excellent-data.de` erzeugen, lokal im macOS-Schlüsselbund speichern
  und die fertige IPA mit `altool` hochladen; Upload am 2026-07-29 erfolgreich,
  Delivery UUID `0f7af54d-390e-4a9c-8a94-e01e88107f5c`.
- [x] Build `1.0.0 (2)` vollständig neu mit Xcode 27 beta 4 kompilieren,
  als echten Release dreimal stabil starten und App-Store-signierte IPA prüfen.
- [x] App-Store-Connect-Zugriff durch erneute Xcode-Anmeldung eines berechtigten
  Team-Nutzers wiederherstellen und Build `1.0.0 (2)` hochladen; Apple-Status
  `PROCESSING`, Delivery UUID `337660fb-79ac-496c-8707-1cc48629c216`.
- [x] Build `1.0.0 (2)` nicht mehr separat freigeben: Er wurde durch die
  nachweislich startstabile Release-Linie ab Build 5 und den zu TestFlight
  hochgeladenen Build 36 vollständig überholt.
- [x] Build `1.0.0 (3)` mit `sleathbots@gmail.com` validieren und zu App Store
  Connect hochladen; Apple Delivery UUID
  `e01f1635-79a8-470f-8a6a-522313e06cb5`.
- [x] Build 3 direkt auf dem verbundenen iPhone reproduzieren und den nativen
  Crashreport auswerten: doppeltes `RCTSwiftUIContainerView` durch
  `React.framework` eindeutig bestätigt.
- [x] React Native aus Source bauen, den danach sichtbaren iOS-27-`UIScene`-
  Startfehler beheben und die Änderungen dauerhaft im Expo-Config-Plugin
  abbilden.
- [x] Korrigierte Build 5 auf `Jannis’s iPhone` installieren und mit drei
  stabilen Kaltstarts einschließlich angeschlossener Release-Konsole prüfen.
- [x] Die identische Release-Konfiguration als freie Buildnummer 36
  archivieren, fehlerfrei bei Apple validieren und zu TestFlight hochladen;
  Delivery UUID `d098edb7-2534-4932-b3d2-8bd6d5eb00ed`.
- [x] Build `1.0.0 (36)` nicht mehr für Tester freigeben: Die native
  Live-Activity-Speicherreparatur und die anschließenden Island-Korrekturen
  liegen erst in Builds 38–41.
- [x] Build `1.0.0 (43)` am 2026-09-17 archiviert, validiert und hochgeladen.
  Delivery UUID `3a19ad53-7342-48cc-aeeb-72fc370b0146`. Enthält den
  Apple/Google-Login ohne E-Mail, die Insel-Progression und die automatische
  Belohnungsauslieferung. Der Upload lief über einen App-Store-Connect-API-Key
  (`Q9YLV5YZW6`, Issuer `f0f26376-…`) statt über ein Apple-ID-Passwort; der
  Schlüssel erzeugt dabei auch die Distributions-Profile für App Groups und die
  Widget-Erweiterung, an denen der Xcode-Organizer-Weg vorher gescheitert ist.
- [x] Build `1.0.0 (44)` am 2026-09-17 hochgeladen, Delivery UUID
  `6993dc39-d3dd-48bd-898b-06cac528aae6`. Zusätzlich zu 43: die Setup-Fehler
  nennen ihre echte Ursache.
- [x] Build `1.0.0 (45)` am 2026-09-17 hochgeladen, Delivery UUID
  `ad05f3e9-8f5e-4635-829b-3412f66218d4`. Gegenüber 44: der Haken beim
  Platzieren führt auf Home statt zurück in den Wähl-Screen, und die
  Besuchs-Benachrichtigung meldet nie mehr „0/4", wenn die Zahl unbekannt ist.
- [ ] Offen zur Entscheidung: Bei Besuch `fbca8fdf-…` liegen 16 Sekunden
  zwischen `start_time` und `end_time`, gespeichert sind 3006 Sekunden. Die
  Dauer stammt aus dem lokal gespeicherten Eintritt; ein verspätet geliefertes
  Verlassen kann sie über das Zeitfenster hinaus wachsen lassen. Deckelung auf
  `end_time − start_time` wäre der Fix, berührt aber die Auto-Check-In-Buchhaltung.
- [x] Builds 46–50 am 2026-09-17/18 hochgeladen. **Build `1.0.0 (50)` ist der
  aktuelle**, Delivery UUID `cf1c394d-b7ff-4fad-9bc1-aec47ba10beb`. Enthält:
  neues App-Icon und neuen Startbildschirm (beide lagen nur in `assets/`, das
  native Projekt hatte noch die Juli-Fassung), feinere Flowtime-Skala ohne
  Sprünge über eine Stunde, repariertes Wochenziel-Rad, korrigierte
  Pausentexte in Onboarding *und* Einstellungen, „invested this week" statt
  Restbudget, `goalPayload` gegen den PostgREST-NULL-Fehler beim Onboarding,
  und die Anzeigefehler „3 / 0 sessions" und „1 sessions".
- [x] Build `1.0.0 (51)` am 2026-09-18 hochgeladen, Delivery UUID
  `ce4bf962-2b21-4a8e-895c-b0c39b92bc21`. Gegenüber 50: Das Antippen einer
  Auto-Check-In-Live-Activity öffnet nur noch die App, statt einen Fokus-Timer
  mit dem Namen des Check-in-Ziels anzubieten.
- [x] Build `1.0.0 (52)` am 2026-09-18 hochgeladen, Delivery UUID
  `09643324-31c3-42bf-8280-108374be0282`. Gegenüber 51: Das Umräumen ruckelt
  nicht mehr (die über 1000 SVG-Pfade einer vollen Insel wurden bei jedem
  Ziehschritt neu erzeugt; Szene und gezogenes Stück liegen jetzt getrennt),
  und die Insel lässt sich per „Clear" in eine Leiste am unteren Rand räumen.
- [x] Build `1.0.0 (54)` am 2026-09-18 hochgeladen, Delivery UUID
  `d78e257e-af59-496c-bf13-4e1ce2619502`. **Das ist der aktuelle Build**; 53
  überspringen. Gegenüber 52: Der Szenenaufbau der Insel ging von gemessenen
  11.156 ms auf 10 ms (drei Platzierungssuchen für ein Bild, und bei jedem
  Aufnehmen erneut), `resolveSpots` merkt sich seine Antworten (3.479 ms → 0),
  Arrange zeigt sofort eine Ladeanzeige, und die Leiste gruppiert Gleiches mit
  Anzahl und lässt sich auf die Insel ziehen.
- [ ] Build 54 in TestFlight für interne Tester freigeben und den Tester
  eintragen, der bisher auf Build 36 festhing (Apple-Konto
  `3bff58e6-…`, Profil vorhanden, 0 Ziele, Onboarding offen). Ursache war der
  Profil-Upsert beim Anmelden in Build 36: `authenticated` hat UPDATE auf jede
  Spalte außer `id`, ein Upsert braucht genau die, Postgres antwortet 42501 und
  PostgREST 403. Im Code seit Längerem behoben (Insert statt Upsert); sein Gerät
  hing nur auf dem alten Build.
- [x] Migration `place_search_proxy` über die Supabase Management API
  angewendet, Edge Function `place-search` deployt und
  `EXPO_PUBLIC_PLACE_SEARCH_ENDPOINT=supabase` für Preview/Production gesetzt.
- [ ] EAS/APNs-Credentials für Remote Pushes konfigurieren, falls später nötig;
  lokale Notifications funktionieren ohne Remote Push.
- [x] Vor lokalem App-Store-Archive mindestens etwa 10 GB freien
  Startvolume-Speicher schaffen; generierte Gerätebuilds und Goals-DerivedData
  wurden am 2026-07-30 bereinigt.

## 21. Auto Check-In: Mindestaufenthalt — ✅

Stand 2026-09-07. Jannis: „ich lauf jeden Tag an meinem Gym vorbei, das soll
nicht zählen." Die feste 10-Minuten-Schwelle ist jetzt eine Einstellung pro
physischem Goal.

- Neue Spalte `goals.min_visit_minutes` (integer, default 10, Constraint 1–240),
  Migration `20260907120000_auto_checkin_min_visit.sql`, **auf dem Projekt
  `uxpburqocxlcivcdtotb` angewendet und verifiziert**; Spalten-Grant `update`
  für `authenticated` ergänzt. Alle 5 Bestands-Goals stehen auf 10 Minuten,
  Verhalten also unverändert.
- Auswahl 10/20/30/60 Minuten an zwei Stellen: im Onboarding auf der
  Auto-Check-In-Zielseite unter „Visits per week", und in
  `SetupGeofenceScreen` unter dem Radius. Beide flache Accent-Pills mit
  44pt-Touchziel und `accessibilityState.selected`.
- `classifyGeofenceSession(durationMs, minVisitMinutes)` bekommt die Schwelle
  als Parameter; `normalizeMinVisitMinutes` klemmt jeden Wert auf 1–240 und
  fällt bei Unsinn auf 10 zurück.
- Der Hintergrund-Task speichert die Schwelle beim Betreten in der
  persistierten Session. Dadurch entscheidet der Exit ohne Netzwerk, und eine
  während des Besuchs geänderte Einstellung verwirft keinen laufenden Besuch
  rückwirkend. Für ältere persistierte Besuche wird sie nachgeladen.
- Account-Cleanup nutzt dieselbe Schwelle.
- **Manuelle Check-Ins bleiben ohne Mindestdauer.** Wer bewusst eincheckt und
  auscheckt, will die Session gezählt haben.
- 6 neue Domain-Assertions (80 gesamt), `npm run typecheck` und
  `npm run test:domain` grün.

**Offen:** Simulator-Screenshot der beiden neuen Pill-Reihen steht noch aus
(kein Dev-Build vorhanden).

## 22. Persönlicher Coach: KI-Nudges aus Langzeitdaten — ✅

Stand 2026-09-07. Die App analysiert die **gesamte** Session-Historie und
schickt daraus lokale Benachrichtigungen, z. B. „Mondays 4pm gym gives you 5/5
rating — you rated 5/5 on 23 sessions at 4pm on Mondays."

**Architektur (das Sparen von API-Calls ist das Designprinzip):**

1. `supabase/functions/_shared/coachPatterns.ts` findet Muster **ohne Modell**
   (Regeln am 2026-09-10 neu gefasst, siehe „Coach-Tipps und Stats-Insight:
   Mustererkennung neu" am Ende). **Kein Muster, kein Call.**
2. Ein Fingerprint der Muster wird gecacht. Solange er gleich bleibt, gilt der
   Text **14 Tage** ohne neuen Call.
3. **Ein** Groq-Request formuliert alle Nudges eines Nutzers gemeinsam
   (Prompt ca. 400 Byte, Antwort ca. 0,4–3 s).
4. Harte Budgetgrenze: **1 Modell-Call pro Nutzer und UTC-Tag**
   (`consume_coach_nudge_quota`), plus clientseitig max. 1 Request pro Gerät
   und Tag.
5. Jeder Fehlerfall fällt auf deterministisch formulierte Texte zurück, statt
   zu wiederholen. Ohne Groq-Key funktioniert das Feature vollständig weiter.

**Produktentscheidungen:**

- Nur **aufwärts** gerichtete Trends werden zur Benachrichtigung. „Deine
  Bewertung ist gefallen" gehört nicht auf einen Sperrbildschirm.
- Nudges kommen 90 Minuten vor der üblichen Startzeit, nie vor 8 oder nach 21 Uhr.
- Höchstens 3 Benachrichtigungen, nur ab Konfidenz 0.12.
- Das Modell sieht **nie Rohdaten**, nur fertig berechnete Zahlen; keine IDs,
  keine Orte, keine Zeitstempel.
- Steuerung über den bestehenden Settings-Toggle „Smart suggestions"
  (`notificationPrefs.aiNudges`); aus = alle Coach-Notifications werden gelöscht.

**Neu:** Tabellen `coach_nudge_cache` und `coach_nudge_limits` (privat, nur
`service_role`), Migration `20260907140000_coach_nudges.sql` **angewendet**;
Edge Function `coach-nudges` **deployed**; Client `src/lib/coachSchedule.ts`
(rein, getestet), `src/lib/coachNudges.ts` (Notifications),
`src/hooks/useCoachNudges.ts` (am App-Root eingehängt).

**Secrets** (in Supabase gesetzt, **nicht** im Repo): `GROQ_API_KEY`,
`GROQ_MODEL` = `openai/gpt-oss-20b`.

**Verifiziert** mit einem Testkonto und 46 Sessions über 6 Monate: erster
Aufruf `source: model` (3,1 s), zweiter Aufruf `source: cache` (0,5 s, kein
Modell-Call). Testkonto und alle Testdaten danach gelöscht.

## 23. Behobener Auth-Fehler in allen Edge Functions — ✅

Beim Testen gefunden: `analyze-sessions`, `delete-account` und `coach-nudges`
riefen `userClient.auth.getUser()` **ohne Argument** auf. Der
`Authorization`-Header wirkt nur auf PostgREST-Anfragen; `getUser()` ohne
Argument liest die leere Client-Session. Ergebnis: **jeder** authentifizierte
Aufruf wurde mit 401 abgelehnt.

- Fix: JWT aus dem Header extrahieren und als `getUser(accessToken)` übergeben.
- Alle drei Funktionen neu deployed.
- `analyze-sessions` liefert seitdem verifiziert wieder Insights.
- **Nicht getestet:** der eigentliche Löschvorgang in `delete-account`; nur der
  Auth-Pfad wurde korrigiert, das Löschen selbst wurde bewusst nicht ausgeführt.

## 20. Island-Progression (Grove v2) — 🟡 Pipeline steht, Props folgen

Stand 2026-09-07 (Nachmittag). Das Sternen-Grove wird durch eine wachsende,
individuelle Insel ersetzt (vorgerenderte 2.5D-Sprites aus Blender, komponiert
in RN). UI-Label ist bereits „Island" (Codex hatte „Insel" in die englische UI
geschrieben; korrigiert, Typecheck grün).

- **Eine Datei für alles:** `island/ISLAND.md` (Entscheidungslog aus Codex- und
  Claude-Chats, Art Bible, Progression, Datenmodell, Pipeline, Changelog).
  Wird bei jeder Insel-Änderung fortgeschrieben.
- Entscheidungen von Jannis (mit Codex, 2026-09-07): Comic-Look, True-Iso-Kamera,
  Inselform **A** der Konzepttafel `island/concepts/island-directions-abcd.png`
  (lappig, Sandrand, viel Baufläche), freie Wahl nach der Session,
  **1 Ausbaupunkt pro Fokusminute** mit festen Preisen, Insel wächst mit Anzahl
  und Grundfläche der Objekte, natürliche Form (nicht rund, nicht eckig).
- Technik: Basis-Bild pro Wachstumsstufe aus einer festen natürlichen
  Formfamilie (16 Stufen, 9 bis ca. 120 Zellen) statt Iso-Kacheln.
- Pipeline `island/blender/islandlib/` läuft headless (Cycles/Metal) und live
  über den Socket des Add-ons „MCP for Blender" (`live.py`). Blender ist als
  MCP-Server in Claude Code registriert. Vier Inselformen sind gerendert
  (`island/blender/out/islands/`), Insel A liegt live in Blender.
- Bug gefunden und behoben: Sichtbarkeitsumschaltung hatte die Sonne ausgeblendet.
- Vorlagen (CC0): Kenney Fantasy Town, KayKit Medieval Hexagon, Quaternius
  Simple Nature unter `island/references/`. KayKit Forest fehlt noch.
- Bestehende DB-Spalten `sessions.growth_stage`/`garden_rendered` werden als
  Tier bzw. „Belohnung eingelöst" wiederverwendet; Tabelle `island_items` plus
  RPC `claim_island_reward` geplant, noch nicht migriert.

- Jannis (12:40): Blender-Inseln zu schlecht, erst Comic-Mockups mit Meer ohne
  Blender. SVG-Mockup-Generator `island/mockups/make_mockups.py`, Sheet A–D.

**Nächster Schritt:** Mockups abnehmen, Blender-Insel daran angleichen, dann
die fünf Props der Master-Szene.

**Nutzeraktion:** Vor jeder Insel-Arbeitssitzung Blender öffnen, `N`, Tab
„MCP for Blender", „Start MCP Server".

## 2026-09-08 — Redesign-Nachzieharbeiten (Setup, Auth, Stats, Onboarding)

- **Ursache für „weekly target ding geht nicht":** Der `ValueStepper` lag nach dem
  Redesign nackt auf dem Ozeanbild. Die Werte waren dunkel und die grünen +/− fast
  unsichtbar auf dem Wasser, deshalb wirkte das Control tot. Es hatte immer
  funktioniert. Der Stepper hat jetzt einen eigenen weißen Körper
  (`src/components/CategoryCards.tsx`) und wurde im Simulator verifiziert
  (10 → 12 Stunden per Tap).
- **Weiß-auf-Weiß behoben:** Radius-Pillen und Suchfeld in `SetupGeofenceScreen`
  sowie Fehler- und Hinweisbox in `AuthScreen` hatten `NEU.onImage`-Text auf
  `NEU.card`. Alle auf `NEU.textPrimary`/`NEU.textSecondary` umgestellt.
- **Stats-Segmente:** Ein ausgewähltes Goal ist nicht mehr vollflächig grün,
  sondern weiß mit grüner Schrift und grüner 2pt-Kontur.
- **Auth:** Die Primäraktion („Create account" / „Sign In") ist jetzt weiß mit
  dunklem Label statt dunkel mit weißem Label.
- **Onboarding:** Die weißen Karten um Focus-Ring und Standort-Pin auf den beiden
  Feature-Seiten sind entfernt; die Animationen stehen frei auf der Seite.
- Nicht visuell geprüft: Auth- und Onboarding-Seiten, weil man dafür ausloggen
  müsste. Reine Farb-/Wrapper-Änderungen, Typecheck grün.

## 2026-09-08 — Paper Light Mode für Stats, Friends, Settings

Diese drei Seiten sind Lese- und Konfigurationsflächen, kein Teil der
Insel-Fiktion. Sie verlassen den Ozean-Hintergrund komplett.

- Neue Tokens in `src/theme/paper.ts`, neue Primitive in
  `src/components/paper/PaperUI.tsx` (`PaperScreen`, `PaperHeader`,
  `PaperLabel`, `PaperCard`, `PaperRow`).
- Seite ist ein warmes Off-White `#F5F5F2` statt des üblichen kalten Blaugraus.
  Karten sind weiß mit 1pt-Haarlinie und **ohne Schatten**; schwebende
  Schattenkarten sind das, was eine Seite generiert aussehen lässt.
- Zwei Grün: `accent #2E9E4F` für Flächen, Ringe und Balken, `accentInk #1F7A3C`
  für grüne **Schrift** auf Weiß. Das Fill-Grün erreicht auf Weiß nur 3,4:1,
  das Ink-Grün 5,4:1.
- Ausgewählte Zustände sind weiß bzw. `accentWash` mit grüner Schrift und
  grüner Kontur. Einzige vollflächig grüne Komponente bleibt der
  `FocusModeSwitch` in Settings — bewusst als einziger Anker der Seite.
- Stats: kein Footer mehr (`edges={["top"]}` wie Settings), Header ist jetzt
  „Stats" + „Close" wie auf den anderen Seiten, Monat als eigene Zeile darunter.
  Zwei KPI-Zahlen liegen in **einer** Karte mit Haarlinie dazwischen.
  Heatmap nutzt vier feste Stufen statt eines Alpha-Verlaufs plus eine
  Less/More-Legende. Zahlen laufen überall in `tabular-nums`.
- Friends: gleicher Header, Freundesliste ist eine Gruppenkarte mit getrennten
  Zeilen statt vieler Einzelkarten.
- Settings: Sektionsnamen stehen als kleine Versallabels **über** den Karten,
  nicht mehr darin. `ScrollBackdrop` entfernt.
- `AnalyticsWeekScreen` mitgezogen, sonst wäre die Wochenansicht als einzige
  Seite hinter Stats wieder auf dem Ozean gelandet.
- Auth-Tabs („Sign Up / Sign In") waren grün bzw. grau auf hellem Himmel und
  praktisch unlesbar; jetzt weiß mit weißer Unterlinie.

**Offen:** Der Simulator hat sich ausgeloggt (Supabase-Session weg,
`userConfig = null` in AsyncStorage). Die drei Seiten sind darum noch nicht
visuell abgenommen — dafür muss Jannis sich im Simulator einmal anmelden.

## 2026-09-10 — Flowtime-Texte im Setup

- Problem: Die Flowtime-Karte im Onboarding hatte das Tag „Count up" und den Text
  „Work without a countdown" — beide Mechanismen in einem Satz.
- Neue Labels überall, wo der Modus gewählt wird (Onboarding, Settings-Switch,
  Start-Popup auf Home): **Intervals · Set time** und **Flowtime · No limit**.
- Onboarding: „Pick a length, like 25 minutes. When it's up, a short break starts
  on its own." / „The clock runs until you stop it. The longer you focused, the
  longer your break." Im Simulator geprüft.
- Settings: Erklärung unter dem Switch beschreibt jetzt, was passiert; „Starting
  ring target" heißt „Ring goal", der Text sagt, dass der Ring nur ein visuelles
  Ziel ist. Wegen Logout nicht visuell geprüft.
- Unverändert: das Statuslabel über dem laufenden Timer
  (`FLOWTIME · COUNT UP`), weil es dort die sichtbare Uhr beschreibt.

## 2026-09-10 — Wochenziel wurde beim Einloggen verworfen

- **Ursache:** Wer ausgeloggt das Setup erneut durchläuft (Wochenziel wählen →
  „Create Account" → mit bestehendem Konto einloggen), verlor alle Angaben.
  `applyUserConfig` löschte `pendingOnboarding`, sobald `onboarding_complete`
  true war, und `RootNavigator` speicherte ein Setup nur für Konten ohne
  abgeschlossenes Onboarding. Belegt über die API-Logs vom 09-09: drei Logins,
  Sessions wurden geschrieben, aber kein einziger PATCH/POST auf `goals`.
  Datenbank-Grants und RLS waren in Ordnung.
- **Fix:** Ein ausstehendes Setup wird jetzt für jedes eingeloggte Konto
  gespeichert, danach wird die Goals-Query invalidiert und `focusStyle` im Store
  gesetzt. Während des Speicherns zeigt die App Laden bzw. einen Fehler mit
  „Try Again"; bestehende Konten haben zusätzlich „Keep my current goals".
- `planOnboardingGoals` hat die Option `preserveExistingPhysicalGoal`: Überspringt
  ein bestehendes Konto im Setup Auto Check-In, bleibt sein Check-In-Goal aktiv
  (vorher wäre es deaktiviert worden). Vier neue Domain-Assertions.
- Nebenbei: `checkinMinVisit` fehlte in den Deps von `buildPending` und
  `renderPage` (Mindestaufenthalt konnte veraltet gespeichert werden).
  Header-Aktionen der Setup-Editoren sind weiß; „Finish" im Auto-Check-In-Editor
  heißt jetzt „Save".
- **Offen:** End-to-End-Test braucht einen Login im Simulator.

## 2026-09-10 — Mindestaufenthalt: 45 min und 2 h

- `MIN_VISIT_MINUTES_OPTIONS` ist jetzt 10 / 20 / 30 / 45 / 60 min und 2 h.
  Keine Migration nötig, der DB-Constraint erlaubt 1–240.
- Onboarding: die sechs Pillen stehen in zwei Dreierreihen (31 % Breite), damit
  auf einem 375pt-iPhone nichts abgeschnitten wird. Der Auto-Check-In-Editor
  bricht ohnehin um und zeigt jetzt ebenfalls zwei Reihen.
- Neuer Formatter `formatMinVisitDuration`: Texte sagen „2 hours" statt
  „120 minutes" (Start-Popup und Editor).
- Im Editor per Simulator geprüft; Onboarding-Raster nicht visuell geprüft.

## 2026-09-10 — Setup-Speichern scheiterte an `users`-Upsert

- In den App-Logs (`sim.sh logs`) stand beim Login: `Failed to flush onboarding
  setup: permission denied for table users` (42501). Der Wochenziel-Fix von heute
  Vormittag lief also bis zum ersten Schritt und brach dort ab.
- Ursache: `completePendingOnboarding` machte `upsert({ id })` auf `users`. Das
  wird `ON CONFLICT DO UPDATE` und braucht UPDATE auf `id` (nicht gegrantet).
  `ignoreDuplicates` hilft nicht: `DO NOTHING` scheitert am CHECK
  `users_display_name_valid` (23514). Beides per zurückgerollter SQL-Probe als
  `authenticated` reproduziert. Goal-Update und `users.update` gehen durch.
- Fix: Die Zeile wird nur noch geprüft, nie geschrieben. Sie existiert immer,
  weil `loadOrCreateUserConfig` sie beim Login anlegt.
- Gleiches Muster in `AuthScreen` (Apple-Name) und `loadOrCreateUserConfig`,
  ebenfalls behoben:
  - Apple-Name: Der Upsert scheiterte immer mit 42501, ein `console.warn`
    verschluckte das, der Name wurde nie gespeichert. Jetzt speichert
    `saveUserDisplayName` (`useAuth.ts`) per `update` auf
    `display_name`/`updated_at`; bei 0 Treffern wird die Zeile angelegt und das
    Update einmal wiederholt. Das passiert vor `auth.updateUser`, damit der
    Profil-Reload nach `USER_UPDATED` den Namen schon liest.
  - `loadOrCreateUserConfig`: Lief ein Auth-Event parallel zum Bootstrap, wurde
    der Upsert zu `DO UPDATE` → 42501 → Login fehlgeschlagen. Jetzt `insert`;
    23505 (`unique_violation`) heißt „existiert schon" → Zeile neu lesen.
  - Namen werden auf die 80 Zeichen des CHECKs gekürzt. Der Trigger
    `on_auth_user_created` legt `public.users` für jeden neuen Auth-User ohnehin
    an; die Insert-Pfade sind nur Absicherung.
- Geprüft per zurückgerollter SQL-Probe als `authenticated` mit zwei
  Wegwerf-Usern: alter Upsert 42501, Update auf vorhandene Zeile 1 Treffer,
  Insert auf vorhandene Zeile 23505, Update auf fehlende Zeile 0 → Insert ok →
  Retry 1, fremde Zeile 0 (RLS), keine Reste. Typecheck, Domain-Suite und
  `sim.sh bundle` grün, App startet eingeloggt. Apple-Login selbst ist nicht
  Ende-zu-Ende getestet (im Simulator nicht möglich).

## 2026-09-10 — Paper-Design überall, Hintergrundbild nur noch auf Home

- `NEU.bg`, `bgSolid` und `pageSolid` sind jetzt das opake Paper-Weiß `#F5F5F2`.
  Der globale Ozean-Hintergrund in `App.tsx` ist entfernt; nur `HomeScreen`
  malt noch sein eigenes Inselbild. `ScreenBackdrop.tsx` ist ungenutzt.
- Auf Paper-Tokens umgestellt: beide Goal-Editoren, `CategoryCards`,
  `ValueStepper`, Start-Popup (`GoalStartSheet`), `RatingSheet`, `PopupCard`,
  Sound-Pillen im Fokus-Timer, Grove-Header, Permission-Gate, Speicher- und
  Fehlerscreen im `RootNavigator`, Auswahlkarten und Pillen im Onboarding.
- Auswahl überall wie auf Stats: helle Fläche, grüne Kontur, grüne Schrift. Nur
  primäre Aktionen (Start, Save, Play) bleiben voll grün.
- Nebenbei behoben: Titel und Beschreibung der Zeilen im Permission-Gate waren
  weiße Schrift auf weißer Karte.

## 2026-09-10 — Coach-Tipps und Stats-Insight: Mustererkennung neu

- Befund mit echten Daten (beide Konten): Die Stats-Karte zeigte fast immer
  „Complete a few more rated sessions…" (5 bewertete Sessions in 28 Tagen nötig,
  Stunden in UTC, Goal-Auswahl ignoriert, lokaler Hinweis verdeckt). Der Coach
  fand kaum Muster (8 Sessions pro Goal, 3 im exakt gleichen Wochentag+Stunde).
  Der einzige Tipp („Tuesdays are your best for Deep Work") beruhte auf Sessions
  unter 1 Minute, und die KI machte aus „35 vs. 21 min" ein „up from 21 minutes".
  Überfällig- und Trend-Tipps wiederholten sich täglich mit festem Tageszähler;
  Ratings und Minuten wurden vermischt, inaktive Goals und Wochenziele ignoriert.
- Eine Engine für beides: `_shared/coachPatterns.ts` liefert die Notifications
  (`coach-nudges`) und den Stats-Text (`analyze-sessions`, jetzt pro gewähltem
  Goal, ohne Rating-Pflicht und immer frisch berechnet; `insight_cache` und das
  Refresh-Limit werden nicht mehr benutzt).
- Regeln: Sessions unter 5 min bilden keine Muster, zählen aber als Aktivität und
  fürs Wochenziel wie auf Home. Wochentag und Uhrzeit pro Session in der
  Geräte-Zeitzone (sommerzeitfest). Gewohnheit = gleicher Wochentag an ≥ 3
  Tagen, Start ±75 min, an ≥ 30 % dieser Wochentage, zuletzt vor ≤ 6 Wochen.
  Vergleiche nach Wochentag oder Tageszeit erst ab 21 Tagen Verlauf und ≥ 3
  Tagen je Gruppe, zum Rest hin geschrumpft (3 Pseudo-Sessions), Ratings nur
  gegen Ratings, Längen per Median. Trends: letzte 4 gegen vorige 8 Wochen, nur
  aufwärts.
- Tipp-Arten: Wochenziel (nur wenn es knapp, aber erreichbar ist), übliche Zeit
  („Gym around 5pm today?"), beste Zeit, Pause ab 14 Tagen, überfälliger
  Rhythmus (nur ohne Wochenziel), Trend.
- Notifications: Nur Gewohnheiten wiederholen sich wöchentlich; alles andere
  feuert einmal und hat eine Sperrfrist (Wochenziel 1 Tag, Rhythmus 3, Pause 7,
  beste Zeit 14, Trend 21). Pro Goal höchstens ein aktueller und ein
  Gewohnheits-Tipp, insgesamt max. 3. Die App lädt neu, sobald sich der
  Wochenfortschritt ändert.
- KI: Groq formuliert nur stabile Muster; Zähler (Wochenziel, Tage seit) sind
  immer feste Texte. Modelltext mit fremden Zahlen oder „up from/recently" bei
  Nicht-Trends wird verworfen. Die Tagesquote wird nur verbraucht, wenn es
  etwas zu formulieren gibt.
- Ergebnis mit den echten 30 Sessions, z. B.: „10h left for Deep Work — No Deep
  Work time logged yet this week, 4 days left: about 2h 30m a day." bzw. am
  Samstag „1 more visit for Gym — 3 of 4 this week, 2 days left." Für Gym steht
  ehrlich „No clear day or time for Gym yet: 4 visits so far."
- Geprüft: Typecheck, Domain-Suite (153 Assertions), Engine-Probelauf gegen die
  echten Daten. `coach-nudges` und `analyze-sessions` sind deployed.
- Später aufräumen: `insight_cache`, `insight_refresh_limits` und
  `consume_insight_refresh_quota` sind ungenutzt.

## 2026-09-10 — Anzeigename änderbar

- Settings → Account → „Display name" ist jetzt tippbar („Edit") und öffnet ein
  Popup mit Textfeld (`DisplayNameSheet`). Speichern schreibt nur
  `users.display_name` über `useAuth().updateDisplayName` (nutzt den bereits
  geprüften grant-kompatiblen Update-Pfad) und aktualisiert sofort Home-Gruß und
  Settings; Freunde sehen den neuen Namen beim nächsten Laden.
- Auth-Metadaten werden bewusst nicht mitgeändert: `updateUser` löst
  `USER_UPDATED` aus und würde den Ladebildschirm aufblitzen lassen.
- Leer speichern geht nicht (Hinweis unter dem Feld), unveränderter Name schließt
  ohne Request, Fehler steht als Text unter dem Feld.
- Nur im Arbeitsstand von main (Settings-Paper-Redesign ist dort noch nicht
  committet). Typecheck grün, `sim.sh bundle` läuft; im Simulator nicht
  durchgeklickt.

## 2026-09-10 — Fokus-Screen neu und Objekte wachsen lassen

- Fokus-Timer im Paper-Look (Variante B): weiße Scheibe mit grünem Ring, darin
  wächst das gewählte Objekt mit der fokussierten Zeit (Pausen zählen nicht).
  Darunter Timer, Status, Wachstumszeile („Plant · growing medium“), Aktionen
  und Musik.
- Start-Sheet: „WHAT TO GROW“ mit Pflanzen, Gebäuden, Wasser und Strand; die
  letzte Wahl bleibt. Sonderobjekte gibt es nur über die Rewards-Roadmap.
- Das Ende einer Session ab 5 min öffnet den Reveal-Screen: Größe (Tiny bis
  Huge) mit Begründung („2h · 2× your usual“), alle Objekte der Kategorie mit
  ihrem echten Ergebnis („New, stage 2“, „Stage 2 → 5“, ausgewachsene
  ausgegraut), dann „Add to island“ bzw. „Grow on island“ mit Konfetti und
  Mini-Insel. „Later“ behält die Belohnung. Danach folgt wie bisher das Rating.
- Auto Check-In: Die Notification nach dem Besuch öffnet denselben Screen,
  zuerst mit der Kategorie-Wahl. Nicht angetippte Belohnungen öffnen sich beim
  nächsten Öffnen der App auf Home, nie über einer laufenden Session.
- Größe: Median der früheren Sessions desselben Ziels (ab 5 min, neueste 50),
  ohne Verlauf Medium, bis 8 Sessions zur Mitte gezogen. Schritte 1/1/2/3/4 für
  Tiny bis Huge: Ein neues Objekt startet dort, ein vorhandenes wächst um so
  viel. Jedes Objekt gibt es einmal, jede Session zählt nur einmal.
- Keine Punkte mehr (Jannis): `island/ISLAND.md` §5 und `island/WACHSTUM.md`
  §14.3 angepasst.
- Speicher nur auf dem Gerät (`islandSlice` pro Konto; offene Belohnungen unter
  `goals-pending-grows`, beim Abmelden gelöscht). Die Objekte sind
  Platzhalter-Zeichnungen, bis die Pixel-Sprites existieren, und erscheinen
  noch nicht auf der Insel.
- Geprüft: Typecheck, Domain-Suite (189 Assertions), `sim.sh bundle`. Im
  Simulator nicht durchgeklickt, nicht committet.

## 2026-09-10 — Neues Home-Hintergrundbild

- Das von Jannis gelieferte Pixel-Ozeanbild mit der kleineren, tiefer liegenden
  Insel ersetzt `assets/home/island-ocean-1.png` exakt und wird von
  `HomeScreen` weiter als vollflächiger `ImageBackground` mit `cover` gerendert.
- Alle sekundären Screens behalten absichtlich ihre opake Paper-Fläche; das
  detailreiche Bild liegt nicht hinter Formularen oder langen Leseseiten.
- Cachefreier iOS-Metro-Export erfolgreich; das gebündelte PNG ist bitgenau
  identisch mit dem gelieferten 887×1774-Asset.

## 2026-09-10 — Pixel-Sprites: Pflanzen (Entwurf)

- Alle 24 Pflanzenbilder aus Katalog v1 plus 2 Gras-Varianten als echte
  Pixel-PNGs, gezeichnet per Skript `island/pixel/plants.py`, damit Stufen,
  Palette und Licht einheitlich bleiben. Maß 16 px pro Meter (Tabelle
  `WACHSTUM.md` §15.2): großer Laubbaum 26 × 34 px, Weltenbaum bis 60 × 67 px.
- Spezifikation für alle weiteren Objekte: `island/SPRITES.md`. Vorschauen
  (Insel-Szene in Handygröße, Übersicht, Dichtevergleich) in
  `island/pixel/previews/`.
- Noch nicht in der App: Reveal und Timer zeigen weiter die SVG-Platzhalter.
  Beim Einbau PNGs ohne Glättung skalieren (vorab ×D oder SVG-Rechtecke).
- Wartet auf Abnahme. Nicht committet.

## 2026-09-14 — Pixel-Insel auf Home, echte Pflanzen im Fokus-Flow

- Home zeigt den selbst gezeichneten Hintergrund `assets/home/pixel-island-1.png`
  (aus `island/pixel/ocean.py`, 220 × 478 Kunstpixel, ×6 auf 1320 × 2868): Himmel,
  Wolken, Meer mit Wellen, Insel mit Wiese, Geröllküsten, wechselnden Stränden,
  Schaum und Flachwasser in einem Bild. Stufe 1 in `src/lib/homeIslandStages.ts`
  braucht dadurch keine Insel-Ebene und keine Transformation mehr; Horizont (20 %)
  und Insel (53 %) sitzen wie abgenommen. `island`/`islandRect` sind jetzt optional,
  HomeScreen zeichnet die Ebene nur, wenn es sie gibt.
- Pflanzen sind keine Platzhalter mehr: `GrowObjectArt` zeichnet für Pflanzen die
  echten Pixel-Sprites als SVG-Rechtecke (`src/components/grow/plantSprites.ts`,
  26 Bilder, 12 Farben, 24 KB, erzeugt von `island/pixel/export_sprites.py`). So
  bleiben sie in jeder Größe scharf, auch während sie im Timer wachsen. Gebäude,
  Wasser und Strand behalten die flachen Platzhalter, bis ihre Sprites existieren.
- Neues optionales `level`-Prop an `GrowObjectArt`: ohne Angabe die höchste Stufe
  (Auswahl im Start-Sheet), mit Angabe die passende Wachstumsstufe.
- Farben danach auf eine Lagunen-Palette umgestellt (Türkis am Horizont, tiefes Blau
  vorne, helles Wasser rund um die Insel), Wolken aus der oberen linken Ecke verbannt,
  damit Begrüßung und Streak-Pille freien Himmel haben.
- Küste kommt aus der Krümmung der Inselform: Buchten bekommen breiten Sand,
  Landzungen Geröll, dazu eine Sandbank in der größten Bucht. Jannis hat aus vier
  Varianten B gewählt (`seed` 23 in `island/pixel/ocean.py`, gilt für alle Inselstufen).
- Geprüft: Typecheck, Domain-Suite (189 Assertions), `sim.sh bundle`, Home-Screenshot.
  Start-Sheet und Reveal im Simulator nicht durchgeklickt (kein Tap-Zugriff).

## 2026-09-14 — Fünf Inselgrößen

- Eine Insel in fünf Größen, gleiche Küstenform: 12,2 / 16,3 / 19,5 / 24,4 / 32,5 m
  (Landfläche 118 / 210 / 303 / 472 / 840 m², gemessen aus den fertigen Bildern).
  Das abgenommene Bild ist Stufe 2. Die Insel füllt auf jeder Stufe denselben Anteil
  der Bildschirmbreite (rund 84 %); gewachsen wird über die Kamera (D 8/6/5/4/3), also
  werden die Objekte pro Stufe kleiner und die Insel bekommt mehr Platz.
- Jede Stufe hat ihr eigenes Meer: Wellen, Dünung und Wolken werden pro Stufe neu
  gewürfelt. Die Wolken liegen als Bank knapp über dem Horizont, weil der restliche
  Himmel auf dem Handy vom Header verdeckt ist.
- `island/pixel/capacity.py` prüft die Kapazität am fertigen Bild: Unterzellen nach
  Farbe einstufen, dann den ganzen Katalog mit echten Footprints platzieren. Stufe 5
  nimmt alle 84 Objekte auf (126 m² Grundfläche, 253 m² mit Abstand) und hat danach
  noch 510 m² Wiese frei; Stufe 4 scheitert nur an der Strandbar, Stufe 3 zusätzlich
  an der Hängematte — beide, weil der Strand dort zu schmal ist.
- Korrektur: Die Meterangaben der Stufen waren zuerst um √2 zu klein. Ein Meter
  entlang einer Bodenachse ist 8 px rechts und 4 px runter, also 11,31 px im
  gestauchten Raum, nicht 16 px.
- `src/lib/homeIslandStages.ts` führt jetzt die fünf Pixelstufen (`HOME_ISLAND_STAGE`
  steht auf 2). Die früheren KI-Meere und Insel-Sprites sind nicht mehr eingebunden,
  liegen aber weiter in `assets/ocean/` und `assets/island/stages/`.
- Geprüft: Typecheck, `sim.sh bundle`, Home-Screenshot (unverändert, weil Stufe 2).

## 2026-09-14 — Zonenkarte der Inseln

- `island/pixel/zones.json` hält für jede der fünf Inselstufen fest, welche
  0,5-m-Zelle Wiese, Strand, Fels, Flachwasser oder offenes Meer ist. Erzeugt von
  `island/pixel/zones.py` aus den fertigen Bildern: 16 Pixel pro Zelle, Mehrheit
  entscheidet, Gegenprobe gegen die Geometrie (98–99 % Übereinstimmung).
- Enthalten sind außerdem Umrechnung Zelle → Pixel, Tiefensortierung, Küstenregel,
  Flächen je Zone und die Prüfergebnisse. Format und Regeln: `island/SPRITES.md` §7.
- `island/pixel/capacity.py` liest nur noch diese Karte und platziert damit den
  Katalog — Stufe 5: 84 von 84 Objekten, 521 m² Wiese bleiben frei.
- Wird gebraucht, sobald Objekte wirklich auf der Insel erscheinen; die App nutzt die
  Datei noch nicht.

## 2026-09-14 — Wasserobjekte: Stufen und feste Plätze

- 75 Sprites für die sieben Wasserobjekte mit 8–14 Wachstumsstufen
  (`island/pixel/water.py`), in der App über `waterSprites.ts` und `GrowObjectArt`.
  `GROW_OBJECTS.water` hat die neuen Maxima.
- Gruppen (Bojen, Felsen, Möwen, Kajaks, Delfine) bekommen feste Einzelplätze rund um
  die Insel statt eines Klumpens: `island/pixel/water/slots.json`, erzeugt und geprüft
  von `island/pixel/layout.py`. Plätze sind Winkel plus Band, also stufenunabhängig.
- Beispiel mit allen Wasserobjekten auf der größten Insel:
  `island/pixel/previews/water-layout-5.png`.
- **Erledigt am 2026-09-14:** Die App zeichnet die Objekte auf die Insel.
  `island/pixel/export_layout.py` löst die Wasserplätze je Inselgröße in Pixel auf
  (`src/lib/islandSlots.ts`) und exportiert Zonenkarte und Landobjekte
  (`islandZones.ts`, `islandLand.ts`); `src/lib/islandScene.ts` entscheidet, was
  wo steht, `src/components/island/IslandObjectsLayer.tsx` zeichnet es über den
  Home-Hintergrund. Die Inselgröße kommt aus den gesammelten Stufen
  (0/25/70/145/240 von 333), jede Kategorie hat pro Inselgröße ein gemessenes
  Limit (`ISLAND_CATEGORY_LIMITS`). Boot 14 Stufen, Delfine 12, Pflanzen 10.
  Details und Zahlen in `island/SPRITES.md` §10–§11 und im Changelog von
  `island/ISLAND.md`.
- **Fokus-Session, 2026-09-14:** Das Objekt im Ring wächst nicht mehr nur linear —
  es springt sichtbar eine Stufe hoch, sobald die Session eine verdient hat
  (`src/components/grow/GrowingObject.tsx`), und ruht bei Pause und Pause.

### Fehler aus dem Prüflauf 2026-09-14 behoben

Drei Audits (Belohnungslogik, Timer-Fluss, Doku gegen Code) haben diese echten
Fehler gefunden; alle sind behoben und, wo es ohne Gerät ging, im Domain-Test
abgesichert.

| Fehler | Wirkung | Behoben in |
|---|---|---|
| Live Activity holte die Zeit ohne Deckel nach | Ein Tap nach 6 h Schlaf buchte 6 h Fokus — genau der Phantomstunden-Bug, gegen den `catchUpAfterGap` geschrieben wurde | `src/lib/focusLiveActivityActions.ts` |
| „End Session"-Dialog nannte eine andere Dauer, als gespeichert wurde | Dialog versprach 12 min, gespeichert wurden 15; bei 4:50 versprach er 5 min und es wuchs nichts | `FocusSessionScreen.tsx` (abgerundet, „weniger als eine Minute") |
| Nach dem Beenden blitzte „Session could not start" auf | Falsche Fehlermeldung nach jeder erfolgreichen Session | `FocusSessionScreen.tsx` |
| Start-Sheet mitten in der Session tauschte das belohnte Objekt | Man bekam ein anderes Objekt als das im Ring | `grow_object_key` auf der Session (`types`, `usePomodoro`) |
| Zweimal auf „End session" stapelte zwei Dialoge | Der zweite lag über dem Reveal-Screen und war tot | `askingStopRef` |
| `+5 min` verlängerte dauerhaft jeden weiteren Block | Aus 25 min wurden für den Rest des Tages 30 min mit längeren Pausen | `usePomodoro.extendFocus` verschiebt nur den laufenden Block |
| Flowtime-Ring lief bei Pause auf null | Sah aus, als sei die Session zurückgesetzt — laut CLAUDE.md §9.1 verboten | `FocusSessionScreen.tsx` |
| Timer zeigte `75:23` statt `1:15:23` | Widersprach der Live Activity auf dem Sperrbildschirm | `src/lib/time.ts` |
| Reveal-Screen ohne Ausweg | Offline plus bereits hinzugefügte Belohnung ließ nur „Try again" übrig, ohne Header und ohne Zurückgeste | `GrowRevealScreen.tsx` |
| Objektwahl ging beim Wiederöffnen verloren | Eine zurückgestellte Belohnung schlug das erste Objekt der Kategorie vor statt des gewachsenen | `App.tsx` reicht `objectKey` durch |
| „Fully grown" bei bloß zu kleiner Insel | Kategorie war gesperrt und behauptete, fertig zu sein | `categoryRoom` liefert jetzt `locked` |
| Gleichzeitige Schreibzugriffe auf die offenen Belohnungen | Ein Geofence-Ende während des Reveals konnte eine Belohnung verschlucken | `pendingGrows.ts` serialisiert die Änderungen |
| Gespeicherte Stufe über dem Maximum | Ein gesenktes `maxLevel` hätte das Objekt unsichtbar gemacht | Deckel in `islandSlice` und `islandScene` |

Offen und bewusst nicht allein entschieden: die Tokentabelle in CLAUDE.md §3
beschreibt noch das blaue Neumorphismus-System, der Code ist längst das grüne
Paper-Theme; Flowtime hat kein Pause/Resume, obwohl §9.1 es verlangt; der Timer
läuft nur, solange der Fokus-Screen montiert ist, weshalb beim Verlassen keine
Phasen-Notification geplant wird; und `BalanceCard`, `GoalCard`, `GardenPreview`
sowie der Grove-Screen sind unerreichbar.

### Prüflauf 2026-09-16: Offline, Hinweise, Ziele, Wasser

Fünf gesuchte Lücken, vier davon behoben. Alles im Domain-Test abgesichert,
soweit es ohne Gerät ging.

| Lücke | Wirkung | Behoben in |
|---|---|---|
| Sessions gingen ohne Netz verloren | Eine beendete Fokus-Session und ein Auto-Check-In wurden direkt an den Server geschrieben und bei Fehlschlag nur geloggt — die Zeit war weg | `src/lib/sessionOutbox.ts` (neu), `useSessions`, `usePomodoro`, `geofencing` |
| Timer ließ sich offline nicht starten | „Start" tat nichts, wenn die Session-Zeile nicht angelegt werden konnte | lokale Session-ID in `usePomodoro`, vollständige Zeile später aus der Warteschlange |
| Insel-Speicherung ohne zweiten Versuch | Ein fehlgeschlagener Schreibvorgang wurde erst durch die *nächste* Belohnung wiederholt | `useIslandSync` mit Wiederholung |
| Wartende Belohnungen ab der 21. verworfen | `slice(-20)` warf die ältesten still weg | Deckel auf 200, Verwerfen wird geloggt |
| Berechtigungswarnungen wurden nie angezeigt | Auto Check-In konnte aufhören zu arbeiten, die App zeigte weiter 0 Besuche | `src/components/PermissionWarningPill.tsx` (neu) auf Home |
| Ziele ließen sich nicht abschalten | Es gab keinen Weg, ein Ziel oder den Check-In-Ort loszuwerden | `useDeactivateGoal`, Aktionen in `SettingsScreen` |
| Leere Home-Karte ohne Ziel | Wer Auto Check-In übersprang, hatte eine tote Karte ohne Einrichtungsweg | Karten führen zur Einrichtung |
| Wasser-Belohnung ins Leere | „Selbst platzieren" öffnete einen Bildschirm, auf dem nichts gegriffen werden konnte | `canPlaceByHand` schließt Wasser aus |

Serverseitig behoben und deployed: Cache-Header der Ortssuche (verriet fremde
Suchen), Nutzerlimit über der globalen Kapazität, Größenprüfung erst nach dem
Puffern, roher Datenbankfehler aus `delete-account`, verbranntes Tageskontingent
nach einem fehlgeschlagenen Modellaufruf, verschluckter Cache-Lesefehler,
23:30-Gewohnheit als „12am", und `analyze-sessions` ganz ohne Begrenzung
(Migration `insight_rate_limit`, 10 Anfragen pro Minute).

Weiterhin offen, bewusst nicht allein entschieden: Kontolöschung braucht nur
einen gültigen Login, ohne erneute Bestätigung; die Belohnungsschleife endet bei
der größten Insel ohne weiteres Ziel; Freunde sehen die Insel nicht.

### Release-Prüfung 2026-09-17

Kompletter Durchgang vor dem Release: Konfiguration, Abhängigkeiten, Timer,
Store, Navigation, Fehlerbehandlung, toter Code. Typecheck, Domain-Tests
(362 Prüfungen), Expo Doctor (20/20), `pod install` und der Release-Bundle-
Export laufen sauber.

| Fund | Wirkung | Behoben in |
|---|---|---|
| Share-Button in Friends stürzte ab (Regression aus `175320f`) | `await import("react-native")` ließ Release-Builds beim Tippen abstürzen | `useFriends.ts`, statischer Import |
| Verwaiste Fokus-Sessions wurden dreimal verschieden behandelt | Belohnung teils behalten, Server-Zeile nie geschlossen — Insel wuchs aus Stunden, die Statistik nie sah | `src/lib/abandonedSession.ts`, genutzt von `usePomodoro`, `focusLiveActivityActions`, `RootNavigator` |
| Home zeigte bei Ladefehler Nullen | Startseite ohne Fehlerzustand | `LoadErrorPill` in `HomeScreen.tsx` |
| Technische Fehlertexte in Dialogen | PostgREST-/Edge-Function-Meldungen landeten beim Nutzer | `src/lib/errors.ts` |
| Sieben nirgends importierte Dateien, ungenutzte Icons/Helfer | Altlast aus Neumorphismus/Grove | gelöscht, Doku bereinigt |
| `@react-navigation/bottom-tabs`, `@expo/ui` direkt | ungenutzt | entfernt (`@expo/ui` bleibt transitiv über `expo-widgets`) |
| 13 Expo-Pakete unter der SDK-Erwartung | `npm run check` schlug fehl | `npx expo install --fix`; **nativer Rebuild nötig** |

Bewusst offen gelassen (Produkt-/manuelle Entscheidungen): Kontolöschung ohne
zweite Bestätigung; keine Datenexport-Funktion; Android nie gebaut (kein
`android/`, kein EAS-Profil, `versionCode` fehlt, Package-ID ≠ Bundle-ID); kein
Crash-Reporting; CLAUDE.md §3 beschreibt weiter das blaue Neumorphismus-System,
der Code ist das Paper-/Insel-Design.

### Funktionaler QA-Durchgang 2026-09-17 (Simulator, adversarial)

Die App wurde im iPhone-Simulator wirklich durchgespielt — Sessions starten,
doppelt tippen, Hintergrund, App killen, Pause, Blockende, Belohnung, Check-in,
Geofence-Ein-/Austritt per simuliertem Standort, Offline über eine unerreichbare
Server-Adresse, Ziel aus/an — und jeder Schritt gegen Server-Zeilen und
gespeicherten Zustand geprüft. Gefunden und behoben:

| Fund | Schwere | Behoben in |
|---|---|---|
| Ein vom Server abgelehnter Eintrag (Endzeit vor Startzeit) blockierte die gesamte Offline-Warteschlange für immer | P1 | `sessionOutbox.ts`: Endzeit ≥ Start + Dauer, Retry gegen Server-Start, abgelehnte Einträge überspringen, Wiederholung nach laufendem Flush, Aufräumen verwaister Fokus-Zeilen |
| Ohne Netz meldeten die Abfragen „keine Ziele" statt Fehler; Ziele verschwanden, Auto Check-In hätte sich abgeschaltet | P1 | `currentUser()` aus der lokalen Sitzung statt `auth.getUser()`; Ziele/Woche werden persistiert |
| Nach Neustart mitten in der Session zeigte Home nichts an; die Karte bot den Start einer zweiten an | P2 | Home: „Running/Paused · tap to resume", direkter Wiedereinstieg |
| Laufender Check-in war auf der Karte unsichtbar | P2 | Home: „Checked in · N min · tap to end" |
| Manuell beendeter Check-in unter der Mindestdauer zählte trotzdem als Session | P2 | Nachfrage auf Home, Zeile wird entfernt statt geschlossen |
| Abbrechen/Verwerfen ohne Netz schlug fehl; Timer lief wieder los | P2 | Verwerfen wird in die Warteschlange gestellt |
| Check-in-Ereignisse im Vordergrund aktualisierten Home nicht | P3 | `sessionEvents.ts`, Home reagiert sofort |
| Offline gestartete Session ließ sich nach dem Senden nicht bewerten | P3 | lokale ID → Server-ID gemerkt |

Regressionstests: `consistentEndTime`, Streak über Sommerzeit/Mitternacht.
Nur am echten Gerät prüfbar: Live Activity, Mitteilungen, Geofence bei
gesperrtem Gerät, Apple-/Google-Anmeldung, Share-Sheet-Ziele.
