import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
}));

vi.mock("@/lib/services/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { exchangeCodeForSession: mocks.exchangeCodeForSession },
  }),
}));

import { GET, safeNextPath } from "./route";

describe("authentication callback", () => {
  beforeEach(() => vi.clearAllMocks());

  it("exchanges a valid code and redirects to the dashboard", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null });

    const response = await GET(
      new Request("http://localhost/auth/callback?code=valid-code"),
    );

    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("valid-code");
    expect(response.headers.get("location")).toBe("http://localhost/dashboard");
  });

  it("returns failures to login", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({
      error: new Error("bad code"),
    });

    const response = await GET(
      new Request("http://localhost/auth/callback?code=bad-code"),
    );

    expect(response.headers.get("location")).toBe(
      "http://localhost/login?status=failed",
    );
  });

  it.each(["//evil.example", "/\\evil.example", "https://evil.example"])(
    "rejects unsafe next destination %s",
    (next) => {
      expect(safeNextPath(next)).toBe("/dashboard");
    },
  );
});
