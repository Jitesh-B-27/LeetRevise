import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getClaims: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/services/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getClaims: mocks.getClaims },
  }),
}));

import {
  getAuthenticatedUserId,
  requireAuthenticatedUser,
} from "./session";

describe("server authentication", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the verified subject claim", async () => {
    mocks.getClaims.mockResolvedValue({
      data: { claims: { sub: "verified-user" } },
      error: null,
    });

    await expect(getAuthenticatedUserId()).resolves.toBe("verified-user");
  });

  it("redirects unauthenticated protected access to login", async () => {
    mocks.getClaims.mockResolvedValue({
      data: null,
      error: new Error("invalid"),
    });
    mocks.redirect.mockImplementation((path: string) => {
      throw new Error(`redirect:${path}`);
    });

    await expect(requireAuthenticatedUser()).rejects.toThrow(
      "redirect:/login",
    );
  });
});
