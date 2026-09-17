# Goals

Goals is an Expo/React Native app for planning a weekly time budget, tracking
focus sessions, logging location-based habits automatically, and turning
completed sessions into a personal Grove constellation.

## Product

- **Focus Time:** interval or open-ended Flowtime sessions, adaptive breaks,
  optional background music, restart-safe wall-clock accounting and ratings.
- **Auto Check-In:** one physical goal with a pinned place, iOS/Android
  background geofence, visible active-visit state and a manual fallback.
- **Weekly budget:** 168 hours minus sleep, work and daily overhead.
- **Stats:** monthly calendar heatmap, weekly drill-down, a personal server
  insight computed per request and an offline heuristic fallback.
- **Grove:** deterministic, interactive 3D constellation; every completed session
  becomes a star.
- **Friends:** opt-in six-character codes and week-only aggregates—never raw
  friend sessions.

The visible bottom navigation has intentionally been removed. Stats, Friends and
Settings open from Home; the Grove opens from its Home preview. Every secondary
screen has its own Back/Close action.

## Stack

- Expo 55, React Native 0.83 and strict TypeScript
- React Navigation (native stack plus a hidden Home/Grove route container)
- Zustand with AsyncStorage persistence
- TanStack React Query
- Supabase Auth, PostgreSQL/RLS and Edge Functions
- Reanimated, react-native-svg and react-native-maps
- expo-location/task-manager, expo-notifications, expo-audio, Apple Auth and WebBrowser

## Local setup

```bash
npm install
cp .env.example .env
npx expo start --dev-client
```

Required environment variables:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Useful checks:

```bash
npm run check
npx expo export --platform ios
npx expo run:ios --no-bundler
```

There is no separate linter or device-E2E runner. `npm run check` includes strict
TypeScript, 228 deterministic domain assertions and Expo Doctor.

## Supabase

The ordered files in [`supabase/migrations`](supabase/migrations) are the
authoritative schema for both fresh and existing projects. `schema.sql` is a
readable baseline reference. Apply migrations and deploy the authenticated Edge
Functions through the CLI:

```bash
npx supabase link --project-ref <project-ref>
npx supabase db push
npx supabase functions deploy analyze-sessions
npx supabase functions deploy delete-account
npx supabase functions deploy place-search
```

The production schema creates `public.users` profiles automatically from
`auth.users`, keeps email exclusively in Supabase Auth, synchronizes app
preferences across devices, enforces ownership with RLS and composite foreign
keys, and exposes Friends only through authenticated aggregate RPCs.

OAuth/recovery redirects required in Supabase:

- `com.goals.app://google-auth`
- `com.goals.app://reset-password`

Apple Sign-In additionally requires the matching Apple Developer/Supabase
configuration for the native iOS bundle ID `com.vibetime.app` and the web
Services ID `com.dominik.vibetimeauth`. App deep links continue to use the
independent `com.goals.app` URL scheme.

Supabase Auth's leaked-password protection should be enabled after upgrading to
a plan that supports it; the current plan rejects that setting with HTTP 402.
The server-side minimum password length is already 8. Provider credentials and
this Auth setting are dashboard-level configuration and are intentionally not
stored in SQL.

## Design

The app is light-only. Home uses the bundled pixel-ocean and island artwork in
`assets/home/island-ocean-1.png`; reading, setup and configuration screens use
an opaque warm Paper surface so text and controls remain clear. Actions stay
flat, inputs remain minimal, and interaction targets are at least 44pt.

[`CLAUDE.md`](CLAUDE.md) is the complete, reproducible design contract.
[`PROGRESS.md`](PROGRESS.md) is the authoritative feature/release status and
[`STRUCTURE.md`](STRUCTURE.md) maps the codebase.

## Assets and licensing

Focus audio comes from
[Open Lofi](https://github.com/btahir/open-lofi) and is CC0/public domain.
Place search data is attributed to OpenStreetMap in every search UI. The
authenticated `place-search` Edge Function provides shared caching, per-user
quotas and a cross-instance upstream queue so installed clients do not call
public Nominatim independently. After its migration and function are deployed,
set `EXPO_PUBLIC_PLACE_SEARCH_ENDPOINT=supabase`; the app derives the trusted
Function URL from `EXPO_PUBLIC_SUPABASE_URL` and only sends the session JWT to
that origin. A different HTTPS endpoint may be supplied if it accepts the same
Nominatim parameters and returns a compatible JSON array. Blank keeps the
throttled direct fallback for development and partially deployed environments.
