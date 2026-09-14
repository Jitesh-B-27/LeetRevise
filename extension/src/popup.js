/* global chrome */
(function initializePopup() {
  "use strict";

  const helpers = globalThis.LeetReviseLeetCode;
  const byId = (id) => document.getElementById(id);
  const fieldIds = [
    "problem-slug",
    "title",
    "difficulty",
    "problem-url",
    "problem-description",
    "language",
    "code",
    "runtime-ms",
    "memory-mb",
  ];

  function setStatus(element, message, kind = "") {
    element.textContent = message;
    element.className = `status ${kind}`.trim();
  }

  async function sendMessage(message) {
    const response = await chrome.runtime.sendMessage(message);
    if (!response?.ok) throw new Error(response?.error ?? "Extension request failed");
    return response;
  }

  function toLocalDateTime(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 19);
  }

  function populateDraft(draft) {
    for (const id of fieldIds) {
      const key = id.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      if (draft?.[key] != null) byId(id).value = String(draft[key]);
    }
    byId("submitted-at").value = toLocalDateTime(draft?.submittedAt);
  }

  function readSubmissionForm() {
    return {
      problemSlug: byId("problem-slug").value,
      title: byId("title").value,
      difficulty: byId("difficulty").value,
      problemUrl: byId("problem-url").value,
      problemDescription: byId("problem-description").value,
      language: byId("language").value,
      code: byId("code").value,
      runtimeMs: byId("runtime-ms").value,
      memoryMb: byId("memory-mb").value,
      submittedAt: byId("submitted-at").value,
    };
  }

  function renderSummary(rows) {
    const summary = byId("history-summary");
    summary.replaceChildren();
    for (const [label, value] of rows) {
      const row = document.createElement("div");
      row.className = "summary-row";
      const name = document.createElement("span");
      name.textContent = label;
      const count = document.createElement("strong");
      count.textContent = String(value);
      row.append(name, count);
      summary.append(row);
    }
    summary.hidden = rows.length === 0;
  }

  function renderHistory(state) {
    const historyState = state.historyImport ?? { status: "idle" };
    const linked = state.linkedLeetCodeUsername;
    byId("linked-account").textContent = linked
      ? `Linked LeetCode account: ${linked}`
      : "No LeetCode account linked.";

    const busy = historyState.status === "scanning" || historyState.status === "uploading";
    byId("link-account").disabled = busy;
    byId("scan-history").disabled = historyState.status === "uploading" || !linked;
    byId("scan-history").textContent =
      historyState.status === "scanning" ? "Restart history scan" : "Scan accepted history";
    const importButton = byId("import-history");
    importButton.hidden = !["ready", "upload-error"].includes(historyState.status);
    importButton.textContent =
      historyState.status === "upload-error" ? "Retry remaining" : "Import problems";

    const progress = historyState.progress;
    if (historyState.status === "scanning" && progress?.phase === "scanning") {
      byId("history-progress").textContent =
        `Scanning history: page ${progress.pageNumber}, ${progress.scanned} entries`;
    } else if (historyState.status === "scanning" && progress?.phase === "details") {
      byId("history-progress").textContent =
        `Loading latest accepted solutions: ${progress.completed} of ${progress.total}`;
    } else if (historyState.status === "uploading") {
      byId("history-progress").textContent =
        `Importing: ${historyState.upload?.processed ?? 0} of ${historyState.upload?.total ?? 0}`;
    } else {
      byId("history-progress").textContent = "";
    }

    const rows = [];
    if (historyState.summary) {
      rows.push(
        ["History entries scanned", historyState.summary.scanned],
        ["Unique accepted problems", historyState.summary.uniqueAccepted],
        ["Ready to import", historyState.summary.ready],
        ["Unavailable", historyState.summary.unavailable],
      );
    }
    if (historyState.status === "complete" || historyState.status === "upload-error") {
      const counts = historyState.upload?.counts;
      rows.push(
        ["Created", counts?.created ?? 0],
        ["Updated", counts?.updated ?? 0],
        ["Skipped", counts?.skipped ?? 0],
        ["Invalid", counts?.invalid ?? 0],
      );
    }
    renderSummary(rows);

    if (historyState.status === "ready") {
      const unavailableReason = historyState.summary?.firstUnavailableReason;
      const message =
        unavailableReason
          ? `${historyState.summary?.ready === 0 ? "Nothing is ready." : "Some problems are unavailable."} First failure: ${unavailableReason}`
          : "Review the summary, then start the import.";
      setStatus(
        byId("history-status"),
        message,
        unavailableReason ? "error" : "success",
      );
    } else if (historyState.status === "complete") {
      setStatus(byId("history-status"), "History import complete.", "success");
    } else if (historyState.status === "error" || historyState.status === "upload-error") {
      setStatus(byId("history-status"), historyState.error ?? "History import failed", "error");
    } else if (busy) {
      setStatus(byId("history-status"), "Keep this popup open while this step runs.");
    } else {
      setStatus(byId("history-status"), "");
    }
  }

  async function refreshState() {
    const { state } = await sendMessage({ type: "get-state" });
    renderHistory(state);
    return state;
  }

  async function requestBackendPermission(backendUrl) {
    const originPattern = `${new URL(helpers.normalizeBackendUrl(backendUrl)).origin}/*`;
    const granted = await chrome.permissions.request({ origins: [originPattern] });
    if (!granted) throw new Error("Backend permission was not granted");
  }

  byId("setup-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.submitter;
    const status = byId("connection-status");
    button.disabled = true;
    setStatus(status, "Verifying…");
    try {
      const backendUrl = helpers.normalizeBackendUrl(byId("backend-url").value);
      await requestBackendPermission(backendUrl);
      await sendMessage({ type: "configure", backendUrl, token: byId("token").value });
      byId("token").value = "";
      byId("token").placeholder = "Saved token (leave blank to keep it)";
      setStatus(status, "Connected", "success");
    } catch (error) {
      setStatus(status, error.message, "error");
    } finally {
      button.disabled = false;
    }
  });

  byId("extract").addEventListener("click", async () => {
    const button = byId("extract");
    const status = byId("submission-status");
    button.disabled = true;
    setStatus(status, "Reading the current LeetCode page…");
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id || !tab.url?.includes("leetcode.com/")) {
        throw new Error("Open a LeetCode problem page before capturing");
      }
      const response = await chrome.tabs.sendMessage(tab.id, { type: "collect-page" });
      if (!response?.ok) throw new Error("Unable to read this LeetCode page");
      populateDraft(response.draft);
      setStatus(status, "Page data loaded. Complete any missing fields and review it.", "success");
    } catch (error) {
      setStatus(status, error.message, "error");
    } finally {
      button.disabled = false;
    }
  });

  byId("link-account").addEventListener("click", async () => {
    const button = byId("link-account");
    button.disabled = true;
    setStatus(byId("history-status"), "Detecting the current LeetCode account…");
    try {
      const response = await sendMessage({ type: "link-leetcode-account" });
      setStatus(
        byId("history-status"),
        `Linked to ${response.username}.`,
        "success",
      );
      await refreshState();
    } catch (error) {
      setStatus(byId("history-status"), error.message, "error");
    } finally {
      button.disabled = false;
    }
  });

  byId("scan-history").addEventListener("click", async () => {
    const button = byId("scan-history");
    button.disabled = true;
    setStatus(byId("history-status"), "Starting history scan…");
    try {
      await sendMessage({ type: "start-history-scan" });
      await refreshState();
    } catch (error) {
      setStatus(byId("history-status"), error.message, "error");
      button.disabled = false;
    }
  });

  byId("import-history").addEventListener("click", async () => {
    const button = byId("import-history");
    button.disabled = true;
    setStatus(byId("history-status"), "Importing accepted history…");
    try {
      await sendMessage({ type: "import-history" });
      await refreshState();
    } catch (error) {
      setStatus(byId("history-status"), error.message, "error");
      await refreshState().catch(() => undefined);
    } finally {
      button.disabled = false;
    }
  });

  byId("submission-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.submitter;
    const status = byId("submission-status");
    button.disabled = true;
    setStatus(status, "Saving…");
    try {
      const submission = helpers.buildSubmission(readSubmissionForm());
      const response = await sendMessage({ type: "submit", submission });
      setStatus(status, `Submission ${response.result.status}.`, "success");
    } catch (error) {
      setStatus(status, error.message, "error");
    } finally {
      button.disabled = false;
    }
  });

  void sendMessage({ type: "get-state" })
    .then(({ state }) => {
      byId("backend-url").value = state.backendUrl;
      renderHistory(state);
      if (state.tokenConfigured) {
        byId("token").placeholder = "Saved token (leave blank to keep it)";
        setStatus(byId("connection-status"), "Configuration saved", "success");
      }
      if (state.pendingDraft) {
        populateDraft(state.pendingDraft);
        setStatus(
          byId("submission-status"),
          "Accepted submission detected. Review it before saving.",
          "success",
        );
      }
    })
    .catch((error) => setStatus(byId("connection-status"), error.message, "error"));

  globalThis.setInterval(() => {
    void refreshState().catch(() => undefined);
  }, 750);
})();
