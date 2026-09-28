-- Run once in Supabase → SQL Editor.
-- One generic table: every record (commitment, outcome, day, week, philosophy)
-- is a JSON document, merged last-write-wins on updated_at.

create table if not exists public.records (
  user_id    uuid    not null default auth.uid() references auth.users on delete cascade,
  collection text    not null,
  id         text    not null,
  data       jsonb   not null,
  updated_at bigint  not null,
  deleted    boolean not null default false,
  primary key (user_id, collection, id)
);

alter table public.records enable row level security;

create policy "own records" on public.records for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Ignore an update carrying an older timestamp than what's stored, so a device
-- that was offline can't overwrite newer changes from another device.
create or replace function public.keep_newest() returns trigger
language plpgsql as $$
begin
  if new.updated_at < old.updated_at then
    return old;
  end if;
  return new;
end $$;

drop trigger if exists records_keep_newest on public.records;
create trigger records_keep_newest before update on public.records
  for each row execute function public.keep_newest();

-- ---------- Reminders (web push) ----------
create table if not exists public.push_subscriptions (
  endpoint     text        primary key,
  user_id      uuid        not null default auth.uid() references auth.users on delete cascade,
  subscription jsonb       not null,
  time_zone    text        not null default 'UTC',
  prefs        jsonb       not null,
  last_sent    jsonb       not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

create policy "own subscriptions" on public.push_subscriptions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
