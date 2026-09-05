import { IngestTokenAuthenticationError, verifyIngestAuthorization } from "@/lib/auth/ingest-token";
import { submissionSchema } from "@/lib/domain/submission";
import { createPrivilegedIngestTokenRepository } from "@/lib/services/ingest-token-repository";
import { createSubmissionPersistenceService } from "@/lib/services/submissions";

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

  const parsed = submissionSchema.safeParse(payload);

  if (!parsed.success) {
    return Response.json({ error: "Invalid submission payload" }, { status: 422 });
  }

  try {
    const outcome = await createSubmissionPersistenceService().persist(
      userId,
      parsed.data,
    );

    return Response.json(
      { status: outcome },
      { status: outcome === "created" ? 201 : 200 },
    );
  } catch {
    return Response.json(
      { error: "Unable to persist submission" },
      { status: 500 },
    );
  }
}
