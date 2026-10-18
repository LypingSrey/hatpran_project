# HatPran app

The React Native app for HatPran (Expo SDK 57 + Expo Router). It runs on iOS, Android and the web, and talks to
the Laravel API in [`../backend`](../backend).

## Run it

1. Start the API from `../backend`, listening on all interfaces so phones and emulators can reach it:

   ```bash
   php artisan serve --host=0.0.0.0 --port=8000
   ```

2. Start the app from this folder:

   ```bash
   npm install        # first time only
   npx expo start
   ```

   Then press `i` (iOS simulator), `a` (Android emulator) or `w` (web), or scan the QR code with Expo Go.

## Pointing at the API

On a phone running Expo Go, the app automatically calls the API on the same Mac that serves the
Expo bundle (`http://<mac-ip>:8000/api`), so the Laravel server must be started with `--host=0.0.0.0`.
The iOS simulator and web use `http://127.0.0.1:8000/api`; the Android emulator uses `http://10.0.2.2:8000/api`.

To force a specific server, set `EXPO_PUBLIC_API_URL`:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.20:8000/api npx expo start
```

The login and Profile screens show which server the app is using.

## Checks

```bash
npx tsc --noEmit   # typecheck
npx expo lint      # lint
```

## Structure

- `src/app/`: screens, using Expo Router's file-based routes.
  - `(tabs)/`: the five tabs, Workouts, Templates, Exercises, Records and Profile.
  - `workout/`, `template/`, `exercise/`: detail and create screens. `workout/edit/` edits a finished workout.
  - `profile/edit`: profile picture, name, email and password.
  - `record/manual`: add, edit or delete a record entered by hand.
  - `records/[group]`: one muscle group's exercises that have records; each opens the exercise screen.
- `src/lib/`: the API client (`api.ts`), session handling (`auth.tsx`; the token lives in SecureStore, or
  localStorage on the web), types, formatting, dialogs, record grouping (`recordGroups.ts`) and the profile
  picture picker.
- `src/components/`: shared UI (`ui.tsx`), the set-logging row, the exercise picker with its category chips, the
  rest timer, the in-app confirm dialog used on the web, muscle icons, and the workout, record, avatar and date
  components.

Opening any screen by URL, or reloading on the web, puts the tabs underneath it so it keeps a back button
(`unstable_settings` in `src/app/_layout.tsx`).
