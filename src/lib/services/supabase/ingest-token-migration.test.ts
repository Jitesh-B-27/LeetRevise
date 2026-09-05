import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260901100000_create_ingest_tokens.sql",
  ),
  "utf8",
);

describe("ingest_tokens migration", () => {
  it("stores hashes and lifecycle metadata without raw tokens", () => {
    expect(migration).toContain("token_hash text not null unique");
    expect(migration).toContain("last_used_at timestamptz");
    expect(migration).toContain("revoked_at timestamptz");
    expect(migration).not.toMatch(/raw_token|token_value|bearer_token/i);
  });

  it("exposes only safe metadata columns to authenticated users", () => {
    expect(migration).toContain(
      "grant select (id, created_at, last_used_at, revoked_at)",
    );
    expect(migration).not.toMatch(/grant select \([^)]*token_hash/i);
    expect(migration).not.toMatch(/grant select on table public\.ingest_tokens/i);
  });

  it("enables owner-only RLS without anonymous access", () => {
    expect(migration).toContain(
      "alter table public.ingest_tokens enable row level security",
    );
    expect(migration).toContain("to authenticated");
    expect(migration).toContain("(select auth.uid()) = user_id");
    expect(migration).not.toMatch(/to anon\b/);
  });
});
