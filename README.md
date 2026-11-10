# Listy

Android-first todo app built with Expo (React Native). Supports multiple lists, check/delete, and sharing lists with other people (e.g. a grocery list). Backend is hosted Supabase (Postgres, Auth, Row Level Security, Realtime).

## Setup

Prerequisites: Node, and Expo Go on an Android phone (or an Android emulator).

```bash
npm install
npm start                 # open in Expo Go
```

Create an account in the app. The email should open Listy (`listy://auth/callback`). If the link goes to a browser page instead, type the code from the email.

**Built-in mail is capped at 2 emails per hour** on the Free plan (confirmation, reset, magic links all count). After that you get `429 Email rate exceeded`. This is not a Listy bug.

Workarounds:

- **Testing:** [Authentication → Providers → Email](https://supabase.com/dashboard/project/xbziyldmasgsafmlwuuj/auth/providers) — turn **Confirm email** off. New sign-ups can sign in immediately, with no mail.
- **Stuck account:** in the [SQL Editor](https://supabase.com/dashboard/project/xbziyldmasgsafmlwuuj/sql/new) set a password:
  ```sql
  update auth.users
  set encrypted_password = extensions.crypt('password123', extensions.gen_salt('bf')),
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      updated_at = now()
  where email = 'you@example.com';
  ```
- **Production:** add **custom SMTP** (Resend, SendGrid, Postmark, SES) under [Auth SMTP](https://supabase.com/dashboard/project/xbziyldmasgsafmlwuuj/settings/auth). Custom SMTP is allowed on Free and removes the 2/hour cap.

**Email links must open Listy, not a browser.** Listy is Expo, Android-only, no web app. Custom scheme `listy://` is the redirect (App Links need a domain we do not have yet).

1. [Auth URL Configuration](https://supabase.com/dashboard/project/xbziyldmasgsafmlwuuj/auth/url-configuration)
   - Site URL: `listy://auth/callback`
   - Redirect URLs: `listy://**`, `listy://auth/callback`, `exp://**`
2. Paste [Auth email templates](https://supabase.com/dashboard/project/xbziyldmasgsafmlwuuj/auth/templates) from this repo (hosted does not use `supabase/templates` until you paste them):
   - Confirm sign up → `supabase/templates/confirmation.html`
   - Reset password → `supabase/templates/recovery.html`
   Those use `{{ .RedirectTo }}?token_hash={{ .TokenHash }}` so the email opens the app. **Do not** use `{{ .ConfirmationURL }}` — that verifies on `supabase.co` first, then Chrome turns `listy://` into a junk redirect.
3. In Resend, turn **off click tracking** for `bokeh.gallery`. Tracking wraps the deep link in `click.resend.com/...` and breaks it.

The app already sends `emailRedirectTo: 'listy://auth/callback'` on sign-up / reset, and `app.json` registers scheme `listy`.

The client lives in `src/lib/supabase.ts` (not a root `App.tsx`). Env vars:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_KEY`

After changing `.env` or `.env.local`, restart Expo with `npx expo start --clear`.

## Useful commands

| Command | What it does |
| --- | --- |
| `npx supabase db push` | Apply `supabase/migrations` to the linked hosted project |
| `npx supabase gen types typescript --linked > src/lib/database.types.ts` | Refresh DB types from hosted |
| `npm run db:start` / `db:stop` | Optional local Docker Supabase |
| `npm run typecheck` | TypeScript check |
| `npx eslint src` | Lint |

## Layout

- `src/app/` - Expo Router screens: `(auth)` sign in/up, `(app)` lists, `list/[id]`, `share/[id]`
- `src/hooks/` - TanStack Query hooks (lists, items, members, realtime sync)
- `src/lib/` - Supabase client, auth context, theme, generated DB types
- `supabase/migrations/` - schema and RLS policies
