import "server-only";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/services/supabase/server";

export async function getAuthenticatedUserId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || typeof data?.claims?.sub !== "string") {
    return null;
  }

  return data.claims.sub;
}

export async function requireAuthenticatedUser(): Promise<string> {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    redirect("/login");
  }

  return userId;
}
