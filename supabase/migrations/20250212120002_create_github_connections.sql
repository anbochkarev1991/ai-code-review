-- github_connections: GitHub OAuth tokens per user
create table public.github_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  github_user_id text not null,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_github_connections_user_id on public.github_connections(user_id);

alter table public.github_connections enable row level security;

create policy "Users can manage own github connections"
  on public.github_connections for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
