"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Exam, Project, ScheduleEntry } from "@/lib/types";
import {
  CALENDAR_KIND_STYLES,
  CALENDAR_WEEKDAYS,
  addDays,
  buildUpcomingDatedEvents,
  buildWeekCalendarEvents,
  formatEventTime,
  getMondayWeekStart,
  toIsoDate,
  type StudentCalendarEvent,
} from "@/lib/student-calendar";
import { cn, formatDateShort } from "@/lib/utils";

export type DashboardScheduleCalendarProps = {
  weeklySchedule: ScheduleEntry[];
  exams: Exam[];
  projects: Project[];
  className?: string;
};

function WeekDayColumn({
  label,
  dateLabel,
  isToday,
  events,
}: {
  label: string;
  dateLabel: string;
  isToday: boolean;
  events: StudentCalendarEvent[];
}) {
  return (
    <div
      className={cn(
        "min-h-[100px] sm:min-h-[120px] rounded-xl border p-2 flex flex-col gap-1.5",
        isToday ? "border-primary/30 bg-primary/[0.04]" : "border-outline-variant/15 bg-surface-container-lowest"
      )}
    >
      <div className="text-center pb-1 border-b border-outline-variant/10">
        <p
          className={cn(
            "text-[10px] font-semibold uppercase tracking-wide",
            isToday ? "text-primary" : "text-on-surface-variant"
          )}
        >
          {label.slice(0, 3)}
        </p>
        <p className={cn("text-xs font-bold tabular-nums", isToday ? "text-primary" : "text-on-surface")}>{dateLabel}</p>
      </div>
      <div className="flex-1 space-y-1.5 overflow-y-auto max-h-[200px] sm:max-h-[220px]">
        {events.length === 0 ? (
          <p className="text-[10px] text-on-surface-variant/70 text-center py-4">—</p>
        ) : (
          events.map((event) => {
            const style = CALENDAR_KIND_STYLES[event.kind];
            return (
              <div
                key={event.id}
                className={cn("rounded-lg border px-2 py-1.5 text-left", style.card)}
                title={event.subtitle}
              >
                <p className="text-[10px] font-semibold leading-tight line-clamp-2">{event.title}</p>
                {formatEventTime(event) ? (
                  <p className="text-[9px] text-on-surface-variant mt-0.5 tabular-nums">{formatEventTime(event)}</p>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export function DashboardScheduleCalendar({
  weeklySchedule,
  exams,
  projects,
  className,
}: DashboardScheduleCalendarProps) {
  const [weekStart, setWeekStart] = useState(() => getMondayWeekStart());
  const todayIso = toIsoDate(new Date());

  const weekEvents = useMemo(
    () => buildWeekCalendarEvents(weekStart, weeklySchedule, exams, projects),
    [weekStart, weeklySchedule, exams, projects]
  );

  const upcomingEvents = useMemo(
    () => buildUpcomingDatedEvents(exams, projects, new Date()),
    [exams, projects]
  );

  const weekEnd = addDays(weekStart, 6);
  const weekRangeLabel = `${formatDateShort(toIsoDate(weekStart))} — ${formatDateShort(toIsoDate(weekEnd))}`;

  const eventsByDate = useMemo(() => {
    const map = new Map<string, StudentCalendarEvent[]>();
    for (const event of weekEvents) {
      const list = map.get(event.date) ?? [];
      list.push(event);
      map.set(event.date, list);
    }
    return map;
  }, [weekEvents]);

  const shiftWeek = (delta: number) => {
    setWeekStart((prev) => addDays(prev, delta * 7));
  };

  return (
    <section className={cn("rounded-2xl border border-outline-variant/15 bg-surface-container-lowest shadow-sm", className)}>
      <div className="p-4 sm:p-6 border-b border-outline-variant/10">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-on-surface">Your schedule</h2>
              <p className="text-sm text-on-surface-variant mt-0.5">
                Courses, exams, and project deadlines for the week.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => shiftWeek(-1)}
                aria-label="Previous week"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setWeekStart(getMondayWeekStart())}
              >
                This week
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => shiftWeek(1)}
                aria-label="Next week"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm font-semibold text-on-surface w-full sm:w-auto text-center sm:text-right">{weekRangeLabel}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 text-xs text-on-surface-variant mt-4">
          {(Object.keys(CALENDAR_KIND_STYLES) as Array<keyof typeof CALENDAR_KIND_STYLES>).map((kind) => (
            <span key={kind} className="inline-flex items-center gap-1.5">
              <span className={cn("h-2 w-2 rounded-full", CALENDAR_KIND_STYLES[kind].dot)} />
              {CALENDAR_KIND_STYLES[kind].label}
            </span>
          ))}
        </div>
      </div>

      <div className="p-4 sm:p-6">
        <div className="hidden sm:grid sm:grid-cols-7 gap-2">
          {CALENDAR_WEEKDAYS.map((dayName, index) => {
            const date = addDays(weekStart, index);
            const iso = toIsoDate(date);
            return (
              <WeekDayColumn
                key={iso}
                label={dayName}
                dateLabel={String(date.getDate())}
                isToday={iso === todayIso}
                events={eventsByDate.get(iso) ?? []}
              />
            );
          })}
        </div>

        <div className="sm:hidden space-y-2">
          {CALENDAR_WEEKDAYS.map((dayName, index) => {
            const date = addDays(weekStart, index);
            const iso = toIsoDate(date);
            const dayEvents = eventsByDate.get(iso) ?? [];
            return (
              <div
                key={iso}
                className={cn(
                  "rounded-xl border p-3",
                  iso === todayIso ? "border-primary/30 bg-primary/[0.04]" : "border-outline-variant/15"
                )}
              >
                <p className="text-sm font-semibold mb-2">
                  {dayName} · {formatDateShort(iso)}
                </p>
                {dayEvents.length === 0 ? (
                  <p className="text-xs text-on-surface-variant">Nothing scheduled</p>
                ) : (
                  <ul className="space-y-2">
                    {dayEvents.map((event) => {
                      const style = CALENDAR_KIND_STYLES[event.kind];
                      return (
                        <li key={event.id} className={cn("rounded-lg border px-3 py-2 text-sm", style.card)}>
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-medium">{event.title}</span>
                            <span className="text-[10px] uppercase font-semibold text-on-surface-variant shrink-0">
                              {style.label}
                            </span>
                          </div>
                          {event.subtitle ? (
                            <p className="text-xs text-on-surface-variant mt-0.5">{event.subtitle}</p>
                          ) : null}
                          {formatEventTime(event) ? (
                            <p className="text-xs tabular-nums mt-0.5">{formatEventTime(event)}</p>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>

        {weeklySchedule.length === 0 ? (
          <p className="text-sm text-on-surface-variant mt-4 rounded-xl border border-dashed border-outline-variant/20 px-4 py-3">
            No courses on your timetable yet. Your school admin can add them under Class → Content → Schedules.
          </p>
        ) : null}

        <div className="mt-6 pt-5 border-t border-outline-variant/15">
          <h3 className="text-sm font-bold text-on-surface mb-3">Upcoming exams &amp; projects</h3>
          {upcomingEvents.length === 0 ? (
            <p className="text-sm text-on-surface-variant">No upcoming exams or project deadlines.</p>
          ) : (
            <ul className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {upcomingEvents.slice(0, 20).map((event) => {
                const style = CALENDAR_KIND_STYLES[event.kind];
                return (
                  <li
                    key={`upcoming-${event.id}`}
                    className={cn("flex items-center gap-3 rounded-xl border px-3 py-2.5", style.card)}
                  >
                    <div className="text-center shrink-0 w-14">
                      <p className="text-lg font-bold tabular-nums leading-none">{event.date.slice(8, 10)}</p>
                      <p className="text-[10px] font-medium text-on-surface-variant">{formatDateShort(event.date)}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{event.title}</p>
                      <p className="text-xs text-on-surface-variant truncate">{event.subtitle}</p>
                    </div>
                    <span className="text-[10px] font-semibold uppercase text-on-surface-variant shrink-0">
                      {style.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
