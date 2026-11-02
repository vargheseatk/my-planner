-- Tracks are grouped into life areas; tasks sit in a "now" (priority) or "later" lane.
-- Tasks without a track are errands: small reminders that need no bigger picture.

alter table tracks add column area text not null default 'personal'
  check (area in ('filmmaking', 'business', 'personal'));

alter table tasks add column lane text not null default 'later'
  check (lane in ('now', 'later'));

update tracks set area = 'filmmaking' where slug in ('priyamvada', 'screenplays', 'comedy-shorts');
update tracks set area = 'business' where slug in ('monastery', 'youtube', 'airytek-dashboard', 'income');

update tasks set lane = 'now'
where status in ('todo', 'doing', 'waiting')
  and (priority = 1 or status = 'doing' or due_on <= current_date + 7);
