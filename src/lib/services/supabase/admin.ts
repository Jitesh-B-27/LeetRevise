import "server-only";

import { createClient } from "@supabase/supabase-js";
import { parsePrivilegedSupabaseEnvironment } from "@/lib/env/schema";

export function createPrivilegedSupabaseClient() {
  const environment = parsePrivilegedSupabaseEnvironment({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });

  return createClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
