-- Beliefs: "know myself". The worldviews that actually drive Varghese's actions (kind = belief),
-- and the tensions he is still holding between them (kind = tension). Distinct from principles,
-- which are rules he chooses to follow; these are noticed, not decided.
create table public.beliefs (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind        text not null default 'belief' check (kind in ('belief', 'tension')),
  title       text not null,
  body        text,
  in_practice text,              -- how it shows up in what he actually does
  sort        int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger beliefs_touch before update on public.beliefs for each row execute function public.touch_updated_at();
alter table public.beliefs enable row level security;
create policy owner_all on public.beliefs for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create index beliefs_owner_idx on public.beliefs (owner);
alter publication supabase_realtime add table public.beliefs;
