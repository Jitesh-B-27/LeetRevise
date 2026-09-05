import { createIngestToken } from "@/lib/auth/ingest-token";
import { createPrivilegedIngestTokenRepository } from "@/lib/services/ingest-token-repository";
import { createSupabaseServerClient } from "@/lib/services/supabase/server";

export async function POST() {
  const sessionClient = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await sessionClient.auth.getUser();

  if (error || !user) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const result = await createIngestToken(
      user.id,
      createPrivilegedIngestTokenRepository(),
    );

    return Response.json(result, { status: 201 });
  } catch {
    return Response.json(
      { error: "Unable to create ingestion token" },
      { status: 500 },
    );
  }
}
