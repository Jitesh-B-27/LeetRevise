"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { parseAuthEnvironment } from "@/lib/env/schema";
import { createSupabaseServerClient } from "@/lib/services/supabase/server";

const magicLinkRequestSchema = z.object({
  email: z.string().trim().pipe(z.email()),
  mode: z.enum(["login", "signup"]),
});

export async function requestMagicLink(formData: FormData): Promise<never> {
  const request = magicLinkRequestSchema.safeParse({
    email: formData.get("email"),
    mode: formData.get("mode"),
  });

  const fallbackMode = formData.get("mode") === "signup" ? "signup" : "login";

  if (!request.success) {
    redirect(`/${fallbackMode}?status=invalid`);
  }

  const environment = parseAuthEnvironment({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: request.data.email,
    options: {
      emailRedirectTo: new URL(
        "/auth/callback",
        environment.NEXT_PUBLIC_APP_URL,
      ).toString(),
      shouldCreateUser: request.data.mode === "signup",
    },
  });

  redirect(`/${request.data.mode}?status=${error ? "failed" : "sent"}`);
}

export async function signOut(): Promise<never> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
