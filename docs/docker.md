# Docker for local Listy development

Listy does not ship a custom `Dockerfile` or `docker-compose.yml`. Local backend work uses **Docker as the runtime for the official Supabase CLI stack**: Postgres, Auth, PostgREST, Realtime, Studio, and a fake mail server, all on your machine.

Day-to-day you can keep Expo Go pointed at **hosted** Supabase. Use this Docker stack when you want a throwaway database, to try a migration before `db push --remote`, or to work offline.

Schema, RLS, and hosted deploy: [supabase.md](./supabase.md). App architecture: [overview.md](./overview.md).

## What Docker is doing here

`npx supabase start` (also `npm run db:start`) talks to the Docker engine and brings up a project named after `project_id` in `supabase/config.toml` (`todo`).

You do not start containers by hand. The CLI:

1. Pulls the Supabase images (first run is slow).
2. Creates a Docker network and named volumes for Postgres data.
3. Starts the services listed in `config.toml`.
4. Applies every file in `supabase/migrations/` in order.
5. Loads `supabase/seed.sql` (on first start / on reset).

Stopping with `npx supabase stop` shuts the containers down. The **volume stays**, so your local users and lists survive a stop/start. `npx supabase db reset` wipes that volume and replays migrations + seed from scratch.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) running (Linux engine, not only the tray icon).
- Node + the repo's `supabase` CLI (`npm install` — it is a `devDependency`).
- Windows: WSL2 backend for Docker Desktop is the usual setup.

Check Docker before starting the stack:

```bash
docker info
```

If that fails, start Docker Desktop and wait until it is idle.

## Services and ports

All of these bind to `127.0.0.1` on your PC. Ports come from `supabase/config.toml`.

| Port | Service | Used for |
| --- | --- | --- |
| **54321** | Kong / API gateway | What the app calls: Auth, PostgREST, Realtime, Storage. This is `EXPO_PUBLIC_SUPABASE_URL`. |
| **54322** | Postgres | `psql`, GUI clients, `db diff` against the live local DB. Not used by Expo. |
| **54320** | Shadow Postgres | Only for `supabase db diff`. Leave it alone. |
| **54323** | Studio | Local dashboard (tables, SQL, auth users). |
| **54324** | Mailpit (Inbucket) | Catch Auth emails. Nothing is sent to a real inbox. |
| 54329 | Connection pooler | Disabled (`[db.pooler] enabled = false`). |

Confirm the exact URLs and keys after start:

```bash
npx supabase status
```

You need **API URL** (`http://127.0.0.1:54321`) and the **publishable / anon key**.

Local Auth in `config.toml`:

- `site_url = "listy://auth/callback"`
- `enable_confirmations = false` — you can usually sign in right after sign-up.
- Mail still shows up in Mailpit if something does send.

## Everyday workflow

### 1. Start the stack

```bash
npx supabase start
# or: npm run db:start
```

First run downloads images. Later runs reuse them.

### 2. Point Expo at Docker, not hosted

`.env` or `.env.local` (gitignored):

```bash
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_KEY=<anon or publishable from supabase status>
```

Keep `127.0.0.1` in the file. `src/lib/supabase.ts` rewrites that hostname at runtime:

1. To the LAN IP from Expo's `hostUri` (so a **physical phone** on Wi-Fi can reach your PC).
2. Or to `10.0.2.2` on the **Android emulator** (that is the emulator's alias for the host machine).

A phone cannot use `127.0.0.1` — that would be the phone itself.

Restart Metro after changing env:

```bash
npx expo start --clear
```

### 3. Use the app

Scan the QR with Expo Go. Sign up with any email/password; local confirmations are off.

Open Studio at **http://127.0.0.1:54323** (or the URL `status` prints) to inspect `public.lists` / `items` like the hosted dashboard.

Open Mailpit at **http://127.0.0.1:54324** if you turn confirmations on or trigger a reset email.

### 4. Change the schema

1. Add a file under `supabase/migrations/` (timestamp prefix, like the existing ones).
2. Apply it locally:

```bash
npx supabase db reset    # wipe + replay all migrations + seed
# or: npm run db:reset
```

`db reset` is the normal local loop. It **destroys local data**. That is the point: migrations stay the source of truth.

Do **not** `db push --remote` until you are happy locally. Hosted is a different database.

### 5. Stop

```bash
npx supabase stop
# or: npm run db:stop
```

Containers go away; data volume remains until the next `db reset` or `supabase stop --no-backup` / volume prune.

## Phone, emulator, and firewall (Windows)

The phone/emulator must reach **two** ports on your PC:

| Port | Why |
| --- | --- |
| 8081 | Metro (JS bundle). Expo prints this. |
| 54321 | Local Supabase API (Auth + data + Realtime). |

Allow inbound TCP for both in Windows Firewall, or Expo Go will load the UI and then fail every query.

Physical device and PC must be on the same Wi-Fi. Guest networks that isolate clients will not work.

## Local vs hosted

| | Docker (this doc) | Hosted |
| --- | --- | --- |
| Command | `npx supabase start` | none; project already running |
| App URL | `http://127.0.0.1:54321` (rewritten to LAN IP) | `https://<ref>.supabase.co` |
| Data | Your laptop only | Shared with anyone using the cloud project |
| Email | Mailpit on 54324 | Resend / Supabase mail |
| Confirm email | Off in `config.toml` | On in the current cloud project |
| Migrations | `db reset` | `npx supabase db push --remote` |

Switching env is switching databases. Accounts you created on hosted are not on Docker, and the other way around.

## What we do not use Docker for

- **Not** building the React Native app. That is Expo / EAS / `expo start`.
- **Not** production. Prod is the hosted Supabase project.
- **Not** a hand-written compose file. If you need extra containers, do not fork the generated stack; keep them separate.

## Troubleshooting

| Symptom | What to try |
| --- | --- |
| `failed to connect to postgres … 127.0.0.1:54322` | Docker is not running, or `supabase start` was never run. `db push` without `--remote` also targets this port. |
| `supabase start` hangs / health timeout | Wait for Docker to finish pulling. Check `docker ps`. Increase `[db] health_timeout` only if the machine is genuinely slow. |
| App crash: missing `EXPO_PUBLIC_SUPABASE_*` | `.env` not loaded; restart with `--clear`. |
| Expo Go cannot fetch lists | Firewall on 54321; or URL still hosted while you expected Docker (or the reverse). |
| Phone cannot reach API | `127.0.0.1` was replaced with a LAN IP? Check Metro banner host. Same Wi-Fi. |
| Studio empty after you added a migration | You edited SQL but did not `db reset`. |
| Port already in use | Another `supabase start`, or something else on 54321–54324. `npx supabase stop` then start again. |
| Stale images after a CLI upgrade | `npx supabase stop` then `npx supabase start` (CLI may pull new tags). |

Wipe everything local (containers + DB volume) and start clean:

```bash
npx supabase stop
npx supabase start
npx supabase db reset
```
