# LeetRevise

LeetRevise is a personal learning tool for capturing accepted LeetCode submissions and, over time, turning them into focused revision practice. The current vertical slice includes Supabase authentication, token-authenticated single and bulk ingestion APIs, newest-submission persistence, and an unpacked Chrome extension for reviewing and sending LeetCode submissions. Revision and AI behavior remain deferred.

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

`supabase/` contains database migrations. `extension/` is a dependency-free Manifest V3 extension that can be loaded directly into Chrome without a separate build step.

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

## Chrome extension

The extension provides the first real ingestion path from a LeetCode page to the existing API. It uses no extension framework or additional runtime dependencies.

### Load it for local development

1. Start the web application with `npm.cmd run dev`.
2. Obtain an `lr_ingest_...` token from `POST /api/tokens`. The settings/token-management UI is still deferred, so development provisioning currently uses the implemented authenticated API directly. After signing in locally, the following can be run once in that application's browser console; copy the returned token because the raw value is shown only in this response:

   ```js
   fetch("/api/tokens", { method: "POST" }).then((response) => response.json()).then(console.log)
   ```
3. Open `chrome://extensions`, enable **Developer mode**, and choose **Load unpacked**.
4. Select the repository's `extension` directory.
5. Pin LeetRevise, open its popup, enter `http://localhost:3000` and the ingestion token, then choose **Save and verify**.

Chrome asks for access only to the configured backend origin. Permanent host access is limited to LeetCode. Production backends must use HTTPS; plain HTTP is accepted only for `localhost` or `127.0.0.1` development.

### Capture a submission

Open a LeetCode problem page and use either path:

- After an accepted submission, the page observer attempts to recognize LeetCode's submit/check traffic. It records the submit time, code, language, runtime, and memory when available, saves a pending draft, and displays a badge on the extension.
- Open the popup and choose **Read current page** for the reliable manual fallback. The extension reads stable page metadata where available and leaves uncertain fields editable.

Review every required field, especially **Submitted at**, before choosing **Save to LeetRevise**. The timestamp represents the real LeetCode submission time; the extension does not replace a missing value with the current time during manual capture. Successful responses display `created`, `updated`, or `skipped`, using the existing backend semantics. A failed request leaves the form intact so it can be retried.

The extension never sends a `user_id`. Its service worker adds the stored bearer token, and the backend derives ownership from that verified credential. The raw token is kept in `chrome.storage.local` with access restricted to trusted extension pages and the service worker; LeetCode content scripts cannot read it.

Automatic capture is best-effort because LeetCode's private request and DOM structure can change. The reviewable manual path is the supported V1 fallback. Historical bulk-import UI is not part of this slice.

## Current boundaries

The application now has separate signup and login pages, cookie-based Supabase sessions, a protected placeholder dashboard, and sign-out. The ingestion backend validates and persists single submissions and partial-valid bulk history while storing one newest submission per user/problem. The Chrome MV3 extension can verify an ingestion token, assemble a reviewable LeetCode submission, and send it through the single-submission API. The project intentionally does not yet contain AI notes, pattern classification, revision attempts, hints, PDS calculations, token-management UI, or historical-import UI. Those contracts will be introduced alongside the business features that need them.

Gemini and all AI functionality are deferred. They are not dependencies of the ingestion MVP, and no Gemini credentials are currently required to develop or verify the implemented scaffold and ingestion contracts.
