/* global chrome, importScripts */
"use strict";

importScripts("leetcode.js", "history.js");

const helpers = globalThis.LeetReviseLeetCode;
const historyHelpers = globalThis.LeetReviseHistory;
const configurationKey = "ingestionConfiguration";
const pendingDraftKey = "pendingSubmissionDraft";
const linkedAccountKey = "linkedLeetCodeUsername";
const historyStateKey = "historyImportState";
const historyItemsKey = "historyImportItems";
const uploadChunkSize = 25;
let historyEventQueue = Promise.resolve();

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

function isLeetCodeUrl(value) {
  try {
    const hostname = new URL(value).hostname;
    return hostname === "leetcode.com" || hostname.endsWith(".leetcode.com");
  } catch {
    return false;
  }
}

async function activeLeetCodeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !isLeetCodeUrl(tab.url)) {
    throw new Error("Open LeetCode in the active tab first");
  }
  return tab;
}

async function detectLeetCodeAccount(tab) {
  const response = await chrome.tabs.sendMessage(tab.id, { type: "detect-account" });
  if (!response?.ok || !response.username) {
    throw new Error(response?.error ?? "Unable to detect the current LeetCode account");
  }
  return String(response.username);
}

async function readHistoryState() {
  const stored = await chrome.storage.local.get(historyStateKey);
  return stored[historyStateKey] ?? { status: "idle" };
}

async function writeHistoryState(state) {
  await chrome.storage.local.set({ [historyStateKey]: state });
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

async function handleHistoryEvent(event, sender) {
  if (!sender.tab?.url || !isLeetCodeUrl(sender.tab.url)) {
    throw new Error("History events are accepted only from LeetCode tabs");
  }

  const state = await readHistoryState();
  if (!event?.requestId || event.requestId !== state.requestId) return;

  if (event.type === "history-progress") {
    await writeHistoryState({ ...state, progress: event.progress });
    return;
  }

  if (event.type === "history-items") {
    const stored = await chrome.storage.local.get(historyItemsKey);
    const existing = stored[historyItemsKey] ?? [];
    const incoming = Array.isArray(event.items) ? event.items : [];
    const validItems = [];
    let rejected = 0;
    for (const item of incoming) {
      try {
        validItems.push(helpers.buildSubmission(item));
      } catch {
        rejected += 1;
      }
    }
    await Promise.all([
      chrome.storage.local.set({ [historyItemsKey]: [...existing, ...validItems] }),
      writeHistoryState({
        ...state,
        received: Number(state.received ?? 0) + validItems.length,
        rejected: Number(state.rejected ?? 0) + rejected,
      }),
    ]);
    return;
  }

  if (event.type === "history-complete") {
    if (event.summary?.username !== state.linkedUsername) {
      await writeHistoryState({
        ...state,
        status: "error",
        error: "The active LeetCode account changed during the history scan",
      });
      return;
    }
    await writeHistoryState({
      ...state,
      status: "ready",
      summary: {
        ...event.summary,
        ready: Number(state.received ?? 0),
        unavailable:
          Number(event.summary.unavailable ?? 0) + Number(state.rejected ?? 0),
      },
      progress: null,
      error: null,
      upload: {
        nextChunk: 0,
        processed: 0,
        counts: historyHelpers.emptyImportCounts(),
      },
    });
    return;
  }

  if (event.type === "history-error") {
    await writeHistoryState({
      ...state,
      status: "error",
      error: event.error || "Unable to scan LeetCode history",
    });
  }
}

async function uploadHistory() {
  const [state, stored] = await Promise.all([
    readHistoryState(),
    chrome.storage.local.get(historyItemsKey),
  ]);
  const items = stored[historyItemsKey] ?? [];
  if (!items.length) throw new Error("No collected submissions are ready to import");
  if (state.status !== "ready" && state.status !== "upload-error") {
    throw new Error("Scan and review LeetCode history before importing");
  }

  const chunks = historyHelpers.chunkItems(items, uploadChunkSize);
  let nextChunk = Number(state.upload?.nextChunk ?? 0);
  let counts = state.upload?.counts ?? historyHelpers.emptyImportCounts();
  let processed = Number(state.upload?.processed ?? 0);

  await writeHistoryState({
    ...state,
    status: "uploading",
    error: null,
    upload: { nextChunk, processed, counts, total: items.length },
  });

  try {
    for (; nextChunk < chunks.length; nextChunk += 1) {
      const result = await requestApi("/api/submissions/bulk", {
        method: "POST",
        body: JSON.stringify({ submissions: chunks[nextChunk] }),
      });
      counts = historyHelpers.addImportCounts(counts, result);
      processed += chunks[nextChunk].length;
      await writeHistoryState({
        ...state,
        status: "uploading",
        error: null,
        upload: {
          nextChunk: nextChunk + 1,
          processed,
          counts,
          total: items.length,
        },
      });
    }
  } catch (error) {
    await writeHistoryState({
      ...state,
      status: "upload-error",
      error: error instanceof Error ? error.message : "Bulk import was interrupted",
      upload: { nextChunk, processed, counts, total: items.length },
    });
    throw error;
  }

  await chrome.storage.local.remove(historyItemsKey);
  await writeHistoryState({
    ...state,
    status: "complete",
    error: null,
    upload: { nextChunk, processed, counts, total: items.length },
  });
  return counts;
}

async function handleMessage(message, sender) {
  switch (message?.type) {
    case "get-state": {
      const [configuration, stored, historyState] = await Promise.all([
        readConfiguration(),
        chrome.storage.local.get([pendingDraftKey, linkedAccountKey]),
        readHistoryState(),
      ]);
      return {
        ok: true,
        state: {
          backendUrl: configuration?.backendUrl ?? "http://localhost:3000",
          tokenConfigured: Boolean(configuration?.token),
          pendingDraft: stored[pendingDraftKey] ?? null,
          linkedLeetCodeUsername: stored[linkedAccountKey] ?? null,
          historyImport: historyState,
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
    case "link-leetcode-account": {
      const tab = await activeLeetCodeTab();
      const username = await detectLeetCodeAccount(tab);
      await chrome.storage.local.set({ [linkedAccountKey]: username });
      return { ok: true, username };
    }
    case "start-history-scan": {
      const tab = await activeLeetCodeTab();
      const stored = await chrome.storage.local.get(linkedAccountKey);
      const linkedUsername = stored[linkedAccountKey];
      const activeUsername = await detectLeetCodeAccount(tab);
      historyHelpers.assertLinkedAccount(linkedUsername, activeUsername);

      const requestId = crypto.randomUUID();
      await Promise.all([
        chrome.storage.local.set({ [historyItemsKey]: [] }),
        writeHistoryState({
          status: "scanning",
          requestId,
          linkedUsername,
          received: 0,
          rejected: 0,
          progress: { phase: "scanning", pageNumber: 0, scanned: 0 },
          summary: null,
          upload: null,
          error: null,
        }),
      ]);
      try {
        const response = await chrome.tabs.sendMessage(tab.id, {
          type: "scan-history",
          requestId,
        });
        if (!response?.ok) throw new Error("Unable to start the history scan");
      } catch (error) {
        await writeHistoryState({
          status: "error",
          requestId,
          linkedUsername,
          error: error instanceof Error ? error.message : "Unable to start the history scan",
        });
        throw error;
      }
      return { ok: true };
    }
    case "history-event":
      historyEventQueue = historyEventQueue
        .catch(() => undefined)
        .then(() => handleHistoryEvent(message.event, sender));
      await historyEventQueue;
      return { ok: true };
    case "import-history":
      return { ok: true, counts: await uploadHistory() };
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
      if (!sender.tab?.url || !isLeetCodeUrl(sender.tab.url)) {
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
