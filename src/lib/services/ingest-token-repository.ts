import "server-only";

import type {
  IngestTokenMetadata,
  IngestTokenRepository,
} from "@/lib/auth/ingest-token";
import { createPrivilegedSupabaseClient } from "@/lib/services/supabase/admin";

interface TokenMetadataRow {
  id: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

function toMetadata(row: TokenMetadataRow): IngestTokenMetadata {
  return {
    id: row.id,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    revokedAt: row.revoked_at,
  };
}

export function createPrivilegedIngestTokenRepository(): IngestTokenRepository {
  const supabase = createPrivilegedSupabaseClient();

  return {
    async create({ userId, tokenHash }) {
      const { data, error } = await supabase
        .from("ingest_tokens")
        .insert({ user_id: userId, token_hash: tokenHash })
        .select("id, created_at, last_used_at, revoked_at")
        .single();

      if (error || !data) {
        throw new Error("Failed to create ingestion token", { cause: error });
      }

      return toMetadata(data);
    },

    async consumeActiveTokenHash(tokenHash) {
      const { data, error } = await supabase
        .from("ingest_tokens")
        .update({ last_used_at: new Date().toISOString() })
        .eq("token_hash", tokenHash)
        .is("revoked_at", null)
        .select("user_id")
        .maybeSingle();

      if (error) {
        throw new Error("Failed to verify ingestion token", { cause: error });
      }

      return data?.user_id ?? null;
    },
  };
}
