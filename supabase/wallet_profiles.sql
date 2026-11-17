-- Public searchable profiles for Privy / in-app Solana wallets.
-- Run in the same Supabase project (SQL Editor). Safe to re-run.

create table if not exists public.wallet_profiles (
  address text primary key,
  username text not null,
  display_name text not null,
  bio text not null default '',
  updated_at timestamptz not null default now()
);

create unique index if not exists wallet_profiles_username_lower_idx
  on public.wallet_profiles (lower(username));

alter table public.wallet_profiles enable row level security;

drop policy if exists "wallet_profiles_public_read" on public.wallet_profiles;
create policy "wallet_profiles_public_read"
  on public.wallet_profiles for select
  using (true);

-- Mobile clients upsert by Solana address (no Supabase auth for Privy users).
drop policy if exists "wallet_profiles_public_upsert" on public.wallet_profiles;
create policy "wallet_profiles_public_upsert"
  on public.wallet_profiles for insert
  with check (true);

drop policy if exists "wallet_profiles_public_update" on public.wallet_profiles;
create policy "wallet_profiles_public_update"
  on public.wallet_profiles for update
  using (true)
  with check (true);

grant select, insert, update on public.wallet_profiles to anon, authenticated;
