import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { Submission } from "@/lib/domain/submission";
import {
  ingestBulkSubmissions,
  normalizeBulkSubmissions,
} from "./bulk-submissions";

function submission(
  problemSlug: string,
  submittedAt: string,
  code = `${problemSlug}-${submittedAt}`,
): Submission {
  return {
    problemSlug,
    title: problemSlug,
    difficulty: "Medium",
    problemUrl: `https://leetcode.com/problems/${problemSlug}/`,
    problemDescription: `Description for ${problemSlug}`,
    language: "typescript",
    code,
    submittedAt,
  };
}

describe("bulk submission normalization", () => {
  it("keeps the chronologically newest valid submission per problem", () => {
    const older = submission("two-sum", "2026-09-05T09:00:00+05:30", "older");
    const newer = submission("two-sum", "2026-09-05T04:00:01Z", "newer");

    const result = normalizeBulkSubmissions([older, newer]);

    expect(result.submissions).toEqual([newer]);
    expect(result.duplicatesCollapsed).toBe(1);
    expect(result.invalid).toBe(0);
  });

  it("keeps valid history entries while counting invalid entries", () => {
    const valid = submission("two-sum", "2026-09-05T04:00:00Z");

    const result = normalizeBulkSubmissions([
      valid,
      { ...valid, code: "" },
      { unexpected: true },
    ]);

    expect(result.submissions).toEqual([valid]);
    expect(result.invalid).toBe(2);
  });

  it("does not impose a domain-level history limit", () => {
    const history = Array.from({ length: 1_000 }, (_, index) =>
      submission(`problem-${index}`, "2026-09-05T04:00:00Z"),
    );

    expect(normalizeBulkSubmissions(history).submissions).toHaveLength(1_000);
  });
});

describe("bulk submission ingestion", () => {
  const persist = vi.fn();

  beforeEach(() => vi.clearAllMocks());

  it("reuses persistence outcomes and counts collapsed duplicates as skipped", async () => {
    persist.mockImplementation(
      async (_userId: string, item: Submission) =>
        ({
          "created-problem": "created",
          "updated-problem": "updated",
          "stored-problem": "skipped",
        })[item.problemSlug],
    );
    const duplicateOlder = submission(
      "created-problem",
      "2026-09-04T04:00:00Z",
    );
    const duplicateNewer = submission(
      "created-problem",
      "2026-09-05T04:00:00Z",
    );

    const result = await ingestBulkSubmissions(
      "verified-owner",
      [
        duplicateOlder,
        duplicateNewer,
        submission("updated-problem", "2026-09-05T04:00:00Z"),
        submission("stored-problem", "2026-09-05T04:00:00Z"),
        { invalid: true },
      ],
      { persist },
    );

    expect(result).toEqual({
      created: 1,
      updated: 1,
      skipped: 2,
      invalid: 1,
    });
    expect(persist).toHaveBeenCalledTimes(3);
    expect(persist).toHaveBeenCalledWith("verified-owner", duplicateNewer);
  });
});
