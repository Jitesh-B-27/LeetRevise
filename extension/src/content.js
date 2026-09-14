/* global chrome */
(function connectLeetCodePage() {
  "use strict";

  const helpers = globalThis.LeetReviseLeetCode;
  const accountRequests = new Map();
  let historyForwardQueue = Promise.resolve();

  function collectDraft(extra = {}) {
    return {
      ...helpers.extractPageDraft(document, globalThis.location.href),
      ...extra,
    };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "collect-page") {
      sendResponse({ ok: true, draft: collectDraft() });
      return false;
    }

    if (message?.type === "detect-account") {
      const requestId = crypto.randomUUID();
      accountRequests.set(requestId, sendResponse);
      globalThis.postMessage(
        { source: "leet-revise-extension", type: "detect-account", requestId },
        globalThis.location.origin,
      );
      return true;
    }

    if (message?.type === "scan-history" && typeof message.requestId === "string") {
      globalThis.postMessage(
        {
          source: "leet-revise-extension",
          type: "scan-history",
          requestId: message.requestId,
        },
        globalThis.location.origin,
      );
      sendResponse({ ok: true });
      return false;
    }

    return false;
  });

  globalThis.addEventListener("message", (event) => {
    if (
      event.source !== globalThis ||
      event.origin !== globalThis.location.origin ||
      event.data?.source !== "leet-revise-page"
    ) {
      return;
    }

    if (event.data.type === "accepted-submission") {
      void chrome.runtime.sendMessage({
        type: "capture-draft",
        draft: collectDraft(event.data.payload),
      });
      return;
    }

    if (event.data.type === "account-result" || event.data.type === "account-error") {
      const respond = accountRequests.get(event.data.requestId);
      if (!respond) return;
      accountRequests.delete(event.data.requestId);
      respond(
        event.data.type === "account-result"
          ? { ok: true, username: event.data.username }
          : { ok: false, error: event.data.error },
      );
      return;
    }

    if (/^history-(progress|items|complete|error)$/.test(event.data.type)) {
      historyForwardQueue = historyForwardQueue
        .catch(() => undefined)
        .then(() =>
          chrome.runtime.sendMessage({
            type: "history-event",
            event: {
              type: event.data.type,
              requestId: event.data.requestId,
              progress: event.data.progress,
              items: event.data.items,
              summary: event.data.summary,
              error: event.data.error,
            },
          }),
        );
    }
  });
})();
