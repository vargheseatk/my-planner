# My Planner

Personal planner: tracks, tasks with checklists, ideas inbox, principles, milestones, day plans.
React + Vite on GitHub Pages, Supabase for data and auth. See `CLAUDE.md` for how Claude pushes to it.

## Setup

1. `npm install`
2. Fill `.env` (copy of `.env.example`): secret key and DB connection string.
3. `npm run migrate -- supabase/migrations/0001_init.sql`
4. In Supabase: create your user (Authentication > Users > Add user), turn off "Allow new users to sign up",
   add `{{ .Token }}` to the Magic Link email template, add the Pages URL to Auth > URL Configuration.
5. `npm run planner -- seed supabase/seed.json` (seed.json is gitignored: personal content)
6. `npm run dev`
