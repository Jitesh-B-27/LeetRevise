import { describe, expect, it } from "vitest";
import { difficultySchema } from "./difficulty";
import { bulkSubmissionSchema, submissionSchema } from "./submission";

const validSubmission = {
  problemSlug: "two-sum",
  title: "Two Sum",
  difficulty: "Easy" as const,
  problemUrl: "https://leetcode.com/problems/two-sum/",
  problemDescription: "Return the indices of two numbers that add up to a target.",
  language: "typescript",
  code: "function twoSum() { return []; }",
  runtimeMs: 51,
  memoryMb: 42.7,
  submittedAt: "2026-08-30T14:15:22.000Z",
};

describe("difficultySchema", () => {
  it.each(["Easy", "Medium", "Hard"])("accepts %s", (difficulty) => {
    expect(difficultySchema.parse(difficulty)).toBe(difficulty);
  });

  it("rejects values outside the LeetCode difficulty set", () => {
    expect(difficultySchema.safeParse("medium").success).toBe(false);
  });
});

describe("submissionSchema", () => {
  it("accepts a complete LeetCode submission", () => {
    expect(submissionSchema.parse(validSubmission)).toEqual(validSubmission);
  });

  it("accepts a submission without optional performance measurements", () => {
    const submission = {
      problemSlug: validSubmission.problemSlug,
      title: validSubmission.title,
      difficulty: validSubmission.difficulty,
      problemUrl: validSubmission.problemUrl,
      problemDescription: validSubmission.problemDescription,
      language: validSubmission.language,
      code: validSubmission.code,
      submittedAt: validSubmission.submittedAt,
    };

    expect(submissionSchema.safeParse(submission).success).toBe(true);
  });

  it.each(["problemSlug", "title", "problemDescription", "language", "code"])(
    "rejects an empty required %s",
    (field) => {
      expect(
        submissionSchema.safeParse({ ...validSubmission, [field]: "   " }).success,
      ).toBe(false);
    },
  );

  it("rejects an invalid problem URL", () => {
    expect(
      submissionSchema.safeParse({
        ...validSubmission,
        problemUrl: "leetcode.com/problems/two-sum",
      }).success,
    ).toBe(false);
  });

  it.each([
    ["runtimeMs", -1],
    ["runtimeMs", 1.5],
    ["memoryMb", -0.1],
  ])("rejects invalid %s values", (field, value) => {
    expect(
      submissionSchema.safeParse({ ...validSubmission, [field]: value }).success,
    ).toBe(false);
  });

  it("rejects an invalid submission timestamp", () => {
    expect(
      submissionSchema.safeParse({
        ...validSubmission,
        submittedAt: "August 30, 2026",
      }).success,
    ).toBe(false);
  });
});

describe("bulkSubmissionSchema", () => {
  it("reuses the submission contract for complete-history imports", () => {
    const history = Array.from({ length: 250 }, (_, index) => ({
      ...validSubmission,
      problemSlug: `problem-${index}`,
    }));

    expect(
      bulkSubmissionSchema.parse({ submissions: history }).submissions,
    ).toHaveLength(250);
  });

  it("rejects the bulk payload when a submission is invalid", () => {
    expect(
      bulkSubmissionSchema.safeParse({
        submissions: [validSubmission, { ...validSubmission, code: "" }],
      }).success,
    ).toBe(false);
  });
});
