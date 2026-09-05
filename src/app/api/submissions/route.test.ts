import { beforeEach, describe, expect, it, vi } from "vitest";
import { IngestTokenAuthenticationError } from "@/lib/auth/ingest-token";

const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  persist: vi.fn(),
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
  createSubmissionPersistenceService: () => ({ persist: mocks.persist }),
}));

import { POST } from "./route";

const validSubmission = {
  problemSlug: "two-sum",
  title: "Two Sum",
  difficulty: "Easy",
  problemUrl: "https://leetcode.com/problems/two-sum/",
  problemDescription: "Find two numbers that add up to the target.",
  language: "typescript",
  code: "function twoSum() { return []; }",
  submittedAt: "2026-09-05T08:30:00.000Z",
};

function createRequest(body: unknown, authorization = "Bearer lr_ingest_test") {
  return new Request("http://localhost/api/submissions", {
    method: "POST",
    headers: { authorization, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/submissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verify.mockResolvedValue({ userId: "verified-owner" });
  });

  it("rejects an unauthenticated bearer request before persistence", async () => {
    mocks.verify.mockRejectedValue(
      new IngestTokenAuthenticationError("invalid", "Invalid bearer token"),
    );

    const response = await POST(createRequest(validSubmission));

    expect(response.status).toBe(401);
    expect(mocks.persist).not.toHaveBeenCalled();
  });

  it("rejects invalid JSON and invalid submission payloads", async () => {
    const invalidJson = await POST(
      new Request("http://localhost/api/submissions", {
        method: "POST",
        headers: { authorization: "Bearer lr_ingest_test" },
        body: "{",
      }),
    );
    const invalidPayload = await POST(createRequest({ title: "Incomplete" }));

    expect(invalidJson.status).toBe(400);
    expect(invalidPayload.status).toBe(422);
    expect(mocks.persist).not.toHaveBeenCalled();
  });

  it("rejects caller-controlled user ownership", async () => {
    const response = await POST(
      createRequest({ ...validSubmission, userId: "attacker-user" }),
    );

    expect(response.status).toBe(422);
    expect(mocks.persist).not.toHaveBeenCalled();
  });

  it.each([
    ["created", 201],
    ["updated", 200],
    ["skipped", 200],
  ] as const)("returns %s with HTTP %s", async (outcome, expectedStatus) => {
    mocks.persist.mockResolvedValue(outcome);

    const response = await POST(createRequest(validSubmission));

    expect(response.status).toBe(expectedStatus);
    await expect(response.json()).resolves.toEqual({ status: outcome });
    expect(mocks.persist).toHaveBeenCalledWith(
      "verified-owner",
      validSubmission,
    );
  });
});
