import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createSubmissionLibraryService } from "./submission-library";

function queryResult(result: unknown) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    maybeSingle: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockResolvedValue(result);
  query.maybeSingle.mockResolvedValue(result);
  return query;
}

describe("submission library service", () => {
  it("lists only the requested user's latest rows in submission order", async () => {
    const query = queryResult({
      data: [
        {
          id: "submission-1",
          problem_slug: "two-sum",
          title: "Two Sum",
          difficulty: "Easy",
          language: "TypeScript",
          runtime_ms: 41,
          memory_mb: "18.2",
          submitted_at: "2026-09-14T08:00:00.000Z",
        },
      ],
      error: null,
    });
    const service = createSubmissionLibraryService(
      Promise.resolve({ from: vi.fn().mockReturnValue(query) } as unknown as SupabaseClient),
    );

    await expect(service.list("user-1")).resolves.toEqual([
      expect.objectContaining({
        problemSlug: "two-sum",
        memoryMb: 18.2,
      }),
    ]);
    expect(query.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(query.order).toHaveBeenCalledWith("submitted_at", { ascending: false });
  });

  it("loads a detail by both owner and submission id", async () => {
    const query = queryResult({
      data: {
        id: "submission-1",
        problem_slug: "two-sum",
        title: "Two Sum",
        difficulty: "Easy",
        problem_url: "https://leetcode.com/problems/two-sum/",
        problem_description: "Find the matching pair.",
        language: "TypeScript",
        code: "function twoSum() {}",
        runtime_ms: null,
        memory_mb: null,
        submitted_at: "2026-09-14T08:00:00.000Z",
      },
      error: null,
    });
    const service = createSubmissionLibraryService(
      Promise.resolve({ from: vi.fn().mockReturnValue(query) } as unknown as SupabaseClient),
    );

    await expect(service.getById("user-1", "submission-1")).resolves.toEqual(
      expect.objectContaining({ code: "function twoSum() {}" }),
    );
    expect(query.eq).toHaveBeenNthCalledWith(1, "user_id", "user-1");
    expect(query.eq).toHaveBeenNthCalledWith(2, "id", "submission-1");
  });

  it("returns null for an inaccessible row and reports database failures", async () => {
    const missing = queryResult({ data: null, error: null });
    const failed = queryResult({ data: null, error: new Error("offline") });
    const missingService = createSubmissionLibraryService(
      Promise.resolve({ from: vi.fn().mockReturnValue(missing) } as unknown as SupabaseClient),
    );
    const failedService = createSubmissionLibraryService(
      Promise.resolve({ from: vi.fn().mockReturnValue(failed) } as unknown as SupabaseClient),
    );

    await expect(missingService.getById("user-1", "missing")).resolves.toBeNull();
    await expect(failedService.list("user-1")).rejects.toThrow(
      "Unable to load the problem library",
    );
  });
});
