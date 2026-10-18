# HatPran

[![CI](https://github.com/LypingSrey/hatpran/actions/workflows/ci.yml/badge.svg)](https://github.com/LypingSrey/hatpran/actions/workflows/ci.yml)

A workout tracker for iPhone, Android and the web. Log your sets as you train, save routines as templates, and let
HatPran keep your personal records up to date automatically.

## Features

- **Log workouts:** start from scratch or from a template, tick sets off as you go, and see a live timer, volume
  and set count. Sets can be normal, warmup, drop or failure, and each exercise type asks for the right numbers
  (weight and reps, reps only, duration, distance and so on). One workout runs at a time; starting another offers
  to resume the one in progress.
- **Last session's numbers:** an empty set shows what you did last time as a hint, so repeating it is one tap.
- **Rest timer:** ticking a set starts a countdown (1, 2 or 3 minutes or your own length) with a buzz and a
  notification when it ends, even with the phone locked.
- **Workout complete screen:** finishing shows the session's duration, volume, sets and any new records, with a
  box for notes on how it went. New workouts suggest a name (Leg day, Push day, or one for the time of day).
- **Templates:** save a routine once and start it again with one tap. HatPran tracks how often you use each one.
- **Exercise library:** 74 built-in exercises across 17 muscle groups and 20 kinds of equipment, plus your own
  custom exercises. The picker groups them into categories (Chest, Back, Legs, Core …), and compound lifts appear
  under each muscle they work.
- **Automatic personal records:** heaviest weight, most reps, best set volume, longest duration and longest
  distance, per exercise. The Records tab is split by muscle group, then by exercise. Editing or deleting a past
  set rebuilds them, and warmups and unticked sets never count.
- **Past records:** add bests you set before using the app. A logged set that beats one takes over as the record.
- **Profile:** a profile picture, lifetime stats, your latest workouts and records, and editing for your name,
  email and password.
- **Edit your history:** change a finished workout's name, notes, date, start time, duration or sets.

## Tech stack

| Folder | What | Stack |
| --- | --- | --- |
| [`backend/`](backend) | REST API | PHP 8.3+, Laravel 13, Sanctum token auth, PostgreSQL 17 |
| [`frontend/`](frontend) | Mobile + web app | React Native 0.86, Expo SDK 57, Expo Router, TypeScript |

## Getting started

You need PHP 8.3+, Composer, Docker (for PostgreSQL) and Node.js.

**1. Start the API**

```bash
cd backend
composer install
cp .env.example .env && php artisan key:generate
# set DB_PASSWORD in .env to any value, then start PostgreSQL (data persists in a Docker volume):
docker compose up -d --wait
php artisan migrate --seed    # on an existing database: php artisan migrate && php artisan db:seed --class=ExerciseSeeder
php artisan storage:link      # serves uploaded profile pictures
php artisan serve --host=0.0.0.0 --port=8000
```

Seeding loads the exercise library and a local test account, `test@example.com` with password `password`.

The development database is PostgreSQL 17 on `127.0.0.1:54320` (database and user `hatpran`, password from
`.env`), so any SQL client can connect with `postgresql://hatpran:<DB_PASSWORD>@127.0.0.1:54320/hatpran`.

**2. Start the app**

```bash
cd frontend
npm install
npx expo start   # i = iOS simulator, a = Android emulator, w = web, or scan the QR code with Expo Go
```

The rest timer's notifications work in Expo Go and in a browser; each asks for permission the first time.

On a phone, the app automatically talks to the API on the Mac serving the Expo bundle. See
[`frontend/README.md`](frontend/README.md) for pointing it at another server.

## Tests and checks

The API tests run against a separate, throwaway PostgreSQL container on port 54329, so they never touch your
development data:

```bash
cd backend
docker compose -f compose.testing.yaml up -d --wait
php artisan test
```

For the app:

```bash
cd frontend
npx tsc --noEmit   # typecheck
npx expo lint      # lint
```

GitHub Actions runs all of these on every push ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)).

## Documentation

- [`backend/README.md`](backend/README.md): API endpoints, how personal records are calculated, and database setup.
- [`frontend/README.md`](frontend/README.md): running the app on devices, choosing the API server, and the code layout.

## License

[MIT](LICENSE) © 2026 LypingSrey
