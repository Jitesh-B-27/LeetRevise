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
})();
