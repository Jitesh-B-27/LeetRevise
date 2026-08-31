import { z } from "zod";
import { difficultySchema } from "./difficulty";

const requiredStringSchema = z.string().trim().min(1);

export const submissionSchema = z.strictObject({
  problemSlug: requiredStringSchema,
  title: requiredStringSchema,
  difficulty: difficultySchema,
  problemUrl: z.url(),
  problemDescription: requiredStringSchema,
  language: requiredStringSchema,
  code: requiredStringSchema,
  runtimeMs: z.number().int().nonnegative().optional(),
  memoryMb: z.number().nonnegative().optional(),
  submittedAt: z.iso.datetime({ offset: true }),
});

export type Submission = z.infer<typeof submissionSchema>;

export const bulkSubmissionSchema = z.strictObject({
  submissions: z.array(submissionSchema),
});

export type BulkSubmission = z.infer<typeof bulkSubmissionSchema>;
