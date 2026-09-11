import { describe, expect, it } from "vitest";
import {
  parseAuthEnvironment,
  parseEnvironment,
  parsePrivilegedSupabaseEnvironment,
  parsePublicSupabaseEnvironment,
} from "./schema";

const validEnvironment = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  GEMINI_API_KEY: "gemini-key",
  GEMINI_MODEL: "gemini-flash",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
};

describe("parseEnvironment", () => {
  it("returns typed configuration when every variable is valid", () => {
    expect(parseEnvironment(validEnvironment)).toEqual(validEnvironment);
  });

  it("names missing or invalid variables in its error", () => {
    expect(() =>
      parseEnvironment({
        ...validEnvironment,
        GEMINI_API_KEY: undefined,
        NEXT_PUBLIC_APP_URL: "not-a-url",
      }),
    ).toThrow(/GEMINI_API_KEY, NEXT_PUBLIC_APP_URL/);
  });
});

describe("parsePublicSupabaseEnvironment", () => {
  it("does not require deferred Gemini configuration", () => {
    expect(
      parsePublicSupabaseEnvironment({
        NEXT_PUBLIC_SUPABASE_URL: validEnvironment.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY:
          validEnvironment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      }),
    ).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: validEnvironment.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY:
        validEnvironment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    });
  });

  it("names invalid Supabase variables", () => {
    expect(() =>
      parsePublicSupabaseEnvironment({
        NEXT_PUBLIC_SUPABASE_URL: "invalid",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined,
      }),
    ).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY/,
    );
  });
});

describe("parsePrivilegedSupabaseEnvironment", () => {
  it("requires only the server-side Supabase credentials", () => {
    expect(
      parsePrivilegedSupabaseEnvironment({
        NEXT_PUBLIC_SUPABASE_URL: validEnvironment.NEXT_PUBLIC_SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY:
          validEnvironment.SUPABASE_SERVICE_ROLE_KEY,
      }),
    ).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: validEnvironment.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: validEnvironment.SUPABASE_SERVICE_ROLE_KEY,
    });
  });
});

describe("parseAuthEnvironment", () => {
  it("requires only public Supabase configuration and the application URL", () => {
    expect(
      parseAuthEnvironment({
        NEXT_PUBLIC_SUPABASE_URL: validEnvironment.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY:
          validEnvironment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        NEXT_PUBLIC_APP_URL: validEnvironment.NEXT_PUBLIC_APP_URL,
      }),
    ).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: validEnvironment.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY:
        validEnvironment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      NEXT_PUBLIC_APP_URL: validEnvironment.NEXT_PUBLIC_APP_URL,
    });
  });
});
