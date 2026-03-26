Here's the full feature and layout specification:

---

# VibeTime — Complete Feature & Layout Specification

---

## Table of Contents

1. [Onboarding Flow](#onboarding)
2. [Home Screen — The Wallet](#home)
3. [Goal Creation & Management](#goals)
4. [Physical Goal Tracking — Geofencing](#geofencing)
5. [Focus Session — Pomodoro](#pomodoro)
6. [The Garden](#garden)
7. [Analytics — Heat Map](#analytics)
8. [AI Analysis](#ai)
9. [Post-Session Flows](#postsession)
10. [Settings](#settings)
11. [Navigation Structure](#navigation)
12. [Data Architecture](#data)
13. [Background & System Behavior](#background)
14. [Notifications](#notifications)

---

## 1. Onboarding Flow {#onboarding}

The onboarding flow runs exactly once — on first app launch after account creation. It collects the minimum information needed to compute the user's weekly Disposable Time budget and creates their first goal. It cannot be skipped.

### Screen 1 — Welcome

A single screen with the app name, a one-sentence value proposition ("Your time, tracked automatically."), and a "Get Started" button. Below the button: a "Already have an account? Sign in" text link.

### Screen 2 — Account Creation / Sign In

Two tabs on this screen: **Sign Up** and **Sign In**.

**Sign Up fields:**
- First name (text input)
- Email (text input, email keyboard)
- Password (secure text input, with show/hide toggle)
- "Create Account" button

**Sign In fields:**
- Email
- Password
- "Sign In" button
- "Forgot password?" text link (triggers email reset flow via Supabase Auth)

OAuth options (Google, Apple) appear as secondary buttons below the primary form on both tabs.

On successful auth, the user proceeds to Screen 3. On error, inline validation messages appear beneath the relevant field — never modal alerts.

### Screen 3 — Sleep

Header: "How much do you sleep per night?"

A large number picker (scroll wheel or +/− stepper) allowing selection from 4 to 12 hours in 0.5-hour increments. Default pre-selected: 7.5 hours.

Below the picker: a live-updating label that shows the weekly total — e.g., "That's 52.5 hours per week committed to sleep."

"Next" button at the bottom.

### Screen 4 — Work / School

Header: "How many hours do you work or study per day?"

Two inputs:
- Hours per day (number picker, 0–16, 0.5 increments)
- Days per week (segmented control: 1–7, default 5)

Live weekly total label updates as the user adjusts either input.

"Next" button.

### Screen 5 — Daily Overhead

Header: "What else eats your time daily?"

Three pre-labeled rows, each with a +/− stepper:
- Commute (hours/day, default 0.5)
- Meals (hours/day, default 1.0)
- Personal care / hygiene (hours/day, default 0.5)

A fourth row labeled "Other" with a free number input (default 0).

Live label: "That's [X] hours/day, [Y] hours/week in daily overhead."

"Next" button.

### Screen 6 — Your Budget Reveal

A full-screen moment. The app computes and displays:

```
168 hours in a week
− [sleep total] hrs sleep
− [work total] hrs work/school
− [overhead total] hrs daily overhead
─────────────────────────
= [disposable] hrs disposable time
```

Each line animates in sequentially — the subtraction lines appear one by one with a brief delay, and the final balance animates counting up from zero to the computed value.

Below: "This is your weekly time budget. Let's put it to work."

"Continue" button.

### Screen 7 — Create Your First Goal

Header: "What do you want to track?"

Two large selectable cards:
- **Physical Goal** — "Something you do at a specific place. Like the gym, a sports court, or a library." — Icon: location pin.
- **Focus Goal** — "Deep work you do anywhere. Like studying, reading, or creating." — Icon: timer/circle.

The user taps one card (it highlights) and then taps "Next."

### Screen 8 — Goal Configuration (Physical)

If Physical was selected:

- Goal name text input (placeholder: "Gym", "Pool", "Climbing Wall")
- Color picker — a horizontal row of 8 preset accent color circles. One must be selected.
- "How many times per week?" — a number stepper (1–14, default 3)
- "Set your location" — a button that opens a full-screen map modal. User can search an address or long-press the map to drop a pin. A radius slider (50m–500m, default 150m) appears below the map once a pin is set. The selected location shows a circle on the map representing the detection radius.

"Create Goal" button. On tap, goal is saved and the user proceeds to Screen 9.

### Screen 8 (alt) — Goal Configuration (Focus)

If Focus was selected:

- Goal name text input (placeholder: "Study", "Read", "Write")
- Color picker — same 8-color row
- "How many hours per week?" — number stepper (0.5–40, 0.5 increments, default 5)
- "Session length" — segmented control: 25 min / 30 min / 45 min / 60 min (default 25)

"Create Goal" button → proceeds to Screen 9.

### Screen 9 — Permissions

Header: "A few permissions to make this work automatically."

A vertical list of permission rows, each with:
- Icon
- Permission name and one-line explanation
- "Allow" button (or "Granted" label if already granted)

Permissions requested:
- **Location (Always)** — "Required to auto-detect when you arrive at your goal locations."
- **Notifications** — "Required to alert you when a session starts or ends."
- **Background App Refresh** — "Required to track sessions even when the app is closed."

Each "Allow" button triggers the native iOS/Android permission dialog. After all three are granted (or dismissed), the "Continue to App" button becomes active.

If the user denies a permission, the row shows a warning label: "Some features won't work without this." They can still proceed.

### Screen 10 — Done

A brief, full-screen success state. Shows the user's computed Disposable Time balance and their first goal. A single "Open VibeTime" button drops them onto the Home Screen. This is the only time this screen appears.

---

## 2. Home Screen — The Wallet {#home}

The Home Screen is the primary surface. It is always the first tab in the navigation. Everything on this screen is live — data reflects the current week (Monday 00:00 to Sunday 23:59 in the user's local timezone).

### 2.1 Header

- Left: User's first name + current day and date (e.g., "Hey Jannis — Wednesday, July 9")
- Right: A single gear icon that opens the Settings modal stack

No search, no notifications bell, no avatar. Just the name and settings access.

### 2.2 The Balance Card

A large card occupying roughly the top third of the scrollable content area (below the header). It displays:

- **Primary figure:** Disposable Time remaining this week, in hours and minutes (e.g., "41h 20m remaining")
- **Secondary label:** "of [total disposable] hrs this week"
- **Progress indicator:** A thin horizontal bar or arc below the figure showing percentage of the weekly budget consumed. It fills left-to-right as the week progresses and sessions are logged.
- **Live decrement:** If a session is currently active, the remaining time decrements in real time — updating every 60 seconds. A small animated pulse indicator or subtle "live" label appears on the card to indicate an active session is running.

The balance is computed as: `disposable_time_per_week − sum(duration of all sessions this week)`.

Tapping the Balance Card does nothing — it is display only.

### 2.3 Goal Cards

Below the Balance Card: a vertical, scrollable list of Goal Cards. One card per goal the user has created.

**Every Goal Card contains:**
- Goal name (left-aligned, prominent)
- Goal type indicator: a small location pin icon for Physical goals, a small timer icon for Focus goals
- The goal's accent color used as a left border stripe or subtle background tint on the card
- Weekly progress vs. target:
  - Physical: "3 / 4 sessions this week"
  - Focus: "6h 20m / 10h this week"
- A slim progress bar spanning the card width, filled to the proportional progress amount
- Progress bar color matches the goal's accent color; turns to a success state (slightly different shade or checkmark) when target is reached

**Physical Goal Card — additional elements:**
- "Auto-tracking" label with the location pin icon, indicating geofencing is active for this goal
- If a session is currently active (user is inside the geofence right now): the card shows a live timer counting up ("Active — 32m"), the progress bar subtly pulses, and a "End Session" button appears at the bottom of the card
- If no session is active: no button, just the progress summary

**Focus Goal Card — additional elements:**
- A large "Start Session" button at the bottom of the card
- Tapping "Start Session" navigates immediately to the Focus Screen for that goal
- If a focus session is currently active for this goal: the card shows a live countdown of the current Pomodoro cycle remaining ("Cycle 2 — 14m left"), a "View Session" button that navigates back to the Focus Screen, and no "Start Session" button

**Empty state (no goals created):**
A single placeholder card with a "+" icon and the text "Create your first goal." Tapping it opens the Goal Creation flow.

### 2.4 Garden Preview Card

Below the Goal Cards: a fixed-size card labeled "Your Garden." It shows a miniature, non-interactive render of the user's garden (the abstract orb scene from the Garden tab). It is purely visual — a thumbnail of the garden's current state.

Tapping it navigates to the Garden tab.

### 2.5 Add Goal Button

At the very bottom of the scrollable content, below all Goal Cards and the Garden Preview: a text button labeled "+ Add Goal." Tapping it opens the Goal Creation flow (Screen 7 onward from onboarding, but as a modal).

---

## 3. Goal Creation & Management {#goals}

### 3.1 Creating a Goal

Accessible from:
- The "+ Add Goal" button on the Home Screen
- The Goals section inside Settings

The creation flow is the same modal stack as Screens 7–8 from onboarding. The user selects goal type, configures it, and saves. On save, the new Goal Card appears at the bottom of the Home Screen list and the goal is written to Supabase.

Maximum goals: 8. If the user already has 8 goals, the "+ Add Goal" button is hidden and a tooltip appears on the settings page: "Maximum of 8 goals reached."

### 3.2 Editing a Goal

Long-pressing any Goal Card on the Home Screen opens a context menu with two options:
- "Edit Goal" — opens a modal with the same configuration fields as creation, pre-filled with current values. All fields are editable except the goal type (Physical/Focus) — type is permanent after creation.
- "Delete Goal" — triggers a confirmation alert ("Delete [Goal Name]? All session history for this goal will be permanently deleted."). On confirm, goal and all associated sessions are hard-deleted from Supabase.

### 3.3 Goal Order

Goals appear on the Home Screen in the order they were created. There is no drag-to-reorder in v1.

---

## 4. Physical Goal Tracking — Geofencing {#geofencing}

This section describes the complete behavior of automatic location-based session tracking.

### 4.1 Background Location Monitoring

After the user grants "Always" location permission during onboarding, the app registers a background task via `expo-task-manager`. This task runs continuously in the background, even when the app is fully closed.

The task monitors all saved Physical goal locations simultaneously. Each location is defined by a latitude/longitude coordinate pair and a radius in meters.

The device's native geofencing API (CLLocationManager on iOS, Geofence API on Android) handles the actual detection — the app does not poll GPS continuously. Entry and exit events are delivered by the OS when the user crosses a geofence boundary.

### 4.2 Session Start — Geofence Entry

When the OS delivers a geofence **entry event** for a saved location:

1. The background task is triggered.
2. The task logs the entry timestamp internally (not yet a session).
3. A **local push notification** is sent immediately: *"You're at [Goal Name] — session started automatically."*
4. A new session record is created in Supabase with `start_time: now()`, `trigger: "geofence"`, and `status: "active"`.
5. The Home Screen Balance Card and Goal Card update in real time via TanStack Query background refetch.

There is no prompt asking the user to confirm the session start for geofenced goals — it is fully automatic. The notification is informational only, not a confirmation request.

### 4.3 Session End — Geofence Exit

When the OS delivers a geofence **exit event**:

1. The background task checks how long the user was inside the geofence since the entry event.
2. **If less than 10 minutes:** The active session record is deleted silently. No notification. No session is counted. This handles brief drive-bys, GPS drift, or accidental triggers.
3. **If 10 minutes or more:** The session is closed — `end_time: now()`, `duration_seconds` computed and written, `status: "completed"`. A notification fires: *"[Goal Name] session logged — [X] mins. How was it?"* Tapping this notification deep-links into the app and opens the Post-Session Rating Sheet for this session.

### 4.4 Manual Session Override

From the Home Screen, if an active geofence session is running, the Goal Card shows an "End Session" button. Tapping it:
1. Immediately closes the session (`end_time: now()`).
2. Opens the Post-Session Rating Sheet inline (as a bottom sheet on the Home Screen).
3. The geofence is still monitored — if the user re-enters later, a new session starts.

If the user is physically inside a geofence but no session was auto-started (e.g., they denied background location permission), the Goal Card shows a "Start Manually" button. Tapping it creates a session with `trigger: "manual"`.

### 4.5 Concurrent Geofences

The app supports up to 8 Physical goals, meaning up to 8 simultaneous geofences. If two geofences overlap (e.g., the gym is inside the university campus radius), both sessions would technically trigger. The app handles this by: if two entry events fire within 60 seconds, only the one with the smaller radius (more precise location) creates a session. The other is silently discarded.

### 4.6 Location Editing

Inside a Physical goal's Edit modal, the user can update the location pin and radius at any time. Changes take effect immediately — the background task de-registers the old geofence and registers the new one.

---

## 5. Focus Session — Pomodoro {#pomodoro}

The Focus Screen is a full-screen, immersive surface. It is entered by tapping "Start Session" on a Focus Goal Card. The navigation bar is hidden while this screen is active.

### 5.1 Session Initialization

When the user taps "Start Session" on a Goal Card:
1. The app navigates to the Focus Screen with the goal's context (name, color, session length setting).
2. A session record is immediately created in Supabase: `start_time: now()`, `trigger: "manual_pomodoro"`, `status: "active"`, `pomodoro_cycles: 0`.
3. The Pomodoro timer begins counting down from the goal's configured session length.

### 5.2 The Timer Display

Center of the Focus Screen: a large circular progress ring. The ring depletes (fills clockwise from full to empty, or the reverse — implementer's choice of direction, but must be consistent) over the duration of one Pomodoro cycle.

Inside the ring:
- The remaining time in MM:SS format (large, prominent)
- The cycle label: "Cycle 1", "Cycle 2", etc.
- The goal name in smaller text below the timer

The ring's stroke color matches the goal's accent color.

### 5.3 Ambient Sound

At the bottom of the Focus Screen: a horizontal scroll row of sound option buttons. Each button is a small rounded tile with an icon and a label:
- 🌧 Rain
- ☕ Café
- 〰 White Noise
- 🌿 Forest
- 🎵 Lo-fi

The previously selected sound (stored in Zustand + AsyncStorage) is pre-highlighted when the screen loads.

Tapping a sound tile:
1. Starts looping playback of that bundled audio asset via `expo-av`.
2. Highlights that tile.
3. Saves the selection to persistent state.

A volume slider sits below the sound tiles (0–100%, default 60%). Adjusting it changes the `expo-av` playback volume in real time.

Tapping a currently active sound tile toggles it off (stops playback). The user can use the timer in silence.

Sound playback continues in the background if the user locks their phone during an active focus session — this requires a background audio mode configuration in Expo.

### 5.4 Cycle Completion

When the countdown reaches zero:
1. A haptic feedback fires (medium impact).
2. A gentle notification fires (even if the app is backgrounded): *"Cycle [N] complete. Take a break."*
3. The progress ring resets and a **break timer** begins automatically:
   - After cycles 1, 2, 3: 5-minute short break
   - After cycle 4: 15-minute long break (or 20 min — configurable in settings)
4. During the break, the ring displays the break countdown and a label "Break" replaces the cycle label.
5. `pomodoro_cycles` on the active session record is incremented by 1 in Supabase.
6. After the break countdown completes, the next cycle begins automatically.

The user is never forced to manually start the next cycle — it flows continuously until they choose to stop.

### 5.5 Ending a Focus Session

A "Stop" or "Finish" button is always visible at the bottom of the Focus Screen (above the sound controls). Tapping it:
1. Stops the current Pomodoro cycle mid-cycle (the partial cycle is not counted).
2. Stops audio playback.
3. Closes the session: `end_time: now()`, `status: "completed"`, final `pomodoro_cycles` count written.
4. Navigates to the **Focus Post-Session Recap Screen**.

If the user taps Stop during a break (not during an active cycle), the behavior is the same — the session ends and the recap screen appears.

If the user has completed zero full cycles (they stop before the first cycle finishes), the session is still saved but marked `pomodoro_cycles: 0`. The growth mechanic does not trigger for zero-cycle sessions.

### 5.6 Focus Session — Background Behavior

If the user presses the home button or switches apps during a focus session:
- The Pomodoro timer continues running via a background timer (using `expo-task-manager` or a persistent notification with countdown).
- Audio continues playing (background audio mode).
- A persistent notification is shown in the notification tray: "[Goal Name] — Cycle [N] — [MM:SS] remaining" with a "Stop Session" action button.
- Tapping the persistent notification brings the user back to the Focus Screen.
- Tapping "Stop Session" from the notification ends the session and opens the app to the Recap Screen.

---

## 6. The Garden {#garden}

The Garden is the second tab in the bottom navigation. It is the visual history of all focus sessions the user has ever completed.

### 6.1 The Scene

The Garden renders a full-screen abstract scene. The scene is built with SVG elements (via `react-native-svg`) animated by Reanimated.

The scene contains a collection of **orbs** — abstract, glowing geometric light forms. Each orb represents a focus goal, and its size, brightness, and complexity reflect the cumulative number of completed Pomodoro cycles for that goal across all time.

The scene is not a realistic environment. It is dark, ambient, and abstract — like a constellation or a bioluminescent field. There are no trees, no plants, no characters, no sky.

### 6.2 Orb Growth Stages

Each orb progresses through 5 defined growth stages based on the total completed Pomodoro cycles for its associated goal:

| Stage | Cycles Completed | Visual Description |
|-------|-----------------|-------------------|
| 1 | 1–4 | A small, dim, static dot. Faint glow. |
| 2 | 5–14 | A slightly larger circle with a slow pulse animation. Soft glow halo. |
| 3 | 15–34 | A pulsing orb with subtle geometric facets (hexagonal or crystalline edge detail). Glow is stronger. |
| 4 | 35–69 | A fully faceted geometric form, slowly rotating. Bright inner core with radiating light threads. |
| 5 | 70+ | Maximum form — complex geometric shape, layered glow rings, slowly breathing scale animation, particle-like shimmer effect around it. |

All stage transitions are animated — when a session causes an orb to advance to the next stage, the transition plays in the Garden immediately (and also on the Focus Recap Screen).

### 6.3 Orb Positioning

Orbs are positioned in the scene based on their goal's creation order — spaced apart so they don't overlap. Up to 8 orbs can coexist (one per goal). Positioning uses a fixed layout algorithm (e.g., distributed evenly across the scene with slight vertical offsets) to ensure readability.

### 6.4 Tapping an Orb

Tapping any orb in the Garden opens a small overlay panel (bottom sheet or floating card) showing:
- Goal name
- Current growth stage
- Total completed Pomodoro cycles (all time)
- Total focus hours (all time)
- A scrollable list of the 5 most recent sessions for this goal: date, duration, cycles, and rating

Tapping outside the panel dismisses it.

### 6.5 Orb Bloom Animation (New Session)

When the user completes a focus session and opens the Garden (or when the Recap Screen plays the animation):
1. The relevant orb plays a bloom animation — it expands outward briefly, emits a ring of light or particles that dissipate outward, then settles into its new state.
2. If a stage advancement occurred, the bloom is more dramatic — the old form dissolves and the new form assembles in place.
3. Haptic feedback (medium impact) fires at the peak of the bloom.

### 6.6 Orb Dormancy

If a Focus goal has had no completed sessions in the past 14 days, its orb gradually dims to a lower-opacity version of its current stage. This is a visual cue only — it does not decrease the stage or reset cycles. A new completed session immediately restores full brightness with a brief pulse animation.

### 6.7 Physical Goals in the Garden

Physical goals (gym, etc.) do **not** appear in the Garden. The Garden is exclusively for Focus goal history. Physical goals are tracked on the Home Screen and in the Heat Map only.

---

## 7. Analytics — Heat Map {#analytics}

The Analytics tab contains exactly two components: the Heat Map and the AI Analysis Card. Nothing else.

### 7.1 The Heat Map Grid

A 24×7 grid. Rows = hours of the day (0 through 23, displayed as "12am", "1am", … "11pm"). Columns = days of the week (Mon through Sun).

Each cell represents one hour of one day of the current week. The cell is colored based on the total session time logged within that hour:
- 0 minutes logged: cell is near-invisible (very dark, almost no fill)
- 1–15 minutes: faint fill
- 16–30 minutes: medium fill
- 31–45 minutes: strong fill
- 46–60 minutes: full intensity fill

Cell color matches the accent color of whichever goal's session occupied that time slot. If multiple goals have sessions in the same hour, the cell blends their colors proportionally (a simple gradient split — left half one color, right half the other — for readability).

The grid is scrollable vertically if it doesn't fit the screen. Column headers (Mon–Sun) are sticky at the top. Row headers (hour labels) are sticky on the left.

### 7.2 Goal Filter

Above the heat map: a horizontal scroll row of filter chips — one chip per goal plus an "All" chip at the start (default selected).

- "All" shows all goals' sessions blended.
- Selecting a specific goal chip filters the heat map to show only that goal's sessions. All other cells go dark.
- Only one filter chip can be active at a time.

### 7.3 Week Navigation

Above the filter chips: a week selector. A left chevron and right chevron flank the current week label (e.g., "Jul 7 – Jul 13"). Tapping the chevrons navigates backward or forward one week.

The right chevron is disabled when the currently displayed week is the current week (can't navigate into the future).

The heat map re-renders with data for the selected week on every navigation tap.

### 7.4 Current-Time Indicator

When viewing the current week, a thin horizontal line (1px) spans across the row corresponding to the current hour of day, visually indicating "now" in the grid. It does not appear when viewing past weeks.

---

## 8. AI Analysis {#ai}

### 8.1 Placement

The AI Analysis Card appears below the Heat Map on the Analytics tab, requiring a scroll down to reach it. It is not shown above the heat map or on the Home Screen.

### 8.2 Content

The card displays 2–3 plain-language insight sentences generated by a Supabase Edge Function. The Edge Function queries the user's full session history and computes correlations between:
- Session rating (1–5) and time of day
- Session rating and the goal type of the preceding session (what did the user do before this one?)
- Day-of-week consistency patterns

It returns exactly 2–3 sentences. Examples of the type of output:
- "Your study sessions rated highest when starting between 9am and noon."
- "Gym sessions logged after a rest day average a full point higher in rating."
- "You've completed 100% of your weekly gym target for 3 consecutive weeks."

### 8.3 Refresh Behavior

The Edge Function is called at most once per day. TanStack Query caches the result with a 24-hour stale time. The card shows a "Last updated: [time]" label in small text below the insights.

A manual refresh button (a small circular arrow icon) appears on the card. Tapping it forces a refetch regardless of cache age, but rate-limits to a maximum of 3 manual refreshes per day per user (enforced server-side in the Edge Function via a refresh-count check in the database).

### 8.4 Loading & Empty States

- **Loading:** The card shows a skeleton placeholder (animated shimmer over three line-height blocks) while the fetch is in progress.
- **Insufficient data:** If the user has fewer than 5 total sessions with ratings, the card shows: "Complete a few more sessions to unlock insights." No skeleton, no error.
- **Error:** If the Edge Function returns an error, the card shows: "Couldn't load insights right now." with the manual refresh button visible.

---

## 9. Post-Session Flows {#postsession}

### 9.1 Physical Goal — Post-Session Rating Sheet

Triggered by: tapping the exit-event notification, or tapping "End Session" manually on the Home Screen.

A bottom sheet slides up from the bottom of the screen. It contains:
- **Header:** "[Goal Name] — [X] mins logged"
- **Rating prompt:** "How was it?" followed by 5 large emoji/star buttons (1 = terrible, 5 = great). Exactly one must be selected.
- **Optional notes field:** A single-line text input, placeholder "Any notes? (optional)". Keyboard appears only if the user taps this field.
- **"Save" button:** Writes the rating and notes to the session record. Dismisses the sheet.
- **"Skip" text button:** Dismisses the sheet without saving a rating. The session record remains with `rating: null`.

The "Save" button is active only after a rating is selected. Haptic feedback fires on each rating tap and on the Save tap.

### 9.2 Focus Goal — Post-Session Recap Screen

A full-screen surface that appears after the user taps "Stop" on the Focus Screen.

**Layout top to bottom:**

1. **Session summary header:**
   - Goal name
   - Total session duration (e.g., "1h 23m")
   - Cycles completed (e.g., "3 cycles")

2. **Garden bloom moment:**
   - A centered render of the user's orb for this goal
   - The bloom animation plays automatically when the screen appears (the orb expands, emits light, settles)
   - If a stage advancement occurred: the stage transition animation plays before the bloom settles
   - Below the orb: a label showing the current stage ("Stage 2") and, if a stage was advanced, a secondary label "Level up!" or equivalent

3. **Rating prompt:**
   - "How was this session?" with 5 star/emoji rating buttons
   - One-line optional notes input below

4. **"Done" button:**
   - Saves rating + notes to the session record
   - Navigates to the Home Screen
   - Haptic feedback on tap

If the user completed zero Pomodoro cycles (stopped before the first cycle finished), the Recap Screen is simplified: no bloom animation, no stage display. Just the duration, a rating prompt, and "Done."

---

## 10. Settings {#settings}

Settings are accessible via the gear icon on the Home Screen. They open as a modal that slides up from the bottom, presenting a navigation stack within the modal.

### 10.1 Settings Root

A simple list of sections:

- **My Budget** → opens Budget Settings
- **Goals** → opens Goals List
- **Notifications** → opens Notification Settings
- **Pomodoro** → opens Pomodoro Settings
- **Account** → opens Account Settings

A "Close" button (X) in the top-right corner dismisses the entire settings modal.

### 10.2 Budget Settings

Allows the user to re-configure their Fixed Commitments from onboarding:
- Sleep hours/night (same picker as onboarding)
- Work/school hours/day + days/week
- Overhead sliders (commute, meals, personal care, other)

Live recomputed balance shown at the bottom: "Your new weekly budget: [X] hours."

A "Save" button writes the changes. The Home Screen Balance Card updates immediately on save.

### 10.3 Goals List

A list of all the user's goals with:
- Goal name and accent color dot
- Goal type label (Physical / Focus)
- An "Edit" button per row → opens the same Edit Goal modal described in Section 3.2
- A "+" button in the top-right corner → opens the Create Goal flow

### 10.4 Notification Settings

Toggle switches for:
- **Geofence Entry Notifications** — "Notify me when a location session starts" (default: ON)
- **Geofence Exit Notifications** — "Notify me when a session is logged" (default: ON)
- **Pomodoro Cycle Notifications** — "Notify me when a cycle completes" (default: ON)
- **Weekly Review Reminder** — "Sunday evening summary notification" (default: ON) — see Section 10.6

### 10.5 Pomodoro Settings

- Default break length after 4 cycles: segmented control (15 min / 20 min, default 15)
- No other Pomodoro settings — individual session lengths are configured per-goal, not globally.

### 10.6 Weekly Review Notification

Every Sunday at 8:00pm (user's local time), if the Notification setting is ON, the app sends a local notification:

*"Week's over — [X]h tracked out of [Y]h budget. Your garden grew [N] new cycles. Tap to see your recap."*

Tapping the notification opens the app to the Analytics tab (Heat Map view of the just-completed week). There is no dedicated "Weekly Review" screen — the Heat Map filtered to the past week serves as the review.

### 10.7 Account Settings

- Display name (editable text field, "Save" button)
- Email address (display only — not editable in v1)
- "Change Password" button → triggers Supabase password reset email
- "Sign Out" button → confirmation alert → signs out and returns to the Welcome screen
- "Delete Account" button → destructive confirmation alert (requires typing "DELETE") → permanently deletes all user data from Supabase (cascade delete on all goals and sessions) → signs out

---

## 11. Navigation Structure {#navigation}

### Bottom Tab Bar

Three tabs, always visible (except during an active Focus Session where it is hidden):

| Tab | Icon | Screen |
|-----|------|--------|
| Home | Wallet / house icon | The Wallet — Balance Card + Goal Cards |
| Garden | Orb / sparkle icon | The Garden scene |
| Analytics | Grid / chart icon | Heat Map + AI Analysis Card |

The active tab icon is highlighted with the user's primary accent color (a system-level accent, not tied to any specific goal — set to a neutral default like white or soft blue).

### Modal Stacks (appear over the tab bar)

- **Settings** — triggered by gear icon on Home Screen
- **Goal Creation/Edit** — triggered by "+ Add Goal" or long-press edit
- **Focus Session** — triggered by "Start Session" on a Focus Goal Card — this is a full-screen modal that hides the tab bar
- **Post-Session Recap** — appears after a Focus Session ends, also full-screen, also hides the tab bar
- **Post-Session Rating Sheet** — appears as a bottom sheet after a Physical session ends, tab bar remains visible beneath it

### Deep Links

The following deep link paths must work (used by notifications):
- `vibeTime://post-session-rating?sessionId=[id]` — opens the Post-Session Rating Sheet for a specific session
- `vibeTime://analytics` — opens the Analytics tab
- `vibeTime://home` — opens the Home tab
- `vibeTime://focus?goalId=[id]` — opens the Focus Screen for a specific goal (used by the persistent focus notification)

---

## 12. Data Architecture {#data}

### 12.1 Tables

**`users`**
- `id` (uuid, PK, from Supabase Auth)
- `display_name` (text)
- `sleep_hours_per_night` (float)
- `work_hours_per_day` (float)
- `work_days_per_week` (integer)
- `overhead_hours_per_day` (float)
- `disposable_hours_per_week` (float, computed on write)
- `created_at` (timestamptz)

**`goals`**
- `id` (uuid, PK)
- `user_id` (uuid, FK → users)
- `name` (text)
- `type` (enum: `physical`, `focus`)
- `color_hex` (text)
- `target_sessions_per_week` (integer, nullable — for physical goals)
- `target_hours_per_week` (float, nullable — for focus goals)
- `session_length_minutes` (integer, nullable — for focus goals: 25/30/45/60)
- `location_lat` (float, nullable)
- `location_lng` (float, nullable)
- `location_radius_meters` (integer, nullable)
- `location_label` (text, nullable — human-readable address)
- `created_at` (timestamptz)
- `sort_order` (integer — for future ordering support)

**`sessions`**
- `id` (uuid, PK)
- `goal_id` (uuid, FK → goals)
- `user_id` (uuid, FK → users)
- `start_time` (timestamptz)
- `end_time` (timestamptz, nullable)
- `duration_seconds` (integer, nullable — written on close)
- `status` (enum: `active`, `completed`)
- `trigger` (enum: `geofence`, `manual`, `manual_pomodoro`)
- `rating` (integer 1–5, nullable)
- `notes` (text, nullable)
- `pomodoro_cycles` (integer, default 0)
- `ambient_sound` (text, nullable)
- `created_at` (timestamptz)

### 12.2 Row-Level Security

All tables have RLS enabled. Every policy is a single rule: `user_id = auth.uid()`. Users can only read and write their own rows. No shared data, no public data, no admin bypass in v1.

### 12.3 Computed Values

- `disposable_hours_per_week` is recomputed and written to the `users` table every time Budget Settings are saved. It is not computed on the fly in the client — it is stored.
- `duration_seconds` is computed server-side in the Edge Function (or in the client before the write) as `end_time - start_time` in seconds when a session is closed.
- Weekly progress figures (sessions this week, hours this week) are computed client-side by TanStack Query from the raw session data — not stored as aggregates.

---

## 13. Background & System Behavior {#background}

### 13.1 App States

The app must behave correctly in three states:
1. **Foreground** — app is open and visible. Full functionality.
2. **Background** — app is running but not visible (user switched apps or locked phone). Geofencing continues, audio continues (during focus sessions), timers continue.
3. **Terminated** — app is fully closed. Geofencing continues via OS-managed background task. No audio. No Pomodoro timer (the timer state is written to Supabase on every cycle completion and on session creation, so if the user re-opens the app, it can reconstruct the session state from the database).

### 13.2 Session State Recovery

When the app is opened (from any state), TanStack Query fetches any sessions with `status: "active"` for the current user.

- If an active **geofence session** is found: the Home Screen Goal Card reflects it as live (with running timer). If the user is no longer at the location, the app does not auto-close the session — it waits for a geofence exit event or manual end.
- If an active **focus session** is found: the app shows a persistent banner or card on the Home Screen: "[Goal Name] focus session is running — tap to return." Tapping navigates to the Focus Screen, which reconstructs the timer state from `start_time` (calculates how many cycles have elapsed since then based on the goal's session length).

### 13.3 Timezone Handling

All `timestamptz` values are stored in UTC. Week boundaries (Monday 00:00 to Sunday 23:59) are computed in the user's local timezone on the client. The Analytics heat map displays times in local timezone. There is no timezone setting — the device's system timezone is used automatically.

### 13.4 Offline Behavior

The app requires an internet connection for initial load and for writing sessions to Supabase. If the user loses connectivity:
- The Focus Timer continues running locally (Zustand state).
- Session data is queued locally and synced to Supabase when connectivity is restored (using a simple retry queue in the Zustand `sessionSlice`).
- The Garden and Heat Map display cached data (TanStack Query's cache) without updating.
- A small non-intrusive banner appears at the top of the screen: "No internet connection — data will sync when reconnected."

---

## 14. Notifications {#notifications}

### 14.1 Notification Types

| ID | Trigger | Content | Action on Tap |
|----|---------|---------|---------------|
| `geo_entry` | Geofence entry detected | "[Goal] — session started automatically." | Opens Home Screen |
| `geo_exit` | Geofence exit after ≥10 min | "[Goal] — [X] mins logged. How was it?" | Opens Rating Sheet for session |
| `pomodoro_cycle` | Pomodoro cycle completes | "Cycle [N] complete. Take a break." | Opens Focus Screen |
| `pomodoro_persistent` | Focus session active in background | "[Goal] — Cycle [N] — [MM:SS] remaining" (live) | Opens Focus Screen |
| `weekly_review` | Sunday at 8pm | "[X]h tracked this week. Tap to see your recap." | Opens Analytics tab on past week |

### 14.2 Notification Permissions

Requested during onboarding. Without notification permission:
- Geofence entry/exit notifications do not fire (tracking still works, but silently).
- Pomodoro cycle alerts do not fire.
- The Pomodoro persistent notification does not appear.
- Weekly review notification does not fire.
- The app is still functional — tracking still happens — but the user loses all proactive alerts.

### 14.3 Do Not Disturb Handling

The app does not override the device's Do Not Disturb or Focus Mode settings. All notifications are standard (not critical/time-sensitive priority) on both iOS and Android. If the user has DND active, notifications are silently queued or dropped by the OS — the app does not intervene.

---

*End of VibeTime Feature & Layout Specification. This document covers all screens, all user flows, all data structures, all background behaviors, and all notification logic for v1 of the application. No features described here are optional — all are required for the v1 build.*