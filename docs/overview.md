# Listy architecture

Listy is an Android-first shared todo app. You create lists (groceries, chores, whatever), check items off, and invite other people by email so you both see the same list update live.

There is no Listy backend server of our own. The phone talks straight to [Supabase](./supabase.md): Postgres, Auth, Row Level Security, and Realtime.

## Who this is for

If you are new to the repo, start here. Schema, env vars, and live sync: [supabase.md](./supabase.md). Running Postgres/Auth on your machine: [docker.md](./docker.md).

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| App | Expo SDK 58 + React Native 0.88 | Android first, run in Expo Go while iterating |
| Navigation | Expo Router (`src/app/`) | File-based screens, session-gated groups |
| Data fetching | TanStack Query | Cache, optimistic updates, refetch on focus |
| Backend | Hosted Supabase (optional local Docker) | Postgres + auth + RLS + realtime, no custom API |
| Client | `@supabase/supabase-js` in `src/lib/supabase.ts` | Typed against `src/lib/database.types.ts` |
| Session | AsyncStorage | Stay signed in across app launches |

There are no `ios/` or `android/` folders. Native projects are generated when needed (Continuous Native Generation). Configure native behavior in `app.json`, not by hand-editing native trees.

## How a tap becomes data

```text
Phone (Expo Go)
  → screen in src/app/
  → hook in src/hooks/ (TanStack Query)
  → supabase.from('…') / .rpc('share_list')
  → PostgREST / Auth / Realtime on the Supabase project
  → Postgres (RLS decides which rows this user may see)
```

The publishable key in `.env` is meant to ship in the app. It is not a secret. Security is RLS: every query runs as the signed-in user (`auth.uid()`), and policies hide other people's lists.

## Folder map

```text
src/app/                 Screens (Expo Router)
  (auth)/                Sign in, sign up, forgot password, confirm code
  (app)/                 Signed-in: My Lists, list detail, share
  auth/callback.tsx      Deep-link landing for email confirmation / reset
  _layout.tsx            Auth + QueryClient + splash + session gates
src/hooks/               Lists, items, members, realtime subscription
src/lib/                 Supabase client, auth context, theme, generated DB types
src/components/          Shared UI (auth form, password field, splash, …)
supabase/migrations/     Source of truth for schema, RLS, realtime
supabase/templates/      Auth email HTML (paste into the hosted dashboard)
docs/                    This folder
```

Import alias: `@/` maps to `src/` (`tsconfig.json`).

## Navigation and auth gates

`src/app/_layout.tsx` wraps the tree in `AuthProvider` and a `QueryClient`. After the splash:

- No session → `(auth)` stack (sign in / sign up).
- Session → `(app)` stack (lists).
- Password-recovery session (user opened a reset email) → `UpdatePassword` overlay instead of the main stack.

`src/app/index.tsx` redirects `/` to `/lists` or `/sign-in`.

Deep link scheme is `listy` (`app.json`). Email confirmation and password reset target `listy://auth/callback`. Details and dashboard settings live in [supabase.md](./supabase.md#auth-and-email).

## Screens (what the user sees)

| Route | File | Job |
| --- | --- | --- |
| `/sign-in`, `/sign-up` | `(auth)/sign-in.tsx`, `sign-up.tsx` | Email + password via `AuthForm` |
| `/forgot-password` | `(auth)/forgot-password.tsx` | Request a reset code / deep link |
| `/confirm` | `(auth)/confirm.tsx` | Type the 6–8 digit email code |
| `/lists` | `(app)/lists.tsx` | Create / rename / delete / open lists |
| `/list/[id]` | `(app)/list/[id].tsx` | Add, edit, check, delete items; clear completed |
| `/share/[id]` | `(app)/share/[id].tsx` | Invite by email, remove members, leave |
| `/auth/callback` | `auth/callback.tsx` | Finish a deep-link session |

## Data layer

Hooks in `src/hooks/` are the only place screens talk to the database.

- **`useLists` / `useList`** — lists you own or are a member of, plus open-item and member counts.
- **`useItems`** and mutations — add, toggle done, rename, delete, clear completed. Mutations apply an optimistic cache update, then refetch.
- **`useMembers` / `useShareList`** — members for a list. Sharing calls the `share_list` RPC (only the owner can invite, and the invitee must already have a Listy account).
- **`useRealtimeSync`** — one Realtime channel per signed-in user. Postgres `INSERT`/`UPDATE`/`DELETE` on `items`, `lists`, and `list_members` patch or invalidate the Query cache so the other phone updates without pull-to-refresh.

Pull-to-refresh on list screens still refetches. Coming back to the foreground also marks Query as focused so stale data reloads (covers events missed while backgrounded).

Switching accounts clears the Query cache so one user's lists never flash on the next user's session.

## Auth (app side)

`src/lib/auth.tsx` holds the session, sign-up / sign-in / reset / verify-OTP, and listens for `listy://` URLs that carry `token_hash`, `code`, or tokens.

`src/lib/supabase.ts` creates a single client:

- Session persisted in AsyncStorage.
- `detectSessionInUrl: false` (no browser hash to parse).
- Token auto-refresh only while the app is in the foreground.
- If `EXPO_PUBLIC_SUPABASE_URL` is `127.0.0.1` / `localhost`, the hostname is rewritten to the Expo dev-server LAN IP (or `10.0.2.2` on the Android emulator) so a physical phone can reach local Docker.

## Sharing model

A **list** has one **owner** (`lists.owner_id`) and a **membership** row per person (`list_members`, role `owner` or `editor`). Creating a list also inserts the owner membership (trigger).

Anyone on the list can add, edit, check, and delete **items**. Only the owner can rename or delete the list, or invite someone with `share_list(email)`. Editors can leave; the owner can remove editors.

## Run it

```bash
npm install
# copy .env.example → .env or .env.local and fill URL + publishable key
npx expo start
```

Scan the QR code with Expo Go on Android. After changing env files, restart with `npx expo start --clear`.

Env vars, migrations, hosted deploy, and realtime: [supabase.md](./supabase.md). Local Docker stack: [docker.md](./docker.md).
