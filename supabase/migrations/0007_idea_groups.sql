-- Ideas notebook: one-liner ideas gathered under headings (a film, "Reels", a business thought...).
-- Ideas without a heading are Unsorted. Headings are not tracks: nothing here is a task until he makes it one.
create table public.idea_groups (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null,
  color       text not null default '#8a7f72',
  sort        int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger idea_groups_touch before update on public.idea_groups for each row execute function public.touch_updated_at();
alter table public.idea_groups enable row level security;
create policy owner_all on public.idea_groups for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create index idea_groups_owner_idx on public.idea_groups (owner);
alter publication supabase_realtime add table public.idea_groups;

alter table public.ideas add column group_id uuid references public.idea_groups(id) on delete set null;
alter table public.ideas add column sort int not null default 0;
