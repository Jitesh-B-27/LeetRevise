import { Buffer } from "node:buffer";
import { describe, expect, it } from "vitest";
import {
  createIngestToken,
  generateIngestToken,
  hashIngestToken,
  IngestTokenAuthenticationError,
  type IngestTokenMetadata,
  type IngestTokenRepository,
  parseIngestBearerToken,
  verifyIngestAuthorization,
} from "./ingest-token";

class MemoryTokenRepository implements IngestTokenRepository {
  readonly tokens = new Map<
    string,
    { userId: string; revoked: boolean; lastUsed: boolean }
  >();

  async create(input: { userId: string; tokenHash: string }) {
    this.tokens.set(input.tokenHash, {
      userId: input.userId,
      revoked: false,
      lastUsed: false,
    });

    return {
      id: "token-id",
      createdAt: "2026-09-01T00:00:00.000Z",
      lastUsedAt: null,
      revokedAt: null,
    } satisfies IngestTokenMetadata;
  }

  async consumeActiveTokenHash(tokenHash: string) {
    const token = this.tokens.get(tokenHash);

    if (!token || token.revoked) {
      return null;
    }

    token.lastUsed = true;
    return token.userId;
  }
}

describe("ingestion token generation", () => {
  it("uses the recognizable prefix and at least 32 random bytes", () => {
    const token = generateIngestToken();
    const encodedRandomness = token.slice("lr_ingest_".length);

    expect(token).toMatch(/^lr_ingest_[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(encodedRandomness, "base64url")).toHaveLength(32);
  });

  it("hashes tokens as SHA-256 without retaining the raw value", async () => {
    const repository = new MemoryTokenRepository();
    const result = await createIngestToken("user-1", repository);
    const [storedHash] = repository.tokens.keys();

    expect(storedHash).toBe(hashIngestToken(result.token));
    expect(storedHash).toMatch(/^[0-9a-f]{64}$/);
    expect(storedHash).not.toContain(result.token);
    expect(result).not.toHaveProperty("tokenHash");
    expect(result.metadata).not.toHaveProperty("tokenHash");
  });
});

describe("ingestion token authentication", () => {
  it("rejects missing and malformed bearer headers", () => {
    expect(() => parseIngestBearerToken(null)).toThrow(
      new IngestTokenAuthenticationError("missing", "Missing bearer token"),
    );
    expect(() => parseIngestBearerToken("Bearer not-a-token")).toThrow(
      new IngestTokenAuthenticationError("malformed", "Malformed bearer token"),
    );
  });

  it("resolves the owning user and consumes the active token", async () => {
    const repository = new MemoryTokenRepository();
    const { token } = await createIngestToken("owner-user", repository);

    await expect(
      verifyIngestAuthorization(`Bearer ${token}`, repository),
    ).resolves.toEqual({ userId: "owner-user" });
    expect(repository.tokens.get(hashIngestToken(token))?.lastUsed).toBe(true);
  });

  it("rejects unknown and revoked tokens without revealing which failed", async () => {
    const repository = new MemoryTokenRepository();
    const { token } = await createIngestToken("owner-user", repository);
    const stored = repository.tokens.get(hashIngestToken(token));

    if (stored) stored.revoked = true;

    await expect(
      verifyIngestAuthorization(`Bearer ${token}`, repository),
    ).rejects.toMatchObject({ code: "invalid" });
    await expect(
      verifyIngestAuthorization(
        `Bearer ${generateIngestToken()}`,
        repository,
      ),
    ).rejects.toMatchObject({ code: "invalid" });
  });
});
