import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { Submission } from "@/lib/domain/submission";
import { createSubmissionPersistenceService } from "./submissions";

const submission: Submission = {
  problemSlug: "two-sum",
  title: "Two Sum",
  difficulty: "Easy",
  problemUrl: "https://leetcode.com/problems/two-sum/",
  problemDescription: "Find two numbers that add up to the target.",
  language: "typescript",
  code: "function twoSum() { return []; }",
  runtimeMs: 42,
  memoryMb: 51.5,
  submittedAt: "2026-09-05T08:30:00.000Z",
};

describe("submission persistence service", () => {
  it.each(["created", "updated", "skipped"] as const)(
    "returns the atomic database %s outcome",
    async (outcome) => {
      const rpc = vi.fn().mockResolvedValue({ data: outcome, error: null });
      const service = createSubmissionPersistenceService({
        rpc,
      } as unknown as SupabaseClient);

      await expect(service.persist("verified-user", submission)).resolves.toBe(
        outcome,
      );
      expect(rpc).toHaveBeenCalledWith("ingest_latest_submission", {
        p_user_id: "verified-user",
        p_problem_slug: "two-sum",
        p_title: "Two Sum",
        p_difficulty: "Easy",
        p_problem_url: "https://leetcode.com/problems/two-sum/",
        p_problem_description: "Find two numbers that add up to the target.",
        p_language: "typescript",
        p_code: "function twoSum() { return []; }",
        p_runtime_ms: 42,
        p_memory_mb: 51.5,
        p_submitted_at: "2026-09-05T08:30:00.000Z",
      });
    },
  );

  it("maps missing performance measurements to database nulls", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "created", error: null });
    const service = createSubmissionPersistenceService({
      rpc,
    } as unknown as SupabaseClient);

    await service.persist("verified-user", {
      ...submission,
      runtimeMs: undefined,
      memoryMb: undefined,
    });

    expect(rpc).toHaveBeenCalledWith(
      "ingest_latest_submission",
      expect.objectContaining({ p_runtime_ms: null, p_memory_mb: null }),
    );
  });

  it("rejects database errors and unexpected outcomes", async () => {
    const databaseError = createSubmissionPersistenceService({
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: new Error("database unavailable"),
      }),
    } as unknown as SupabaseClient);
    const unexpectedOutcome = createSubmissionPersistenceService({
      rpc: vi.fn().mockResolvedValue({ data: "replaced", error: null }),
    } as unknown as SupabaseClient);

    await expect(
      databaseError.persist("verified-user", submission),
    ).rejects.toThrow("Failed to persist submission");
    await expect(
      unexpectedOutcome.persist("verified-user", submission),
    ).rejects.toThrow("Failed to persist submission");
  });
});
