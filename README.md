# LeetRevise

LeetRevise is a personal learning tool for capturing accepted LeetCode submissions and, over time, turning them into focused revision practice. The project is currently in its foundation stage: the Next.js application, test tooling, environment validation, and pure LeetCode ingestion contracts are in place. Database, authentication, API, extension, revision, and AI behavior have not been implemented yet.

For the implementation sequence and scope decisions, see [`plan.md`](./plan.md). For the longer-term system design, see [`architecture.md`](./architecture.md). The plan takes precedence where the two differ.

## Prerequisites

- Node.js 22 or newer
- npm 10 or newer
- Current Chrome will be needed later for extension development
- Supabase and Gemini accounts will be needed only when their corresponding integrations are implemented

The current verified development environment uses Node.js 22.14.0 and npm 10.9.2. Node.js 22 is required by the current official Supabase client packages.

## Local setup

1. Install the locked dependencies:

   ```powershell
   npm.cmd ci
   ```

2. Copy `.env.example` to `.env.local`:

   ```powershell
   Copy-Item .env.example .env.local
   ```

3. Start the development server:

   ```powershell
   npm.cmd run dev
   ```

4. Open `http://localhost:3000`.

On Windows, this repository uses `npm.cmd` in examples because some PowerShell execution policies block the `npm.ps1` shim. On other shells, the equivalent `npm` commands are sufficient.

## Environment variables

`.env.example` is the canonical list of planned configuration names. Keep real credentials in `.env.local`; `.env*` files are ignored except for the example file.

| Variable | Exposure | Purpose | Current requirement |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser-safe | Supabase project URL | Deferred until Supabase integration |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser-safe | Supabase anonymous client key | Deferred until Supabase integration |
| `SUPABASE_SERVICE_ROLE_KEY` | Server secret | Privileged token creation and extension authentication | Required for ingestion-token APIs |
| `NEXT_PUBLIC_APP_URL` | Browser-safe | Canonical application URL | Deferred until URL-aware application flows |
| `GEMINI_API_KEY` | Server secret | Authenticates Gemini requests | **Not required for the ingestion MVP; AI is deferred** |
| `GEMINI_MODEL` | Server configuration | Selects a Gemini model | **Not required for the ingestion MVP; AI is deferred** |

The current scaffold does not read these values during normal page rendering. Environment validation is lazy so configuration is checked when server-side integrations begin using it.

Never expose `SUPABASE_SERVICE_ROLE_KEY` or `GEMINI_API_KEY` through a `NEXT_PUBLIC_*` variable or commit their values.

## Developer workflow

Run the focused test suite while developing:

```powershell
npm.cmd test
```

Run tests continuously:

```powershell
npm.cmd run test:watch
```

Before considering a task complete, run the current quality gate:

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

The production build can be served locally after building:

```powershell
npm.cmd start
```

## Authentication

LeetRevise uses Supabase passwordless email authentication with PKCE-backed, cookie-based sessions.

- `/signup` sends a magic link and allows Supabase to create a new user.
- `/login` sends a magic link only for an existing user.
- `/auth/callback` exchanges the returned authorization code for a session.
- `/dashboard` validates the signed token claims and redirects unauthenticated visitors to `/login`.
- Signing out clears the Supabase session and returns to `/login`.

In the Supabase dashboard, configure **Authentication → URL Configuration** with:

```text
Site URL: http://localhost:3000
Redirect URL: http://localhost:3000/auth/callback
```

Add the corresponding production callback URL before deployment. `NEXT_PUBLIC_APP_URL` must match the application origin used in the configured redirect URL. Keep the default magic-link email template using Supabase's confirmation URL unless the authentication flow is deliberately changed.

## Repository structure

```text
src/
  app/             Next.js routes and route-local UI
  components/      Reusable application components
  lib/
    auth/           Web-session and ingestion authentication helpers
    domain/         Pure types, validation schemas, and algorithms
    env/            Environment validation and server access
    services/       Supabase, Gemini, and other external I/O boundaries
  test/             Shared test setup
```

Future database migrations and Chrome extension code will live under `supabase/` and `extension/` respectively when those scopes are approved.

## Create and migrate a Supabase database

The ingestion migration is stored in `supabase/migrations/`. Keep database changes in migration files rather than editing the remote schema directly so Supabase migration history and Git remain aligned.

### 1. Create the hosted project

1. Sign in at [Supabase](https://supabase.com/dashboard) and choose **New project**.
2. Select an organization, enter a project name, generate and securely save the database password, and choose the region nearest the application deployment.
3. Wait for project provisioning to finish.
4. Open the project's **Connect** dialog and copy its Project URL and publishable key. A legacy anon key also works with the current variable name.
5. Put the values in `.env.local`:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-publishable-or-anon-key
   ```

Do not use the service-role key in either public variable. The current browser and signed-in server clients do not require service-role access.

The ingestion-token API does require `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`. Copy it only from the project's server-side API settings and never expose it to browser code.

### 2. Link this repository

From the repository root, authenticate the Supabase CLI and link the hosted project:

```powershell
npx.cmd supabase@latest login
npx.cmd supabase@latest link --project-ref YOUR_PROJECT_REF
```

The project reference appears in the project URL and in the dashboard's project settings. The CLI may request the database password created with the project.

### 3. Review and apply migrations

Preview pending migrations first:

```powershell
npx.cmd supabase@latest db push --dry-run
```

Apply them after reviewing the preview:

```powershell
npx.cmd supabase@latest db push
```

`db push` records applied migration timestamps in the remote migration history and skips them on subsequent pushes. Do not paste the migration into the hosted SQL editor as a second deployment path.

### 4. Verify the result

In the Supabase dashboard, open **Table Editor** and confirm that `public.user_submissions` exists. Then open the database policy view and confirm that Row Level Security is enabled with owner-only select, insert, update, and delete policies.

For a full local Supabase environment, Docker is required. After initializing the CLI configuration, `supabase start` starts the local stack and `supabase db reset` recreates the local database from every migration. A remote reset is destructive and is not part of this project's normal migration workflow.

## Ingestion-token API

`POST /api/tokens` requires an authenticated Supabase web session. It creates a token with at least 32 bytes of cryptographic randomness and returns the raw `lr_ingest_...` value only in that creation response. The database stores only its SHA-256 hash.

```json
{
  "token": "lr_ingest_...",
  "metadata": {
    "id": "...",
    "createdAt": "...",
    "lastUsedAt": null,
    "revokedAt": null
  }
}
```

Authenticated database access to `ingest_tokens` is restricted to the safe metadata columns shown above. It cannot select `token_hash`.

`GET /api/extension/verify` accepts the raw token as a bearer credential:

```http
Authorization: Bearer lr_ingest_...
```

Successful verification returns `{ "valid": true }` and updates `last_used_at`. Missing, malformed, unknown, and revoked tokens return `401`. The resolved owner ID remains server-side for subsequent ingestion and is never accepted from the extension request.

## Single-submission API

`POST /api/submissions` accepts the existing single-submission JSON contract and requires an active ingestion bearer token. Ownership is always derived from that token; a payload containing `userId` is rejected.

The endpoint atomically preserves one newest submission per user/problem:

- A missing problem is inserted and returns `201 { "status": "created" }`.
- A strictly newer `submittedAt` replaces stored state and returns `200 { "status": "updated" }`.
- An equal or older submission leaves stored state unchanged and returns `200 { "status": "skipped" }`.

The database function implements only this insert/update/skip invariant. Payload validation and bearer authentication remain in the application layer. Before using this endpoint against hosted Supabase, push all pending migrations with `npx.cmd supabase@latest db push`.

## Bulk-submission API

`POST /api/submissions/bulk` accepts `{ "submissions": [...] }` with the same bearer authentication as single ingestion. Each array item is validated independently, so malformed entries do not prevent valid history entries from being processed.

Valid entries are grouped by `problemSlug`; only the chronologically newest `submittedAt` in each group reaches the single-submission persistence service. Older in-payload duplicates count as skipped. The response accounts for every input item:

```json
{
  "created": 12,
  "updated": 3,
  "skipped": 4,
  "invalid": 2
}
```

No domain-level history-size limit is imposed. Transport chunking may be introduced later without changing these semantics.

## Current boundaries

The application now has separate signup and login pages, cookie-based Supabase sessions, a protected placeholder dashboard, and sign-out. The ingestion backend validates and persists single submissions and partial-valid bulk history while storing one newest submission per user/problem. It intentionally does not yet contain AI notes, pattern classification, revision attempts, hints, PDS calculations, token-management UI, or extension behavior. Those contracts will be introduced alongside the business features that need them.

Gemini and all AI functionality are deferred. They are not dependencies of the ingestion MVP, and no Gemini credentials are currently required to develop or verify the implemented scaffold and ingestion contracts.
