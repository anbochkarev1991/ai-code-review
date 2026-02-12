-- review_runs: AI code review execution records
create table public.review_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  repo_full_name text not null,
  pr_number integer not null,
  pr_title text,
  status text not null,
  result_snapshot jsonb,
  trace jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_review_runs_user_id on public.review_runs(user_id);
create index idx_review_runs_user_id_created_at on public.review_runs(user_id, created_at desc);

alter table public.review_runs enable row level security;

create policy "Users can manage own review runs"
  on public.review_runs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
