import { createHash, randomBytes } from "node:crypto";

const TOKEN_PREFIX = "lr_ingest_";
const TOKEN_RANDOM_BYTES = 32;
const TOKEN_PATTERN = /^lr_ingest_[A-Za-z0-9_-]{43}$/;

export interface IngestTokenMetadata {
  id: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface IngestTokenRepository {
  create(input: {
    userId: string;
    tokenHash: string;
  }): Promise<IngestTokenMetadata>;
  consumeActiveTokenHash(tokenHash: string): Promise<string | null>;
}

export class IngestTokenAuthenticationError extends Error {
  constructor(
    public readonly code: "missing" | "malformed" | "invalid",
    message: string,
  ) {
    super(message);
    this.name = "IngestTokenAuthenticationError";
  }
}

export function generateIngestToken(): string {
  return `${TOKEN_PREFIX}${randomBytes(TOKEN_RANDOM_BYTES).toString("base64url")}`;
}

export function hashIngestToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function parseIngestBearerToken(
  authorization: string | null,
): string {
  if (!authorization) {
    throw new IngestTokenAuthenticationError(
      "missing",
      "Missing bearer token",
    );
  }

  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  const token = match?.[1];

  if (!token || !TOKEN_PATTERN.test(token)) {
    throw new IngestTokenAuthenticationError(
      "malformed",
      "Malformed bearer token",
    );
  }

  return token;
}

export async function createIngestToken(
  userId: string,
  repository: IngestTokenRepository,
): Promise<{ token: string; metadata: IngestTokenMetadata }> {
  const token = generateIngestToken();
  const metadata = await repository.create({
    userId,
    tokenHash: hashIngestToken(token),
  });

  return { token, metadata };
}

export async function verifyIngestAuthorization(
  authorization: string | null,
  repository: IngestTokenRepository,
): Promise<{ userId: string }> {
  const token = parseIngestBearerToken(authorization);
  const userId = await repository.consumeActiveTokenHash(hashIngestToken(token));

  if (!userId) {
    throw new IngestTokenAuthenticationError(
      "invalid",
      "Invalid or revoked bearer token",
    );
  }

  return { userId };
}
