import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260905100000_create_ingest_latest_submission_function.sql",
  ),
  "utf8",
);

describe("ingest_latest_submission migration", () => {
  it("implements only insert, newer update, and stale skip outcomes", () => {
    expect(migration).toContain("submitted_at < p_submitted_at");
    expect(migration).toContain("return 'updated'");
    expect(migration).toContain("return 'skipped'");
    expect(migration).toContain("return 'created'");
    expect(migration).not.toMatch(/ingest_tokens|token_hash|json|array|bulk/i);
  });

  it("handles concurrent inserts through conflict retry", () => {
    expect(migration).toContain("loop");
    expect(migration).toContain(
      "on conflict (user_id, problem_slug) do nothing",
    );
  });

  it("is callable only through the privileged database role", () => {
    expect(migration).toMatch(
      /revoke execute[\s\S]+from public, anon, authenticated/,
    );
    expect(migration).toMatch(/grant execute[\s\S]+to service_role/);
  });
});
