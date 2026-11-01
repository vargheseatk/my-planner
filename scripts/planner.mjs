// Local CLI Claude uses to read and write the planner. Uses the secret key from .env,
// which bypasses RLS, so every write sets owner explicitly.
//
//   npm run planner -- snapshot                       everything open, as JSON
//   npm run planner -- idea "text" [--track slug]
//   npm run planner -- task "title" [--track slug] [--due 2026-11-15] [--start 2026-11-08]
//                          [--priority 1] [--check "step a|step b"] [--notes "..."] [--waiting "who"]
//   npm run planner -- done <task id or id prefix>
//   npm run planner -- insert <table> <json | @file.json>   (object or array)
//   npm run planner -- update <table> <id> <json | @file.json>
//   npm run planner -- delete <table> <id>
//   npm run planner -- day <YYYY-MM-DD> <json | @file.json>  upsert that day's plan
//   npm run planner -- seed <file.json>                       { tracks, principles, tasks, milestones, ideas }
//
// In JSON, "track": "<slug>" is translated to track_id.
import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const TABLES = ['tracks', 'principles', 'ideas', 'tasks', 'milestones', 'days']

const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env
if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) fail('SUPABASE_URL / SUPABASE_SECRET_KEY missing from .env')

const db = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

function fail(msg) {
  console.error(msg)
  process.exit(1)
}

function parseArgs(argv) {
  const pos = []
  const flags = {}
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) flags[argv[i].slice(2)] = argv[i + 1]?.startsWith('--') ? true : argv[++i] ?? true
    else pos.push(argv[i])
  }
  return { pos, flags }
}

function readJson(arg) {
  if (!arg) fail('missing JSON argument')
  return JSON.parse(arg.startsWith('@') ? readFileSync(arg.slice(1), 'utf8') : arg)
}

function check(res) {
  if (res.error) fail(res.error.message)
  return res.data
}

let ownerId
async function owner() {
  if (ownerId) return ownerId
  if (process.env.PLANNER_OWNER_ID) return (ownerId = process.env.PLANNER_OWNER_ID)
  const { data, error } = await db.auth.admin.listUsers({ perPage: 2 })
  if (error) fail(error.message)
  if (data.users.length !== 1) fail(`expected exactly 1 user, found ${data.users.length}; set PLANNER_OWNER_ID in .env`)
  return (ownerId = data.users[0].id)
}

let trackMap
async function trackId(slug) {
  if (!trackMap) {
    const rows = check(await db.from('tracks').select('id, slug').eq('owner', await owner()))
    trackMap = Object.fromEntries(rows.map((r) => [r.slug, r.id]))
  }
  if (!(slug in trackMap)) fail(`unknown track "${slug}". Known: ${Object.keys(trackMap).join(', ')}`)
  return trackMap[slug]
}

// Translate { track: slug } to { track_id } and stamp owner.
async function prepare(row, { stampOwner = true } = {}) {
  const out = { ...row }
  if ('track' in out) {
    out.track_id = out.track ? await trackId(out.track) : null
    delete out.track
  }
  if ('focus_track' in out) {
    out.focus_track_id = out.focus_track ? await trackId(out.focus_track) : null
    delete out.focus_track
  }
  if (stampOwner) out.owner = await owner()
  return out
}

function table(name) {
  if (!TABLES.includes(name)) fail(`unknown table "${name}". Tables: ${TABLES.join(', ')}`)
  return name
}

async function resolveId(tbl, idOrPrefix) {
  if (/^[0-9a-f-]{36}$/i.test(idOrPrefix)) return idOrPrefix
  const rows = check(await db.from(tbl).select('id').eq('owner', await owner()))
  const hits = rows.filter((r) => r.id.startsWith(idOrPrefix))
  if (hits.length !== 1) fail(`id prefix "${idOrPrefix}" matched ${hits.length} rows in ${tbl}`)
  return hits[0].id
}

const today = () => new Date().toLocaleDateString('en-CA') // YYYY-MM-DD, local time

const commands = {
  async snapshot() {
    const o = await owner()
    const q = (t) => db.from(t).select('*').eq('owner', o)
    const [tracks, principles, tasks, ideas, milestones, days] = await Promise.all([
      q('tracks').order('sort'),
      q('principles').eq('active', true).order('sort'),
      q('tasks').in('status', ['todo', 'doing', 'waiting']).order('due_on', { nullsFirst: false }),
      q('ideas').eq('status', 'inbox').order('created_at', { ascending: false }),
      q('milestones').eq('done', false).order('due_on'),
      q('days').gte('day', today()).order('day').limit(7),
    ].map(async (p) => check(await p)))
    const slug = Object.fromEntries(tracks.map((t) => [t.id, t.slug]))
    const tag = (r) => ({ ...r, owner: undefined, track: slug[r.track_id] ?? null })
    console.log(JSON.stringify({
      today: today(),
      tracks: tracks.map((t) => ({ ...t, owner: undefined })),
      principles: principles.map(tag),
      open_tasks: tasks.map(tag),
      inbox: ideas.map(tag),
      milestones: milestones.map(tag),
      upcoming_days: days.map((d) => ({ ...d, owner: undefined, focus_track: slug[d.focus_track_id] ?? null })),
    }, null, 2))
  },

  async idea({ pos, flags }) {
    const body = pos.join(' ')
    if (!body) fail('idea text required')
    const row = await prepare({ body, source: 'claude', ...(flags.track ? { track: flags.track } : {}) })
    const out = check(await db.from('ideas').insert(row).select('id').single())
    console.log(`idea ${out.id}`)
  },

  async task({ pos, flags }) {
    const title = pos.join(' ')
    if (!title) fail('task title required')
    const row = await prepare({
      title,
      ...(flags.track && { track: flags.track }),
      ...(flags.due && { due_on: flags.due }),
      ...(flags.start && { start_on: flags.start }),
      ...(flags.priority && { priority: Number(flags.priority) }),
      ...(flags.notes && { notes: flags.notes }),
      ...(flags.waiting && { waiting_on: flags.waiting, status: 'waiting' }),
      ...(flags.check && { checklist: String(flags.check).split('|').map((text) => ({ text: text.trim(), done: false })) }),
    })
    const out = check(await db.from('tasks').insert(row).select('id').single())
    console.log(`task ${out.id}`)
  },

  async done({ pos }) {
    const id = await resolveId('tasks', pos[0] ?? fail('task id required'))
    check(await db.from('tasks').update({ status: 'done' }).eq('id', id).eq('owner', await owner()))
    console.log(`done ${id}`)
  },

  async insert({ pos }) {
    const tbl = table(pos[0])
    const data = readJson(pos[1])
    const rows = await Promise.all((Array.isArray(data) ? data : [data]).map((r) => prepare(r)))
    const out = check(await db.from(tbl).insert(rows).select('id'))
    console.log(`inserted ${out.length} into ${tbl}: ${out.map((r) => r.id).join(', ')}`)
  },

  async update({ pos }) {
    const tbl = table(pos[0])
    const id = await resolveId(tbl, pos[1] ?? fail('id required'))
    const patch = await prepare(readJson(pos[2]), { stampOwner: false })
    check(await db.from(tbl).update(patch).eq('id', id).eq('owner', await owner()))
    console.log(`updated ${tbl} ${id}`)
  },

  async delete({ pos }) {
    const tbl = table(pos[0])
    const id = await resolveId(tbl, pos[1] ?? fail('id required'))
    check(await db.from(tbl).delete().eq('id', id).eq('owner', await owner()))
    console.log(`deleted ${tbl} ${id}`)
  },

  async day({ pos }) {
    const day = pos[0] ?? fail('date required')
    const row = await prepare({ ...readJson(pos[1]), day })
    check(await db.from('days').upsert(row, { onConflict: 'owner,day' }))
    console.log(`day ${day} saved`)
  },

  async seed({ pos }) {
    const data = readJson('@' + (pos[0] ?? fail('seed file required')))
    const o = await owner()
    const existing = check(await db.from('tracks').select('id').eq('owner', o))
    if (existing.length) fail('tracks already exist; seed only runs on an empty planner')
    if (data.tracks?.length) {
      check(await db.from('tracks').insert(data.tracks.map((t, i) => ({ sort: i, ...t, owner: o }))))
      trackMap = undefined
    }
    for (const tbl of ['principles', 'tasks', 'milestones', 'ideas']) {
      if (!data[tbl]?.length) continue
      const rows = await Promise.all(data[tbl].map((r, i) => prepare(tbl === 'principles' || tbl === 'tasks' ? { sort: i, ...r } : r)))
      check(await db.from(tbl).insert(rows))
      console.log(`seeded ${rows.length} ${tbl}`)
    }
    console.log(`seeded ${data.tracks?.length ?? 0} tracks`)
  },
}

const [cmd, ...rest] = process.argv.slice(2)
if (!commands[cmd]) fail(`commands: ${Object.keys(commands).join(', ')}`)
await commands[cmd](parseArgs(rest))
