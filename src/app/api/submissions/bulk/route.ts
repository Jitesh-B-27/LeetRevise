import { z } from "zod";
import {
  IngestTokenAuthenticationError,
  verifyIngestAuthorization,
} from "@/lib/auth/ingest-token";
import { ingestBulkSubmissions } from "@/lib/services/bulk-submissions";
import { createPrivilegedIngestTokenRepository } from "@/lib/services/ingest-token-repository";
import { createSubmissionPersistenceService } from "@/lib/services/submissions";

const bulkEnvelopeSchema = z.strictObject({
  submissions: z.array(z.unknown()),
});

export async function POST(request: Request) {
  let userId: string;

  try {
    ({ userId } = await verifyIngestAuthorization(
      request.headers.get("authorization"),
      createPrivilegedIngestTokenRepository(),
    ));
  } catch (error) {
    if (error instanceof IngestTokenAuthenticationError) {
      return Response.json({ error: error.message }, { status: 401 });
    }

    return Response.json(
      { error: "Unable to authenticate ingestion request" },
      { status: 500 },
    );
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const envelope = bulkEnvelopeSchema.safeParse(payload);

  if (!envelope.success) {
    return Response.json(
      { error: "Invalid bulk submission payload" },
      { status: 422 },
    );
  }

  try {
    const result = await ingestBulkSubmissions(
      userId,
      envelope.data.submissions,
      createSubmissionPersistenceService(),
    );

    return Response.json(result);
  } catch {
    return Response.json(
      { error: "Unable to persist bulk submissions" },
      { status: 500 },
    );
  }
}
