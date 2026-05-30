import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { ChevronLeft, ChevronRight, MapPin } from "lucide-react-native";
import { Screen } from "../../../components/screen";
import {
  ErrorBanner,
  LoadingState,
  styles as uiStyles,
} from "../../../components/ui";
import { studentsApi } from "../../../lib/api";
import {
  addDays,
  formatWeekRange,
  getMondayWeekStart,
  scheduleForWeekDay,
  toIsoDate,
  weekdayNameForDate,
} from "../../../lib/student-calendar";
import { colors, radius, spacing } from "../../../theme";
import { useLoader } from "../hooks/useLoader";

function formatTimeShort(time: string) {
  return String(time).slice(0, 5);
}

export function ScheduleWeekScreen() {
  const [weekStart, setWeekStart] = useState(() => getMondayWeekStart());
  const loader = useLoader(() => studentsApi.mySchedules());
  const todayIso = toIsoDate(new Date());

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const date = addDays(weekStart, i);
        return {
          date,
          iso: toIsoDate(date),
          weekday: weekdayNameForDate(date),
          shortLabel: date.toLocaleDateString(undefined, { weekday: "short", day: "numeric" }),
        };
      }),
    [weekStart]
  );

  if (loader.loading && !loader.data) {
    return (
      <Screen variant="stack">
        <LoadingState label="Loading schedule..." />
      </Screen>
    );
  }

  const schedules = loader.data ?? [];

  return (
    <Screen variant="stack" refreshing={loader.loading} onRefresh={loader.load}>
      <Text style={weekStyles.range}>{formatWeekRange(weekStart)}</Text>

      <View style={weekStyles.nav}>
        <Pressable onPress={() => setWeekStart((d) => addDays(d, -7))} style={weekStyles.navBtn}>
          <ChevronLeft color={colors.primary} size={20} />
        </Pressable>
        <Pressable onPress={() => setWeekStart(getMondayWeekStart())}>
          <Text style={weekStyles.navToday}>This week</Text>
        </Pressable>
        <Pressable onPress={() => setWeekStart((d) => addDays(d, 7))} style={weekStyles.navBtn}>
          <ChevronRight color={colors.primary} size={20} />
        </Pressable>
      </View>

      <ErrorBanner message={loader.error} onRetry={loader.load} />

      {days.map(({ iso, weekday, shortLabel }) => {
        const entries = scheduleForWeekDay(schedules, weekday);
        const isToday = iso === todayIso;
        return (
          <View
            key={iso}
            style={[weekStyles.dayBlock, isToday && weekStyles.dayBlockToday]}
          >
            <View style={weekStyles.dayHeader}>
              <View style={[weekStyles.dayDot, isToday && weekStyles.dayDotToday]} />
              <View style={{ flex: 1 }}>
                <Text style={[weekStyles.dayTitle, isToday && weekStyles.dayTitleToday]}>{weekday}</Text>
                <Text style={uiStyles.muted}>{shortLabel}</Text>
              </View>
              {isToday ? <Text style={weekStyles.todayBadge}>Today</Text> : null}
              <Text style={weekStyles.count}>{entries.length} class{entries.length === 1 ? "" : "es"}</Text>
            </View>

            {entries.length ? (
              entries.map((entry, index) => (
                <View
                  key={entry.id}
                  style={[weekStyles.entry, index === entries.length - 1 && weekStyles.entryLast]}
                >
                  <View style={weekStyles.timeBlock}>
                    <Text style={weekStyles.timeStart}>{formatTimeShort(entry.start_time)}</Text>
                    <Text style={weekStyles.timeEnd}>{formatTimeShort(entry.end_time)}</Text>
                  </View>
                  <View style={weekStyles.entryBody}>
                    <Text style={weekStyles.subject}>{entry.subject}</Text>
                    {entry.room ? (
                      <View style={weekStyles.metaRow}>
                        <MapPin color={colors.muted} size={12} />
                        <Text style={weekStyles.meta}>{entry.room}</Text>
                      </View>
                    ) : null}
                    {entry.professor ? <Text style={weekStyles.meta}>{entry.professor}</Text> : null}
                  </View>
                </View>
              ))
            ) : (
              <Text style={[uiStyles.muted, { paddingVertical: spacing.sm }]}>No classes</Text>
            )}
          </View>
        );
      })}
    </Screen>
  );
}

const weekStyles = {
  range: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "600" as const,
    marginBottom: spacing.sm,
  },
  nav: {
    alignItems: "center" as const,
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    marginBottom: spacing.lg,
  },
  navBtn: {
    backgroundColor: colors.surface,
    borderColor: "rgba(194,198,211,0.35)",
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.sm,
  },
  navToday: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "800" as const,
  },
  dayBlock: {
    backgroundColor: colors.surface,
    borderColor: "rgba(194,198,211,0.25)",
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
    overflow: "hidden" as const,
  },
  dayBlockToday: {
    borderColor: colors.primary,
  },
  dayHeader: {
    alignItems: "center" as const,
    backgroundColor: colors.surfaceLow,
    borderBottomColor: "rgba(194,198,211,0.2)",
    borderBottomWidth: 1,
    flexDirection: "row" as const,
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  dayDot: {
    backgroundColor: colors.outline,
    borderRadius: 999,
    height: 10,
    width: 10,
  },
  dayDotToday: {
    backgroundColor: colors.primary,
  },
  dayTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800" as const,
  },
  dayTitleToday: {
    color: colors.primary,
  },
  todayBadge: {
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    color: colors.primary,
    fontSize: 11,
    fontWeight: "800" as const,
    overflow: "hidden" as const,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  count: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600" as const,
  },
  entry: {
    borderBottomColor: "rgba(194,198,211,0.15)",
    borderBottomWidth: 1,
    flexDirection: "row" as const,
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  entryLast: {
    borderBottomWidth: 0,
  },
  timeBlock: {
    width: 52,
  },
  timeStart: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800" as const,
  },
  timeEnd: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 2,
  },
  entryBody: {
    flex: 1,
  },
  subject: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700" as const,
  },
  metaRow: {
    alignItems: "center" as const,
    flexDirection: "row" as const,
    gap: 4,
    marginTop: 4,
  },
  meta: {
    color: colors.muted,
    fontSize: 12,
  },
};
