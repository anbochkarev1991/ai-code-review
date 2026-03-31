-- Atomic increment for monthly review usage (avoids read-modify-write races on concurrent reviews)

create or replace function public.increment_usage_review_count(p_month text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  insert into public.usage (user_id, month, review_count, updated_at)
  values (uid, p_month, 1, now())
  on conflict (user_id, month)
  do update set
    review_count = public.usage.review_count + 1,
    updated_at = now();
end;
$$;

revoke all on function public.increment_usage_review_count(text) from public;
grant execute on function public.increment_usage_review_count(text) to authenticated;
