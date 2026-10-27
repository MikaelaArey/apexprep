-- ApexPrep database schema.
-- Run in the Supabase dashboard: SQL Editor → New query → paste all of this → Run.
-- Safe to run again; it only creates what's missing and refreshes functions.
--
-- Model: the phone's database is the source of truth. These tables are its
-- backup and the way progress moves between devices. Each row belongs to one
-- user and row-level security keeps it private to them.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.attempts (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id uuid not null,
  data jsonb not null,
  item_id text not null,
  exam text not null check (exam in ('LSAT', 'MCAT')),
  correct boolean not null,
  at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists attempts_user_updated_idx on public.attempts (user_id, updated_at);
create index if not exists attempts_item_idx on public.attempts (item_id);

create table if not exists public.reviews (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id uuid not null,
  data jsonb not null,
  at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists reviews_user_updated_idx on public.reviews (user_id, updated_at);

create table if not exists public.xp_events (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id uuid not null,
  data jsonb not null,
  at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists xp_events_user_updated_idx on public.xp_events (user_id, updated_at);

create table if not exists public.cards (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kp_id text not null,
  data jsonb not null,
  client_updated_at bigint not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, kp_id)
);
create index if not exists cards_user_updated_idx on public.cards (user_id, updated_at);

create table if not exists public.profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  client_updated_at bigint not null default 0,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at is the sync cursor, so it must change on every update.
-- Cards and settings keep whichever copy a device changed most recently.
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create or replace function public.keep_newer() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.client_updated_at < old.client_updated_at then
    return old;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists attempts_touch on public.attempts;
create trigger attempts_touch before update on public.attempts
  for each row execute function public.touch_updated_at();

drop trigger if exists cards_keep_newer on public.cards;
create trigger cards_keep_newer before update on public.cards
  for each row execute function public.keep_newer();

drop trigger if exists profiles_keep_newer on public.profiles;
create trigger profiles_keep_newer before update on public.profiles
  for each row execute function public.keep_newer();

-- ---------------------------------------------------------------------------
-- Row-level security: people can only read and write their own rows.
-- Guest (anonymous) accounts use the authenticated role too.
-- ---------------------------------------------------------------------------

alter table public.attempts enable row level security;
alter table public.reviews enable row level security;
alter table public.xp_events enable row level security;
alter table public.cards enable row level security;
alter table public.profiles enable row level security;

drop policy if exists "own rows" on public.attempts;
create policy "own rows" on public.attempts for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "own rows" on public.reviews;
create policy "own rows" on public.reviews for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "own rows" on public.xp_events;
create policy "own rows" on public.xp_events for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "own rows" on public.cards;
create policy "own rows" on public.cards for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "own rows" on public.profiles;
create policy "own rows" on public.profiles for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- How everyone answered a question: counts of each student's first answer.
-- Returns aggregates only; the app shows them once 30+ students have answered.
-- ---------------------------------------------------------------------------

create or replace function public.item_answer_counts(p_item_id text)
returns table (selected text, n bigint)
language sql stable security definer set search_path = '' as $$
  select first_answer.selected, count(*) as n
  from (
    select distinct on (a.user_id) a.data ->> 'selected' as selected
    from public.attempts a
    where a.item_id = p_item_id
    order by a.user_id, a.at
  ) as first_answer
  group by first_answer.selected;
$$;
revoke all on function public.item_answer_counts(text) from public, anon;
grant execute on function public.item_answer_counts(text) to authenticated;

-- ---------------------------------------------------------------------------
-- In-app account deletion (required by App Store Review Guideline 5.1.1(v)).
-- Deleting the auth user cascades to every table above.
-- ---------------------------------------------------------------------------

create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from auth.users where id = (select auth.uid());
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Optional housekeeping, run now and then: remove guest accounts nobody has
-- opened in 90 days.
-- delete from auth.users where is_anonymous and last_sign_in_at < now() - interval '90 days';
