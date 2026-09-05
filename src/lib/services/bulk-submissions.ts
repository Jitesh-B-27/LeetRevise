import "server-only";

import { submissionSchema, type Submission } from "@/lib/domain/submission";
import type {
  SubmissionPersistenceOutcome,
  SubmissionPersistenceService,
} from "@/lib/services/submissions";

export interface BulkSubmissionResult {
  created: number;
  updated: number;
  skipped: number;
  invalid: number;
}

interface NormalizedBulkSubmissions {
  submissions: Submission[];
  invalid: number;
  duplicatesCollapsed: number;
}

export function normalizeBulkSubmissions(
  entries: unknown[],
): NormalizedBulkSubmissions {
  const newestByProblem = new Map<string, Submission>();
  let invalid = 0;
  let duplicatesCollapsed = 0;

  for (const entry of entries) {
    const parsed = submissionSchema.safeParse(entry);

    if (!parsed.success) {
      invalid += 1;
      continue;
    }

    const current = newestByProblem.get(parsed.data.problemSlug);

    if (!current) {
      newestByProblem.set(parsed.data.problemSlug, parsed.data);
      continue;
    }

    duplicatesCollapsed += 1;

    if (Date.parse(parsed.data.submittedAt) > Date.parse(current.submittedAt)) {
      newestByProblem.set(parsed.data.problemSlug, parsed.data);
    }
  }

  return {
    submissions: [...newestByProblem.values()],
    invalid,
    duplicatesCollapsed,
  };
}

export async function ingestBulkSubmissions(
  userId: string,
  entries: unknown[],
  persistence: SubmissionPersistenceService,
): Promise<BulkSubmissionResult> {
  const normalized = normalizeBulkSubmissions(entries);
  const result: BulkSubmissionResult = {
    created: 0,
    updated: 0,
    skipped: normalized.duplicatesCollapsed,
    invalid: normalized.invalid,
  };

  for (const submission of normalized.submissions) {
    const outcome: SubmissionPersistenceOutcome = await persistence.persist(
      userId,
      submission,
    );
    result[outcome] += 1;
  }

  return result;
}
