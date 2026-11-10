# Supabase in Listy

Listy does not run its own API. The app is a Supabase client: the phone sends the user's JWT on every request, Postgres enforces Row Level Security (RLS), and Realtime pushes row changes to other members of the same list.

This doc covers the schema, security, realtime, env vars, and how to run **local Docker** vs **hosted (prod)** databases.

## What the app uses

| Product | Used for |
| --- | --- |
| Postgres | `profiles`, `lists`, `list_members`, `items` |
| Auth | Email + password, confirmation, password recovery |
| Data API (PostgREST) | `supabase.from('…')` from the hooks |
| Database functions | `share_list`, membership helpers |
| Realtime | `postgres_changes` on `items`, `lists`, `list_members` |

Storage, Edge Functions, and GraphQL are unused.

Current hosted project (if you are on this repo's cloud): `xbziyldmasgsafmlwuuj`  
URL: `https://xbziyldmasgsafmlwuuj.supabase.co`

## Schema

Source of truth: `supabase/migrations/`. Do not edit tables by hand in the dashboard if you can add a migration instead.

```text
auth.users
    │ 1:1 (trigger on signup)
    ▼
public.profiles  (id, email, display_name)
    │
    │ owner_id
    ▼
public.lists  (id, name, owner_id, created_at)
    │
    ├─◄── public.list_members (list_id, user_id, role)  role: owner | editor
    │
    └─◄── public.items (id, list_id, title, is_done, position, created_by, created_at)
```

### Tables

**`profiles`**  
Mirror of the Auth user for display. Created by trigger `on_auth_user_created` from `auth.users`. Email is unique case-insensitively.

**`lists`**  
A named list. `owner_id` defaults to `auth.uid()`. Trigger `on_list_created` inserts the owner into `list_members`.

**`list_members`**  
Who can see and edit a list. Primary key `(list_id, user_id)`. Owners are not inserted from the client; the trigger and `share_list` do it.

**`items`**  
Todo rows. Any member can insert/update/delete. `position` is reserved for ordering; the UI currently sorts by `position` then `created_at`.

### RPCs and helpers

All helpers are `SECURITY DEFINER` with a fixed `search_path` so RLS policies can call them without infinite recursion.

| Function | Purpose |
| --- | --- |
| `is_list_member(list_id)` | True if `auth.uid()` has a `list_members` row |
| `is_list_owner(list_id)` | True if `auth.uid()` owns the list |
| `shares_list_with(user_id)` | True if you share at least one list with that user (for profile visibility) |
| `share_list(list_id, email)` | Owner-only. Looks up `profiles` by email and inserts an `editor` membership. Errors if the email has no account. |

`share_list` is the only way to add a member. There is no `INSERT` policy on `list_members`, so the client cannot forge memberships.

### Grants

`anon` has no table access. `authenticated` can:

- `profiles`: select, update
- `lists`: select, insert, update, delete
- `list_members`: select, delete (not insert)
- `items`: select, insert, update, delete

Policies still restrict *which* rows.

## Row Level Security

RLS is on for every public table. Think of it as: “the JWT says who you are; policies say which rows you may touch.”

| Table | Select | Write |
| --- | --- | --- |
| `profiles` | Yourself, or anyone you share a list with | Update your own row |
| `lists` | Owner or member | Insert as owner; update/delete only owner |
| `list_members` | Members of that list | Delete: owner can remove editors; a non-owner can remove themselves (leave). No client insert |
| `items` | Members of that list | Members can insert/update/delete |

Unauthenticated requests see nothing useful. Sharing a list is safe because editors still cannot rename/delete the list or invite others.

## Auth and email

The app uses email + password (`src/lib/auth.tsx`).

- Sign-up sends `emailRedirectTo: listy://auth/callback`.
- Reset password sends the same `redirectTo`.
- If hosted Auth still requires confirmation, sign-up returns no session and the app opens `/confirm` so the user can type the email OTP.
- Incoming `listy://` URLs with `token_hash`, `code`, or access/refresh tokens are exchanged via `createSessionFromUrl`.

`app.json` registers scheme `listy` and an Android intent filter so Expo Go / a future store build can open that URL.

### Hosted Auth URL settings

Dashboard → Authentication → URL Configuration:

| Setting | Value |
| --- | --- |
| Site URL | `listy://auth/callback` |
| Additional Redirect URLs | `listy://**`, `listy://auth/callback`, `exp://**` |

Default Site URL is `http://localhost:3000`, which is why old confirmation links opened a desktop URL.

### Email templates

Repo copies: `supabase/templates/confirmation.html` and `recovery.html`.

Hosted Auth does **not** pick those files up from git. Paste them in Authentication → Email Templates.

They use `{{ .RedirectTo }}?token_hash={{ .TokenHash }}` plus `{{ .Token }}` (the OTP). Do **not** use `{{ .ConfirmationURL }}` as the button: that hits `https://<project>.supabase.co/auth/v1/verify` and then tries to bounce into `listy://`, which Android Chrome turns into a broken redirect.

If you use Resend (or any SMTP with click tracking), turn **click tracking off**. Wrapping `listy://` in `https://click.…` breaks the deep link.

Built-in Supabase mail on Free is **2 emails per hour**. Custom SMTP (Resend, etc.) removes that cap. Current prod sender, if configured: `noreply@bokeh.gallery` via Resend.

Local `supabase/config.toml` sets `site_url = "listy://auth/callback"` and the same redirect allow list for Docker Auth.

## Environment variables

The app only needs two public values. Never put the `service_role` key or the database password in the mobile app or in git.

| Variable | Where | Purpose |
| --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | `.env` or `.env.local` | API URL. Hosted: `https://<ref>.supabase.co`. Local: `http://127.0.0.1:54321` |
| `EXPO_PUBLIC_SUPABASE_KEY` | `.env` or `.env.local` | Publishable / anon key (`sb_publishable_…` or the legacy `anon` JWT) |

Expo inlines any `EXPO_PUBLIC_*` var at bundle time. After changing env files, restart with `npx expo start --clear`.

`.env` and `.env.local` are gitignored. Copy from `.env.example`.

Optional CLI / machine env (not read by the app):

| Variable | Purpose |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | `npx supabase login` / CI for link, db push, types |
| Database password | Dashboard or `supabase link`; never in the client |

`src/lib/supabase.ts` rewrites `127.0.0.1` / `localhost` in the URL to:

1. The hostname from `Constants.expoConfig.hostUri` (your PC's LAN IP while Expo is running), or
2. `10.0.2.2` on the Android emulator.

A physical phone cannot reach `127.0.0.1` on your PC; that rewrite is why local Docker works from Expo Go.

## Local deployment (Docker)

Full walkthrough (images, ports, Mailpit, firewall, reset): [docker.md](./docker.md).

Use this when you want a throwaway database on your machine. Docker Desktop must be running. There is no repo `Dockerfile`; the Supabase CLI starts the official containers.

### 1. Start the stack

```bash
npm install
npx supabase start
# or: npm run db:start
```

First start pulls images and applies `supabase/migrations` plus `supabase/seed.sql`. Later starts reuse the volume.

### 2. Read local credentials

```bash
npx supabase status
```

You need:

- **API URL** — `http://127.0.0.1:54321`
- **Publishable / anon key** — paste into `.env`

Default local ports (`supabase/config.toml`):

| Service | Port |
| --- | --- |
| API (PostgREST, Auth, Realtime, Storage) | 54321 |
| Postgres | 54322 |
| Shadow DB (for `db diff`) | 54320 |
| Studio | 54323 (typical; confirm in `status`) |

### 3. Point the app at local

`.env` / `.env.local`:

```bash
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_KEY=<anon or publishable from status>
```

Keep `127.0.0.1` in the file; the client swaps the host at runtime.

### 4. Phone and firewall

- Phone and PC on the same Wi-Fi.
- Allow **54321** (Supabase API) and **8081** (Metro) through Windows Firewall inbound, or Expo / the phone will fail to load JS or data.
- `npx expo start`, open in Expo Go.

### 5. Iterate on schema locally

```bash
# edit / add files under supabase/migrations/
npx supabase db reset    # wipe local DB, replay migrations + seed
# or npm run db:reset
```

Studio: URL printed by `supabase status` (local dashboard).

### 6. Stop

```bash
npx supabase stop
# or npm run db:stop
```

Local Auth email usually lands in **Mailpit** (URL from `status`), not a real inbox. Confirmations in `config.toml` default to `enable_confirmations = false` locally, so you can often sign in immediately.

## Prod deployment (hosted)

Hosted Postgres is what Expo Go uses day to day for this project.

### 1. Project and login

```bash
npx supabase login
npx supabase link --project-ref xbziyldmasgsafmlwuuj
```

Link stores the ref under `supabase/.temp/` (gitignored).

### 2. Apply migrations

```bash
npx supabase db push --remote
```

This applies any new files in `supabase/migrations/` that hosted has not seen. Do not “fix” prod by clicking around in the Table Editor for schema that belongs in a migration.

### 3. App env for hosted

```bash
EXPO_PUBLIC_SUPABASE_URL=https://xbziyldmasgsafmlwuuj.supabase.co
EXPO_PUBLIC_SUPABASE_KEY=<publishable key from Project Settings → API>
```

Dashboard: **Project Settings → API Keys**. Use the **publishable** (or legacy `anon`) key. Never the `service_role` / secret key.

### 4. Auth (once per project)

See [Auth and email](#auth-and-email). Minimum:

1. URL configuration (`listy://auth/callback` + wildcards).
2. Email templates pasted from `supabase/templates/`.
3. Confirm email on or off under Authentication → Providers → Email (off is easier for throwaway testing).
4. Optional SMTP under Project Settings → Auth.

`npx supabase config push` can overwrite hosted Auth with `config.toml`. That file also contains local-only values (`enable_confirmations = false`, MFA off, pool sizes). Diff first (`npx supabase config diff`) and do not push blindly.

### 5. Regenerate TypeScript types after schema changes

```bash
npx supabase gen types typescript --linked > src/lib/database.types.ts
```

Commit `database.types.ts` so the app's `Database` generic stays in sync.

### 6. Store builds (later)

EAS is not required for Expo Go. When you ship a store APK:

- Keep the same `EXPO_PUBLIC_*` vars in EAS environment settings.
- `app.json` already has `scheme`, `android.package` (`com.justa.listy`), and intent filters.
- After adding native modules, you need a development build (`npx expo run:android` or `eas build --profile development`); Expo Go will not include extra native code.

## Realtime: how live sync actually works

### Postgres side

A **publication** named `supabase_realtime` lists which tables emit change events. The init migration adds `lists`, `list_members`, and `items`.

Logical replication needs a **replica identity** so UPDATE/DELETE payloads include enough columns:

```sql
alter table public.items replica identity full;
alter table public.list_members replica identity full;
alter table public.lists replica identity full;
```

- **INSERT** always sends the full new row (including `list_id`).
- **UPDATE / DELETE** with replica identity `DEFAULT` (primary key only) often send just `id`. Realtime also uses the old row to evaluate **SELECT** RLS. If `list_id` is missing, `is_list_member(list_id)` cannot pass, and **the event is dropped**. That is why “add item” can sync while complete / edit / delete do not, until replica identity is `FULL`.

Migration `20261110170000_items_realtime_replica_identity.sql` forces `FULL` on those tables.

Realtime still respects **SELECT** RLS. You only receive events for rows you are allowed to read (lists you belong to). You do not get other users' private lists.

### App side

`useRealtimeSync` in `src/hooks/use-realtime-sync.ts` runs from `(app)/_layout.tsx` whenever there is a session.

```text
supabase.channel('sync:<userId>')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, …)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'list_members' }, …)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'lists' }, …)
  .subscribe()
```

`event: '*'` means INSERT, UPDATE, and DELETE.

On each event the hook:

1. **Patches** the TanStack Query cache immediately when it can (delete by id, merge UPDATE fields).
2. **Invalidates** `['items']` and `['lists']` (and members / list detail when those ids are present) so active screens refetch.

Invalidating the `['items']` prefix, not only `['items', listId]`, matters because UPDATE/DELETE payloads may still omit `list_id`.

The writer's own UI does not wait on Realtime: item mutations already apply **optimistic** cache updates in `use-items.ts`, then refetch on settle.

### End-to-end example (two phones, one grocery list)

1. Alex and Sam are both `list_members` of list `L`.
2. Both have Listy open; each has a channel `sync:<their user id>` and a JWT.
3. Alex checks off “milk”. The app `UPDATE`s `items` set `is_done = true`.
4. Postgres commits, the publication emits an UPDATE, replica identity FULL includes `id`, `list_id`, `title`, `is_done`, …
5. Realtime evaluates Sam's SELECT policy: `is_list_member(L)` is true, so Sam's client gets the payload.
6. Sam's `useRealtimeSync` merges `is_done` into the cached items and invalidates queries. The row flips without pull-to-refresh.

If Sam's app was backgrounded, the socket may have missed events. Returning to the foreground sets Query `focusManager` so stale queries refetch from Postgres.

### What Realtime is not

- It is not a second database. If refetch fails, the cache is wrong until the next successful select.
- Broadcast and Presence are unused; only `postgres_changes`.
- Filters like `filter: 'list_id=eq.…'` are unused; RLS is the filter.
- Expo Go does not need extra native modules for this. It is a WebSocket on the same Supabase URL.

## Useful commands

```bash
npx supabase start                 # local Docker
npx supabase stop
npx supabase status                # local URL + keys
npx supabase db reset              # local: replay migrations + seed
npx supabase link --project-ref <ref>
npx supabase db push --remote      # apply migrations to hosted
npx supabase config diff           # local config.toml vs hosted Auth/API settings
npx supabase gen types typescript --linked > src/lib/database.types.ts
npx supabase logs --remote --service auth --since 1h --output-format text
```

App:

```bash
npx expo start --clear
npx tsc --noEmit
npx expo lint
```

`npm run test:sharing` hits the API with env from `.env` (see `scripts/test-sharing.mjs`).

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| App crash on boot about missing URL/key | No `.env` / `.env.local`, or Expo not restarted after changing them |
| Expo Go cannot load lists against local Docker | Firewall, or URL still `127.0.0.1` on the phone (client rewrite needs Metro `hostUri`) |
| Sign-up / reset email goes to localhost:3000 | Hosted Site URL still default; set `listy://auth/callback` |
| Email link is a huge `supabase.co/verify?redirect_to=listy://…` URL | Template still uses `{{ .ConfirmationURL }}`; paste repo templates |
| `429 email rate limit exceeded` | Free built-in mail (2/hour) or per-user send cooldown; use SMTP / wait |
| Other phone sees new items but not checks/edits/deletes | Replica identity not FULL, or the other app not subscribed (signed out / old JS bundle) |
| Share says no user with that email | Invitee must have a `profiles` row (they must have signed up first) |
| Empty lists for a user who should see them | RLS: not a member; or Query cache from a previous account (sign out/in) |

Stuck confirmed account (testing only), SQL Editor on hosted:

```sql
update auth.users
set encrypted_password = extensions.crypt('password123', extensions.gen_salt('bf')),
    email_confirmed_at = coalesce(email_confirmed_at, now()),
    updated_at = now()
where email = 'you@example.com';
```
