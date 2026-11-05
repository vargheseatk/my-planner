-- Reach out: people Varghese wants to contact. Who they are, what he wants to learn from them,
-- the message he plans to send and where, and how far it has got.
create table public.outreach (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null,
  company     text,
  questions   text,              -- what he wants to know from them
  draft       text,              -- the message he plans to send
  platform    text,              -- LinkedIn, Email, WhatsApp, Instagram, ... (free text)
  status      text not null default 'draft' check (status in ('draft', 'sent', 'replied', 'done')),
  sent_on     date,
  notes       text,              -- what came of it
  sort        int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger outreach_touch before update on public.outreach for each row execute function public.touch_updated_at();
alter table public.outreach enable row level security;
create policy owner_all on public.outreach for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create index outreach_owner_idx on public.outreach (owner);
alter publication supabase_realtime add table public.outreach;
