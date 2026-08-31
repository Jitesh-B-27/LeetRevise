import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260831140000_create_user_submissions.sql",
  ),
  "utf8",
);

describe("user_submissions migration", () => {
  it("stores one latest submission per user and problem", () => {
    expect(migration).toContain("unique (user_id, problem_slug)");
    expect(migration).toContain("new.submitted_at <= old.submitted_at");
    expect(migration).not.toContain("solved_count");
  });

  it("enables RLS and scopes every operation to authenticated owners", () => {
    expect(migration).toContain(
      "alter table public.user_submissions enable row level security",
    );
    expect(migration).toContain("for select\nto authenticated");
    expect(migration).toContain("for insert\nto authenticated");
    expect(migration).toContain("for update\nto authenticated");
    expect(migration).toContain("for delete\nto authenticated");
    expect(migration.match(/\(select auth\.uid\(\)\) = user_id/g)).toHaveLength(5);
  });

  it("does not introduce deferred business fields", () => {
    expect(migration).not.toMatch(/pattern|topic|revision|hint|ai_notes|gemini/i);
  });
});
