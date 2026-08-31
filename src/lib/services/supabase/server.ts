import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { parsePublicSupabaseEnvironment } from "@/lib/env/schema";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const environment = parsePublicSupabaseEnvironment({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

  return createServerClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Components cannot write cookies. A later auth proxy will
            // handle session refresh when authentication is implemented.
          }
        },
      },
    },
  );
}
