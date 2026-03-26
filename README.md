# VibeTime

**Your time, your currency.** A minimalist mobile time-tracking app built on the metaphor that time is a financial resource.

## Overview

VibeTime gives you 168 hours per week. After subtracting fixed commitments (sleep, work, overhead), what remains is your **Disposable Time** — a personal weekly budget you allocate to goals.

### Two Goal Types

- **Physical Goals** (e.g., Gym) — tracked automatically via geofencing. Zero manual input.
- **Focus Goals** (e.g., Study, Read) — tracked via an in-app Pomodoro timer with ambient sounds and a visual growth mechanic.

## Tech Stack

- **React Native** + **Expo** (managed workflow, TypeScript)
- **NativeWind** (Tailwind CSS for React Native)
- **Zustand** (state management with slices pattern)
- **React Native Reanimated v3** (all animations)
- **Supabase** (Auth, PostgreSQL with RLS, Edge Functions)
- **TanStack Query v5** (server state, caching, background refetch)
- **expo-location** + **expo-task-manager** (geofencing)
- **expo-av** (ambient background audio)
- **expo-haptics** (tactile feedback)
- **react-native-svg** (garden orb rendering)

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Copy `.env.example` to `.env` and fill in your Supabase credentials:

```bash
cp .env.example .env
```

Required variables:
- `EXPO_PUBLIC_SUPABASE_URL` — Your Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — Your Supabase anon/public key

### 3. Database Setup

Run the SQL schema in your Supabase SQL Editor:

```bash
# File: supabase/schema.sql
```

This creates all tables (`users`, `goals`, `sessions`) with Row-Level Security policies.

### 4. Deploy Edge Function

Deploy the AI analysis Edge Function to Supabase:

```bash
supabase functions deploy analyze-sessions
```

### 5. Ambient Sound Assets

Replace the placeholder audio files in `assets/sounds/` with real ambient audio:
- `rain.mp3`
- `cafe.mp3`
- `white_noise.mp3`
- `forest.mp3`
- `lofi.mp3`

### 6. Run the App

```bash
npx expo start
```

## Project Structure

```
src/
├── components/      # Shared UI components
│   ├── BalanceCard.tsx
│   ├── GlassCard.tsx
│   ├── GoalCard.tsx
│   ├── ProgressBar.tsx
│   └── RatingSheet.tsx
├── hooks/           # Custom hooks (TanStack Query, Pomodoro, Auth, Audio)
│   ├── useAmbientSound.ts
│   ├── useAuth.ts
│   ├── useGoals.ts
│   ├── usePomodoro.ts
│   └── useSessions.ts
├── lib/             # Utilities (Supabase client, haptics, time helpers)
│   ├── haptics.ts
│   ├── supabase.ts
│   └── time.ts
├── navigation/      # Navigation setup
│   ├── MainTabs.tsx
│   ├── RootNavigator.tsx
│   └── types.ts
├── screens/         # All screens
│   ├── AnalyticsScreen.tsx
│   ├── AuthScreen.tsx
│   ├── CreateGoalScreen.tsx
│   ├── FocusSessionScreen.tsx
│   ├── GardenScreen.tsx
│   ├── HomeScreen.tsx
│   ├── OnboardingScreen.tsx
│   └── SettingsScreen.tsx
├── services/        # Background services
│   └── geofencing.ts
├── store/           # Zustand store with slices
│   ├── configSlice.ts
│   ├── goalsSlice.ts
│   ├── index.ts
│   ├── sessionSlice.ts
│   └── walletSlice.ts
└── types/           # Centralized TypeScript types
    └── index.ts
```

## Navigation

- **Home** — The Wallet (balance card + goal cards)
- **Garden** — Abstract orb visualization of focus session consistency
- **Analytics** — 24×7 heat map + AI insight card
- **Settings** — Gear icon on Home → modal (fixed commitments, goal CRUD, account)

## Design

- Dark mode only (`#0A0A0F` background)
- Glassmorphism cards with blur backdrop
- Goal-specific accent colors
- Generous spacing, large tap targets
- Reanimated animations throughout
- Haptic feedback on all major interactions
