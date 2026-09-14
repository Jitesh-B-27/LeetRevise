import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const storage = new Map();
let messageListener;
let activeUsername = "alice";

const chromeMock = {
  action: {
    setBadgeBackgroundColor: vi.fn(async () => undefined),
    setBadgeText: vi.fn(async () => undefined),
  },
  runtime: {
    onInstalled: { addListener: vi.fn() },
    onStartup: { addListener: vi.fn() },
    onMessage: {
      addListener: vi.fn((listener) => {
        messageListener = listener;
      }),
    },
  },
  storage: {
    local: {
      get: vi.fn(async (keys) => {
        const names = Array.isArray(keys) ? keys : [keys];
        return Object.fromEntries(names.map((name) => [name, storage.get(name)]));
      }),
      set: vi.fn(async (values) => {
        for (const [key, value] of Object.entries(values)) storage.set(key, value);
      }),
      remove: vi.fn(async (key) => storage.delete(key)),
      setAccessLevel: vi.fn(async () => undefined),
    },
  },
  tabs: {
    query: vi.fn(async () => [
      { id: 7, url: "https://leetcode.com/problems/two-sum/" },
    ]),
    sendMessage: vi.fn(async (_tabId, message) =>
      message.type === "detect-account"
        ? { ok: true, username: activeUsername }
        : { ok: true },
    ),
  },
};

async function send(message, sender = {}) {
  return new Promise((resolve) => {
    messageListener(message, sender, resolve);
  });
}

beforeAll(async () => {
  globalThis.chrome = chromeMock;
  globalThis.importScripts = vi.fn();
  await import("./leetcode.js");
  await import("./history.js");
  await import("./background.js");
});

beforeEach(() => {
  storage.clear();
  activeUsername = "alice";
  vi.stubGlobal("fetch", vi.fn());
});

describe("bulk history service-worker orchestration", () => {
  it("links the active account and blocks a scan after the account changes", async () => {
    await expect(send({ type: "link-leetcode-account" })).resolves.toEqual({
      ok: true,
      username: "alice",
    });
    expect(storage.get("linkedLeetCodeUsername")).toBe("alice");

    activeUsername = "bob";
    await expect(send({ type: "start-history-scan" })).resolves.toEqual({
      ok: false,
      error: "Linked to alice, but LeetCode is signed in as bob",
    });
  });

  it("checkpoints successful chunks and retries only the unfinished upload", async () => {
    const submissions = Array.from({ length: 30 }, (_, index) => ({
      problemSlug: `problem-${index}`,
      title: `Problem ${index}`,
      difficulty: "Easy",
      problemUrl: `https://leetcode.com/problems/problem-${index}/`,
      problemDescription: "Description",
      language: "JavaScript",
      code: "return true;",
      submittedAt: new Date(1_700_000_000_000 + index * 1000).toISOString(),
    }));
    storage.set("ingestionConfiguration", {
      backendUrl: "http://localhost:3000",
      token: `lr_ingest_${"a".repeat(43)}`,
    });
    storage.set("historyImportItems", submissions);
    storage.set("historyImportState", {
      status: "ready",
      summary: { ready: 30 },
      upload: {
        nextChunk: 0,
        processed: 0,
        counts: { created: 0, updated: 0, skipped: 0, invalid: 0 },
      },
    });

    globalThis.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ created: 25, updated: 0, skipped: 0, invalid: 0 }),
      })
      .mockRejectedValueOnce(new Error("offline"));

    expect(await send({ type: "import-history" })).toEqual({
      ok: false,
      error: "offline",
    });
    expect(storage.get("historyImportState").upload).toMatchObject({
      nextChunk: 1,
      processed: 25,
    });

    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ created: 5, updated: 0, skipped: 0, invalid: 0 }),
    });
    expect(await send({ type: "import-history" })).toMatchObject({ ok: true });
    expect(storage.get("historyImportState")).toMatchObject({
      status: "complete",
      upload: {
        processed: 30,
        counts: { created: 30, updated: 0, skipped: 0, invalid: 0 },
      },
    });
    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
  });
});
