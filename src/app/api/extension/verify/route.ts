import {
  IngestTokenAuthenticationError,
  verifyIngestAuthorization,
} from "@/lib/auth/ingest-token";
import { createPrivilegedIngestTokenRepository } from "@/lib/services/ingest-token-repository";

export async function GET(request: Request) {
  try {
    await verifyIngestAuthorization(
      request.headers.get("authorization"),
      createPrivilegedIngestTokenRepository(),
    );

    return Response.json({ valid: true });
  } catch (error) {
    if (error instanceof IngestTokenAuthenticationError) {
      return Response.json({ error: error.message }, { status: 401 });
    }

    return Response.json(
      { error: "Unable to verify ingestion token" },
      { status: 500 },
    );
  }
}
