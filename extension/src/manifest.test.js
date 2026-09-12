import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("extension manifest", () => {
  it("uses MV3 with narrow permanent host access and a review popup", async () => {
    const manifest = JSON.parse(
      await readFile("extension/manifest.json", "utf8"),
    );

    expect(manifest.manifest_version).toBe(3);
    expect(manifest.background.service_worker).toBe("src/background.js");
    expect(manifest.action.default_popup).toBe("popup.html");
    expect(manifest.host_permissions).toEqual([
      "https://leetcode.com/*",
      "https://*.leetcode.com/*",
    ]);
    expect(manifest.optional_host_permissions).toEqual(["http://*/*", "https://*/*"]);
  });

  it("keeps ownership and token storage behind the service-worker boundary", async () => {
    const background = await readFile("extension/src/background.js", "utf8");
    const content = await readFile("extension/src/content.js", "utf8");

    expect(background).toContain('accessLevel: "TRUSTED_CONTEXTS"');
    expect(background).not.toMatch(/user_?id/i);
    expect(content).not.toMatch(/token|authorization/i);
  });
});
