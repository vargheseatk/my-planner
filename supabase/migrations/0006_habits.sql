-- Habits: daily things he wants to keep doing (gym, meditation...). One log row per habit per day done.
-- goal_count is an optional finish line (Daily Film: 100 films).
create table public.habits (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null,
  principle   text,              -- the small line shown under the tracker
  goal_count  int,               -- optional finish line, counted in days done
  color       text not null default '#3d8a55',
  active      boolean not null default true,
  sort        int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.habit_logs (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  habit_id    uuid not null references public.habits(id) on delete cascade,
  day         date not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (habit_id, day)
);

-- Small key/value settings, e.g. the motto on top of the habit tracker.
create table public.settings (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  key         text not null,
  value       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (owner, key)
);

do $$
declare t text;
begin
  foreach t in array array['habits','habit_logs','settings'] loop
    execute format('create trigger %I_touch before update on public.%I for each row execute function public.touch_updated_at()', t, t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy owner_all on public.%I for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid())', t);
    execute format('create index %I_owner_idx on public.%I (owner)', t, t);
    execute format('alter publication supabase_realtime add table public.%I', t);
  end loop;
end $$;
