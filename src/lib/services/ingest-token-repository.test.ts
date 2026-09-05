import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  client: {} as Record<string, unknown>,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/services/supabase/admin", () => ({
  createPrivilegedSupabaseClient: () => mocks.client,
}));

import { createPrivilegedIngestTokenRepository } from "./ingest-token-repository";

describe("privileged ingestion token repository", () => {
  beforeEach(() => {
    mocks.client = {};
  });

  it("creates a token while returning metadata without its hash", async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: "token-id",
        created_at: "2026-09-01T00:00:00.000Z",
        last_used_at: null,
        revoked_at: null,
      },
      error: null,
    });
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    const from = vi.fn(() => ({ insert }));
    mocks.client = { from };

    const repository = createPrivilegedIngestTokenRepository();
    const metadata = await repository.create({
      userId: "owner-user",
      tokenHash: "a".repeat(64),
    });

    expect(insert).toHaveBeenCalledWith({
      user_id: "owner-user",
      token_hash: "a".repeat(64),
    });
    expect(select).toHaveBeenCalledWith(
      "id, created_at, last_used_at, revoked_at",
    );
    expect(metadata).not.toHaveProperty("tokenHash");
  });

  it("atomically updates last_used_at only for a matching active token", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { user_id: "owner-user" },
      error: null,
    });
    const select = vi.fn(() => ({ maybeSingle }));
    const is = vi.fn(() => ({ select }));
    const eq = vi.fn(() => ({ is }));
    const update = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ update }));
    mocks.client = { from };

    const repository = createPrivilegedIngestTokenRepository();
    await expect(
      repository.consumeActiveTokenHash("b".repeat(64)),
    ).resolves.toBe("owner-user");

    expect(update).toHaveBeenCalledWith({
      last_used_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    });
    expect(eq).toHaveBeenCalledWith("token_hash", "b".repeat(64));
    expect(is).toHaveBeenCalledWith("revoked_at", null);
    expect(select).toHaveBeenCalledWith("user_id");
  });
});
