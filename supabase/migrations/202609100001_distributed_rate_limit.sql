create table if not exists public.rate_limit_buckets (
  key_hash text primary key,
  window_started_at timestamptz not null,
  request_count integer not null check (request_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.rate_limit_buckets enable row level security;

create or replace function public.consume_rate_limit(
  p_key_hash text,
  p_max_requests integer,
  p_window_seconds integer
)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  bucket public.rate_limit_buckets%rowtype;
  now_at timestamptz := now();
begin
  if p_max_requests < 1 or p_window_seconds < 1 then raise exception 'invalid rate limit'; end if;
  select * into bucket from public.rate_limit_buckets where key_hash = p_key_hash for update;
  if not found then
    insert into public.rate_limit_buckets(key_hash, window_started_at, request_count) values (p_key_hash, now_at, 1);
    return query select true, p_window_seconds;
  elsif bucket.window_started_at + make_interval(secs => p_window_seconds) <= now_at then
    update public.rate_limit_buckets set window_started_at = now_at, request_count = 1, updated_at = now_at where key_hash = p_key_hash;
    return query select true, p_window_seconds;
  elsif bucket.request_count >= p_max_requests then
    return query select false, greatest(1, ceil(extract(epoch from (bucket.window_started_at + make_interval(secs => p_window_seconds) - now_at)))::integer);
  else
    update public.rate_limit_buckets set request_count = request_count + 1, updated_at = now_at where key_hash = p_key_hash;
    return query select true, greatest(1, ceil(extract(epoch from (bucket.window_started_at + make_interval(secs => p_window_seconds) - now_at)))::integer);
  end if;
end;
$$;

revoke all on public.rate_limit_buckets from anon, authenticated;
revoke all on function public.consume_rate_limit(text, integer, integer) from public;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;
