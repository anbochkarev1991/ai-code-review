-- usage: monthly review count per user (for quota)
create table public.usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month text not null,
  review_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, month)
);

create index idx_usage_user_id_month on public.usage(user_id, month);

alter table public.usage enable row level security;

create policy "Users can manage own usage"
  on public.usage for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
