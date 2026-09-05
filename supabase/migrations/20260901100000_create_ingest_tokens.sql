create table public.ingest_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index ingest_tokens_user_id_idx on public.ingest_tokens (user_id);

alter table public.ingest_tokens enable row level security;

revoke all on table public.ingest_tokens from anon, authenticated;
grant select (id, created_at, last_used_at, revoked_at)
  on public.ingest_tokens to authenticated;

create policy "Users can read their own ingestion token metadata"
on public.ingest_tokens
for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
