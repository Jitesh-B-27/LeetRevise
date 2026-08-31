create table public.user_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  problem_slug text not null check (length(btrim(problem_slug)) > 0),
  title text not null check (length(btrim(title)) > 0),
  difficulty text not null check (difficulty in ('Easy', 'Medium', 'Hard')),
  problem_url text not null check (length(btrim(problem_url)) > 0),
  problem_description text not null check (length(btrim(problem_description)) > 0),
  language text not null check (length(btrim(language)) > 0),
  code text not null check (length(btrim(code)) > 0),
  runtime_ms integer check (runtime_ms >= 0),
  memory_mb numeric check (memory_mb >= 0),
  submitted_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_submissions_user_problem_unique unique (user_id, problem_slug)
);

create index user_submissions_user_submitted_at_idx
  on public.user_submissions (user_id, submitted_at desc);

create function public.keep_newest_user_submission()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.submitted_at <= old.submitted_at then
    return old;
  end if;

  new.id := old.id;
  new.user_id := old.user_id;
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$$;

create trigger keep_newest_user_submission_before_update
before update on public.user_submissions
for each row execute function public.keep_newest_user_submission();

revoke execute on function public.keep_newest_user_submission() from public, anon, authenticated;

alter table public.user_submissions enable row level security;

revoke all on table public.user_submissions from anon, authenticated;
grant select, insert, update, delete on table public.user_submissions to authenticated;

create policy "Users can read their own submissions"
on public.user_submissions
for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can insert their own submissions"
on public.user_submissions
for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can update their own submissions"
on public.user_submissions
for update
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can delete their own submissions"
on public.user_submissions
for delete
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
