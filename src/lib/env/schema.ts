import { z } from "zod";

export const publicSupabaseEnvironmentSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

export const privilegedSupabaseEnvironmentSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

export const authEnvironmentSchema = publicSupabaseEnvironmentSchema.extend({
  NEXT_PUBLIC_APP_URL: z.url(),
});

export const environmentSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  GEMINI_API_KEY: z.string().min(1),
  GEMINI_MODEL: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.url(),
});

export type AppEnvironment = z.infer<typeof environmentSchema>;
export type PublicSupabaseEnvironment = z.infer<
  typeof publicSupabaseEnvironmentSchema
>;
export type PrivilegedSupabaseEnvironment = z.infer<
  typeof privilegedSupabaseEnvironmentSchema
>;
export type AuthEnvironment = z.infer<typeof authEnvironmentSchema>;

function formatInvalidVariables(error: z.ZodError): string {
  return error.issues
    .map((issue) => String(issue.path[0]))
    .filter((name, index, names) => names.indexOf(name) === index)
    .join(", ");
}

export function parseEnvironment(
  source: Record<string, string | undefined>,
): AppEnvironment {
  const result = environmentSchema.safeParse(source);

  if (!result.success) {
    throw new Error(
      `Invalid environment variables: ${formatInvalidVariables(result.error)}`,
    );
  }

  return result.data;
}

export function parsePublicSupabaseEnvironment(
  source: Record<string, string | undefined>,
): PublicSupabaseEnvironment {
  const result = publicSupabaseEnvironmentSchema.safeParse(source);

  if (!result.success) {
    throw new Error(
      `Invalid Supabase environment variables: ${formatInvalidVariables(result.error)}`,
    );
  }

  return result.data;
}

export function parsePrivilegedSupabaseEnvironment(
  source: Record<string, string | undefined>,
): PrivilegedSupabaseEnvironment {
  const result = privilegedSupabaseEnvironmentSchema.safeParse(source);

  if (!result.success) {
    throw new Error(
      `Invalid privileged Supabase environment variables: ${formatInvalidVariables(result.error)}`,
    );
  }

  return result.data;
}

export function parseAuthEnvironment(
  source: Record<string, string | undefined>,
): AuthEnvironment {
  const result = authEnvironmentSchema.safeParse(source);

  if (!result.success) {
    throw new Error(
      `Invalid authentication environment variables: ${formatInvalidVariables(result.error)}`,
    );
  }

  return result.data;
}
