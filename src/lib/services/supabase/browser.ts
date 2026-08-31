import { createBrowserClient } from "@supabase/ssr";
import { parsePublicSupabaseEnvironment } from "@/lib/env/schema";

export function createSupabaseBrowserClient() {
  const environment = parsePublicSupabaseEnvironment({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

  return createBrowserClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
