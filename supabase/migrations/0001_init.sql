-- My Planner: initial schema.
-- Single-owner app: every row carries owner = auth.uid(), and RLS only lets
-- the owner see or change it. The local CLI uses the secret key (bypasses RLS)
-- and sets owner explicitly.

create extension if not exists pgcrypto;

-- updated_at helper
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- Tracks: the parallel streams of work/life.
create table public.tracks (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  slug        text not null,
  name        text not null,
  color       text not null default '#8a8a8a',
  status      text not null default 'active' check (status in ('active','paused','parked','done')),
  purpose     text,              -- why this track exists
  next_step   text,              -- the one next physical action
  review_on   date,              -- when to revisit a paused/parked track
  notes       text,
  sort        int  not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (owner, slug)
);

-- Principles: global (track_id null) or per-track mindset rules.
create table public.principles (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  track_id    uuid references public.tracks(id) on delete cascade,
  title       text not null,
  body        text,
  active      boolean not null default true,
  sort        int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Ideas: quick-capture inbox, triaged later.
create table public.ideas (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body        text not null,
  track_id    uuid references public.tracks(id) on delete set null,
  status      text not null default 'inbox' check (status in ('inbox','kept','parked','converted','dropped')),
  source      text not null default 'portal' check (source in ('portal','claude')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Tasks: next steps with an embedded checklist [{ "text": "...", "done": false }].
create table public.tasks (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  track_id    uuid references public.tracks(id) on delete set null,
  title       text not null,
  notes       text,
  status      text not null default 'todo' check (status in ('todo','doing','waiting','done','dropped')),
  waiting_on  text,              -- who/what this is blocked on
  start_on    date,              -- earliest day it can be worked on
  due_on      date,
  priority    int  not null default 2 check (priority between 1 and 3), -- 1 = high
  checklist   jsonb not null default '[]'::jsonb,
  done_at     timestamptz,
  sort        int  not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Milestones: dated targets.
create table public.milestones (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  track_id    uuid references public.tracks(id) on delete set null,
  title       text not null,
  due_on      date not null,
  done        boolean not null default false,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Days: one plan per date. blocks = [{ "time": "07:00", "label": "...", "done": false }]
create table public.days (
  id             uuid primary key default gen_random_uuid(),
  owner          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day            date not null,
  focus_track_id uuid references public.tracks(id) on delete set null,
  intention      text,
  top_task_ids   uuid[] not null default '{}',
  blocks         jsonb not null default '[]'::jsonb,
  reflection     text,
  energy         int check (energy between 1 and 5),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (owner, day)
);

-- Triggers, RLS, realtime for every table.
do $$
declare t text;
begin
  foreach t in array array['tracks','principles','ideas','tasks','milestones','days'] loop
    execute format('create trigger %I_touch before update on public.%I for each row execute function public.touch_updated_at()', t, t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy owner_all on public.%I for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid())', t);
    execute format('create index %I_owner_idx on public.%I (owner)', t, t);
    execute format('alter publication supabase_realtime add table public.%I', t);
  end loop;
end $$;

-- Keep done_at in sync with status.
create or replace function public.tasks_done_at() returns trigger
language plpgsql as $$
begin
  if new.status = 'done' and (old is null or old.status <> 'done') then
    new.done_at = now();
  elsif new.status <> 'done' then
    new.done_at = null;
  end if;
  return new;
end $$;

create trigger tasks_done_at before insert or update on public.tasks
  for each row execute function public.tasks_done_at();
