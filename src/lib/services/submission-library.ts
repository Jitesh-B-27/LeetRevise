import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Difficulty } from "@/lib/domain/difficulty";
import { createSupabaseServerClient } from "@/lib/services/supabase/server";

export interface LibrarySubmissionSummary {
  id: string;
  problemSlug: string;
  title: string;
  difficulty: Difficulty;
  language: string;
  runtimeMs: number | null;
  memoryMb: number | null;
  submittedAt: string;
}

export interface LibrarySubmission extends LibrarySubmissionSummary {
  problemUrl: string;
  problemDescription: string;
  code: string;
}

interface SubmissionRow {
  id: string;
  problem_slug: string;
  title: string;
  difficulty: Difficulty;
  problem_url?: string;
  problem_description?: string;
  language: string;
  code?: string;
  runtime_ms: number | null;
  memory_mb: number | string | null;
  submitted_at: string;
}

const summaryColumns =
  "id, problem_slug, title, difficulty, language, runtime_ms, memory_mb, submitted_at";
const detailColumns = `${summaryColumns}, problem_url, problem_description, code`;

function summaryFromRow(row: SubmissionRow): LibrarySubmissionSummary {
  return {
    id: row.id,
    problemSlug: row.problem_slug,
    title: row.title,
    difficulty: row.difficulty,
    language: row.language,
    runtimeMs: row.runtime_ms,
    memoryMb: row.memory_mb == null ? null : Number(row.memory_mb),
    submittedAt: row.submitted_at,
  };
}

function detailFromRow(row: SubmissionRow): LibrarySubmission {
  return {
    ...summaryFromRow(row),
    problemUrl: row.problem_url ?? "",
    problemDescription: row.problem_description ?? "",
    code: row.code ?? "",
  };
}

export function createSubmissionLibraryService(
  supabasePromise: Promise<SupabaseClient> = createSupabaseServerClient(),
) {
  return {
    async list(userId: string): Promise<LibrarySubmissionSummary[]> {
      const supabase = await supabasePromise;
      const { data, error } = await supabase
        .from("user_submissions")
        .select(summaryColumns)
        .eq("user_id", userId)
        .order("submitted_at", { ascending: false });

      if (error) throw new Error("Unable to load the problem library", { cause: error });
      return ((data ?? []) as SubmissionRow[]).map(summaryFromRow);
    },

    async getById(userId: string, submissionId: string): Promise<LibrarySubmission | null> {
      const supabase = await supabasePromise;
      const { data, error } = await supabase
        .from("user_submissions")
        .select(detailColumns)
        .eq("user_id", userId)
        .eq("id", submissionId)
        .maybeSingle();

      if (error) throw new Error("Unable to load the saved submission", { cause: error });
      return data ? detailFromRow(data as SubmissionRow) : null;
    },
  };
}
