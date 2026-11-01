export type TrackStatus = 'active' | 'paused' | 'parked' | 'done'
export type TaskStatus = 'todo' | 'doing' | 'waiting' | 'done' | 'dropped'
export type IdeaStatus = 'inbox' | 'kept' | 'parked' | 'converted' | 'dropped'

export interface Track {
  id: string
  slug: string
  name: string
  color: string
  status: TrackStatus
  purpose: string | null
  next_step: string | null
  review_on: string | null
  notes: string | null
  sort: number
}

export interface Principle {
  id: string
  track_id: string | null
  title: string
  body: string | null
  active: boolean
  sort: number
}

export interface Idea {
  id: string
  body: string
  track_id: string | null
  status: IdeaStatus
  source: 'portal' | 'claude'
  created_at: string
}

export interface CheckItem {
  text: string
  done: boolean
}

export interface Task {
  id: string
  track_id: string | null
  title: string
  notes: string | null
  status: TaskStatus
  waiting_on: string | null
  start_on: string | null
  due_on: string | null
  priority: number
  checklist: CheckItem[]
  done_at: string | null
  sort: number
  created_at: string
}

export interface Milestone {
  id: string
  track_id: string | null
  title: string
  due_on: string
  done: boolean
  notes: string | null
}

export interface Block {
  time: string
  label: string
  done: boolean
}

export interface Day {
  id: string
  day: string
  focus_track_id: string | null
  intention: string | null
  top_task_ids: string[]
  blocks: Block[]
  reflection: string | null
  energy: number | null
}

export interface Data {
  tracks: Track[]
  principles: Principle[]
  ideas: Idea[]
  tasks: Task[]
  milestones: Milestone[]
  days: Day[]
}

export type TableName = keyof Data
