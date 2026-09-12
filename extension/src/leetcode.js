(function initializeLeetCodeHelpers(root) {
  "use strict";

  const difficulties = new Set(["Easy", "Medium", "Hard"]);
  const tokenPattern = /^lr_ingest_[A-Za-z0-9_-]{43}$/;

  function nonEmptyString(value) {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  }

  function normalizeBackendUrl(value) {
    const rawValue = nonEmptyString(value);
    if (!rawValue) {
      throw new Error("Backend URL is required");
    }

    let url;
    try {
      url = new URL(rawValue);
    } catch {
      throw new Error("Backend URL must be a valid URL");
    }

    const isLocalHttp =
      url.protocol === "http:" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1");

    if (url.protocol !== "https:" && !isLocalHttp) {
      throw new Error("Use HTTPS, or HTTP only for localhost development");
    }

    if (url.username || url.password || url.search || url.hash) {
      throw new Error("Backend URL must not contain credentials, a query, or a hash");
    }

    if (url.pathname !== "/") {
      throw new Error("Backend URL must be an origin without a path");
    }

    return url.origin;
  }

  function validateToken(value) {
    const token = nonEmptyString(value);
    if (!token || !tokenPattern.test(token)) {
      throw new Error("Enter a valid lr_ingest_ token");
    }
    return token;
  }

  function problemSlugFromUrl(value) {
    try {
      const url = new URL(value);
      const match = /^\/problems\/([^/]+)/.exec(url.pathname);
      return match?.[1] ? decodeURIComponent(match[1]) : "";
    } catch {
      return "";
    }
  }

  function parseRuntimeMs(value) {
    if (typeof value === "number") {
      return Number.isInteger(value) && value >= 0 ? value : undefined;
    }

    const match = /([0-9]+(?:\.[0-9]+)?)\s*(ms|s)?\b/i.exec(String(value ?? ""));
    if (!match) return undefined;
    const amount = Number(match[1]);
    const milliseconds = match[2]?.toLowerCase() === "s" ? amount * 1000 : amount;
    return Number.isInteger(milliseconds) && milliseconds >= 0
      ? milliseconds
      : undefined;
  }

  function parseMemoryMb(value) {
    if (typeof value === "number") {
      return Number.isFinite(value) && value >= 0 ? value : undefined;
    }

    const match = /([0-9]+(?:\.[0-9]+)?)\s*(kb|mb|gb)?\b/i.exec(String(value ?? ""));
    if (!match) return undefined;
    const amount = Number(match[1]);
    const unit = match[2]?.toLowerCase() ?? "mb";
    const megabytes = unit === "gb" ? amount * 1024 : unit === "kb" ? amount / 1024 : amount;
    return Number.isFinite(megabytes) && megabytes >= 0 ? megabytes : undefined;
  }

  function normalizeTimestamp(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
      const milliseconds = value < 10_000_000_000 ? value * 1000 : value;
      return new Date(milliseconds).toISOString();
    }

    const text = nonEmptyString(value);
    if (!text) return undefined;
    const milliseconds = Date.parse(text);
    return Number.isNaN(milliseconds) ? undefined : new Date(milliseconds).toISOString();
  }

  function readFirstText(documentValue, selectors) {
    for (const selector of selectors) {
      const element = documentValue.querySelector(selector);
      const text = nonEmptyString(element?.textContent);
      if (text) return text;
    }
    return "";
  }

  function extractPageDraft(documentValue, pageUrl) {
    const titleMeta = documentValue.querySelector('meta[property="og:title"]')?.content;
    const rawTitle =
      nonEmptyString(titleMeta) ??
      readFirstText(documentValue, [
        '[data-cy="question-title"]',
        'a[href^="/problems/"]',
        "h1",
      ]);
    const title = rawTitle.replace(/\s*[-|]\s*LeetCode.*$/i, "").trim();

    let difficulty = "";
    const difficultyElement = documentValue.querySelector("[data-difficulty]");
    const difficultyAttribute = nonEmptyString(difficultyElement?.getAttribute("data-difficulty"));
    if (difficultyAttribute && difficulties.has(difficultyAttribute)) {
      difficulty = difficultyAttribute;
    } else {
      const candidates = documentValue.querySelectorAll(
        '[class*="text-difficulty-"], [class*="difficulty"]',
      );
      for (const candidate of candidates) {
        const text = nonEmptyString(candidate.textContent);
        if (text && difficulties.has(text)) {
          difficulty = text;
          break;
        }
      }
    }

    const problemDescription = readFirstText(documentValue, [
      '[data-track-load="description_content"]',
      '[data-cy="question-content"]',
      'article[data-problem-description]',
    ]);

    const editor = documentValue.querySelector(
      '.monaco-editor textarea, textarea[data-mode-id], textarea[aria-label*="Editor"]',
    );
    const language = readFirstText(documentValue, [
      '[data-cy="lang-select"]',
      'button[id*="headlessui-listbox-button"]',
      '[aria-label*="language" i]',
    ]);

    return {
      problemSlug: problemSlugFromUrl(pageUrl),
      title,
      difficulty,
      problemUrl: pageUrl,
      problemDescription,
      language,
      code: typeof editor?.value === "string" ? editor.value : "",
      runtimeMs: undefined,
      memoryMb: undefined,
      submittedAt: "",
    };
  }

  function findAcceptedResult(value, depth = 0) {
    if (!value || typeof value !== "object" || depth > 5) return undefined;

    const statusCode = value.status_code ?? value.statusCode;
    const statusText = value.status_msg ?? value.statusMessage ?? value.status;
    if (statusCode === 10 || statusText === "Accepted") return value;

    for (const child of Object.values(value)) {
      const accepted = findAcceptedResult(child, depth + 1);
      if (accepted) return accepted;
    }
    return undefined;
  }

  function submissionRequestDetails(urlValue, bodyValue) {
    const url = String(urlValue ?? "");
    const body = typeof bodyValue === "string" ? bodyValue : "";
    const isSubmission =
      /\/submit\/?(?:\?|$)/i.test(url) ||
      /"operationName"\s*:\s*"(?:submit|submitCode)[^"]*"/i.test(body);
    if (!isSubmission) return undefined;

    try {
      const parsed = JSON.parse(body);
      const variables = parsed.variables ?? parsed;
      return {
        code: nonEmptyString(variables.typed_code ?? variables.typedCode ?? variables.code) ?? "",
        language: nonEmptyString(variables.lang ?? variables.language) ?? "",
      };
    } catch {
      return { code: "", language: "" };
    }
  }

  function acceptedResultDetails(value) {
    const result = findAcceptedResult(value);
    if (!result) return undefined;

    return {
      language:
        nonEmptyString(result.lang) ??
        nonEmptyString(result.pretty_lang) ??
        nonEmptyString(result.language) ??
        "",
      runtimeMs: parseRuntimeMs(result.status_runtime ?? result.runtime),
      memoryMb: parseMemoryMb(result.status_memory ?? result.memory),
      submittedAt:
        normalizeTimestamp(
          result.submitted_at ?? result.submittedAt ?? result.submit_time ?? result.timestamp,
        ) ?? "",
    };
  }

  function buildSubmission(input) {
    const requiredFields = [
      "problemSlug",
      "title",
      "problemUrl",
      "problemDescription",
      "language",
      "code",
    ];
    const submission = {};

    for (const field of requiredFields) {
      const value = nonEmptyString(input?.[field]);
      if (!value) throw new Error(`${field} is required`);
      submission[field] = value;
    }

    try {
      new URL(submission.problemUrl);
    } catch {
      throw new Error("problemUrl must be a valid URL");
    }

    if (!difficulties.has(input?.difficulty)) {
      throw new Error("difficulty must be Easy, Medium, or Hard");
    }
    submission.difficulty = input.difficulty;

    const submittedAt = normalizeTimestamp(input?.submittedAt);
    if (!submittedAt) throw new Error("submittedAt must be a valid timestamp");
    submission.submittedAt = submittedAt;

    if (input?.runtimeMs !== "" && input?.runtimeMs != null) {
      const runtimeMs = Number(input.runtimeMs);
      if (!Number.isInteger(runtimeMs) || runtimeMs < 0) {
        throw new Error("runtimeMs must be a non-negative integer");
      }
      submission.runtimeMs = runtimeMs;
    }

    if (input?.memoryMb !== "" && input?.memoryMb != null) {
      const memoryMb = Number(input.memoryMb);
      if (!Number.isFinite(memoryMb) || memoryMb < 0) {
        throw new Error("memoryMb must be a non-negative number");
      }
      submission.memoryMb = memoryMb;
    }

    return submission;
  }

  root.LeetReviseLeetCode = Object.freeze({
    acceptedResultDetails,
    buildSubmission,
    extractPageDraft,
    findAcceptedResult,
    normalizeBackendUrl,
    normalizeTimestamp,
    parseMemoryMb,
    parseRuntimeMs,
    problemSlugFromUrl,
    submissionRequestDetails,
    validateToken,
  });
})(globalThis);
