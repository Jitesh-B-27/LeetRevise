(function observeLeetCodeSubmissions() {
  "use strict";

  const helpers = globalThis.LeetReviseLeetCode;
  const nativeFetch = globalThis.fetch;
  const nativeOpen = XMLHttpRequest.prototype.open;
  const nativeSend = XMLHttpRequest.prototype.send;
  let pendingSubmission;
  let lastAcceptedAt = 0;

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
})();
