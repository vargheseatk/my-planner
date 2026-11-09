import { useState } from "react";
import { addDays, fmtDay, todayIso, weekStart } from "../dates";
import { useStore } from "../store";
import type { Habit, HabitLog } from "../types";
import { Icon } from "../components/icons";
import { AddLine, EditText, Segmented } from "../components/ui";
import { SortableList, sortPatches } from "../components/Sortable";

const MOTTO_KEY = "habits_motto";
const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

export const activeHabits = (habits: Habit[]) =>
  habits
    .filter((h) => h.active)
    .sort(
      (a, b) => a.sort - b.sort || a.created_at.localeCompare(b.created_at),
    );

// Days in a row, counting back from today (or from yesterday while today is still open).
function streak(done: Set<string>, today: string) {
  let day = done.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (done.has(day)) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

// Habit tracker: a week of tap-to-mark circles per habit, the motto on top, each habit's "why" below.
export function Habits() {
  const { data, insert, update, remove, updateMany } = useStore();
  const today = todayIso();
  const [mode, setMode] = useState<"week" | "month">("week");
  const [weekOf, setWeekOf] = useState(() => weekStart(today));
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekOf, i));
  const habits = activeHabits(data.habits);
  const logsBy = new Map<string, HabitLog[]>();
  for (const l of data.habit_logs)
    logsBy.set(l.habit_id, [...(logsBy.get(l.habit_id) ?? []), l]);

  const motto = data.settings.find((s) => s.key === MOTTO_KEY);
  const saveMotto = (value: string) =>
    motto
      ? update("settings", motto.id, { value: value || null })
      : value && insert("settings", { key: MOTTO_KEY, value });

  const toggle = (h: Habit, day: string) => {
    const hit = (logsBy.get(h.id) ?? []).find((l) => l.day === day);
    if (hit) remove("habit_logs", hit.id);
    else insert("habit_logs", { habit_id: h.id, day });
  };

  return (
    <div className="panel habits-panel">
      <EditText
        multiline
        className="habit-motto"
        value={motto?.value ?? null}
        placeholder="A line to keep you going"
        onSave={saveMotto}
      />

      <div className="habit-mode">
        <Segmented
          small
          value={mode}
          options={[
            { value: "week", label: "Week" },
            { value: "month", label: "Month" },
          ]}
          onChange={setMode}
        />
      </div>

      {mode === "month" ? (
        <MonthSummary
          habits={habits}
          logsBy={logsBy}
          today={today}
          onToggle={toggle}
        />
      ) : (
        <>
          <div className="habit-week">
            <button
              className="icon-btn ghost"
              aria-label="Previous week"
              onClick={() => setWeekOf(addDays(weekOf, -7))}
            >
              <Icon name="left" size={18} />
            </button>
            <button
              className="link-plain habit-range"
              onClick={() => setWeekOf(weekStart(today))}
              title="Back to this week"
            >
              {weekOf === weekStart(today)
                ? "This week"
                : `${fmtDay(days[0], { day: "numeric", month: "short" })} – ${fmtDay(days[6], { day: "numeric", month: "short" })}`}
            </button>
            <button
              className="icon-btn ghost"
              aria-label="Next week"
              disabled={weekOf >= weekStart(today)}
              onClick={() => setWeekOf(addDays(weekOf, 7))}
            >
              <Icon name="right" size={18} />
            </button>
          </div>

          <div className="habit-grid">
            <div className="habit-row habit-days">
              <span />
              <span className="habit-name-col" />
              {days.map((d, i) => (
                <span
                  key={d}
                  className={`habit-day ${d === today ? "today" : ""}`}
                >
                  {DAY_LETTERS[i]}
                  <em>{Number(d.slice(8))}</em>
                </span>
              ))}
            </div>
            <SortableList
              items={habits}
              id={(h) => h.id}
              onReorder={(next) => updateMany("habits", sortPatches(next))}
            >
              {(h, grip) => {
                const logs = logsBy.get(h.id) ?? [];
                const done = new Set(logs.map((l) => l.day));
                const s = streak(done, today);
                return (
                  <div
                    className="habit-row"
                    style={{ "--c": h.color } as React.CSSProperties}
                  >
                    {grip}
                    <span className="habit-name-col">
                      <EditText
                        className="habit-name"
                        value={h.name}
                        onSave={(name) =>
                          name.trim() &&
                          update("habits", h.id, { name: name.trim() })
                        }
                      />
                      <span className="habit-meta">
                        {h.goal_count ? (
                          <span className="habit-goal">
                            <span className="bar">
                              <span
                                style={{
                                  width: `${Math.min(100, (logs.length / h.goal_count) * 100)}%`,
                                }}
                              />
                            </span>
                            {logs.length}/{h.goal_count}
                          </span>
                        ) : null}
                        {s > 0 && <span>{s}-day streak</span>}
                      </span>
                    </span>
                    {days.map((d) => (
                      <button
                        key={d}
                        className={`habit-cell ${done.has(d) ? "on" : ""} ${d === today ? "today" : ""}`}
                        disabled={d > today}
                        aria-pressed={done.has(d)}
                        aria-label={`${h.name}, ${fmtDay(d)}`}
                        onClick={() => toggle(h, d)}
                      >
                        <Icon name="check" size={13} />
                      </button>
                    ))}
                  </div>
                );
              }}
            </SortableList>
            <AddLine
              placeholder="Add a habit"
              onAdd={(name) => insert("habits", { name, sort: habits.length })}
            />
          </div>
        </>
      )}

      {habits.length > 0 && (
        <section className="habit-whys">
          {habits.map((h) => (
            <div
              key={h.id}
              className="habit-why"
              style={{ "--c": h.color } as React.CSSProperties}
            >
              <span className="habit-why-name">{h.name}</span>
              <EditText
                multiline
                className="habit-why-text"
                value={h.principle}
                placeholder="Why this one matters"
                onSave={(principle) =>
                  update("habits", h.id, { principle: principle || null })
                }
              />
              <span className="habit-why-tools">
                <label title="Optional finish line, in days done">
                  Goal
                  <input
                    className="habit-goal-input"
                    type="number"
                    min={1}
                    defaultValue={h.goal_count ?? ""}
                    placeholder="–"
                    onBlur={(e) => {
                      const v = e.target.value
                        ? Math.max(1, Math.round(Number(e.target.value)))
                        : null;
                      if (v !== h.goal_count)
                        update("habits", h.id, { goal_count: v });
                    }}
                  />
                </label>
                <button
                  className="icon-btn ghost small"
                  aria-label={`Delete ${h.name}`}
                  onClick={() =>
                    confirm(`Delete ${h.name} and its history?`) &&
                    remove("habits", h.id)
                  }
                >
                  <Icon name="trash" size={14} />
                </button>
              </span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

// Month summary: per habit, days done out of days so far, best run, and a small calendar you can tap.
function MonthSummary({
  habits,
  logsBy,
  today,
  onToggle,
}: {
  habits: Habit[];
  logsBy: Map<string, HabitLog[]>;
  today: string;
  onToggle: (h: Habit, day: string) => void;
}) {
  const [monthOf, setMonthOf] = useState(() => today.slice(0, 8) + "01");
  const nextMonth = (m: string, n: number) => {
    const d = new Date(m + "T00:00:00");
    d.setMonth(d.getMonth() + n);
    return d.toLocaleDateString("en-CA").slice(0, 8) + "01";
  };
  const end = addDays(nextMonth(monthOf, 1), -1);
  const days = Array.from({ length: Number(end.slice(8)) }, (_, i) =>
    addDays(monthOf, i),
  );
  const elapsed = days.filter((d) => d <= today).length;
  const lead = (new Date(monthOf + "T00:00:00").getDay() + 6) % 7; // blanks before the 1st (Monday-first)
  const isCurrent = monthOf === today.slice(0, 8) + "01";

  return (
    <>
      <div className="habit-week">
        <button
          className="icon-btn ghost"
          aria-label="Previous month"
          onClick={() => setMonthOf(nextMonth(monthOf, -1))}
        >
          <Icon name="left" size={18} />
        </button>
        <button
          className="link-plain habit-range"
          onClick={() => setMonthOf(today.slice(0, 8) + "01")}
          title="Back to this month"
        >
          {fmtDay(monthOf, { month: "long", year: "numeric" })}
        </button>
        <button
          className="icon-btn ghost"
          aria-label="Next month"
          disabled={isCurrent}
          onClick={() => setMonthOf(nextMonth(monthOf, 1))}
        >
          <Icon name="right" size={18} />
        </button>
      </div>
      <div className="habit-months">
        {habits.map((h) => {
          const done = new Set((logsBy.get(h.id) ?? []).map((l) => l.day));
          const count = days.filter((d) => done.has(d)).length;
          let best = 0;
          let run = 0;
          for (const d of days) {
            run = done.has(d) ? run + 1 : 0;
            best = Math.max(best, run);
          }
          const pct = elapsed ? Math.round((count / elapsed) * 100) : 0;
          return (
            <div
              key={h.id}
              className="habit-month"
              style={{ "--c": h.color } as React.CSSProperties}
            >
              <div className="hm-head">
                <span className="hm-name">{h.name}</span>
                <span className="hm-pct">{pct}%</span>
              </div>
              <div className="hm-stats">
                <span>
                  <b>{count}</b>/{elapsed} days
                </span>
                {best > 1 && (
                  <span>
                    best run <b>{best}</b>
                  </span>
                )}
                {h.goal_count ? (
                  <span>
                    total <b>{(logsBy.get(h.id) ?? []).length}</b>/
                    {h.goal_count}
                  </span>
                ) : null}
              </div>
              <div className="hm-cal">
                {DAY_LETTERS.map((l, i) => (
                  <span key={"h" + i} className="hm-dow">
                    {l}
                  </span>
                ))}
                {Array.from({ length: lead }, (_, i) => (
                  <span key={"b" + i} />
                ))}
                {days.map((d) => (
                  <button
                    key={d}
                    className={`hm-day ${done.has(d) ? "on" : ""} ${d === today ? "today" : ""}`}
                    disabled={d > today}
                    aria-pressed={done.has(d)}
                    aria-label={`${h.name}, ${fmtDay(d)}`}
                    title={fmtDay(d)}
                    onClick={() => onToggle(h, d)}
                  >
                    {Number(d.slice(8))}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
