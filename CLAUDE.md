# My Planner

Varghese's personal planner: tracks, tasks with checklists, an ideas inbox, principles, milestones and day plans.
Static React app (Vite) on GitHub Pages; data in Supabase (personal account, project `isjyfqwpwutpvdydsili`).
No AI API anywhere: Claude reads and writes the planner from chat via the local CLI below.

## Pushing to the planner from chat

Only push when Varghese asks ("put this in the planner", "plan tomorrow", "add these ideas").
Always run `snapshot` first so you work from current state (he also edits in the portal).

```bash
npm run planner -- snapshot                                   # open tasks, inbox, tracks, principles, milestones, next 7 days
npm run planner -- idea "text" --track screenplays            # source=claude, lands in the Ideas inbox
npm run planner -- task "title" --track priyamvada --due 2026-11-07 --priority 1 --check "a|b|c"
npm run planner -- done <task id or prefix>
npm run planner -- update tasks <id> '{"status":"waiting","waiting_on":"composer"}'
npm run planner -- insert principles '{"track":"monastery","title":"...","body":"..."}'
npm run planner -- day 2026-11-02 '{"focus_track":"priyamvada","intention":"...","top_task_ids":["<id>"],"blocks":[{"time":"07:00","label":"Parents sequencing","done":false}]}'
```

- `"track": "<slug>"` / `"focus_track": "<slug>"` are translated to ids. Slugs: priyamvada, screenplays, monastery, youtube, airytek-dashboard, income, comedy-shorts (check `snapshot` for current ones).
- For long JSON, write it to a scratch file and pass `@path/to/file.json`.
- Task statuses: todo, doing, waiting, done, dropped. Priority 1 = high, 2 = normal, 3 = low.
- Checklists are `[{ "text", "done" }]` on the task; blocks are `[{ "time", "label", "done" }]` on the day.
- `update` merges into the row, but `checklist`/`blocks` replace the whole array: read, modify, write back.
- After writing, tell him in plain words what changed. The portal updates live.

## Data model

`supabase/migrations/*.sql` is the source of truth. Tables: tracks, principles (track_id null = global),
ideas, tasks, milestones, days. Every row has `owner`; RLS restricts all access to `owner = auth.uid()`.

## Secrets

- `src/config.ts` holds the URL and the **publishable** key: public by design, safe in the repo.
- `.env` (gitignored) holds `SUPABASE_SECRET_KEY` and `SUPABASE_DB_URL`. Never commit, print or paste these.
  Varghese fills them in himself.

## Dev

- `npm run dev` for localhost, `npm run build` to type-check and build.
- Migrations: `npm run migrate -- supabase/migrations/000N_name.sql`.
- Deploys: GitHub Actions builds and publishes to Pages on push to `main`. Build and verify locally,
  commit locally, push only when Varghese says so.
