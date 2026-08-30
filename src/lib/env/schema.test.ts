import { describe, expect, it } from "vitest";
import { parseEnvironment } from "./schema";

const validEnvironment = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  GEMINI_API_KEY: "gemini-key",
  GEMINI_MODEL: "gemini-flash",
  INGEST_TOKEN_SECRET: "a-long-random-secret",
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
