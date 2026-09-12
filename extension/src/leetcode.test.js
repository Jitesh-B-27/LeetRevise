import { beforeAll, describe, expect, it } from "vitest";

beforeAll(async () => {
  await import("./leetcode.js");
});

function helpers() {
  return globalThis.LeetReviseLeetCode;
}

describe("LeetCode extension helpers", () => {
  it("normalizes secure and local development backend origins", () => {
    expect(helpers().normalizeBackendUrl("https://app.example.com/")).toBe(
      "https://app.example.com",
    );
    expect(helpers().normalizeBackendUrl("http://localhost:3000")).toBe(
      "http://localhost:3000",
    );
    expect(() => helpers().normalizeBackendUrl("http://app.example.com")).toThrow(
      "Use HTTPS",
    );
    expect(() => helpers().normalizeBackendUrl("https://app.example.com/path")).toThrow(
      "without a path",
    );
  });

  it("extracts a draft from stable page metadata and known content hooks", () => {
    document.head.innerHTML = '<meta property="og:title" content="Two Sum - LeetCode" />';
    document.body.innerHTML = `
      <div data-difficulty="Easy"></div>
      <article data-problem-description>Find two values.</article>
      <textarea aria-label="Editor">return answer;</textarea>
      <span data-cy="lang-select">JavaScript</span>
    `;

    expect(
      helpers().extractPageDraft(document, "https://leetcode.com/problems/two-sum/description/"),
    ).toMatchObject({
      problemSlug: "two-sum",
      title: "Two Sum",
      difficulty: "Easy",
      problemDescription: "Find two values.",
      language: "JavaScript",
      code: "return answer;",
    });
  });

  it("recognizes submit requests and accepted result measurements", () => {
    expect(
      helpers().submissionRequestDetails(
        "https://leetcode.com/problems/two-sum/submit/",
        JSON.stringify({ typed_code: "solve()", lang: "typescript" }),
      ),
    ).toEqual({ code: "solve()", language: "typescript" });

    expect(
      helpers().acceptedResultDetails({
        status_code: 10,
        status_runtime: "12 ms",
        status_memory: "16.4 MB",
      }),
    ).toMatchObject({ runtimeMs: 12, memoryMb: 16.4 });
    expect(helpers().acceptedResultDetails({ status_code: 11 })).toBeUndefined();
  });

  it("builds the exact backend contract and validates optional metrics", () => {
    const submission = helpers().buildSubmission({
      problemSlug: "two-sum",
      title: "Two Sum",
      difficulty: "Easy",
      problemUrl: "https://leetcode.com/problems/two-sum/",
      problemDescription: "Find two values.",
      language: "typescript",
      code: "return answer;",
      runtimeMs: "12",
      memoryMb: "16.4",
      submittedAt: "2026-09-13T10:00:00+05:30",
    });

    expect(submission).toEqual({
      problemSlug: "two-sum",
      title: "Two Sum",
      difficulty: "Easy",
      problemUrl: "https://leetcode.com/problems/two-sum/",
      problemDescription: "Find two values.",
      language: "typescript",
      code: "return answer;",
      runtimeMs: 12,
      memoryMb: 16.4,
      submittedAt: "2026-09-13T04:30:00.000Z",
    });

    expect(() => helpers().buildSubmission({ ...submission, runtimeMs: 1.5 })).toThrow(
      "non-negative integer",
    );
  });
});
