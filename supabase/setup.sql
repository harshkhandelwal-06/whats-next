-- What's Next: database setup. Paste this whole file into Supabase -> SQL Editor -> Run. Safe to run more than once.

-- One private row per account: all of that account's profiles, lists and ratings.
create table if not exists public.wn_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.wn_data enable row level security;
drop policy if exists "own data read" on public.wn_data;
drop policy if exists "own data insert" on public.wn_data;
drop policy if exists "own data update" on public.wn_data;
drop policy if exists "own data delete" on public.wn_data;
create policy "own data read"   on public.wn_data for select to authenticated using (auth.uid() = user_id);
create policy "own data insert" on public.wn_data for insert to authenticated with check (auth.uid() = user_id);
create policy "own data update" on public.wn_data for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own data delete" on public.wn_data for delete to authenticated using (auth.uid() = user_id);

-- Movie night share codes: a small copy of someone's watched/saved titles, under a random code.
create table if not exists public.wn_shares (
  code text primary key,
  owner uuid not null references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.wn_shares enable row level security;
drop policy if exists "own shares read" on public.wn_shares;
drop policy if exists "own shares insert" on public.wn_shares;
drop policy if exists "own shares update" on public.wn_shares;
drop policy if exists "own shares delete" on public.wn_shares;
create policy "own shares read"   on public.wn_shares for select to authenticated using (auth.uid() = owner);
create policy "own shares insert" on public.wn_shares for insert to authenticated with check (auth.uid() = owner);
create policy "own shares update" on public.wn_shares for update to authenticated using (auth.uid() = owner) with check (auth.uid() = owner);
create policy "own shares delete" on public.wn_shares for delete to authenticated using (auth.uid() = owner);

-- Friends read a share only by knowing its exact code (nobody can list the table).
create or replace function public.wn_get_share(p_code text) returns jsonb
language sql security definer set search_path = public stable as $$
  select data from public.wn_shares where code = p_code limit 1;
$$;
revoke all on function public.wn_get_share(text) from public;
grant execute on function public.wn_get_share(text) to authenticated;
