# LeetRevise — Architecture Document (V1 MVP)

> **Project:** LeetRevise – AI-Powered Spaced Revision & Pattern Engine
> **Status:** Approved defaults (fire-and-forget AI notes · extension API-token auth · Vitest + Playwright)
>
> This document is organized into independent sections. Future features (V2+) should be appended as new subsections or new numbered modules — never by rewriting existing ones.

---

## Table of Contents

1. [Scope](#1-scope)
2. [System Architecture & Data Flow](#2-system-architecture--data-flow)
3. [Database Schema](#3-database-schema)
4. [API Contracts](#4-api-contracts)
5. [Task Breakdown (Modular)](#5-task-breakdown-modular)
6. [Test Matrix](#6-test-matrix)
7. [Decisions & Defaults](#7-decisions--defaults)
8. [Deployment Checklist](#8-deployment-checklist)
9. [Future Extensions (V2+)](#9-future-extensions-v2)

---

## 1. Scope

### In Scope (V1 MVP)

| Feature | Description |
|---|---|
| Chrome Extension (MV3) | Background service worker intercepting LeetCode's submit GraphQL response (`status_code: 10`); manual historical bulk-import button |
| Next.js App Router monolith | Dashboard, Monaco revision canvas workspace, backend API routes in one deployable |
| Automated AI Notes Engine | Gemini Flash generates pattern tag, Big-O breakdown, key insights on accepted submission |
| Socratic Hint Engine | 3-level non-spoiler progressive hints for stuck/failing revisions |
| Spaced Revision / Pattern Decay Engine | PDS-weighted daily top-3 revision feed |
| Production deployment | Vercel (app) + Supabase Postgres (DB/auth) |

### Out of Scope (V2+, see §9)

- Custom code compilation sandboxes (Docker/Judge0)
- Social leaderboards, profile discovery
- Multi-platform ingestion (Codeforces, HackerRank)

---

## 2. System Architecture & Data Flow

```
[ LeetCode.com ]
      │  (intercepts GraphQL submit response, status_code === 10)
      ▼
[ Chrome Extension — Manifest V3 ]
      │  HTTP POST payload (Bearer API token)
      ▼
[ Next.js App Router API Routes ]
      ├──► POST /api/submissions        → upsert user_submissions → update pattern_stats → fire-and-forget AI notes
      ├──► POST /api/submissions/bulk   → batched idempotent backfill
      ├──► GET  /api/revision/daily     → compute PDS → serve top-3 deck
      └──► POST /api/hints              → L1→L3 Socratic guidance via Gemini

[ Supabase PostgreSQL ]   ← persistence + auth.users
[ Google Gemini Flash ]   ← AI notes + hints
```

### Primary data flow (Capture → Process → Review → Practice)

1. **Capture:** User solves a problem on LeetCode → extension strips code/language/runtime/problem metadata → `POST /api/submissions`.
2. **Process:** Backend validates (Zod), idempotently upserts submission, atomically updates pattern stats, fires background Gemini notes job.
3. **Review:** Next morning, dashboard calls `GET /api/revision/daily`; PDS computed per problem; Daily-3 served.
4. **Practice:** User opens Monaco workspace; if stuck, hint drawer requests progressive L1→L3 hints.

### Module boundaries (for future additions)

Each layer is swappable; new features attach at these seams:

| Layer | Location | Extension seam |
|---|---|---|
| Domain (pure logic) | `src/lib/domain/` | Add pure functions/types; zero I/O |
| Services (I/O wrappers) | `src/lib/services/` | One file per external system (`gemini.ts`, `patterns.ts`) |
| API routes | `src/app/api/` | Thin: validate → call service → respond |
| UI | `src/app/`, `src/components/` | Feature folders per page |
| Ingestion | `extension/` | Independent MV3 app; only contract = API |

### Pattern Decay Score (PDS) — canonical formula

```
PDS = DaysSinceLastSolved × (1 + TotalSolvedInPattern / (RecentSolved14Days + 1)) × DifficultyMultiplier
```

Difficulty multipliers: Easy = 1.0, Medium = 1.5, Hard = 2.0. Implemented as a pure function in `src/lib/domain/pds.ts`.

---

## 3. Database Schema

Supabase PostgreSQL. Migrations live in `supabase/migrations/`.

### `user_submissions`

```sql
create table user_submissions (
    id             uuid primary key default gen_random_uuid(),
    user_id        uuid references auth.users(id) on delete cascade,
    problem_id     text not null,
    title          text not null,
    difficulty     text not null check (difficulty in ('Easy','Medium','Hard')),
    pattern_tag    text not null,
    language       text not null,
    code           text not null,
    runtime_ms     integer,
    memory_mb      numeric,
    ai_notes       jsonb,          -- { pattern_tag, time_complexity, space_complexity, insights[] }
    last_solved_at timestamptz not null default timezone('utc', now()),
    solved_count   integer default 1,
    unique (user_id, problem_id)
);

create index idx_user_submissions_user on user_submissions(user_id);
create index idx_user_submissions_pattern on user_submissions(user_id, pattern_tag);
create index idx_user_submissions_last_solved on user_submissions(user_id, last_solved_at);
```

### `pattern_stats`

```sql
create table pattern_stats (
    id                    uuid primary key default gen_random_uuid(),
    user_id               uuid references auth.users(id) on delete cascade,
    pattern_tag           text not null,
    total_solved          integer default 0,
    recent_solved_14_days integer default 0,
    last_revision_date    timestamptz not null default timezone('utc', now()),
    unique (user_id, pattern_tag)
);
```

### Row Level Security

- All tables: RLS enabled; policies restrict all operations to `auth.uid() = user_id`.
- Service-role client (server-side only) bypasses RLS for extension token flows and stats jobs.

---

## 4. API Contracts

All routes require authentication (see §7). Errors follow `{ "error": string }` shape.

### `POST /api/submissions`

```jsonc
// Request (Zod-validated)
{
  "problem_id": "two-sum",     // required
  "title": "Two Sum",          // required
  "difficulty": "Medium",      // enum Easy|Medium|Hard, required
  "pattern_tag": "Two Pointers", // optional on ingest; filled by AI notes if absent
  "language": "python3",       // required
  "code": "...",               // required
  "runtime_ms": 52,            // optional
  "memory_mb": 16.4            // optional
}
// 201 Created (new) | 200 OK (re-solve: solved_count++, last_solved_at updated)
// 401 unauthenticated | 422 invalid payload
```

Behavior: upsert on `(user_id, problem_id)`; then async: pattern stats increment + Gemini notes job.

### `POST /api/submissions/bulk`

```jsonc
// Request
{ "submissions": [ /* array of same item schema */ ] }
// 200 { "inserted": n, "duplicates_skipped": m }  — idempotent
// 422 if any item invalid (all-or-nothing per batch)
```

### `GET /api/revision/daily`

```jsonc
// Response
{ "daily_three": [
    { "problem_id": "...", "title": "...", "difficulty": "...",
      "pattern_tag": "...", "pds": 12.5, "days_since_last_solved": 9 }
]}
```

Excludes problems revised within the current day; empty library → `{ "daily_three": [] }`.

### `POST /api/hints`

```jsonc
// Request
{
  "problem_id": "two-sum",
  "current_code": "...",        // user's WIP code
  "level": 1                    // requested level 1..3 (server enforces progression)
}
// Response
{ "level": 1, "hint": "Consider what invariant the two pointers maintain..." }
```

Socratic constraints (enforced via system prompt):
- Never output direct code solutions, syntax fixes, or explicit algorithms.
- Level 1 Conceptual → pattern/invariant direction.
- Level 2 Structural → state variables, data structure shifts.
- Level 3 Edge cases → missed constraints (negatives, empty arrays).

---

## 5. Task Breakdown (Modular)

Dependency-ordered. Each task is independently implementable and testable. Future tasks append to this table.

| # | Task | Key deliverables | Depends on |
|---|------|-----------------|-----------|
| T1 | Scaffold | Next.js App Router, TS, Tailwind, Zod-validated env schema, folder skeleton per §2 module boundaries | – |
| T2 | DB layer | Migrations for `user_submissions`, `pattern_stats`; indexes; RLS; typed Supabase client (`src/lib/services/db.ts`) | T1 |
| T3 | Auth | Supabase magic-link auth; middleware guarding dashboard + API routes | T2 |
| T4 | Domain core | Shared types, Zod schemas, `computePDS()` pure function (`src/lib/domain/pds.ts`) | T2 |
| T5 | `POST /api/submissions` | Validate → idempotent upsert → trigger notes job + stats update | T3, T4 |
| T6 | AI Notes Engine service | Gemini Flash call, structured JSON parse with retry/fallback, persist to `ai_notes` (`src/lib/services/gemini.ts`) | T5 |
| T7 | Pattern stats service | Atomic increment of `pattern_stats`, 14-day rolling window refresh (`src/lib/services/patterns.ts`) | T5 |
| T8 | `GET /api/revision/daily` | PDS ranking query, top-3 feed endpoint | T4, T7 |
| T9 | `POST /api/hints` | L1→L3 state machine, strict no-code system prompt, multi-turn context | T3 |
| T10 | Dashboard UI | Daily-3 deck cards, pattern health overview (`src/app/(dashboard)/page.tsx`) | T8 |
| T11 | Revision workspace UI | Monaco split view (problem left / editor right), dynamic clean starter templates | T10 |
| T12 | Socratic hint drawer UI | Progressive reveal, level badges, disabled state at L3 | T9, T11 |
| T13 | Chrome extension core | `manifest.json`, background service worker GraphQL interceptor, popup shell (`extension/`) | T5 |
| T14 | Bulk import | `POST /api/submissions/bulk` (batched, idempotent) + popup wiring | T13 |
| T15 | E2E smoke suite + deploy | Playwright happy-path test; Vercel/Supabase deployment per §8 | All |

---

## 6. Test Matrix

Runner: **Vitest** (unit/integration) + **Playwright** (E2E). Tests co-located as `*.test.ts`.

### T1 — Scaffold
- Build passes with zero TS errors.
- `/` renders without crashing.
- Missing env var → startup fails with named-variable error message.

### T2 — DB layer
- Migration runs clean on a fresh database.
- Unique constraint `(user_id, problem_id)` rejects duplicates.
- RLS: user A cannot read/modify user B's rows.

### T3 — Auth
- Unauthenticated API call → 401.
- Magic link login → session cookie set.
- Unauthenticated page visit → redirect to login.

### T4 — Domain core (PDS)
- `PDS = days × (1 + total/(recent+1)) × mult` verified against Easy/Medium/Hard fixtures.
- Edge cases: `recent = 0`, `days = 0`, large totals (no overflow/NaN).

### T5 — POST /api/submissions
- New problem → 201; row persisted.
- Re-solve same problem → 200; `solved_count++`, `last_solved_at` updated, no duplicate row.
- Invalid payload → 422; unauthenticated → 401.
- Notes job + stats update triggered exactly once per accepted ingest.

### T6 — AI Notes Engine
- Mocked Gemini returns valid JSON → parsed and persisted to `ai_notes`.
- Malformed JSON → retry once, then graceful null (submission still succeeds).
- Prompt contains code snippet + problem description only (no PII beyond scope).

### T7 — Pattern stats service
- Concurrent upserts for the same pattern do not double-count (transactional increment).
- 14-day window recount matches fixture data after window slides.

### T8 — GET /api/revision/daily
- Fixture DB → correct top-3 ordering by PDS descending.
- Problems revised today are excluded.
- Empty library → `{ "daily_three": [] }`.

### T9 — POST /api/hints
- Levels progress strictly 1→2→3; cannot jump or exceed 3.
- Response contains no fenced/inline code blocks (regex assertion) at any level.
- Request context includes current WIP code + stored accepted solution.

### T10 — Dashboard UI
- Renders exactly 3 deck cards from mocked feed response.
- Loading and empty states render correctly.

### T11 — Revision workspace UI
- Starter template renders dynamically per selected language.
- Problem description pane displays metadata; Monaco mounts without errors.

### T12 — Hint drawer UI
- Click "Get Socratic Hint" → advances displayed level.
- At level 3 button disables.
- Hint text renders without leaking solution code.

### T13 — Extension core
- Payload parser extracts code/language/runtime/problem metadata from mocked LeetCode GraphQL submit response.
- Submissions with `status_code !== 10` are ignored.
- Popup shell loads in MV3 context.

### T14 — Bulk import
- 100-item fixture → batch insert; duplicates skipped idempotently.
- Re-running import on same data → `inserted = 0, duplicates_skipped = n`.
- Popup button triggers sync and shows result counts.

### T15 — E2E smoke (Playwright)
- Happy path: mock submission ingest → dashboard shows card → open revision workspace → request hint through L1.
- Deploy checklist executed post-deploy (§8).

---

## 7. Decisions & Defaults

| Decision | Choice | Rationale |
|---|---|---|
| AI notes execution | Fire-and-forget inside route handler (no queue infra in MVP) | Simplest V1; queue can be added later behind `services/gemini.ts` seam |
| Extension authentication | Paste-once personal API token (Bearer header), validated server-side against Supabase session mapping | Avoids full OAuth flow inside extension popup for MVP |
| Test runner | Vitest (unit/integration) + Playwright (E2E) | Native Next.js/TS support, fast, single config ecosystem |
| Monorepo layout | Single Next.js app + `extension/` subfolder | One deployable; extension is contract-coupled only via API |
| Package manager | npm | Default availability |

---

## 8. Deployment Checklist

1. Create Supabase project → run migrations → enable magic-link auth → configure site URL.
2. Set Vercel env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `INGEST_TOKEN_SECRET`.
3. Deploy Next.js app to Vercel; verify production URL responds.
4. Update extension's configured backend base URL to production.
5. Load unpacked extension → solve one problem on LeetCode → verify ingestion end-to-end.
6. Verify daily feed populates next day (or via manual backfill through bulk import).
7. Run Playwright E2E suite against production URL (smoke).

---

## 9. Future Extensions (V2+)

Append new features here as numbered subsections; each must name its integration seam from §2.

- **9.1 Compilation sandbox** — Docker/Judge0 verification of revisions (seam: new `services/sandbox.ts` + workspace UI hook).
- **9.2 Social layer** — leaderboards, profile discovery (seam: new tables + public read policies).
- **9.3 Multi-platform ingestion** — Codeforces/HackerRank adapters (seam: extension interceptor pattern generalized into adapter modules).
- **9.4 Background job infrastructure** — replace fire-and-forget with durable queue for AI notes/retries (seam: swap `services/gemini.ts` invocation point in T5 handler).

