import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  signInWithOtp: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/services/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: {
      signInWithOtp: mocks.signInWithOtp,
      signOut: mocks.signOut,
    },
  }),
}));

import { requestMagicLink, signOut } from "./actions";

function form(email: string, mode: "login" | "signup") {
  const data = new FormData();
  data.set("email", email);
  data.set("mode", mode);
  return data;
}

describe("authentication actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "publishable-key");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000/");
    mocks.redirect.mockImplementation((path: string) => {
      throw new Error(`redirect:${path}`);
    });
  });

  it.each([
    ["signup", true],
    ["login", false],
  ] as const)(
    "requests a %s link with the correct account behavior",
    async (mode, shouldCreateUser) => {
      mocks.signInWithOtp.mockResolvedValue({ error: null });

      await expect(
        requestMagicLink(form(" person@example.com ", mode)),
      ).rejects.toThrow(`redirect:/${mode}?status=sent`);
      expect(mocks.signInWithOtp).toHaveBeenCalledWith({
        email: "person@example.com",
        options: {
          emailRedirectTo: "http://localhost:3000/auth/callback",
          shouldCreateUser,
        },
      });
    },
  );

  it("rejects invalid email before calling Supabase", async () => {
    await expect(requestMagicLink(form("invalid", "signup"))).rejects.toThrow(
      "redirect:/signup?status=invalid",
    );
    expect(mocks.signInWithOtp).not.toHaveBeenCalled();
  });

  it("signs out and returns to login", async () => {
    mocks.signOut.mockResolvedValue({ error: null });

    await expect(signOut()).rejects.toThrow("redirect:/login");
    expect(mocks.signOut).toHaveBeenCalledOnce();
  });
});
