import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Submission } from "@/lib/domain/submission";
import { createPrivilegedSupabaseClient } from "@/lib/services/supabase/admin";

export type SubmissionPersistenceOutcome = "created" | "updated" | "skipped";

export interface SubmissionPersistenceService {
  persist(
    userId: string,
    submission: Submission,
  ): Promise<SubmissionPersistenceOutcome>;
}

function isPersistenceOutcome(
  value: unknown,
): value is SubmissionPersistenceOutcome {
  return value === "created" || value === "updated" || value === "skipped";
}

export function createSubmissionPersistenceService(
  supabase: SupabaseClient = createPrivilegedSupabaseClient(),
): SubmissionPersistenceService {
  return {
    async persist(userId, submission) {
      const { data, error } = await supabase.rpc("ingest_latest_submission", {
        p_user_id: userId,
        p_problem_slug: submission.problemSlug,
        p_title: submission.title,
        p_difficulty: submission.difficulty,
        p_problem_url: submission.problemUrl,
        p_problem_description: submission.problemDescription,
        p_language: submission.language,
        p_code: submission.code,
        p_runtime_ms: submission.runtimeMs ?? null,
        p_memory_mb: submission.memoryMb ?? null,
        p_submitted_at: submission.submittedAt,
      });

      if (error || !isPersistenceOutcome(data)) {
        throw new Error("Failed to persist submission", { cause: error });
      }

      return data;
    },
  };
}
