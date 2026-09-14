(function initializeHistoryHelpers(root) {
  "use strict";

  function valueFrom(object, keys) {
    for (const key of keys) {
      if (object?.[key] != null) return object[key];
    }
    return undefined;
  }

  function normalizeSummary(input) {
    const status = String(valueFrom(input, ["statusDisplay", "status_display", "status"]) ?? "");
    const submittedAt = root.LeetReviseLeetCode.normalizeTimestamp(
      valueFrom(input, ["submittedAt", "submitted_at", "timestamp"]),
    );
    const problemSlug = String(
      valueFrom(input, ["problemSlug", "titleSlug", "title_slug"]) ?? "",
    ).trim();
    const submissionId = String(valueFrom(input, ["submissionId", "id"]) ?? "").trim();

    return {
      submissionId,
      problemSlug,
      title: String(valueFrom(input, ["title", "questionTitle"]) ?? "").trim(),
      status,
      language: String(valueFrom(input, ["lang", "language"]) ?? "").trim(),
      submittedAt: submittedAt ?? "",
    };
  }

  function isAccepted(summary) {
    return /^(accepted|ac)$/i.test(summary.status);
  }

  function assertLinkedAccount(linkedUsername, activeUsername) {
    if (!linkedUsername) throw new Error("Link the intended LeetCode account first");
    if (!activeUsername) throw new Error("Sign in to the intended LeetCode account first");
    if (linkedUsername !== activeUsername) {
      throw new Error(
        `Linked to ${linkedUsername}, but LeetCode is signed in as ${activeUsername}`,
      );
    }
    return activeUsername;
  }

  function collapseLatestAccepted(items) {
    const latestByProblem = new Map();

    for (const item of items) {
      const summary = normalizeSummary(item);
      if (
        !isAccepted(summary) ||
        !summary.problemSlug ||
        !summary.submissionId ||
        !summary.submittedAt
      ) {
        continue;
      }

      const existing = latestByProblem.get(summary.problemSlug);
      if (
        !existing ||
        summary.submittedAt > existing.submittedAt ||
        (summary.submittedAt === existing.submittedAt &&
          summary.submissionId > existing.submissionId)
      ) {
        latestByProblem.set(summary.problemSlug, summary);
      }
    }

    return [...latestByProblem.values()].sort((left, right) =>
      left.problemSlug.localeCompare(right.problemSlug),
    );
  }

  function submissionFromDetail(summaryInput, detail, options) {
    const summary = normalizeSummary(summaryInput);
    const question = detail?.question;
    if (!detail || !question) throw new Error("Submission details are unavailable");
    const problemSlug = String(question.titleSlug || summary.problemSlug || "").trim();

    return root.LeetReviseLeetCode.buildSubmission({
      problemSlug,
      title: question.title || summary.title,
      difficulty: question.difficulty,
      problemUrl: new URL(`/problems/${problemSlug}/`, options.origin).toString(),
      problemDescription: options.problemDescription,
      language: detail.lang?.verboseName || detail.lang?.name || summary.language,
      code: detail.code,
      runtimeMs: root.LeetReviseLeetCode.parseRuntimeMs(
        detail.runtimeDisplay ?? detail.runtime,
      ),
      memoryMb: root.LeetReviseLeetCode.parseMemoryMb(
        detail.memoryDisplay ?? detail.memory,
      ),
      submittedAt:
        root.LeetReviseLeetCode.normalizeTimestamp(detail.timestamp) ||
        summary.submittedAt,
    });
  }

  function solvedProblemPage(data) {
    const list = data?.problemsetQuestionList;
    if (!list || !Array.isArray(list.questions)) {
      throw new Error("LeetCode solved-problem response format is unsupported");
    }
    return {
      total: Number(list.total ?? list.questions.length),
      problems: list.questions
        .filter((question) => question?.status === "ac" || question?.status === "AC")
        .map((question) => ({
          problemSlug: String(question.titleSlug ?? "").trim(),
          title: String(question.title ?? "").trim(),
        }))
        .filter((question) => question.problemSlug),
    };
  }

  function problemSubmissionPage(data) {
    const list = data?.questionSubmissionList;
    if (!list || !Array.isArray(list.submissions)) {
      throw new Error("LeetCode submission-list response format is unsupported");
    }
    return {
      submissions: list.submissions,
      hasNext: Boolean(list.hasNext),
      lastKey: String(list.lastKey ?? ""),
    };
  }

  function chunkItems(items, size) {
    if (!Number.isInteger(size) || size <= 0) {
      throw new Error("Chunk size must be a positive integer");
    }
    const chunks = [];
    for (let index = 0; index < items.length; index += size) {
      chunks.push(items.slice(index, index + size));
    }
    return chunks;
  }

  function emptyImportCounts() {
    return { created: 0, updated: 0, skipped: 0, invalid: 0 };
  }

  function addImportCounts(total, next) {
    return {
      created: total.created + Number(next.created ?? 0),
      updated: total.updated + Number(next.updated ?? 0),
      skipped: total.skipped + Number(next.skipped ?? 0),
      invalid: total.invalid + Number(next.invalid ?? 0),
    };
  }

  async function mapWithConcurrency(items, concurrency, mapper) {
    if (!Number.isInteger(concurrency) || concurrency <= 0) {
      throw new Error("Concurrency must be a positive integer");
    }

    const results = new Array(items.length);
    let nextIndex = 0;

    async function worker() {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await mapper(items[index], index);
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
    );
    return results;
  }

  root.LeetReviseHistory = Object.freeze({
    addImportCounts,
    assertLinkedAccount,
    chunkItems,
    collapseLatestAccepted,
    emptyImportCounts,
    isAccepted,
    mapWithConcurrency,
    normalizeSummary,
    problemSubmissionPage,
    solvedProblemPage,
    submissionFromDetail,
  });
})(globalThis);
