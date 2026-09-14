(function observeLeetCodeSubmissions() {
  "use strict";

  const helpers = globalThis.LeetReviseLeetCode;
  const historyHelpers = globalThis.LeetReviseHistory;
  const nativeFetch = globalThis.fetch;
  const nativeOpen = XMLHttpRequest.prototype.open;
  const nativeSend = XMLHttpRequest.prototype.send;
  let pendingSubmission;
  let lastAcceptedAt = 0;
  const historyPageSize = 100;
  const detailConcurrency = 4;
  const historyEventChunkSize = 25;
  const detailRequestIntervalMs = 600;
  let nextDetailRequestAt = 0;

  const accountQuery = `
    query globalData {
      userStatus {
        isSignedIn
        username
      }
    }
  `;

  const submissionDetailsQuery = `
    query submissionImportDetails($submissionId: Int!, $titleSlug: String!) {
      submissionDetails(submissionId: $submissionId) {
        runtime
        runtimeDisplay
        memory
        memoryDisplay
        code
        timestamp
        lang {
          name
          verboseName
        }
        question {
          titleSlug
        }
      }
      question(titleSlug: $titleSlug) {
        title
        titleSlug
        content
        difficulty
      }
    }
  `;

  const solvedProblemsQuery = `
    query problemsetQuestionList(
      $categorySlug: String
      $limit: Int
      $skip: Int
      $filters: QuestionListFilterInput
    ) {
      problemsetQuestionList: questionList(
        categorySlug: $categorySlug
        limit: $limit
        skip: $skip
        filters: $filters
      ) {
        total: totalNum
        questions: data {
          title
          titleSlug
          difficulty
          status
        }
      }
    }
  `;

  const problemSubmissionsQuery = `
    query submissionList(
      $offset: Int!
      $limit: Int!
      $lastKey: String
      $questionSlug: String!
      $status: Int
    ) {
      questionSubmissionList(
        offset: $offset
        limit: $limit
        lastKey: $lastKey
        questionSlug: $questionSlug
        status: $status
      ) {
        lastKey
        hasNext
        submissions {
          id
          title
          titleSlug
          statusDisplay
          lang
          timestamp
        }
      }
    }
  `;

  function currentEditorCode() {
    try {
      const models = globalThis.monaco?.editor?.getModels?.();
      return models?.[0]?.getValue?.() ?? "";
    } catch {
      return "";
    }
  }

  function rememberSubmission(url, body) {
    const details = helpers.submissionRequestDetails(url, body);
    if (!details) return;
    pendingSubmission = {
      ...details,
      code: details.code || currentEditorCode(),
      submittedAt: new Date().toISOString(),
    };
  }

  function publishAccepted(value) {
    const accepted = helpers.acceptedResultDetails(value);
    if (!accepted || Date.now() - lastAcceptedAt < 2_000) return;
    lastAcceptedAt = Date.now();

    globalThis.postMessage(
      {
        source: "leet-revise-page",
        type: "accepted-submission",
        payload: {
          ...accepted,
          code: pendingSubmission?.code || currentEditorCode(),
          language: accepted.language || pendingSubmission?.language || "",
          submittedAt: accepted.submittedAt || pendingSubmission?.submittedAt || "",
        },
      },
      globalThis.location.origin,
    );
    pendingSubmission = undefined;
  }

  function publishHistoryEvent(requestId, type, payload = {}) {
    globalThis.postMessage(
      {
        source: "leet-revise-page",
        type,
        requestId,
        ...payload,
      },
      globalThis.location.origin,
    );
  }

  function cookieValue(name) {
    const prefix = `${encodeURIComponent(name)}=`;
    const entry = document.cookie.split("; ").find((part) => part.startsWith(prefix));
    return entry ? decodeURIComponent(entry.slice(prefix.length)) : "";
  }

  async function queryLeetCode(query, variables = {}) {
    const csrfToken = cookieValue("csrftoken");
    const response = await nativeFetch.call(globalThis, "/graphql/", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(csrfToken ? { "x-csrftoken": csrfToken } : {}),
      },
      body: JSON.stringify({ query, variables }),
    });
    const responseText = await response.text();
    let payload;
    try {
      payload = JSON.parse(responseText);
    } catch {
      payload = undefined;
    }
    if (!response.ok) {
      const message = payload?.errors?.[0]?.message;
      throw new Error(message || `LeetCode request failed (${response.status})`);
    }
    if (!payload) throw new Error("LeetCode returned an unreadable response");
    if (payload.errors?.length) {
      throw new Error(payload.errors[0]?.message ?? "LeetCode returned a GraphQL error");
    }
    return payload.data;
  }

  async function currentLeetCodeUsername() {
    const data = await queryLeetCode(accountQuery);
    const userStatus = data?.userStatus;
    if (!userStatus?.isSignedIn || !userStatus.username) {
      throw new Error("Sign in to the intended LeetCode account first");
    }
    return String(userStatus.username);
  }

  async function fetchSolvedProblemPage(skip) {
    const data = await queryLeetCode(solvedProblemsQuery, {
      categorySlug: "",
      limit: historyPageSize,
      skip,
      filters: { status: "AC" },
    });
    return historyHelpers.solvedProblemPage(data);
  }

  async function fetchProblemSubmissionHistory(problemSlug) {
    const data = await queryLeetCode(problemSubmissionsQuery, {
      offset: 0,
      limit: 1,
      lastKey: null,
      questionSlug: problemSlug,
      status: 10,
    });
    return historyHelpers.problemSubmissionPage(data).submissions;
  }

  function descriptionText(html) {
    if (typeof html !== "string" || !html.trim()) return "";
    const parsed = new DOMParser().parseFromString(html, "text/html");
    return parsed.body.textContent?.replace(/\s+/g, " ").trim() ?? "";
  }

  async function withRetries(operation, delays = [300]) {
    let lastError;
    for (let attempt = 0; attempt <= delays.length; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (attempt < delays.length) {
          await new Promise((resolve) => globalThis.setTimeout(resolve, delays[attempt]));
        }
      }
    }
    throw lastError;
  }

  async function waitForDetailRequestSlot() {
    const scheduledAt = Math.max(Date.now(), nextDetailRequestAt);
    nextDetailRequestAt = scheduledAt + detailRequestIntervalMs;
    const waitMs = scheduledAt - Date.now();
    if (waitMs > 0) {
      await new Promise((resolve) => globalThis.setTimeout(resolve, waitMs));
    }
  }

  async function fetchSubmissionDetail(summary) {
    const numericId = Number(summary.submissionId);
    if (!Number.isSafeInteger(numericId)) throw new Error("Invalid submission identifier");
    const data = await withRetries(async () => {
      await waitForDetailRequestSlot();
      const response = await queryLeetCode(submissionDetailsQuery, {
        submissionId: numericId,
        titleSlug: summary.problemSlug,
      });
      if (typeof response?.submissionDetails?.code !== "string" || !response.submissionDetails.code.trim()) {
        throw new Error("LeetCode temporarily returned no submission code");
      }
      return response;
    }, [2_000, 5_000]);
    const detail = data?.submissionDetails;
    return historyHelpers.submissionFromDetail(summary, { ...detail, question: data?.question }, {
      origin: globalThis.location.origin,
      problemDescription: descriptionText(data?.question?.content),
    });
  }

  async function scanHistory(requestId) {
    const username = await currentLeetCodeUsername();
    const solvedBySlug = new Map();
    let skip = 0;
    let pageNumber = 0;

    while (true) {
      const page = await fetchSolvedProblemPage(skip);
      pageNumber += 1;
      for (const problem of page.problems) solvedBySlug.set(problem.problemSlug, problem);
      publishHistoryEvent(requestId, "history-progress", {
        progress: {
          phase: "scanning",
          pageNumber,
          scanned: solvedBySlug.size,
        },
      });

      skip += page.problems.length;
      if (page.problems.length === 0 || skip >= page.total) break;
    }

    const solvedProblems = [...solvedBySlug.values()];
    let unavailable = 0;
    let firstUnavailableReason = "";
    let completed = 0;
    let inspectedSubmissions = 0;
    const collected = await historyHelpers.mapWithConcurrency(
      solvedProblems,
      detailConcurrency,
      async (problem) => {
        try {
          const submissions = await withRetries(() =>
            fetchProblemSubmissionHistory(problem.problemSlug),
          );
          inspectedSubmissions += submissions.length;
          const summary = historyHelpers.collapseLatestAccepted(submissions)[0];
          if (!summary) throw new Error("No accepted submission details were found");
          summary.title ||= problem.title;
          return { submission: await fetchSubmissionDetail(summary) };
        } catch (error) {
          const reason = error instanceof Error ? error.message : "Unable to collect submission";
          firstUnavailableReason ||= `${problem.problemSlug}: ${reason}`;
          return {
            unavailable: {
              problemSlug: problem.problemSlug,
              reason,
            },
          };
        } finally {
          completed += 1;
          publishHistoryEvent(requestId, "history-progress", {
            progress: {
              phase: "details",
              completed,
              total: solvedProblems.length,
              scanned: inspectedSubmissions,
            },
          });
        }
      },
    );

    const ready = [];
    for (const result of collected) {
      if (result.submission) ready.push(result.submission);
      else unavailable += 1;
    }

    for (const items of historyHelpers.chunkItems(ready, historyEventChunkSize)) {
      publishHistoryEvent(requestId, "history-items", { items });
    }

    publishHistoryEvent(requestId, "history-complete", {
      summary: {
        username,
        scanned: inspectedSubmissions,
        uniqueAccepted: solvedProblems.length,
        ready: ready.length,
        unavailable,
        firstUnavailableReason: unavailable ? firstUnavailableReason : undefined,
      },
    });
  }

  globalThis.fetch = async function leetReviseObservedFetch(...args) {
    const request = args[0];
    const options = args[1];
    const url = typeof request === "string" ? request : request?.url;
    rememberSubmission(url, options?.body);

    const response = await nativeFetch.apply(this, args);
    const responseUrl = response.url || String(url ?? "");
    if (/\/check\/?(?:\?|$)/i.test(responseUrl)) {
      void response
        .clone()
        .json()
        .then(publishAccepted)
        .catch(() => undefined);
    }
    return response;
  };

  XMLHttpRequest.prototype.open = function leetReviseObservedOpen(method, url, ...rest) {
    this.__leetReviseUrl = String(url);
    return nativeOpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function leetReviseObservedSend(body) {
    rememberSubmission(this.__leetReviseUrl, body);
    if (/\/check\/?(?:\?|$)/i.test(this.__leetReviseUrl ?? "")) {
      this.addEventListener("load", () => {
        try {
          publishAccepted(JSON.parse(this.responseText));
        } catch {
          // Non-JSON responses are unrelated to accepted-submission capture.
        }
      });
    }
    return nativeSend.call(this, body);
  };

  globalThis.addEventListener("message", (event) => {
    if (
      event.source !== globalThis ||
      event.origin !== globalThis.location.origin ||
      event.data?.source !== "leet-revise-extension"
    ) {
      return;
    }

    const requestId = event.data.requestId;
    if (typeof requestId !== "string") return;

    if (event.data.type === "detect-account") {
      void currentLeetCodeUsername()
        .then((username) =>
          publishHistoryEvent(requestId, "account-result", { username }),
        )
        .catch((error) =>
          publishHistoryEvent(requestId, "account-error", {
            error: error instanceof Error ? error.message : "Unable to detect LeetCode account",
          }),
        );
    }

    if (event.data.type === "scan-history") {
      void scanHistory(requestId).catch((error) =>
        publishHistoryEvent(requestId, "history-error", {
          error: error instanceof Error ? error.message : "Unable to scan LeetCode history",
        }),
      );
    }
  });
})();
