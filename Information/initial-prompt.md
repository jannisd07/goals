**Role:** You are an expert Full-Stack Mobile Developer and UI/UX Designer specializing in React Native, Expo, and AI-driven applications. You build production-ready, scalable, clean systems — every decision prioritizes simplicity, performance, and user experience above all else.

**Project Name:** VibeTime (Internal Codename: TimeWallet)

---

## Core Concept

VibeTime is a **minimalist mobile time-tracking app** built on one metaphor: time is a financial currency. Users have 168 hours per week. After subtracting fixed commitments (sleep, work), what remains is their **Disposable Time** — a personal weekly budget they allocate to goals.

The app has exactly two types of goals, each with its own purpose-built tracking mode:

1. **Physical Goals (e.g., Gym)** — tracked automatically via geofencing. Zero manual input required.
2. **Mental/Study Goals (e.g., Study, Read, Create)** — tracked via an in-app Pomodoro timer with ambient background sounds and a visual growth mechanic.

The philosophy is: **seamless, automatic, beautiful, and non-intrusive.** The app should feel like it lives quietly in the background of a user's life, surfacing only when needed — and when it does appear, it should feel premium and calm.

---

## Tech Stack (Non-Negotiable)

- **Framework:** React Native with Expo Managed Workflow, fully typed with TypeScript. No any types. All interfaces live in a centralized /types directory.
- **Styling:** NativeWind (Tailwind CSS for React Native). All styles via NativeWind utility classes. Design tokens (colors, radii, font sizes) defined in tailwind.config.js. Dark mode by default. The visual language is: muted dark backgrounds, soft white text, gentle glassmorphism cards, minimal UI chrome.
- **State Management:** Zustand with a slices pattern — separate slices for wallet state, goals, active session, and user config. No prop drilling whatsoever.
- **Animations:** React Native Reanimated v3 exclusively. Every meaningful UI moment — progress fills, screen transitions, the growth animation, modal entrances — is animated with shared values and useAnimatedStyle.
- **Backend/Database:** Supabase — Auth (email + OAuth), PostgreSQL with Row-Level Security on all tables, Edge Functions for AI analysis logic.
- **Server State:** TanStack Query v5 for all async data. Loading states, caching, background refetching, and optimistic updates are all handled through TanStack Query — never manual useState flags.
- **Native Features:** expo-location (geofencing), expo-notifications (push + local), expo-task-manager (background tasks), expo-haptics (tactile feedback on every major interaction), expo-av (ambient background audio playback).
- **No Spotify, no Apple Music, no external music APIs.** Background sounds are bundled audio assets served locally within the app.

---

## 1. Architecture & Data Structure

### The Time Wallet

During onboarding, the user configures their **Fixed Commitments**:
- Hours of sleep per night (× 7)
- Hours of work or school per day (× their work days)
- A flat daily overhead for meals, commute, hygiene (user-defined)

The app computes: 168 − (all fixed commitment hours) = Disposable Time (hours/week).

This number is the primary KPI on the home screen — displayed like a bank balance, always visible, decrementing live as an active session runs.

### Goal Structure

Each goal has:
- name (string)
- type: either "physical" (geofence-tracked) or "focus" (Pomodoro-tracked)
- target_sessions_per_week (integer — e.g., "I want to go to the gym 4 times this week")
- target_hours_per_week (float — e.g., "I want to study 10 hours this week")
- location (optional, only for physical type): GPS coordinates + radius in meters
- color (a single accent color chosen at goal creation, used throughout that goal's UI)

Goals do **not** have minimum/target dual thresholds. A single weekly target is sufficient. Progress toward that target is shown as a clean progress bar or arc on the home screen.

### Session Structure

A session record contains:
- goal_id, start_time, end_time, duration_seconds 
- trigger: "geofence" or "manual_pomodoro" 
- rating (1–5, collected post-session via a simple bottom sheet)
- pomodoro_cycles (integer, only for focus sessions)
- ambient_sound (string key of which sound was playing, nullable)
- notes (optional short text)
- growth_stage (integer — see Growth Mechanic below)

---

## 2. Feature Behavior — Physical Goals (Geofencing)

### How It Works

When a user creates a physical goal (e.g., "Gym"), they set a location by either searching an address or dropping a pin on a map. They also specify a detection radius (default: 150m, adjustable).

A background task registered via expo-task-manager continuously monitors the device's location. When the user **enters** the geofenced radius:
1. A push notification fires: *"You're at [Goal Name]. Logging your session automatically."*
2. A session is created in the database with trigger: "geofence" and start_time: now().
3. The session runs silently in the background — no need to open the app.

When the user **exits** the geofenced radius (and has been inside for at least 10 minutes — to prevent false triggers from brief passes):
1. The session is closed with end_time: now().
2. A gentle notification fires: *"[Goal Name] session logged — [X] mins. How was it?"*
3. Tapping the notification opens the app directly to a minimal **Post-Session Rating Sheet** (a bottom sheet with 5 star/emoji options and an optional one-line notes field). This rating is attached to the session record.

**Edge case handling:**
- If the user enters and exits in under 10 minutes, no session is logged and no notification is sent.
- If the user is inside the geofence when the app is first installed/opened, no session is auto-started until a proper enter-event is detected.
- The user can manually end a session from the app at any time if the geofence fails to detect exit.

The user sees their weekly session count for each physical goal on the home screen (e.g., "Gym — 3 / 4 sessions this week"), updated in real time.

---

## 3. Feature Behavior — Focus Goals (Pomodoro)

### The Timer

When the user starts a focus session for a goal like "Study" or "Read":
1. They are taken to the **Focus Screen** — a full-screen, immersive, dark UI.
2. A circular progress ring fills over the duration of a single Pomodoro cycle (default 25 minutes, configurable per goal to 30, 45, or 60 minutes).
3. A short break (5 minutes) automatically follows. After 4 cycles, a long break (15–20 minutes) is offered.
4. The session ends when the user manually stops or when they choose to finish after any completed cycle.

### Ambient Background Sounds

On the Focus Screen, the user can optionally enable a background sound. The sounds are **locally bundled audio files** — no internet connection, no APIs. Available options:
- Rain
- Café ambience
- White noise
- Forest / nature sounds
- Lo-fi instrumental (a simple, non-copyrighted bundled track)

The user selects a sound via a small horizontal scroll picker at the bottom of the Focus Screen. The selected sound loops seamlessly via expo-av for the duration of the session. Volume is adjustable with a simple slider. The sound setting persists across sessions (remembered via Zustand + AsyncStorage).

### The Growth Mechanic — "Your Garden"

This is the emotional core of the focus tracking experience. The concept: **every completed Pomodoro cycle plants or grows something in a personal visual garden.**

Specifically:
- The user has a **personal garden** — a dark, ambient scene rendered with React Native Reanimated and SVG (via react-native-svg).
- Each **completed focus session** (at least one full Pomodoro cycle) adds a **glowing orb** to the garden. The orb is small and dim at first.
- As the same goal accumulates more completed sessions over the weeks, the orbs in that goal's zone of the garden **grow brighter, larger, and more complex in shape** — they evolve visually through defined growth stages (e.g., Stage 1: small dot → Stage 2: pulsing orb → Stage 3: crystalline shape → Stage 4: fully bloomed geometric form).
- Each goal has its own color (set at creation), so the garden is a multi-color, ambient visual representation of the user's consistency.
- The garden is **not a forest, not trees, not plants.** It is abstract — floating geometric light forms on a dark background — so it is clearly distinct from Forest/Flora-style apps while delivering the same emotional reward of watching something grow through consistent effort.
- The garden is accessible as its own tab in the navigation and also shown in a smaller preview card on the home screen.
- When a session completes and a new orb is added or an existing one grows, a **Reanimated entrance animation** plays — the orb blooms into existence with a particle-like expand-and-settle effect. Haptic feedback fires at the same moment.

### Post-Session Flow (Focus)

After the user ends a focus session:
1. A full-screen **recap moment** appears briefly — it shows duration, cycles completed, and the garden growth that just occurred (the orb bloom animation plays again, center screen).
2. Below that, a minimal rating prompt (1–5) and optional note field.
3. Tapping "Done" dismisses to the home screen. The session is saved to Supabase.

---

## 4. Home Screen — "The Wallet"

The home screen is the command center. It must be clean, glanceable, and never overwhelming.

Layout from top to bottom:
1. **Header:** Greeting ("Good morning, Jannis") + current date + a small gear icon for settings.
2. **The Balance Card:** A large, glassmorphism-style card showing the Disposable Time remaining this week in hours (e.g., "38.5 hrs left"). A subtle arc or thin ring underneath shows percentage of budget consumed. This number decrements live during active sessions.
3. **Goal Cards:** One card per goal, displayed in a vertical scroll list. Each card shows:
   - Goal name and color accent
   - Progress this week (sessions for physical goals, hours for focus goals) vs. target
   - A slim progress bar
   - For physical goals: a small location pin icon and "Auto-tracking" label
   - For focus goals: a "Start Session" tap target
4. **No other content.** No charts, no feeds, no noise on the home screen.

---

## 5. Analytics — Heat Map

A dedicated tab shows a **24×7 grid heat map** — 24 rows (hours of the day, 0–23) × 7 columns (days of the week). Each cell is colored by the density of session activity logged at that time slot. Darker/brighter = more activity.

This gives the user an instant visual read of their personal rhythm — when they're consistently productive, when they're inactive, and whether their patterns are shifting week over week.

The user can toggle between goals (filter the heat map by goal) and between weeks (navigate backward).

No additional analytics beyond this — no bar charts of weekly totals, no streaks counter, no verbose stats pages. Just the heat map.

---

## 6. AI Analysis

This feature lives as a subtle section within the Analytics tab, below the heat map. It is powered by a **Supabase Edge Function** (Deno/TypeScript runtime) that queries the user's session data and returns a short, human-readable insight.

The analysis correlates:
- Session rating (1–5) with time_of_day (derived from start_time)
- Session rating with what the user did in the previous 2–3 hours (derived from adjacent sessions)
- Consistency patterns (which days/times have the most completed sessions)

The Edge Function returns 2–3 plain-language sentences. Examples:
- *"Your study sessions rated 4+ almost always happen between 9am and 1pm."*
- *"Gym sessions after a rest day are rated 0.8 points higher on average."*
- *"You've been most consistent on Tuesday and Thursday — consider protecting those time blocks."*

This text is displayed in a clean card below the heat map. It refreshes once per day (cached via TanStack Query with a 24-hour stale time). No chatbot UI, no interactivity — just a static, thoughtful insight card.

---

## 7. Design Language

- **Mode:** Dark by default. No light mode in v1.
- **Background:** Near-black (#0A0A0F or similar), not pure black. Subtle noise texture overlay at low opacity to avoid flat digital feel.
- **Cards:** Frosted glass effect — semi-transparent white/gray backgrounds with blur backdrop, soft border at ~10% white opacity.
- **Typography:** One font family throughout. Clean, modern, slightly geometric. All text is either pure white, 70% white, or 40% white — no color text except goal accent colors and system status indicators.
- **Accent Colors:** Each goal has one user-chosen accent color. These are the only colors on screen beyond white and dark gray.
- **Spacing:** Generous. Nothing feels cramped. Large tap targets everywhere.
- **Haptics:** expo-haptics fires on: session start, session end, rating selection, goal creation, garden orb bloom. Light impact for small interactions, medium for major ones.
- **Animations:** All transitions use Reanimated shared values. Screen mounts fade+slide in gently. No jarring jumps. The Focus Screen and Garden are the two most visually rich surfaces — all other screens are intentionally sparse.

---

## 8. Navigation Structure

Bottom tab navigation with exactly three tabs:
1. **Home** — The Wallet (balance + goal cards)
2. **Focus** — The Garden view (full garden scene, tap any orb to see its goal history)
3. **Analytics** — Heat map + AI insight card

Settings (Fixed Commitments config, goal management, notification preferences) are accessible via the gear icon on the Home screen as a modal stack — not a separate tab.

---

## 9. Initial Build Instructions

1. Initialize the Expo project with TypeScript, NativeWind, and the full dependency set listed above.
2. Set up Supabase — create all tables (users, goals, sessions) with RLS policies. All writes are scoped to the authenticated user's user_id.
3. Build the Zustand store with slices: walletSlice (disposable time, live decrement logic), goalsSlice (CRUD for goals), sessionSlice (active session state, start/stop logic).
4. Build the Home Screen with the Balance Card and Goal Cards, wired to live Zustand + TanStack Query data.
5. Implement the Geofencing background task — register it with expo-task-manager, handle enter/exit events, auto-create and auto-close sessions, fire notifications.
6. Build the Focus Screen — Pomodoro timer with Reanimated ring, expo-av ambient sound picker, and the post-session recap animation.
7. Build the Garden — SVG-based abstract orb scene, per-goal color zones, Reanimated orb bloom animation on session completion.
8. Build the Analytics tab — heat map grid component, TanStack Query fetch to Supabase Edge Function for AI insight.
9. Wire up expo-haptics to all major interaction points.

**Build for production. No placeholders, no mock data in final components, no commented-out TODO blocks. Every screen must be fully functional end-to-end.**