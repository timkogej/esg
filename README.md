# ESG Portal — Customer Frontend

Customer-facing portal for an ESG compliance system, aimed at Slovenian manufacturing
SMEs supplying German/Austrian buyers. Frontend only — it talks **directly to Supabase**
(RLS scopes every client to their own rows via `contacts.auth_user_id = auth.uid()`),
so there is no separate backend API layer. The admin panel and payment/subscription
concerns are out of scope (separate projects).

## Stack

- **Next.js 15** (App Router) + **TypeScript**
- **Tailwind CSS** + **shadcn/ui** (hand-authored primitives in `src/components/ui`)
- **@supabase/supabase-js** / **@supabase/ssr** (browser client)
- **next-intl** — i18n for **SL / DE / EN** (cookie-based locale, no path routing)
- **next-themes** — light/dark
- Standalone output (`output: 'standalone'`) for Docker on a VPS — no Vercel features.

## Getting started

```bash
cp .env.example .env.local   # fill in Supabase URL + anon key
npm install
npm run dev                  # http://localhost:3000
```

`.env` variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Docker

```bash
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=... \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
  -t esg-portal .
docker run -p 3000:3000 esg-portal
```

> `NEXT_PUBLIC_*` values are inlined at build time, so they must be passed as build args.

## Design system

- Warm neutral, high-contrast product UI. Brand accent **`#FE7001`** is reserved for
  primary actions, compact active indicators and progress. Semantic colors remain separate.
- No ambient glow or decorative page gradient. Elevation is reserved for floating surfaces.
- **Inter** is used throughout the product UI. The final Evipace wordmark will remain a
  separate vector brand asset.
- Desktop: collapsible solid sidebar (state in localStorage). Mobile: bottom bar with a
  liquid-glass surface (`.glass-bar`) and exactly 5 slots — Home, Documents, Data,
  Downloads, More.

## Auth (invite-only)

No sign-up. Login + password reset only. After sign-in the app finds the `contacts` row
by `auth_user_id`; if it's missing or `is_portal_user = false`, the user is signed out and
shown a "not approved" message. See `src/lib/auth-context.tsx`.

## Key conventions

- **Product name** lives in one place: `APP_NAME` in `src/lib/config.ts`.
- **Locale** persists to a cookie + localStorage; manual changes also write
  `contacts.language`. First login adopts `contacts.language` (`src/components/locale-sync.tsx`).
- **Storage**: private `documents` bucket, always accessed via signed URLs
  (`src/lib/storage.ts`).
- **Attestation**: the portal ONLY inserts into `client_attestations`; it never mutates
  `client_datapoint_values.status` (a separate backend workflow reacts to the insert).
- **`output_mode`**: always shown as "Draft, aligned with VSME" — never "compliant".
- `// TODO:` comments mark places where the provided schema was incomplete (e.g.
  `datapoint_evidence_links`, portal-submitted gap values) — no tables/columns were invented.

## Project structure

```
messages/                 sl.json · de.json · en.json  (all UI strings)
src/
  app/
    layout.tsx            root: fonts, providers, ambient glow
    login/                invite-only login
    reset-password/       request link + set new password
    (app)/                authenticated area (AuthGuard + AppShell)
      layout.tsx          guard + locale sync + shell
      page.tsx            Dashboard / gap overview (Home)
      documents/          upload + processing status (polls ~10s)
      data/               attestation flow
      downloads/          reports + questionnaire exports
      notifications/      full-page notifications
      settings/           appearance + read-only company info
  components/
    ui/                   shadcn primitives (button, card, dialog, sheet, …)
    nav/                  sidebar, bottom-bar, more-sheet, app-shell, nav-items
    notifications/        bell (+ unread badge) and list
    dashboard/            gap-resolve dialog
    documents/            status badge
    brand, theme-toggle, language-switcher, page-header,
    auth-guard, locale-sync, providers, theme-provider
  lib/
    config.ts             APP_NAME, accent, locales, poll/TTL constants
    supabase/             browser client + hand-written DB types
    auth-context.tsx      session → contact → client state
    storage.ts            signed URLs + downloads
    datapoint.ts          typed value formatting
    locale.ts, utils.ts, fonts.ts
  i18n/request.ts         next-intl cookie-based config
```
