-- Top reach-outs: the people he most needs to follow up with (green circle in the list).
alter table public.outreach add column top boolean not null default false;
