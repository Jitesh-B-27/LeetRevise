/* global chrome, importScripts */
"use strict";

importScripts("leetcode.js");

const helpers = globalThis.LeetReviseLeetCode;
const configurationKey = "ingestionConfiguration";
const pendingDraftKey = "pendingSubmissionDraft";

async function restrictLocalStorage() {
  await chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
}

chrome.runtime.onInstalled.addListener(() => void restrictLocalStorage());
chrome.runtime.onStartup.addListener(() => void restrictLocalStorage());
void restrictLocalStorage();

async function readConfiguration() {
  const stored = await chrome.storage.local.get(configurationKey);
  return stored[configurationKey] ?? null;
}

async function requestApi(path, options = {}, overrideConfiguration) {
  const configuration = overrideConfiguration ?? (await readConfiguration());
  if (!configuration) throw new Error("Configure and verify the extension first");

  const response = await fetch(`${configuration.backendUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${configuration.token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(`Backend returned an unreadable response (${response.status})`);
  }

  if (!response.ok) {
    throw new Error(typeof data.error === "string" ? data.error : `Request failed (${response.status})`);
  }
  return data;
}

async function handleMessage(message, sender) {
  switch (message?.type) {
    case "get-state": {
      const [configuration, stored] = await Promise.all([
        readConfiguration(),
        chrome.storage.local.get(pendingDraftKey),
      ]);
      return {
        ok: true,
        state: {
          backendUrl: configuration?.backendUrl ?? "http://localhost:3000",
          tokenConfigured: Boolean(configuration?.token),
          pendingDraft: stored[pendingDraftKey] ?? null,
        },
      };
    }
    case "configure": {
      const existing = await readConfiguration();
      const configuration = {
        backendUrl: helpers.normalizeBackendUrl(message.backendUrl),
        token: message.token ? helpers.validateToken(message.token) : existing?.token,
      };
      if (!configuration.token) throw new Error("Enter an ingestion token");
      await requestApi("/api/extension/verify", {}, configuration);
      await chrome.storage.local.set({ [configurationKey]: configuration });
      return { ok: true };
    }
    case "verify":
      await requestApi("/api/extension/verify");
      return { ok: true };
    case "submit": {
      const submission = helpers.buildSubmission(message.submission);
      const result = await requestApi("/api/submissions", {
        method: "POST",
        body: JSON.stringify(submission),
      });
      await chrome.storage.local.remove(pendingDraftKey);
      await chrome.action.setBadgeText({ text: "" });
      return { ok: true, result };
    }
    case "capture-draft": {
      const isLeetCodeTab =
        sender.tab?.url?.startsWith("https://leetcode.com/") ||
        sender.tab?.url?.includes(".leetcode.com/");
      if (!isLeetCodeTab) {
        throw new Error("Capture messages are accepted only from LeetCode tabs");
      }
      await chrome.storage.local.set({ [pendingDraftKey]: message.draft });
      await chrome.action.setBadgeBackgroundColor({ color: "#EAB308" });
      await chrome.action.setBadgeText({ text: "1" });
      return { ok: true };
    }
    default:
      throw new Error("Unknown extension message");
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch((error) =>
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : "Unexpected extension error",
      }),
    );
  return true;
});
