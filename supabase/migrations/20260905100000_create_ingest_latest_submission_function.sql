create function public.ingest_latest_submission(
  p_user_id uuid,
  p_problem_slug text,
  p_title text,
  p_difficulty text,
  p_problem_url text,
  p_problem_description text,
  p_language text,
  p_code text,
  p_runtime_ms integer,
  p_memory_mb numeric,
  p_submitted_at timestamptz
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  loop
    update public.user_submissions
    set
      title = p_title,
      difficulty = p_difficulty,
      problem_url = p_problem_url,
      problem_description = p_problem_description,
      language = p_language,
      code = p_code,
      runtime_ms = p_runtime_ms,
      memory_mb = p_memory_mb,
      submitted_at = p_submitted_at
    where user_id = p_user_id
      and problem_slug = p_problem_slug
      and submitted_at < p_submitted_at;

    if found then
      return 'updated';
    end if;

    if exists (
      select 1
      from public.user_submissions
      where user_id = p_user_id
        and problem_slug = p_problem_slug
    ) then
      return 'skipped';
    end if;

    insert into public.user_submissions (
      user_id,
      problem_slug,
      title,
      difficulty,
      problem_url,
      problem_description,
      language,
      code,
      runtime_ms,
      memory_mb,
      submitted_at
    )
    values (
      p_user_id,
      p_problem_slug,
      p_title,
      p_difficulty,
      p_problem_url,
      p_problem_description,
      p_language,
      p_code,
      p_runtime_ms,
      p_memory_mb,
      p_submitted_at
    )
    on conflict (user_id, problem_slug) do nothing;

    if found then
      return 'created';
    end if;
  end loop;
end;
$$;

revoke execute on function public.ingest_latest_submission(
  uuid, text, text, text, text, text, text, text, integer, numeric, timestamptz
) from public, anon, authenticated;

grant execute on function public.ingest_latest_submission(
  uuid, text, text, text, text, text, text, text, integer, numeric, timestamptz
) to service_role;
