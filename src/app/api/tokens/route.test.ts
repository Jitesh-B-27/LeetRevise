import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  createToken: vi.fn(),
}));

vi.mock("@/lib/services/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: mocks.getUser },
  }),
}));
vi.mock("@/lib/services/ingest-token-repository", () => ({
  createPrivilegedIngestTokenRepository: () => ({}),
}));
vi.mock("@/lib/auth/ingest-token", () => ({
  createIngestToken: mocks.createToken,
}));

import { POST } from "./route";

describe("POST /api/tokens", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects requests without an authenticated web session", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: new Error("No session"),
    });

    const response = await POST();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Authentication required",
    });
    expect(mocks.createToken).not.toHaveBeenCalled();
  });

  it("derives the owner from the session and returns the raw token once", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "session-user" } },
      error: null,
    });
    mocks.createToken.mockResolvedValue({
      token: "lr_ingest_raw-once",
      metadata: {
        id: "token-id",
        createdAt: "2026-09-01T00:00:00.000Z",
        lastUsedAt: null,
        revokedAt: null,
      },
    });

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(mocks.createToken).toHaveBeenCalledWith(
      "session-user",
      expect.anything(),
    );
    expect(body.token).toBe("lr_ingest_raw-once");
    expect(body).not.toHaveProperty("tokenHash");
    expect(body.metadata).not.toHaveProperty("tokenHash");
  });
});
