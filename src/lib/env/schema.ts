import { z } from "zod";

export const environmentSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  GEMINI_API_KEY: z.string().min(1),
  GEMINI_MODEL: z.string().min(1),
  INGEST_TOKEN_SECRET: z.string().min(16),
  NEXT_PUBLIC_APP_URL: z.url(),
});

export type AppEnvironment = z.infer<typeof environmentSchema>;

export function parseEnvironment(
  source: Record<string, string | undefined>,
): AppEnvironment {
  const result = environmentSchema.safeParse(source);

  if (!result.success) {
    const variables = result.error.issues
      .map((issue) => String(issue.path[0]))
      .filter((name, index, names) => names.indexOf(name) === index)
      .join(", ");

    throw new Error(`Invalid environment variables: ${variables}`);
  }

  return result.data;
}
