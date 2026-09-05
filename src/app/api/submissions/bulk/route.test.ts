import { beforeEach, describe, expect, it, vi } from "vitest";
import { IngestTokenAuthenticationError } from "@/lib/auth/ingest-token";

const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  ingestBulk: vi.fn(),
}));

vi.mock("@/lib/auth/ingest-token", async (importOriginal) => {
  const original = await importOriginal<
    typeof import("@/lib/auth/ingest-token")
  >();
  return { ...original, verifyIngestAuthorization: mocks.verify };
});
vi.mock("@/lib/services/ingest-token-repository", () => ({
  createPrivilegedIngestTokenRepository: () => ({}),
}));
vi.mock("@/lib/services/submissions", () => ({
  createSubmissionPersistenceService: () => ({ persist: vi.fn() }),
}));
vi.mock("@/lib/services/bulk-submissions", () => ({
  ingestBulkSubmissions: mocks.ingestBulk,
}));

import { POST } from "./route";

function request(body: unknown) {
  return new Request("http://localhost/api/submissions/bulk", {
    method: "POST",
    headers: {
      authorization: "Bearer lr_ingest_test",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/submissions/bulk", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verify.mockResolvedValue({ userId: "verified-owner" });
  });

  it("rejects requests outside the bearer authorization boundary", async () => {
    mocks.verify.mockRejectedValue(
      new IngestTokenAuthenticationError("invalid", "Invalid bearer token"),
    );

    const response = await POST(request({ submissions: [] }));

    expect(response.status).toBe(401);
    expect(mocks.ingestBulk).not.toHaveBeenCalled();
  });

  it("rejects invalid JSON and invalid envelopes", async () => {
    const invalidJson = await POST(
      new Request("http://localhost/api/submissions/bulk", {
        method: "POST",
        headers: { authorization: "Bearer lr_ingest_test" },
        body: "{",
      }),
    );
    const invalidEnvelope = await POST(request({ submissions: "not-an-array" }));

    expect(invalidJson.status).toBe(400);
    expect(invalidEnvelope.status).toBe(422);
    expect(mocks.ingestBulk).not.toHaveBeenCalled();
  });

  it("derives ownership from the token and returns aggregate results", async () => {
    const entries = [
      { problemSlug: "valid-item" },
      { problemSlug: "valid-item", userId: "caller-controlled" },
      { invalid: true },
    ];
    mocks.ingestBulk.mockResolvedValue({
      created: 1,
      updated: 0,
      skipped: 1,
      invalid: 1,
    });

    const response = await POST(request({ submissions: entries }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      created: 1,
      updated: 0,
      skipped: 1,
      invalid: 1,
    });
    expect(mocks.ingestBulk).toHaveBeenCalledWith(
      "verified-owner",
      entries,
      expect.anything(),
    );
  });
});
