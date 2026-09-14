import { beforeAll, describe, expect, it, vi } from "vitest";

beforeAll(async () => {
  await import("./leetcode.js");
  await import("./history.js");
});

function history() {
  return globalThis.LeetReviseHistory;
}

describe("bulk history helpers", () => {
  it("keeps only the newest accepted submission for each problem", () => {
    const collapsed = history().collapseLatestAccepted([
      { id: "1", title_slug: "two-sum", status_display: "Accepted", timestamp: 100 },
      { id: "2", title_slug: "two-sum", status_display: "Wrong Answer", timestamp: 300 },
      { id: "3", title_slug: "two-sum", status_display: "Accepted", timestamp: 200 },
      { id: "4", title_slug: "binary-search", status_display: "Accepted", timestamp: 150 },
      { id: "5", title_slug: "invalid-time", status_display: "Accepted" },
    ]);

    expect(collapsed).toHaveLength(2);
    expect(collapsed.find((item) => item.problemSlug === "two-sum")?.submissionId).toBe("3");
    expect(collapsed.find((item) => item.problemSlug === "binary-search")?.submissionId).toBe("4");
  });

  it("accepts numeric-string Unix timestamps returned by LeetCode GraphQL", () => {
    const collapsed = history().collapseLatestAccepted([
      {
        id: "42",
        titleSlug: "two-sum",
        statusDisplay: "Accepted",
        lang: "python3",
        timestamp: "1757741400",
      },
    ]);

    expect(collapsed).toEqual([
      expect.objectContaining({
        submissionId: "42",
        problemSlug: "two-sum",
        submittedAt: "2025-09-13T05:30:00.000Z",
      }),
    ]);
  });

  it("is independent of input order and resolves timestamp ties deterministically", () => {
    const items = [
      { id: "10", title_slug: "two-sum", status_display: "Accepted", timestamp: 100 },
      { id: "11", title_slug: "two-sum", status_display: "Accepted", timestamp: 100 },
    ];

    expect(history().collapseLatestAccepted(items)[0].submissionId).toBe("11");
    expect(history().collapseLatestAccepted([...items].reverse())[0].submissionId).toBe("11");
  });

  it("chunks every item without imposing a total-history limit", () => {
    const items = Array.from({ length: 123 }, (_, index) => index);
    const chunks = history().chunkItems(items, 25);

    expect(chunks.map((chunk) => chunk.length)).toEqual([25, 25, 25, 25, 23]);
    expect(chunks.flat()).toEqual(items);
  });

  it("aggregates backend outcomes across chunks", () => {
    const total = history().addImportCounts(
      { created: 5, updated: 1, skipped: 2, invalid: 0 },
      { created: 3, updated: 2, skipped: 4, invalid: 1 },
    );

    expect(total).toEqual({ created: 8, updated: 3, skipped: 6, invalid: 1 });
  });

  it("blocks a scan when the active account differs from the linked account", () => {
    expect(history().assertLinkedAccount("alice", "alice")).toBe("alice");
    expect(() => history().assertLinkedAccount("alice", "bob")).toThrow(
      "Linked to alice, but LeetCode is signed in as bob",
    );
    expect(() => history().assertLinkedAccount(null, "alice")).toThrow(
      "Link the intended",
    );
  });

  it("builds the existing ingestion contract from a submission-detail fixture", () => {
    const submission = history().submissionFromDetail(
      {
        id: "42",
        title_slug: "two-sum",
        title: "Two Sum",
        status_display: "Accepted",
        lang: "python3",
        timestamp: 1_757_741_400,
      },
      {
        runtimeDisplay: "41 ms",
        memoryDisplay: "18.2 MB",
        code: "class Solution: pass",
        timestamp: 1_757_741_400,
        lang: { name: "python3", verboseName: "Python3" },
        question: {
          titleSlug: "two-sum",
          title: "Two Sum",
          content: "<p>Find two values.</p>",
          difficulty: "Easy",
        },
      },
      {
        origin: "https://leetcode.com",
        problemDescription: "Find two values.",
      },
    );

    expect(submission).toMatchObject({
      problemSlug: "two-sum",
      title: "Two Sum",
      difficulty: "Easy",
      problemUrl: "https://leetcode.com/problems/two-sum/",
      problemDescription: "Find two values.",
      language: "Python3",
      code: "class Solution: pass",
      runtimeMs: 41,
      memoryMb: 18.2,
    });
  });

  it("parses solved-problem and per-problem submission GraphQL fixtures", () => {
    expect(
      history().solvedProblemPage({
        problemsetQuestionList: {
          total: 2,
          questions: [
            { title: "Two Sum", titleSlug: "two-sum", status: "ac" },
            { title: "Unsolved", titleSlug: "unsolved", status: null },
          ],
        },
      }),
    ).toEqual({
      total: 2,
      problems: [{ problemSlug: "two-sum", title: "Two Sum" }],
    });

    expect(
      history().problemSubmissionPage({
        questionSubmissionList: {
          hasNext: true,
          lastKey: "next-page",
          submissions: [{ id: "42", statusDisplay: "Accepted" }],
        },
      }),
    ).toEqual({
      hasNext: true,
      lastKey: "next-page",
      submissions: [{ id: "42", statusDisplay: "Accepted" }],
    });
  });

  it("limits concurrent detail work while preserving result order", async () => {
    let active = 0;
    let maximumActive = 0;
    const mapper = vi.fn(async (value) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await Promise.resolve();
      active -= 1;
      return value * 2;
    });

    await expect(history().mapWithConcurrency([1, 2, 3, 4, 5], 2, mapper)).resolves.toEqual([
      2, 4, 6, 8, 10,
    ]);
    expect(maximumActive).toBeLessThanOrEqual(2);
  });
});
