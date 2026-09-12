/* global chrome */
(function connectLeetCodePage() {
  "use strict";

  const helpers = globalThis.LeetReviseLeetCode;

  function collectDraft(extra = {}) {
    return {
      ...helpers.extractPageDraft(document, globalThis.location.href),
      ...extra,
    };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "collect-page") return false;
    sendResponse({ ok: true, draft: collectDraft() });
    return false;
  });

  globalThis.addEventListener("message", (event) => {
    if (
      event.source !== globalThis ||
      event.origin !== globalThis.location.origin ||
      event.data?.source !== "leet-revise-page" ||
      event.data?.type !== "accepted-submission"
    ) {
      return;
    }

    void chrome.runtime.sendMessage({
      type: "capture-draft",
      draft: collectDraft(event.data.payload),
    });
  });
})();
