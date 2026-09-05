import { describe, expect, it, vi } from "vitest";
import { IngestTokenAuthenticationError } from "@/lib/auth/ingest-token";

const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
}));

vi.mock("@/lib/services/ingest-token-repository", () => ({
  createPrivilegedIngestTokenRepository: () => ({}),
}));
vi.mock("@/lib/auth/ingest-token", async (importOriginal) => {
  const original = await importOriginal<
    typeof import("@/lib/auth/ingest-token")
  >();
  return { ...original, verifyIngestAuthorization: mocks.verify };
});

import { GET } from "./route";

describe("GET /api/extension/verify", () => {
  it("returns 401 for a missing or invalid bearer token", async () => {
    mocks.verify.mockRejectedValue(
      new IngestTokenAuthenticationError("missing", "Missing bearer token"),
    );

    const response = await GET(
      new Request("http://localhost/api/extension/verify"),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Missing bearer token",
    });
  });

  it("confirms a valid token without returning its user ID", async () => {
    mocks.verify.mockResolvedValue({ userId: "resolved-owner" });

    const response = await GET(
      new Request("http://localhost/api/extension/verify", {
        headers: { authorization: "Bearer lr_ingest_example" },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ valid: true });
    expect(body).not.toHaveProperty("userId");
  });
});
