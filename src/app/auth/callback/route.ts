import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/services/supabase/server";

export function safeNextPath(value: string | null): string {
  return value?.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\")
    ? value
    : "/dashboard";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(
        new URL(safeNextPath(url.searchParams.get("next")), url.origin),
      );
    }
  }

  return NextResponse.redirect(new URL("/login?status=failed", url.origin));
}
