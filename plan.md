# LeetRevise V1 — Two-Week Build Plan

> **Project:** LeetRevise — AI-powered spaced revision and pattern practice for LeetCode
> **Target:** Complete and deploy a usable personal-project V1 in 14 calendar days
> **Development approach:** Rapid, agent-assisted implementation with Codex
> **Primary reference:** `architecture.md`
> **Deployment:** Vercel (Next.js) + Supabase (Postgres/Auth) + Google Gemini

---

## 1. Purpose of This File

This file is the implementation source of truth for Version 1. It is intended to give Codex and the developer enough context to resume work at any stage without reconstructing project decisions from conversation history.

When implementation details differ from `architecture.md`, this plan takes precedence for the two-week personal-project build. `architecture.md` remains the longer-term architectural reference.

Update this file throughout development:

- Check completed acceptance criteria.
- Record material decisions in the Decision Log.
- Record active problems in Known Issues.
- Keep the Current Status section accurate at the end of each work session.
- Do not expand V1 scope unless an existing core flow cannot work without the change.

---

## 2. V1 Outcome

At the end of Version 1, one user must be able to:

1. Sign in to the LeetRevise web app.
2. Configure a personal ingestion token in the Chrome extension.
3. Capture an accepted LeetCode submission or manually import submission data.
4. See the saved problem and generated AI notes in LeetRevise.
5. Open a dashboard containing up to three recommended revision problems.
6. Open a revision workspace with the problem context and a Monaco editor.
7. Request Socratic hints progressively from Level 1 through Level 3.
8. Mark a revision complete so it is not recommended again that day.
9. Use the deployed application from a Vercel URL with Supabase persistence.

The goal is a reliable personal tool and portfolio-ready demo, not a multi-user commercial platform.

---

## 3. Scope

### 3.1 Required V1 features

#### Web application

- Next.js App Router with TypeScript and Tailwind CSS.
- Supabase magic-link authentication.
- Protected dashboard and revision routes.
- Daily revision feed containing zero to three problems.
- Pattern-health summary using stored submission data.
- Revision workspace with problem details, prior solution context, and Monaco editor.
- Progressive Socratic hint drawer.
- Submission/library view sufficient to verify imported problems and AI notes.
- Responsive desktop-first UI with usable loading, empty, and error states.

#### Submission ingestion

- Single-submission API with validation and idempotent upsert behavior.
- Chrome MV3 extension capable of sending accepted submission data.
- Paste-once bearer token configuration in the extension popup.
- A manual capture/import fallback if automatic interception is unreliable.
- Bulk import endpoint and basic extension UI for historical sync if LeetCode data access is feasible within the timebox.

#### AI features

- Gemini-generated structured notes:
  - pattern tag;
  - time complexity;
  - space complexity;
  - concise insights.
- Three-level Socratic hints.
- AI errors must not lose a saved submission.
- Retry or regeneration action for missing AI notes.

#### Revision engine

- Pattern Decay Score implementation.
- Deterministic top-three selection.
- Difficulty weighting.
- Exclusion of problems already revised on the current local day.
- A persisted revision-completion event.

#### Testing and deployment

- Unit tests for PDS and validation.
- API tests for the most important ingestion and daily-feed behavior.
- One Playwright happy-path smoke test.
- Vercel deployment.
- Supabase migrations, authentication, and production configuration.
- End-to-end manual test using the deployed application and extension.

### 3.2 Explicitly out of scope

- Running or judging code inside LeetRevise.
- Docker or Judge0 sandboxing.
- Social profiles, followers, leaderboards, or sharing.
- Billing, subscriptions, organizations, or admin panels.
- Codeforces, HackerRank, or other coding platforms.
- Native mobile apps.
- Production-scale queues, observability, incident response, or formal SLAs.
- Complex analytics and long-term learning reports.
- Perfect AI safety enforcement; reasonable prompt and output checks are sufficient.
- Full browser/version compatibility beyond current Chrome.
- Comprehensive automated test coverage.
- Chrome Web Store publication as a dependency for V1 completion; loading unpacked is acceptable.

### 3.3 Timeboxed optional features

Only implement these after the complete core flow works:

- Fully automatic historical LeetCode bulk discovery.
- Rich charts for pattern health.
- Multiple editor themes and extensive language templates.
- AI-note regeneration history.
- Extension status history and advanced retry controls.
- Polished landing page and animations.

---

## 4. Product Flow

### 4.1 First-time setup

1. User visits the deployed web application.
2. User signs in through a Supabase magic link.
3. Dashboard displays an empty-state setup guide.
4. User creates or copies a personal ingestion token from the web app.
5. User loads the unpacked Chrome extension and pastes the token and backend URL into its popup.
6. Extension verifies the token with the backend and displays a connected state.

### 4.2 Accepted-submission capture

1. User submits a solution on LeetCode.
2. The extension detects an accepted result.
3. It collects available problem metadata, code, language, runtime, memory, and URL.
4. It sends the payload to `POST /api/submissions` with the bearer token.
5. The server authenticates the token and validates the payload.
6. The server inserts a new problem or updates an existing problem as a re-solve.
7. AI notes are generated and persisted. For V1 this may run synchronously with a timeout or through a simple post-response mechanism; submission persistence must succeed independently.
8. Pattern information becomes available to the dashboard.
9. Extension displays success or a retryable error.

### 4.3 Manual fallback capture

Automatic interception is an external-integration risk. V1 must include a usable fallback:

1. User opens the extension while viewing a LeetCode problem/submission page.
2. Extension attempts to read the page metadata and editor contents.
3. User reviews or fills any missing required fields.
4. User clicks **Save to LeetRevise**.
5. The same submission API and processing flow is used.

The manual path is required if automatic interception cannot be completed reliably within its timebox.

### 4.4 Daily revision

1. Authenticated user opens the dashboard.
2. The dashboard requests `GET /api/revision/daily`.
3. Server retrieves eligible submissions and revision history.
4. Server calculates PDS and returns the highest-ranked three.
5. Dashboard displays up to three cards with title, difficulty, pattern, days since solved, and revision action.
6. User opens one card in the revision workspace.

### 4.5 Revision workspace and hints

1. Workspace loads the stored problem context and last accepted solution metadata.
2. Monaco displays a clean language-appropriate starter template.
3. User works through the problem without code execution.
4. If stuck, the user requests a Level 1 hint.
5. Additional requests progress to Levels 2 and 3; levels cannot be skipped through normal UI use.
6. User marks the revision complete.
7. A revision event is persisted and the problem disappears from that day's feed.

### 4.6 Historical import

1. User initiates import from the extension.
2. Extension collects accessible historical submissions or accepts manually assembled items.
3. Items are sent in batches to `POST /api/submissions/bulk`.
4. Existing problems are skipped during import rather than counted as new re-solves.
5. The popup displays imported, skipped, and failed counts.

---

## 5. Technical Architecture

```text
LeetCode page
    |
    | accepted submission or manual capture
    v
Chrome MV3 extension
    |
    | HTTPS + personal bearer token
    v
Next.js App Router on Vercel
    |-- authentication and token management
    |-- submission and bulk APIs
    |-- daily revision API
    |-- hint API
    |-- dashboard and Monaco workspace
    |
    +--> Supabase Postgres/Auth
    |
    +--> Gemini API for notes and hints
```

### 5.1 Repository layout

```text
src/
  app/
    (auth)/
    (dashboard)/
    api/
  components/
  lib/
    domain/       # pure types, schemas, PDS
    services/     # Supabase, Gemini, patterns, tokens
    auth/         # session and extension authentication helpers
extension/
  manifest.json
  src/
supabase/
  migrations/
tests/
architecture.md
plan.md
```

API routes should remain thin: authenticate, validate, call a service, and return a response. Domain logic must not depend on Supabase, Next.js, or Gemini.

### 5.2 Main technology choices

- Next.js App Router and TypeScript.
- Tailwind CSS.
- Supabase Postgres and magic-link auth.
- Google Gemini Flash-class model selected through an environment variable.
- Monaco Editor.
- Zod validation.
- Vitest and React Testing Library where useful.
- Playwright for one critical smoke journey.
- npm as package manager.

---

## 6. Data Model

The migrations are the final authority once created. The minimum intended model is below.

### 6.1 `user_submissions`

- `id`: UUID primary key.
- `user_id`: Supabase user reference.
- `problem_id`: stable LeetCode slug or identifier.
- `title`: problem title.
- `difficulty`: Easy, Medium, or Hard.
- `problem_url`: source URL, nullable when imported.
- `problem_description`: captured problem context, nullable if unavailable.
- `pattern_tag`: nullable until AI classification completes.
- `language`: submitted language.
- `code`: most recently captured accepted code.
- `runtime_ms`: nullable integer.
- `memory_mb`: nullable numeric.
- `ai_notes`: nullable JSON.
- `last_solved_at`: timestamp.
- `solved_count`: positive integer.
- `created_at` and `updated_at`: timestamps.
- Unique constraint on `(user_id, problem_id)`.

### 6.2 `pattern_stats`

For V1 this table may be omitted if statistics can be calculated simply and quickly from submission rows. If retained, it is a cache rather than the source of truth.

- `user_id`.
- `pattern_tag`.
- `total_solved`.
- `recent_solved_14_days`.
- `last_revision_date`.
- Unique constraint on `(user_id, pattern_tag)`.

### 6.3 `revision_attempts`

- `id`: UUID primary key.
- `user_id`.
- `submission_id`.
- `started_at`.
- `completed_at`, nullable until completion.
- `highest_hint_level`, default 0.
- `created_at`.

This table determines whether a problem was revised today and stores hint progression for a revision session.

### 6.4 `ingest_tokens`

- `id`: UUID primary key.
- `user_id`.
- `token_hash`: hash of the personal token; never store the raw token.
- `name`: default such as `Chrome extension`.
- `last_used_at`.
- `revoked_at`.
- `created_at`.

Only the generated raw token is shown to the user, once.

### 6.5 Security rules

- Enable RLS on all user-owned tables.
- Browser sessions can access only rows where `auth.uid() = user_id`.
- The service-role key is server-only.
- Extension bearer tokens are hashed before lookup or verification.
- Do not place Gemini or service-role secrets in client bundles.

Because this is a personal project, basic input limits and safe secret handling are required; enterprise-grade token management and abuse prevention are not.

---

## 7. API Surface

All errors use `{ "error": string }` with an appropriate HTTP status.

### Authentication and setup

- `POST /api/tokens`: create a personal ingestion token for the signed-in user.
- `DELETE /api/tokens/:id`: revoke a token; optional if time is tight, but database support should allow it.
- `GET /api/extension/verify`: validate an extension bearer token.

### Submissions

- `POST /api/submissions`: create or update one accepted submission.
  - New item returns `201`.
  - Re-solve returns `200` and increments `solved_count`.
  - Save must succeed even if AI generation fails.
- `POST /api/submissions/bulk`: validate and import a batch.
  - Existing problems are skipped.
  - Returns inserted, skipped, and failed/invalid information as defined by implementation.
- `GET /api/submissions`: list the signed-in user's saved problems.
- `GET /api/submissions/:id`: retrieve one problem for the workspace.
- `POST /api/submissions/:id/notes`: regenerate missing notes; add only if needed for recovery.

### Revision

- `GET /api/revision/daily`: return up to three eligible ranked problems.
- `POST /api/revision/:submissionId/start`: create or reuse today's active attempt.
- `POST /api/revision/:attemptId/complete`: mark an attempt complete.

### Hints

- `POST /api/hints`: request the next valid hint for a revision attempt.
- Server derives or validates the next level from `highest_hint_level`.
- Response contains the level and hint text.

API details may be simplified during implementation, but all user flows above must remain possible.

---

## 8. Domain Rules

### 8.1 Pattern Decay Score

```text
PDS = DaysSinceLastSolved
      × (1 + TotalSolvedInPattern / (RecentSolved14Days + 1))
      × DifficultyMultiplier
```

- Easy multiplier: `1.0`.
- Medium multiplier: `1.5`.
- Hard multiplier: `2.0`.
- Clamp `DaysSinceLastSolved` to zero or greater.
- Invalid inputs must not produce `NaN` or infinity.
- Use a deterministic secondary order, such as oldest solve timestamp and then problem ID.

### 8.2 Daily eligibility

A submission is eligible when:

- It belongs to the authenticated user.
- It has not been marked revised during the user's current local day.
- It contains enough data to open the workspace.

Use the browser-provided IANA time zone stored in user metadata or passed to the endpoint. UTC is an acceptable temporary fallback.

### 8.3 AI notes

Expected JSON shape:

```json
{
  "pattern_tag": "Two Pointers",
  "time_complexity": "O(n)",
  "space_complexity": "O(1)",
  "insights": ["Maintain an invariant while narrowing the search space."]
}
```

- Validate AI output with Zod.
- Retry malformed output once.
- Persist `null` and expose a retry action after repeated failure.
- Keep insights short enough for revision cards/workspace display.

### 8.4 Hints

- Level 1: conceptual pattern or invariant.
- Level 2: useful state and structural direction.
- Level 3: edge cases, constraints, or debugging direction.
- Do not intentionally return complete code solutions.
- Remove fenced code blocks from model output as a lightweight V1 safeguard.
- Stop progression after Level 3.

---

## 9. UI Pages and Components

### Required pages

- `/`: minimal landing page or authenticated redirect.
- `/login`: magic-link form and status feedback.
- `/dashboard`: Daily Three, pattern health, setup/empty states.
- `/library`: saved submissions and AI-note status.
- `/revision/[submissionId]`: problem context, Monaco editor, hints, completion action.
- `/settings`: token creation and extension setup instructions; may be incorporated into dashboard if faster.

### Required reusable components

- Navigation/header.
- Revision card.
- Difficulty badge.
- Pattern badge.
- Pattern-health summary.
- Monaco editor wrapper loaded client-side.
- Hint drawer.
- Empty, loading, and error states.
- Extension connection/setup instructions.

Design priority: clear and functional first, consistent visual polish second. Avoid spending core-flow time on animation or a custom design system.

---

## 10. Chrome Extension Plan

### Components

- Manifest V3 configuration.
- Popup for backend URL, bearer token, connection state, manual save/import, and result messages.
- Content script for problem-page context.
- Page-context script if wrapping page `fetch`/XHR is necessary.
- Background service worker for authenticated API calls and retryable state.
- Chrome storage for configuration.

### Capture strategy

Timebox automatic interception to one focused implementation session. Preferred order:

1. Page-context interception of the relevant LeetCode request/result.
2. Content-script observation of accepted-result UI plus page/editor extraction.
3. Manual **Save to LeetRevise** fallback.

The manual fallback is enough to ship V1 if LeetCode internals make automatic interception unstable. Do not allow reverse-engineering the external site to consume multiple days.

### Extension completion criteria

- Loads unpacked without MV3 errors.
- Stores backend URL and token.
- Verifies authentication.
- Captures or manually assembles a valid submission payload.
- Successfully saves it to the deployed backend.
- Shows success and failure states.

---

## 11. Testing Strategy

Testing is risk-based to fit the two-week deadline.

### Must automate

- PDS calculation across all difficulties and important edge cases.
- Submission payload validation.
- AI-note response parsing and fallback.
- Idempotent new submission versus re-solve behavior.
- Daily feed excludes completed revisions and returns at most three.
- Extension payload parser with saved/mock LeetCode fixtures.
- One Playwright flow: authenticate using test setup, seed/capture submission, see dashboard card, open workspace, request Level 1 hint, complete revision.

### Must verify manually

- Magic-link login on the deployed URL.
- RLS prevents access to another test user's data.
- Extension loads and connects.
- Real LeetCode accepted/manual capture reaches production.
- AI notes appear or fail gracefully.
- Daily feed and completion behavior work across refreshes.
- Monaco loads in the deployed application.
- Environment secrets are absent from browser-visible bundles.

### Not required for V1

- Exhaustive component snapshots.
- Full cross-browser automation.
- Load testing.
- Every error branch covered by an integration test.

---

## 12. Fourteen-Day Execution Schedule

The order is vertical-slice oriented: establish one end-to-end path early, then improve it.

### Day 1 — Scaffold and contracts

- [x] Scaffold Next.js, TypeScript, Tailwind, and linting.
- [ ] Configure the Vitest test runner and add an initial smoke test.
- [ ] Add folder boundaries and environment validation.
- [ ] Define domain types and Zod schemas.
- [ ] Add `.env.example` and local setup instructions.
- [ ] Confirm production-compatible package versions.

**Exit condition:** Application builds, runs, and tests execute.

### Day 2 — Supabase schema and auth

- [ ] Create migrations for submissions, revision attempts, and ingestion tokens.
- [ ] Add indexes, triggers/timestamps, and RLS policies.
- [ ] Implement Supabase server/browser clients.
- [ ] Implement magic-link login and protected routes.
- [ ] Test two-user data isolation manually or with SQL tests.

**Exit condition:** A user can log in and reach a protected empty dashboard.

### Day 3 — Submission API and token setup

- [ ] Implement token generation, hashing, and verification.
- [ ] Implement `POST /api/submissions`.
- [ ] Implement idempotent insert/re-solve behavior.
- [ ] Add focused API/service tests.
- [ ] Add settings/setup UI for copying a generated token.

**Exit condition:** An authenticated test request stores a submission.

### Day 4 — AI notes

- [ ] Implement Gemini service and structured prompt.
- [ ] Validate JSON, retry once, and persist results.
- [ ] Ensure AI failure does not roll back ingestion.
- [ ] Add note display and regeneration fallback.
- [ ] Add mocked Gemini tests.

**Exit condition:** A saved submission displays structured notes.

### Day 5 — Daily revision engine

- [ ] Implement and test `computePDS()`.
- [ ] Implement pattern aggregation.
- [ ] Implement `GET /api/revision/daily`.
- [ ] Implement revision start/complete persistence.
- [ ] Handle local-day exclusion and deterministic ordering.

**Exit condition:** Seeded submissions produce the correct Daily Three and completion removes a card.

### Day 6 — Dashboard and library

- [ ] Build navigation and dashboard states.
- [ ] Build Daily Three cards.
- [ ] Build a simple pattern-health summary.
- [ ] Build library list/detail access.
- [ ] Verify responsiveness and error handling.

**Exit condition:** The web app provides a coherent view of saved and recommended problems.

### Day 7 — Revision workspace

- [ ] Build the revision route and load stored context.
- [ ] Integrate Monaco with client-only loading.
- [ ] Add basic starter templates by language.
- [ ] Add completion action and navigation.
- [ ] Preserve reasonable editor state during the active session.

**Exit condition:** A dashboard card opens a usable revision workspace.

### Day 8 — Socratic hints

- [ ] Implement revision-attempt hint progression.
- [ ] Implement Gemini hint prompt and output cleanup.
- [ ] Build hint drawer with Levels 1–3.
- [ ] Add loading, failure, retry, and terminal states.
- [ ] Test progression and no-code output checks.

**Exit condition:** The complete web-only revision journey works.

### Day 9 — Extension foundation and feasibility spike

- [ ] Scaffold MV3 extension.
- [ ] Build popup settings and connection verification.
- [ ] Implement content/page/background communication.
- [ ] Investigate accepted-submission detection against current LeetCode.
- [ ] Decide and record the final capture method before ending the day.

**Exit condition:** Unpacked extension connects to the local or preview backend and capture strategy is proven or manual fallback selected.

### Day 10 — Extension capture

- [ ] Implement the selected automatic capture method.
- [ ] Implement manual save fallback regardless of automatic success.
- [ ] Extract available metadata and normalize the payload.
- [ ] Add success, duplicate/re-solve, and error feedback.
- [ ] Test with mocked fixtures and one real problem.

**Exit condition:** A real LeetCode submission can reach LeetRevise through at least one reliable extension path.

### Day 11 — Bulk import and integration cleanup

- [ ] Implement bulk API batching and idempotent skip behavior.
- [ ] Implement the simplest feasible historical-import UI/data source.
- [ ] If automatic history access is not feasible, provide manual JSON/list import or defer it explicitly.
- [ ] Fix contract differences uncovered by extension testing.
- [ ] Improve retry behavior for network failures.

**Exit condition:** Core ingestion is stable; a practical backfill path exists without blocking release.

### Day 12 — Automated smoke coverage

- [ ] Complete critical Vitest tests.
- [ ] Add Playwright happy-path test.
- [ ] Run typecheck, lint, unit tests, build, and E2E.
- [ ] Fix only release-blocking or high-impact defects.
- [ ] Update README setup and run instructions.

**Exit condition:** All required local quality gates pass.

### Day 13 — Deploy and production integration

- [ ] Create/configure Supabase production project.
- [ ] Apply migrations and configure magic-link URLs.
- [ ] Configure Vercel environment variables.
- [ ] Deploy the Next.js application.
- [ ] Point the extension to production.
- [ ] Perform the complete real-world flow.

**Exit condition:** The production URL, database, AI calls, auth, and extension work together.

### Day 14 — Stabilize and finish

- [ ] Resolve production-only issues.
- [ ] Run the release checklist below.
- [ ] Improve the highest-impact UX problems.
- [ ] Record known limitations.
- [ ] Mark V1 complete and create a post-V1 backlog without implementing it.

**Exit condition:** V1 is deployed, personally usable, documented, and reproducibly testable.

---

## 13. Scope-Control Rules

To protect the two-week deadline:

1. The end-to-end user loop takes priority over isolated feature completeness.
2. Use established libraries and platform defaults rather than custom infrastructure.
3. A manual extension capture fallback is acceptable for V1.
4. Direct queries are acceptable where cached pattern statistics add complexity.
5. AI work may be synchronous with a timeout for a personal project, provided the submission is persisted first and failure is recoverable.
6. Prefer one polished happy path over broad configuration options.
7. Any task blocked for more than half a day should be simplified, isolated, or deferred unless it blocks the core loop.
8. Chrome Web Store approval is not part of the deadline.
9. New ideas go into the post-V1 backlog, not the active sprint.

---

## 14. Codex Working Protocol

At the start of a coding session, Codex should:

1. Read `plan.md` and relevant sections of `architecture.md`.
2. Inspect the current working tree and existing changes.
3. Read any repository-level `AGENTS.md` instructions.
4. Identify the current day/milestone from Current Status rather than assuming the repository matches the schedule.
5. Confirm the smallest testable slice to implement next.

During implementation, Codex should:

- Preserve user changes and avoid unrelated rewrites.
- Keep domain logic separate from external I/O.
- Add or update tests with each important behavior.
- Run focused checks after each slice, then broader checks at milestones.
- Prefer completing an in-progress vertical slice before starting another.
- Update API/schema documentation when contracts change.
- Surface external-integration uncertainty early, especially LeetCode and Gemini behavior.
- Keep secrets out of source control and logs.

At the end of a coding session, Codex should:

- Summarize implemented behavior and verification results.
- Update checkboxes and Current Status in this file.
- Record unresolved bugs and the exact next action.
- Note any divergence from architecture and why it was chosen.

### Standard quality commands

Populate exact scripts when the project is scaffolded. The intended gate is:

```text
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

---

## 15. Environment Variables

Expected variables; confirm names during scaffold:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
GEMINI_MODEL=
INGEST_TOKEN_SECRET=
NEXT_PUBLIC_APP_URL=
```

Rules:

- Validate required variables at startup/server use with clear messages.
- Never expose `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, or `INGEST_TOKEN_SECRET` through `NEXT_PUBLIC_*` variables.
- Maintain `.env.example` with placeholders only.
- Configure preview and production values in Vercel.

---

## 16. Release Checklist

### Application

- [ ] Production build passes without TypeScript errors.
- [ ] Landing/login/dashboard/revision routes load without console-breaking errors.
- [ ] Magic-link redirect returns to the production domain.
- [ ] Empty library state explains how to add a problem.
- [ ] Dashboard returns no more than three eligible problems.
- [ ] Monaco loads in production.
- [ ] Revision completion persists across refreshes.
- [ ] Hint progression stops at Level 3.

### Data and security

- [ ] All migrations apply cleanly to a fresh Supabase project.
- [ ] RLS is enabled and tested for user-owned tables.
- [ ] Service-role and Gemini secrets are server-only.
- [ ] Extension tokens are stored as hashes and can be invalidated in the database.
- [ ] Invalid API payloads receive safe errors.

### AI

- [ ] Valid notes are parsed and persisted.
- [ ] Malformed/failed generation does not lose the submission.
- [ ] Notes can be retried or regenerated.
- [ ] Hints are concise and do not intentionally reveal full code.

### Extension

- [ ] Extension loads unpacked without errors.
- [ ] Backend URL and token persist.
- [ ] Token verification works against production.
- [ ] At least one reliable real-world capture path works.
- [ ] Failed requests show a useful retry message.

### Deployment

- [ ] Vercel production URL is stable.
- [ ] Supabase site URL and redirect URLs are correct.
- [ ] Production environment variables are present.
- [ ] A real captured problem appears in the production dashboard.
- [ ] The end-to-end smoke journey passes manually.
- [ ] README contains local setup, migrations, extension loading, testing, and deployment instructions.

---

## 17. Definition of Done

Version 1 is complete when:

- The application is deployed to Vercel.
- A real user can authenticate.
- At least one reliable extension capture method saves a real LeetCode problem.
- AI notes are generated or fail recoverably.
- The Daily Three ranking works.
- A problem can be revised in Monaco with progressive hints.
- Completing the revision removes it from the current day's recommendations.
- Data persists in Supabase with basic RLS protection.
- Critical automated checks pass.
- Setup and known limitations are documented.

Chrome Web Store publication, automatic capture perfection, and optional historical-import polish are not required to declare V1 complete.

---

## 18. Known Risks and Fallbacks

| Risk | Impact | V1 fallback |
|---|---|---|
| LeetCode changes request or page internals | Automatic capture fails | Manual capture from extension popup |
| MV3 cannot directly inspect response bodies | Intended interceptor is blocked | Inject page-context script or observe accepted UI |
| Gemini response is malformed or slow | Notes/hints fail | Zod parse, one retry, graceful null/error, regeneration |
| Vercel terminates fire-and-forget work | Notes never persist | Persist first; use synchronous bounded call or supported background primitive |
| Magic-link email/redirect configuration fails | User cannot sign in | Test production redirect early; use Supabase test user/session locally |
| Monaco creates SSR/build issues | Workspace fails | Client-only dynamic import |
| Bulk history discovery is difficult | Empty initial library | Manual capture and simple JSON/manual import |
| Schedule slips | Deployment missed | Drop optional polish and automatic bulk discovery; retain core loop |

---

## 19. Decision Log

| Date | Decision | Reason |
|---|---|---|
| 2026-08-30 | Target a complete personal-project V1 within 14 days using Codex-assisted rapid development. | Delivery speed is more important than production-scale architecture. |
| 2026-08-30 | An unpacked Chrome extension is sufficient for V1. | Store review time is external and unnecessary for personal use. |
| 2026-08-30 | Manual capture is an acceptable fallback but must still use the real API and persistence flow. | Protects the core product from LeetCode integration instability. |
| 2026-08-30 | Add revision-attempt persistence and nullable pattern classification to the implementation plan. | Required for daily exclusion, hint state, and delayed/failed AI processing. |
| 2026-08-30 | Prefer simple synchronous/bounded AI processing or a platform-supported background mechanism over custom queue infrastructure. | Appropriate reliability/complexity tradeoff for a personal MVP. |

Add new decisions here rather than relying only on chat history.

---

## 20. Current Status

**Last updated:** 2026-08-30

**Current milestone:** Day 1 — scaffold and contracts.

**Repository state:**

- `architecture.md` and `plan.md` define the project and execution plan.
- Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, and ESLint are scaffolded.
- The root page renders a minimal LeetRevise introduction.
- `npm run lint`, `npm run typecheck`, and `npm run build` pass.
- Database migrations, authentication, extension, domain contracts, and automated tests have not been implemented yet.

**Next action:** Configure Vitest and add one initial application smoke test.

**Active blockers:** None.

**Known implementation issues:** PowerShell blocks the `npm.ps1` shim on this machine; use `npm.cmd` for project commands.

---

## 21. Post-V1 Backlog

Do not implement these during the two-week V1 unless all required work is complete:

- Durable background job queue.
- Code execution sandbox.
- Rich revision analytics and streaks.
- Multi-platform ingestion.
- Chrome Web Store packaging and publication.
- Social features.
- More sophisticated spaced-repetition scheduling.
- Prompt/evaluation suite for AI quality.
- Token management UI with multiple named devices.
- Mobile-specific experience.
